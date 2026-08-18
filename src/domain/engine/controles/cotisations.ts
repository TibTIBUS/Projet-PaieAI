import type { Anomalie } from '../../types';
import { arrondi } from '../../parsing/montants';
import { bareme } from '../../referentiel';
import type { BaremeCotisation } from '../../referentiel';
import type { Controle, ContexteControle } from '../types';
import {
  aUneLigne, brut, effectif, euros, finaliser, ligneParCode, pourcent,
  REF_PRESCRIPTION, severiteSelonEcart,
} from '../utils';

/** Tolérance par défaut sur un taux, en points de pourcentage. */
const TOLERANCE_TAUX = 0.02;

/** Le barème s'applique-t-il à ce bulletin ? */
function baremeApplicable(b: BaremeCotisation, ctx: ContexteControle): boolean {
  const eff = effectif(ctx);
  if (b.effectifMin !== undefined && (eff === undefined || eff < b.effectifMin)) return false;
  if (b.effectifMax !== undefined && (eff === undefined || eff > b.effectifMax)) return false;
  if (b.cadresUniquement && ctx.bulletin.salarie.statutCadre === false) return false;
  if (b.alsaceMoselle && !(ctx.options.alsaceMoselle ?? ctx.bulletin.employeur.alsaceMoselle)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* COT-01 / COT-02 — taux hors barème                                  */
/* ------------------------------------------------------------------ */

export const controleTauxCotisations: Controle = {
  code: 'COT-01',
  nom: 'Conformité des taux de cotisations',
  categorie: 'cotisations',
  description:
    'Compare chaque taux de cotisation figurant sur le bulletin au taux légal ou conventionnel en vigueur sur la période.',
  references: [
    { texte: 'Articles D.242-3 et suivants du Code de la sécurité sociale' },
    { texte: 'Accord national interprofessionnel Agirc-Arrco' },
  ],
  executer(ctx) {
    const { bulletin, params } = ctx;
    const anomalies: Anomalie[] = [];

    for (const ligne of bulletin.lignes) {
      if (ligne.nature !== 'cotisation' || !ligne.code) continue;
      const attendu = bareme(params, codeSelonEffectif(ligne.code, ctx));
      if (!attendu || attendu.tauxVariable) continue;
      if (!baremeApplicable(attendu, ctx)) continue;

      for (const cote of ['salarial', 'patronal'] as const) {
        const constate = cote === 'salarial' ? ligne.tauxSalarial : ligne.tauxPatronal;
        const reference = cote === 'salarial' ? attendu.tauxSalarial : attendu.tauxPatronal;
        if (constate === undefined || reference === undefined) continue;

        const tolerance = attendu.tolerance ?? TOLERANCE_TAUX;
        const ecartTaux = arrondi(constate - reference, 3);
        if (Math.abs(ecartTaux) <= tolerance) continue;

        // Cas particuliers documentés : taux majorés selon le niveau de rémunération.
        if (exceptionTauxMajore(ligne.code, constate, ctx)) continue;

        const base = ligne.base ?? brut(bulletin) ?? 0;
        const impact = arrondi((base * ecartTaux) / 100);
        const confianceBase = attendu.fiabilite === 'verifie' ? 'certaine' : 'a_verifier';

        anomalies.push(
          finaliser(
            {
              code: cote === 'salarial' ? 'COT-01' : 'COT-02',
              controle: this.nom,
              titre: `Taux ${cote} incorrect sur « ${ligne.libelle} »`,
              severite: cote === 'salarial' ? severiteSelonEcart(impact) : 'mineure',
              categorie: 'cotisations',
              confiance: confianceBase,
              explication:
                cote === 'salarial'
                  ? ecartTaux > 0
                    ? `Le taux appliqué (${pourcent(constate)}) dépasse le taux en vigueur (${pourcent(reference)}). ` +
                      `Vous payez ${euros(Math.abs(impact))} de trop chaque mois sur cette seule ligne.`
                    : `Le taux appliqué (${pourcent(constate)}) est inférieur au taux en vigueur (${pourcent(reference)}). ` +
                      `Une régularisation à votre défaveur est possible.`
                  : `La part employeur est calculée à ${pourcent(constate)} au lieu de ${pourcent(reference)}. ` +
                    'Sans effet sur votre net, mais révélateur d’un paramétrage erroné.',
              detail:
                `Taux attendu ${pourcent(reference)} — taux constaté ${pourcent(constate)} ` +
                `(écart de ${ecartTaux} point) sur une base de ${euros(base)}. ` +
                `Référence : ${attendu.reference ?? attendu.libelle}.` +
                (attendu.fiabilite !== 'verifie'
                  ? ' ⚠️ Ce taux de référence n’est pas vérifié pour la période : à confirmer.'
                  : ''),
              attendu: reference,
              constate,
              ecart: ecartTaux,
              impactMensuel: cote === 'salarial' && impact > 0 ? impact : undefined,
              references: [
                { texte: attendu.reference ?? 'Barème des cotisations sociales' },
                REF_PRESCRIPTION,
              ],
              actions: [
                'Demandez au service paie sur quel texte s’appuie ce taux.',
                'En cas de trop-prélevé confirmé, réclamez le remboursement sur les trois dernières années.',
              ],
              lignesConcernees: [ligne.libelle],
            },
            params,
          ),
        );
      }
    }
    return anomalies;
  },
};

/**
 * Certaines cotisations changent de barème selon l'effectif : le libellé du
 * bulletin ne permet pas de les distinguer, seul l'effectif tranche.
 */
function codeSelonEffectif(code: string, ctx: ContexteControle): string {
  const eff = effectif(ctx);
  if (eff === undefined) return code;
  if (code === 'FNAL_MOINS_50' && eff >= 50) return 'FNAL_50_PLUS';
  if (code === 'FNAL_50_PLUS' && eff < 50) return 'FNAL_MOINS_50';
  if (code === 'FORMATION_MOINS_11' && eff >= 11) return 'FORMATION_11_PLUS';
  if (code === 'FORMATION_11_PLUS' && eff < 11) return 'FORMATION_MOINS_11';
  return code;
}

/**
 * Taux légitimement majorés selon le niveau de rémunération :
 *  - maladie patronale : 13 % au-delà de 2,5 SMIC ;
 *  - allocations familiales : 5,25 % au-delà de 3,5 SMIC.
 */
function exceptionTauxMajore(code: string, constate: number, ctx: ContexteControle): boolean {
  const { params, bulletin } = ctx;
  const remuneration = brut(bulletin) ?? 0;
  if (code === 'MALADIE' && Math.abs(constate - 13) < 0.05) {
    return remuneration > params.smicMensuel * 2.5;
  }
  if (code === 'ALLOCATIONS_FAMILIALES' && Math.abs(constate - 5.25) < 0.05) {
    return remuneration > params.smicMensuel * 3.5;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* COT-03 — cotisation obligatoire absente                             */
/* ------------------------------------------------------------------ */

/** Cotisations qui doivent figurer sur tout bulletin du régime général. */
const COTISATIONS_ATTENDUES: { codes: string[]; libelle: string; motif: string }[] = [
  {
    codes: ['VIEILLESSE_PLAFONNEE'],
    libelle: 'Assurance vieillesse plafonnée',
    motif: 'Elle ouvre vos droits à la retraite de base : son absence ampute vos trimestres et votre salaire annuel moyen.',
  },
  {
    codes: ['VIEILLESSE_DEPLAFONNEE'],
    libelle: 'Assurance vieillesse déplafonnée',
    motif: 'Cotisation due sur la totalité du salaire, quelle que soit la rémunération.',
  },
  {
    codes: ['RETRAITE_COMP_T1'],
    libelle: 'Retraite complémentaire Agirc-Arrco tranche 1',
    motif: 'Elle finance vos points de retraite complémentaire : son absence réduit directement votre future pension.',
  },
  {
    codes: ['CEG_T1'],
    libelle: 'Contribution d’équilibre général',
    motif: 'Contribution obligatoire adossée à la retraite complémentaire.',
  },
  {
    codes: ['CSG_DEDUCTIBLE'],
    libelle: 'CSG déductible',
    motif: 'Contribution obligatoire sur tous les revenus d’activité.',
  },
  {
    codes: ['CSG_CRDS_NON_DEDUCTIBLE', 'CSG_NON_DEDUCTIBLE', 'CRDS'],
    libelle: 'CSG/CRDS non déductible',
    motif: 'Contribution obligatoire sur tous les revenus d’activité.',
  },
];

export const controleCotisationsAbsentes: Controle = {
  code: 'COT-03',
  nom: 'Présence des cotisations obligatoires',
  categorie: 'cotisations',
  description:
    'Vérifie que les cotisations obligatoires du régime général figurent bien sur le bulletin.',
  references: [
    { texte: 'Article R.3243-1 du Code du travail' },
    { texte: 'Article L.242-1 du Code de la sécurité sociale' },
  ],
  applicable: ({ bulletin }) =>
    bulletin.contrat.type === 'APPRENTISSAGE'
      ? 'Les contrats d’apprentissage bénéficient d’exonérations spécifiques : contrôle écarté.'
      : bulletin.lignes.filter((l) => l.nature === 'cotisation').length < 4
        ? 'Trop peu de lignes de cotisations lues pour conclure de manière fiable.'
        : null,
  executer({ bulletin, params }) {
    const anomalies: Anomalie[] = [];
    for (const attendue of COTISATIONS_ATTENDUES) {
      if (aUneLigne(bulletin, ...attendue.codes)) continue;
      anomalies.push(
        finaliser(
          {
            code: 'COT-03',
            controle: this.nom,
            titre: `Cotisation absente : ${attendue.libelle}`,
            severite: 'majeure',
            categorie: 'cotisations',
            confiance: 'probable',
            explication:
              `Aucune ligne « ${attendue.libelle} » n’a été identifiée sur ce bulletin. ${attendue.motif}`,
            detail:
              'Soit la cotisation est réellement absente, soit son libellé n’a pas été reconnu par l’analyse. ' +
              'Vérifiez visuellement le bulletin avant toute démarche.',
            references: [
              { texte: 'Article L.242-1 du Code de la sécurité sociale' },
              { texte: 'Article R.3243-1 du Code du travail' },
            ],
            actions: [
              'Vérifiez la présence de cette cotisation sur le bulletin papier.',
              'Si elle est bien absente, interrogez l’employeur : le défaut de cotisation engage sa responsabilité.',
              'Contrôlez votre relevé de carrière sur info-retraite.fr.',
            ],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

/* ------------------------------------------------------------------ */
/* COT-04 — cotisation salariale indue                                 */
/* ------------------------------------------------------------------ */

export const controleCotisationsIndues: Controle = {
  code: 'COT-04',
  nom: 'Cotisations salariales indues',
  categorie: 'cotisations',
  description:
    'Détecte les retenues salariales qui ne devraient pas exister, comme une cotisation maladie salariale hors Alsace-Moselle.',
  references: [{ texte: 'Article D.242-3 du Code de la sécurité sociale' }],
  executer(ctx) {
    const { bulletin, params, options } = ctx;
    const anomalies: Anomalie[] = [];
    const enAlsaceMoselle = options.alsaceMoselle ?? bulletin.employeur.alsaceMoselle ?? false;

    // Cotisation maladie salariale : nulle hors Alsace-Moselle.
    const maladie = ligneParCode(bulletin, 'MALADIE');
    if (maladie?.montantSalarial && maladie.montantSalarial > 0.5 && !enAlsaceMoselle) {
      anomalies.push(
        finaliser(
          {
            code: 'COT-04',
            controle: this.nom,
            titre: 'Retenue salariale d’assurance maladie hors Alsace-Moselle',
            severite: 'majeure',
            categorie: 'cotisations',
            confiance: 'probable',
            explication:
              `Une retenue maladie de ${euros(maladie.montantSalarial)} figure sur votre bulletin. ` +
              'La cotisation salariale d’assurance maladie a été supprimée en 2018 dans le régime général : ' +
              'elle ne subsiste qu’en Alsace-Moselle, au taux de 1,30 %.',
            detail:
              `Retenue constatée : ${euros(maladie.montantSalarial)}` +
              (maladie.tauxSalarial ? ` au taux de ${pourcent(maladie.tauxSalarial)}.` : '.'),
            constate: maladie.montantSalarial,
            attendu: 0,
            ecart: maladie.montantSalarial,
            impactMensuel: maladie.montantSalarial,
            references: [
              { texte: 'Article D.242-3 du Code de la sécurité sociale' },
              { texte: 'Article D.242-25 du Code de la sécurité sociale — régime local d’Alsace-Moselle' },
              REF_PRESCRIPTION,
            ],
            actions: [
              'Vérifiez si votre établissement relève du régime local d’Alsace-Moselle (Bas-Rhin, Haut-Rhin, Moselle).',
              'Si ce n’est pas le cas, réclamez le remboursement des retenues des trois dernières années.',
            ],
            lignesConcernees: [maladie.libelle],
          },
          params,
        ),
      );
    }

    // CET : due uniquement au-delà du plafond mensuel.
    const cet = ligneParCode(bulletin, 'CET');
    const remuneration = brut(bulletin);
    if (cet?.montantSalarial && remuneration !== undefined && remuneration <= params.plafondMensuelSS) {
      anomalies.push(
        finaliser(
          {
            code: 'COT-04b',
            controle: this.nom,
            titre: 'Contribution d’équilibre technique prélevée sous le plafond',
            severite: 'mineure',
            categorie: 'cotisations',
            confiance: 'probable',
            explication:
              'La contribution d’équilibre technique n’est due que par les salariés dont la rémunération dépasse ' +
              `le plafond mensuel de la Sécurité sociale (${euros(params.plafondMensuelSS)}). ` +
              `Votre brut est de ${euros(remuneration)}.`,
            detail: `Retenue constatée : ${euros(cet.montantSalarial)} pour un brut de ${euros(remuneration)}.`,
            constate: cet.montantSalarial,
            attendu: 0,
            impactMensuel: cet.montantSalarial,
            references: [{ texte: 'Accord national interprofessionnel Agirc-Arrco — contribution d’équilibre technique' }],
            actions: ['Demandez la suppression de cette ligne et la régularisation des mois concernés.'],
            lignesConcernees: [cet.libelle],
          },
          params,
        ),
      );
    }

    // APEC : réservée aux cadres.
    const apec = ligneParCode(bulletin, 'APEC');
    if (apec?.montantSalarial && bulletin.salarie.statutCadre === false) {
      anomalies.push(
        finaliser(
          {
            code: 'COT-04c',
            controle: this.nom,
            titre: 'Cotisation APEC prélevée sur un bulletin non-cadre',
            severite: 'mineure',
            categorie: 'cotisations',
            confiance: 'probable',
            explication:
              'La cotisation APEC est réservée aux salariés relevant du statut cadre ou assimilé. ' +
              'Votre bulletin porte la mention « non cadre ».',
            detail: `Retenue constatée : ${euros(apec.montantSalarial)}.`,
            constate: apec.montantSalarial,
            attendu: 0,
            impactMensuel: apec.montantSalarial,
            references: [{ texte: 'Convention nationale APEC du 18 novembre 1966' }],
            actions: ['Faites confirmer votre statut : cadre, assimilé cadre ou non-cadre.'],
            lignesConcernees: [apec.libelle],
          },
          params,
        ),
      );
    }
    return anomalies;
  },
};

export const CONTROLES_COTISATIONS: Controle[] = [
  controleTauxCotisations,
  controleCotisationsAbsentes,
  controleCotisationsIndues,
];
