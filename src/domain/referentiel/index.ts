import { PERIODES, DERNIERE_PERIODE_VERIFIEE } from './data';
import type { BaremeCotisation, ParametresPeriode } from './types';

export * from './types';
export { PERIODES, DERNIERE_PERIODE_VERIFIEE };

/**
 * Surcharges saisies par l'utilisateur (ou par l'expert-comptable qui valide
 * l'outil) pour corriger le référentiel sans toucher au code.
 */
export interface SurchargesReferentiel {
  /** Clé de période → valeurs scalaires surchargées. */
  periodes?: Record<string, Partial<Pick<ParametresPeriode,
    'smicHoraire' | 'smicMensuel' | 'plafondMensuelSS' | 'plafondAnnuelSS'
    | 'plafondHoraireSS' | 'minimumGaranti' | 'titreRestaurantExoMax'>>>;
  /** Clé de période → code cotisation → taux surchargés. */
  cotisations?: Record<string, Record<string, Partial<Pick<BaremeCotisation, 'tauxSalarial' | 'tauxPatronal'>>>>;
  /** Périodes explicitement validées par un professionnel. */
  validees?: string[];
}

/** Dernier jour du mois, utilisé comme date de référence de la période de paie. */
function finDeMois(annee: number, mois: number): string {
  const d = new Date(Date.UTC(annee, mois, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Retourne les paramètres légaux applicables à une période de paie.
 * On retient la dernière période entrée en vigueur avant la fin du mois de paie.
 */
export function parametresPour(
  annee: number,
  mois: number,
  surcharges?: SurchargesReferentiel,
): ParametresPeriode {
  const date = finDeMois(annee, mois);
  const candidates = PERIODES.filter((p) => p.debut <= date);
  const base = candidates.length
    ? candidates[candidates.length - 1]
    : PERIODES[0];
  return appliquerSurcharges(base, surcharges);
}

export function appliquerSurcharges(
  p: ParametresPeriode,
  s?: SurchargesReferentiel,
): ParametresPeriode {
  if (!s) return p;
  const scalaires = s.periodes?.[p.cle];
  const taux = s.cotisations?.[p.cle];
  if (!scalaires && !taux && !s.validees?.includes(p.cle)) return p;

  const resultat: ParametresPeriode = { ...p, ...(scalaires ?? {}) };

  if (taux) {
    resultat.cotisations = p.cotisations.map((c) =>
      taux[c.code] ? { ...c, ...taux[c.code], fiabilite: 'verifie' as const } : c,
    );
  }
  if (scalaires || s.validees?.includes(p.cle)) {
    resultat.sources = [...p.sources, 'Valeurs corrigées manuellement dans l’application.'];
  }
  if (s.validees?.includes(p.cle)) {
    resultat.fiabilite = 'verifie';
    resultat.avertissement = undefined;
  }
  return resultat;
}

/** Le référentiel de cette période est-il exploitable sans réserve ? */
export function referentielFiable(p: ParametresPeriode): boolean {
  return p.fiabilite === 'verifie';
}

/** Recherche un barème par code normalisé. */
export function bareme(p: ParametresPeriode, code: string): BaremeCotisation | undefined {
  return p.cotisations.find((c) => c.code === code);
}

export interface Tranches {
  /** Tranche 1 : 0 → 1 plafond mensuel. */
  t1: number;
  /** Tranche 2 : 1 → 8 plafonds mensuels. */
  t2: number;
  /** Assiette 0 → 4 plafonds (chômage, APEC). */
  plafond4: number;
  totalite: number;
}

/**
 * Découpe une assiette en tranches.
 * `plafondMensuel` peut être proratisé (entrée ou sortie en cours de mois,
 * temps partiel avec plafond réduit).
 */
export function decouperTranches(brut: number, plafondMensuel: number): Tranches {
  const t1 = Math.min(Math.max(brut, 0), plafondMensuel);
  const t2 = Math.min(Math.max(brut - plafondMensuel, 0), plafondMensuel * 7);
  const plafond4 = Math.min(Math.max(brut, 0), plafondMensuel * 4);
  return { t1, t2, plafond4, totalite: Math.max(brut, 0) };
}

/**
 * Plafond de sécurité sociale proratisé pour un mois incomplet.
 * Règle des trentièmes : plafond × (jours de la période / jours du mois).
 * Voir BOSS, rubrique « Assiette générale », § plafond réduit.
 */
export function plafondProratise(
  plafondMensuel: number,
  joursPresence: number,
  joursDuMois = 30,
): number {
  if (joursPresence >= joursDuMois) return plafondMensuel;
  return Math.round(plafondMensuel * (joursPresence / joursDuMois) * 100) / 100;
}

/** Assiette CSG/CRDS : abattement de 1,75 % plafonné à 4 PASS. */
export function assietteCsg(
  brutSoumis: number,
  partPatronalePrevoyance: number,
  p: ParametresPeriode,
): number {
  const plafondAbattement = p.plafondMensuelSS * p.plafondAbattementCsgEnPass;
  const abattable = Math.min(brutSoumis, plafondAbattement);
  const nonAbattable = Math.max(brutSoumis - plafondAbattement, 0);
  const apresAbattement = abattable * (1 - p.abattementCsg / 100) + nonAbattable;
  // Les contributions patronales de prévoyance et de mutuelle sont ajoutées
  // sans abattement (article L.136-1-1 III du Code de la sécurité sociale).
  return apresAbattement + partPatronalePrevoyance;
}
