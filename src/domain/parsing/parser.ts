import type { Bulletin, LignePaie, NatureLigne } from '../types';
import { bareme, parametresPour } from '../referentiel';
import type { BaremeCotisation } from '../referentiel';
import {
  arrondi,
  extraireNombres,
  decouperLigne,
  normaliserTexte,
  procheRelatif,
  versNombre,
} from './montants';
import { reconnaitreLigne } from './normalisation';

const MOIS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

/* ------------------------------------------------------------------ */
/* Interprétation des colonnes d'une ligne                             */
/* ------------------------------------------------------------------ */

interface Colonnes {
  base?: number;
  tauxSalarial?: number;
  montantSalarial?: number;
  tauxPatronal?: number;
  montantPatronal?: number;
}

/**
 * Un taux de cotisation reste sous 100 % ; la borne haute couvre les lignes de
 * mutuelle où la répartition employeur/salarié s'exprime en pourcentage (70/30).
 */
function estTauxPlausible(v: number): boolean {
  return v > 0 && v <= 100;
}

/** Un triplet (base, taux, montant) est-il arithmétiquement cohérent ? */
function tripletCoherent(base: number, taux: number, montant: number): boolean {
  if (!estTauxPlausible(taux)) return false;
  return procheRelatif((base * taux) / 100, montant, 0.03, 0.002);
}

/**
 * Repères de colonnes appris sur les lignes non ambiguës du bulletin.
 * `frontiere` est l'abscisse, en caractères, qui sépare la zone des montants
 * salariaux de celle des montants patronaux.
 */
export interface ReperesColonnes {
  frontiere?: number;
  /** Position, en caractères, de chaque nombre de la ligne analysée. */
  positions?: number[];
}

/**
 * Répartit les nombres d'une ligne de cotisation entre base, taux et montants.
 *
 * Le format standard du bulletin français est :
 *   libellé | base | taux salarial | montant salarial | taux patronal | montant patronal
 * mais chaque éditeur en omet des colonnes. On s'appuie successivement sur :
 *   1. la cohérence arithmétique (base × taux = montant) ;
 *   2. les taux attendus du référentiel, en retenant le côté le plus proche ;
 *   3. la position de la colonne dans la ligne, apprise sur le reste du bulletin ;
 *   4. l'ordre des colonnes, la part salariale précédant la part patronale.
 */
export function interpreterColonnesCotisation(
  valeurs: number[],
  attendu?: BaremeCotisation,
  reperes?: ReperesColonnes,
): Colonnes {
  const n = valeurs.length;
  if (n === 0) return {};

  // 1. Recherche de triplets cohérents, base éventuellement partagée.
  interface Triplet { base: number; taux: number; montant: number; iTaux: number }
  const triplets: Triplet[] = [];
  for (let iTaux = 1; iTaux < n - 0; iTaux++) {
    const iMontant = iTaux + 1;
    if (iMontant >= n) break;
    for (const iBase of iTaux === 1 ? [0] : [iTaux - 1, 0]) {
      if (iBase >= iTaux) continue;
      if (tripletCoherent(valeurs[iBase], valeurs[iTaux], valeurs[iMontant])) {
        triplets.push({
          base: valeurs[iBase], taux: valeurs[iTaux], montant: valeurs[iMontant], iTaux,
        });
        break;
      }
    }
  }
  // On ne conserve pas deux triplets qui se chevauchent.
  const retenus: Triplet[] = [];
  for (const t of triplets) {
    if (retenus.some((r) => Math.abs(r.iTaux - t.iTaux) < 2)) continue;
    retenus.push(t);
  }

  if (retenus.length) {
    const c: Colonnes = { base: retenus[0].base };

    /**
     * Détermine le côté d'un triplet. `null` signifie « indéterminé », auquel
     * cas on retombe sur l'ordre des colonnes.
     */
    const cote = (t: Triplet): 'salarial' | 'patronal' | null => {
      const dSal = attendu?.tauxSalarial !== undefined
        ? Math.abs(t.taux - attendu.tauxSalarial) : Infinity;
      const dPat = attendu?.tauxPatronal !== undefined
        ? Math.abs(t.taux - attendu.tauxPatronal) : Infinity;

      // 1. Un seul côté colle exactement au barème : le doute n'est pas permis.
      if (dSal !== dPat && Math.min(dSal, dPat) < 0.06) return dPat < dSal ? 'patronal' : 'salarial';

      // 2. Sinon la position prime : c'est le seul indice fiable quand le taux
      //    est justement celui qui est erroné, ou qu'il n'a pas de référence.
      const position = reperes?.positions?.[t.iTaux + 1];
      if (reperes?.frontiere !== undefined && position !== undefined) {
        return position >= reperes.frontiere ? 'patronal' : 'salarial';
      }

      // 3. À défaut de position, le côté qui a une référence l'emporte.
      if (dPat < dSal) return 'patronal';
      if (dSal < dPat) return 'salarial';
      return null;
    };

    for (const [i, t] of retenus.entries()) {
      const determine = cote(t);
      const patronal = determine === 'patronal'
        || (determine === null && i > 0 && retenus.length > 1);
      if (patronal && c.montantPatronal === undefined) {
        c.tauxPatronal = t.taux;
        c.montantPatronal = t.montant;
      } else if (c.montantSalarial === undefined) {
        c.tauxSalarial = t.taux;
        c.montantSalarial = t.montant;
      }
    }
    // Colonne de montant restante après le dernier triplet retenu.
    const dernier = retenus[retenus.length - 1];
    if (c.montantPatronal === undefined && dernier.iTaux + 2 < n) {
      c.montantPatronal = valeurs[n - 1];
    }
    return c;
  }

  // 2. Aucun triplet cohérent : affectation positionnelle. Les incohérences
  //    seront remontées par le contrôle arithmétique.
  const versSalarial = attendu?.tauxSalarial !== undefined && attendu.tauxSalarial > 0;
  switch (n) {
    case 1:
      return versSalarial || !attendu ? { montantSalarial: valeurs[0] } : { montantPatronal: valeurs[0] };
    case 2:
      if (estTauxPlausible(valeurs[0]) && !estTauxPlausible(valeurs[1])) {
        return versSalarial
          ? { tauxSalarial: valeurs[0], montantSalarial: valeurs[1] }
          : { tauxPatronal: valeurs[0], montantPatronal: valeurs[1] };
      }
      return { base: valeurs[0], montantSalarial: valeurs[1] };
    case 3: {
      const proximiteSal = attendu?.tauxSalarial !== undefined
        ? Math.abs(valeurs[1] - attendu.tauxSalarial) : Infinity;
      const proximitePat = attendu?.tauxPatronal !== undefined
        ? Math.abs(valeurs[1] - attendu.tauxPatronal) : Infinity;
      return proximitePat < proximiteSal
        ? { base: valeurs[0], tauxPatronal: valeurs[1], montantPatronal: valeurs[2] }
        : { base: valeurs[0], tauxSalarial: valeurs[1], montantSalarial: valeurs[2] };
    }
    case 4:
      return {
        base: valeurs[0],
        tauxSalarial: valeurs[1],
        montantSalarial: valeurs[2],
        montantPatronal: valeurs[3],
      };
    default:
      return {
        base: valeurs[0],
        tauxSalarial: valeurs[1],
        montantSalarial: valeurs[2],
        tauxPatronal: valeurs[3],
        montantPatronal: valeurs[4],
      };
  }
}

/** Répartit les nombres d'une ligne de rémunération : nombre, taux unitaire, montant. */
export function interpreterColonnesRemuneration(valeurs: number[]): {
  nombre?: number; tauxUnitaire?: number; montant?: number;
} {
  const n = valeurs.length;
  if (n === 0) return {};
  if (n === 1) return { montant: valeurs[0] };

  for (let i = 0; i + 2 < n + 1; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (procheRelatif(valeurs[i] * valeurs[j], valeurs[k], 0.03, 0.002)) {
          return { nombre: valeurs[i], tauxUnitaire: valeurs[j], montant: valeurs[k] };
        }
      }
    }
  }
  if (n === 2) return { nombre: valeurs[0], montant: valeurs[1] };
  return { nombre: valeurs[0], tauxUnitaire: valeurs[1], montant: valeurs[n - 1] };
}

/* ------------------------------------------------------------------ */
/* En-tête du bulletin                                                 */
/* ------------------------------------------------------------------ */

export interface PeriodeDetectee { annee: number; mois: number }

export function detecterPeriode(texte: string): PeriodeDetectee | null {
  const t = normaliserTexte(texte);

  // « Période du 01/07/2025 au 31/07/2025 »
  const plage = t.match(/periode\s*(?:de paie\s*)?(?:du)?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*(?:au|a)\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (plage) return { annee: Number(plage[6]), mois: Number(plage[5]) };

  // « Bulletin de paie — Juillet 2025 »
  const nomMois = t.match(new RegExp(`\\b(${MOIS_FR.join('|')})\\s+(\\d{4})\\b`));
  if (nomMois) return { annee: Number(nomMois[2]), mois: MOIS_FR.indexOf(nomMois[1]) + 1 };

  // « Paie 07/2025 »
  const numerique = t.match(/\b(0[1-9]|1[0-2])[/.-](20\d{2})\b/);
  if (numerique) return { annee: Number(numerique[2]), mois: Number(numerique[1]) };

  // Date de paiement en fin de bulletin.
  const dateSeule = t.match(/\b(\d{1,2})[/.-](0[1-9]|1[0-2])[/.-](20\d{2})\b/);
  if (dateSeule) return { annee: Number(dateSeule[3]), mois: Number(dateSeule[2]) };

  return null;
}

function capturerApres(lignes: string[], motif: RegExp): string | undefined {
  for (const ligne of lignes) {
    const m = ligne.match(motif);
    if (m) {
      const reste = ligne.slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-–|]+/, '').trim();
      if (reste) return reste.split(/\s{3,}|\s\|\s/)[0].trim();
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Analyse complète                                                    */
/* ------------------------------------------------------------------ */

/** Lignes de totaux qui ne doivent pas être comptées comme des lignes de paie. */
const CODES_TOTAUX = new Set([
  'TOTAL_BRUT', 'NET_SOCIAL', 'NET_IMPOSABLE', 'NET_A_PAYER', 'NET_AVANT_IMPOT',
  'TOTAL_COT_SALARIALES', 'TOTAL_COT_PATRONALES', 'COUT_EMPLOYEUR', 'ALLEGEMENTS',
]);

/**
 * Lignes d'identification (SIRET, dates, coordonnées, pagination) qui portent
 * des nombres sans être des lignes de paie. Sans ce filtre, un SIRET ou une
 * période se retrouverait interprété comme un montant.
 */
const MOTS_ENTETE =
  /\b(siret|siren|urssaf|n\s?secu|numero de securite|periode|paiement|virement|bulletin de paie|page|code ape|naf|idcc|convention|matricule|effectif|adresse|telephone|email|coefficient|classification|date d|emploi|qualification|horaire mensuel|entree|sortie|anciennete|mode de reglement|conserver)\b/;

const MOTIF_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/;

/** Bloc de cumuls annuels : lu séparément, jamais comme une ligne de paie. */
const MOTIF_CUMUL = /\bcumul|\bdepuis le debut\b/;

/**
 * Ligne de compteur de congés (« acquis / pris / solde »), à distinguer d'une
 * véritable ligne d'indemnité de congés payés qui, elle, entre dans le brut.
 */
export function estCompteurConges(ligne: string): boolean {
  const t = normaliserTexte(ligne);
  if (!/(conges|\bcp\b|\brtt\b|repos)/.test(t)) return false;
  const compteurs = ['acquis', 'pris', 'solde', 'restant', 'droits', 'en cours'];
  return compteurs.filter((c) => t.includes(c)).length >= 2;
}

export function estLigneNonPaie(libelle: string, ligne: string, valeurs: number[]): boolean {
  const t = normaliserTexte(libelle);
  if (MOTS_ENTETE.test(t)) return true;
  if (MOTIF_DATE.test(ligne)) return true;
  // Un identifiant long (SIRET, IBAN, matricule) n'est pas un montant.
  if (valeurs.length && valeurs.every((v) => Number.isInteger(v) && Math.abs(v) >= 100000)) return true;
  return false;
}

export interface OptionsParsing {
  nomFichier?: string;
  source?: Bulletin['source'];
  /** Période forcée par l'utilisateur si la détection échoue. */
  periode?: PeriodeDetectee;
}

export function analyserLignes(lignes: string[], options: OptionsParsing = {}): Bulletin {
  const texteBrut = lignes.join('\n');
  // L'alignement des colonnes est une information : on conserve les espaces
  // internes, seuls les blancs de fin sont supprimés.
  const lignesNettes = lignes
    .map((l) => l.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0);

  const periode = options.periode ?? detecterPeriode(texteBrut) ?? {
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1,
  };
  const params = parametresPour(periode.annee, periode.mois);

  const bulletin: Bulletin = {
    id: `${periode.annee}-${String(periode.mois).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8)}`,
    nomFichier: options.nomFichier ?? 'bulletin',
    annee: periode.annee,
    mois: periode.mois,
    salarie: {},
    employeur: {},
    contrat: {},
    heures: { supplementaires: [], complementaires: [] },
    totaux: {},
    lignes: [],
    texteBrut,
    qualiteExtraction: 0,
    champsManquants: [],
    source: options.source ?? 'pdf',
    importeLe: new Date().toISOString(),
  };

  lireEntete(bulletin, lignesNettes, texteBrut);

  // Premier passage : repérage des lignes exploitables.
  interface Candidat {
    index: number;
    ligne: string;
    libelle: string;
    localises: ReturnType<typeof extraireNombres>;
    valeurs: number[];
    code: string | null;
    nature: NatureLigne;
  }
  const candidats: Candidat[] = [];

  for (const [index, ligne] of lignesNettes.entries()) {
    const { libelle, nombres: localises } = decouperLigne(ligne);
    if (!libelle || libelle.length < 3) continue;
    if (!localises.length) continue;
    const valeurs = localises.map((x) => x.valeur);

    if (MOTIF_CUMUL.test(normaliserTexte(libelle)) || estCompteurConges(ligne)) continue;

    const reconnu = reconnaitreLigne(libelle);
    if (!reconnu && estLigneNonPaie(libelle, ligne, valeurs)) continue;
    const code = reconnu?.code ?? null;

    if (code && CODES_TOTAUX.has(code)) {
      affecterTotal(bulletin, code, valeurs, ligne);
      continue;
    }
    if (code === 'PAS') {
      affecterPrelevementSource(bulletin, valeurs);
      bulletin.lignes.push({
        code, libelle, nature: 'retenue', montant: valeurs[valeurs.length - 1], ligneSource: index,
      });
      continue;
    }
    candidats.push({
      index, ligne, libelle, localises, valeurs, code,
      nature: reconnu?.nature ?? devinerNature(valeurs),
    });
  }

  // Deuxième passage : apprentissage de la frontière entre colonnes salariale
  // et patronale, à partir des seules lignes que le barème permet de trancher.
  const frontiere = apprendreFrontiereColonnes(candidats, params);

  for (const c of candidats) {
    const lignePaie: LignePaie = {
      code: c.code, libelle: c.libelle, nature: c.nature, ligneSource: c.index,
    };
    if (c.nature === 'cotisation' || c.nature === 'exoneration') {
      const attendu = c.code ? bareme(params, c.code) : undefined;
      Object.assign(
        lignePaie,
        interpreterColonnesCotisation(c.valeurs, attendu, {
          frontiere,
          positions: c.localises.map((x) => x.index),
        }),
      );
    } else {
      Object.assign(lignePaie, interpreterColonnesRemuneration(c.valeurs));
    }
    bulletin.lignes.push(lignePaie);
  }

  consoliderHeures(bulletin);
  consoliderConges(bulletin, lignesNettes);
  lireCumuls(bulletin, lignesNettes);
  bulletin.qualiteExtraction = evaluerQualite(bulletin);
  bulletin.champsManquants = listerChampsManquants(bulletin);
  return bulletin;
}

/**
 * Apprend l'abscisse qui sépare la colonne des montants salariaux de celle des
 * montants patronaux.
 *
 * On ne se fie qu'aux lignes dont le barème identifie le côté sans ambiguïté :
 * elles servent d'étalon pour les lignes à taux variable (accident du travail,
 * versement mobilité) ou à taux majoré, où le seul indice est la position.
 */
function apprendreFrontiereColonnes(
  candidats: { localises: { valeur: number; index: number }[]; code: string | null; nature: NatureLigne }[],
  params: ReturnType<typeof parametresPour>,
): number | undefined {
  const positionsSalariales: number[] = [];
  const positionsPatronales: number[] = [];

  for (const c of candidats) {
    if (c.nature !== 'cotisation' || !c.code) continue;
    const attendu = bareme(params, c.code);
    if (!attendu || attendu.tauxVariable) continue;

    for (let i = 1; i + 1 < c.localises.length; i++) {
      const taux = c.localises[i].valeur;
      const montant = c.localises[i + 1];
      if (!estTauxPlausible(taux)) continue;
      const base = c.localises[0].valeur;
      if (!tripletCoherent(base, taux, montant.valeur)) continue;

      const versSalarial = attendu.tauxSalarial !== undefined
        && Math.abs(taux - attendu.tauxSalarial) < 0.06;
      const versPatronal = attendu.tauxPatronal !== undefined
        && Math.abs(taux - attendu.tauxPatronal) < 0.06;
      if (versSalarial && !versPatronal) positionsSalariales.push(montant.index);
      else if (versPatronal && !versSalarial) positionsPatronales.push(montant.index);
    }
  }

  if (!positionsSalariales.length || !positionsPatronales.length) return undefined;
  const maxSalarial = Math.max(...positionsSalariales);
  const minPatronal = Math.min(...positionsPatronales);
  // Colonnes qui se chevauchent : la position n'est pas un indice fiable.
  if (minPatronal <= maxSalarial) return undefined;
  return (maxSalarial + minPatronal) / 2;
}

function devinerNature(nombres: number[]): NatureLigne {
  return nombres.length >= 3 ? 'cotisation' : 'remuneration';
}

function lireEntete(bulletin: Bulletin, lignes: string[], texte: string) {
  const t = normaliserTexte(texte);

  const siret = texte.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/);
  if (siret) bulletin.employeur.siret = siret[1].replace(/[\s.]/g, '');

  const ape = texte.match(/\b(\d{4}[A-Z])\b/);
  if (ape) bulletin.employeur.codeApe = ape[1];

  const idcc = t.match(/idcc\s*:?\s*(\d{3,4})/);
  if (idcc) bulletin.employeur.idcc = idcc[1];

  bulletin.employeur.conventionCollective =
    capturerApres(lignes, /convention collective\s*(nationale)?/i);
  bulletin.salarie.matricule = capturerApres(lignes, /matricule/i);
  bulletin.salarie.emploi = capturerApres(lignes, /\b(emploi|poste|fonction)\b/i);
  bulletin.salarie.qualification = capturerApres(lignes, /\b(qualification|classification)\b/i);
  bulletin.salarie.niveauCoefficient = capturerApres(lignes, /\b(coefficient|niveau|indice)\b/i);

  if (/\bnon.?cadre\b/.test(t)) bulletin.salarie.statutCadre = false;
  else if (/\bcadre\b/.test(t)) bulletin.salarie.statutCadre = true;

  if (/temps partiel/.test(t)) bulletin.salarie.tempsPartiel = true;
  else if (/temps (complet|plein)/.test(t)) bulletin.salarie.tempsPartiel = false;

  const horaire = t.match(/(?:horaire|base|duree)\s*(?:mensuel\w*|de travail)?\s*:?\s*(\d{1,3}[.,]\d{1,2})\s*(?:h|heures)?/);
  if (horaire) bulletin.salarie.horaireMensuel = versNombre(horaire[1]) ?? undefined;

  // « taxe d'apprentissage » ne doit pas être lue comme un contrat d'apprentissage.
  if (/\bcdd\b|duree determinee/.test(t)) bulletin.contrat.type = 'CDD';
  else if (/\bapprenti\b|\bapprentie\b|contrat d apprentissage/.test(t)) bulletin.contrat.type = 'APPRENTISSAGE';
  else if (/contrat de professionnalisation/.test(t)) bulletin.contrat.type = 'PROFESSIONNALISATION';
  else if (/\bcdi\b|duree indeterminee/.test(t)) bulletin.contrat.type = 'CDI';

  const entree = t.match(/(?:date d )?(?:entree|embauche|anciennete)\s*:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (entree) {
    bulletin.salarie.dateEntree = `${entree[3]}-${entree[2].padStart(2, '0')}-${entree[1].padStart(2, '0')}`;
    const debut = new Date(bulletin.salarie.dateEntree);
    const ref = new Date(bulletin.annee, bulletin.mois - 1, 1);
    bulletin.salarie.ancienneteMois = Math.max(
      0,
      (ref.getFullYear() - debut.getFullYear()) * 12 + (ref.getMonth() - debut.getMonth()),
    );
  }

  if (/\b(57|67|68)\b/.test(t) && /(moselle|bas.rhin|haut.rhin|alsace)/.test(t)) {
    bulletin.employeur.alsaceMoselle = true;
  }

  const effectif = t.match(/effectif\s*(?:de l entreprise)?\s*:?\s*(\d{1,6})/);
  if (effectif) bulletin.employeur.effectif = Number(effectif[1]);

  const raison = lignes.find((l) =>
    /\b(sarl|sas|sasu|sa\b|eurl|snc|scop|sci|association|groupe)\b/i.test(l) && l.length < 80);
  if (raison) bulletin.employeur.raisonSociale = raison.trim();
}

function affecterTotal(bulletin: Bulletin, code: string, nombres: number[], _ligne: string) {
  const dernier = nombres[nombres.length - 1];
  const t = bulletin.totaux;
  switch (code) {
    case 'TOTAL_BRUT': if (t.brut === undefined) t.brut = dernier; break;
    case 'NET_SOCIAL': if (t.netSocial === undefined) t.netSocial = dernier; break;
    case 'NET_IMPOSABLE': if (t.netImposable === undefined) t.netImposable = nombres[0]; break;
    case 'NET_AVANT_IMPOT': if (t.netAvantImpot === undefined) t.netAvantImpot = dernier; break;
    case 'NET_A_PAYER': if (t.netAPayer === undefined) t.netAPayer = dernier; break;
    case 'TOTAL_COT_SALARIALES':
      if (t.totalCotisationsSalariales === undefined) t.totalCotisationsSalariales = nombres[0];
      if (nombres.length > 1 && t.totalCotisationsPatronales === undefined) {
        t.totalCotisationsPatronales = nombres[nombres.length - 1];
      }
      break;
    case 'TOTAL_COT_PATRONALES':
      if (t.totalCotisationsPatronales === undefined) t.totalCotisationsPatronales = dernier;
      break;
    case 'COUT_EMPLOYEUR': if (t.coutTotalEmployeur === undefined) t.coutTotalEmployeur = dernier; break;
    case 'ALLEGEMENTS': if (t.allegementsPatronaux === undefined) t.allegementsPatronaux = Math.abs(dernier); break;
  }
}

function affecterPrelevementSource(bulletin: Bulletin, nombres: number[]) {
  const t = bulletin.totaux;
  if (nombres.length >= 3) {
    t.tauxPrelevementSource = nombres[1];
    t.prelevementSource = Math.abs(nombres[2]);
  } else if (nombres.length === 2) {
    t.tauxPrelevementSource = nombres[0];
    t.prelevementSource = Math.abs(nombres[1]);
  } else if (nombres.length === 1) {
    t.prelevementSource = Math.abs(nombres[0]);
  }
}

function consoliderHeures(bulletin: Bulletin) {
  for (const l of bulletin.lignes) {
    const majoration =
      l.code === 'HEURES_SUPP_25' ? 25 : l.code === 'HEURES_SUPP_50' ? 50 : null;
    if (majoration && l.nombre) {
      bulletin.heures.supplementaires.push({
        majoration, nombre: l.nombre, montant: l.montant ?? 0, libelle: l.libelle,
      });
    }
    if (l.code === 'HEURES_COMPLEMENTAIRES' && l.nombre) {
      bulletin.heures.complementaires.push({
        majoration: l.tauxUnitaire ? 0 : 10, nombre: l.nombre, montant: l.montant ?? 0, libelle: l.libelle,
      });
    }
    if (l.code === 'SALAIRE_BASE' && l.nombre && l.nombre > 20 && l.nombre < 400) {
      bulletin.heures.normales = l.nombre;
    }
    if (l.code === 'ABSENCE' && l.nombre) {
      bulletin.heures.absences = (bulletin.heures.absences ?? 0) + Math.abs(l.nombre);
    }
  }
}

function consoliderConges(bulletin: Bulletin, lignes: string[]) {
  const ligneCp = lignes.find((l) => {
    const t = normaliserTexte(l);
    return /(conges|cp)\b/.test(t) && /(acquis|solde|restant|pris)/.test(t);
  });
  if (!ligneCp) return;
  const nombres = extraireNombres(ligneCp).map((x) => x.valeur);
  if (!nombres.length) return;
  const t = normaliserTexte(ligneCp);
  bulletin.conges = {
    acquisPeriodeN: nombres[0],
    prisPeriodeN: nombres.length > 2 ? nombres[1] : undefined,
    soldeN: nombres[nombres.length - 1],
    unite: /ouvre(s|)\b/.test(t) && !/ouvrable/.test(t) ? 'ouvres' : 'ouvrables',
  };
}

/** Bloc « cumuls annuels » présent en pied de bulletin. */
function lireCumuls(bulletin: Bulletin, lignes: string[]) {
  for (const ligne of lignes) {
    const t = normaliserTexte(ligne);
    if (!/cumul|annuel|depuis le debut/.test(t)) continue;
    const valeurs = extraireNombres(ligne).map((x) => x.valeur).filter((v) => v > 0);
    if (!valeurs.length) continue;
    bulletin.cumuls ??= {};
    if (/brut/.test(t) && bulletin.cumuls.brutAnnuel === undefined) {
      bulletin.cumuls.brutAnnuel = Math.max(...valeurs);
    }
    if (/imposable|fiscal/.test(t) && bulletin.cumuls.netImposableAnnuel === undefined) {
      bulletin.cumuls.netImposableAnnuel = Math.max(...valeurs);
    }
    if (/heures? sup/.test(t) && bulletin.cumuls.heuresSuppAnnuelles === undefined) {
      bulletin.cumuls.heuresSuppAnnuelles = valeurs[0];
    }
  }
}

function evaluerQualite(bulletin: Bulletin): number {
  let score = 0;
  const t = bulletin.totaux;
  if (t.brut !== undefined) score += 0.25;
  if (t.netAPayer !== undefined) score += 0.2;
  if (t.netImposable !== undefined) score += 0.1;
  if (t.totalCotisationsSalariales !== undefined) score += 0.1;
  const cotisationsReconnues = bulletin.lignes.filter((l) => l.nature === 'cotisation' && l.code).length;
  score += Math.min(cotisationsReconnues / 10, 1) * 0.25;
  if (bulletin.lignes.some((l) => l.code === 'SALAIRE_BASE')) score += 0.1;
  return arrondi(Math.min(score, 1), 2);
}

function listerChampsManquants(bulletin: Bulletin): string[] {
  const manquants: string[] = [];
  const t = bulletin.totaux;
  if (t.brut === undefined) manquants.push('Salaire brut');
  if (t.netAPayer === undefined) manquants.push('Net à payer');
  if (t.netImposable === undefined) manquants.push('Net imposable');
  if (t.netSocial === undefined) manquants.push('Montant net social');
  if (t.totalCotisationsSalariales === undefined) manquants.push('Total des cotisations salariales');
  return manquants;
}
