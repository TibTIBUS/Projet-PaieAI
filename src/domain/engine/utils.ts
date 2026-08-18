import type { Anomalie, Bulletin, LignePaie, Severite } from '../types';
import type { ParametresPeriode } from '../referentiel';
import { arrondi } from '../parsing/montants';
import type { ContexteControle } from './types';

/* ------------------------------------------------------------------ */
/* Construction d'anomalies                                            */
/* ------------------------------------------------------------------ */

type Brouillon = Omit<Anomalie, 'impactAnnuel' | 'rappelPotentiel'> & {
  impactAnnuel?: number;
  rappelPotentiel?: number;
};

/**
 * Complète une anomalie : projections annuelle et sur la période de
 * prescription des salaires (3 ans, article L.3245-1 du Code du travail).
 */
export function finaliser(a: Brouillon, params: ParametresPeriode): Anomalie {
  const impact = a.impactMensuel;
  if (impact === undefined || impact === 0) return a as Anomalie;
  return {
    ...a,
    impactMensuel: arrondi(impact),
    impactAnnuel: a.impactAnnuel ?? arrondi(impact * 12),
    rappelPotentiel: a.rappelPotentiel ?? arrondi(impact * params.prescriptionSalairesMois),
  };
}

/** Référence légale usuelle sur la prescription des salaires. */
export const REF_PRESCRIPTION = {
  texte: 'Article L.3245-1 du Code du travail — prescription triennale des salaires',
  url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000027565006',
};

export const REF_MENTIONS_BULLETIN = {
  texte: 'Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie',
  url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955',
};

/* ------------------------------------------------------------------ */
/* Accès aux lignes                                                    */
/* ------------------------------------------------------------------ */

export function lignesParCode(b: Bulletin, code: string): LignePaie[] {
  return b.lignes.filter((l) => l.code === code);
}

export function ligneParCode(b: Bulletin, code: string): LignePaie | undefined {
  return b.lignes.find((l) => l.code === code);
}

export function aUneLigne(b: Bulletin, ...codes: string[]): boolean {
  return b.lignes.some((l) => l.code !== null && codes.includes(l.code));
}

/** Somme des montants salariaux des lignes de cotisation. */
export function totalCotisationsSalariales(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.nature === 'cotisation')
      .reduce((s, l) => s + (l.montantSalarial ?? 0), 0),
  );
}

export function totalCotisationsPatronales(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.nature === 'cotisation' || l.nature === 'exoneration')
      .reduce((s, l) => s + (l.montantPatronal ?? 0), 0),
  );
}

/** Somme des éléments de rémunération, c'est-à-dire le brut recalculé. */
export function brutRecalcule(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.nature === 'remuneration')
      .reduce((s, l) => s + (l.montant ?? 0), 0),
  );
}

/** Brut retenu pour les contrôles : celui du bulletin, sinon le recalculé. */
export function brut(b: Bulletin): number | undefined {
  return b.totaux.brut ?? (b.lignes.some((l) => l.nature === 'remuneration') ? brutRecalcule(b) : undefined);
}

/** Part patronale des régimes de protection sociale complémentaire. */
export function partPatronalePrevoyance(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.code === 'MUTUELLE' || l.code === 'PREVOYANCE' || l.code === 'RETRAITE_SUPPLEMENTAIRE')
      .reduce((s, l) => s + (l.montantPatronal ?? 0), 0),
  );
}

/** Part salariale des régimes de protection sociale complémentaire. */
export function partSalarialePrevoyance(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.code === 'MUTUELLE' || l.code === 'PREVOYANCE' || l.code === 'RETRAITE_SUPPLEMENTAIRE')
      .reduce((s, l) => s + (l.montantSalarial ?? 0), 0),
  );
}

/** Total des CSG et CRDS non déductibles de l'impôt sur le revenu. */
export function csgCrdsNonDeductible(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) =>
        l.code === 'CSG_CRDS_NON_DEDUCTIBLE' || l.code === 'CSG_NON_DEDUCTIBLE' || l.code === 'CRDS')
      .reduce((s, l) => s + (l.montantSalarial ?? 0), 0),
  );
}

/** Éléments non soumis à cotisations, ajoutés au net à payer. */
export function totalNonSoumis(b: Bulletin): number {
  return arrondi(
    b.lignes.filter((l) => l.nature === 'non_soumis').reduce((s, l) => s + (l.montant ?? 0), 0),
  );
}

/** Retenues nettes (titres-restaurant, acomptes, saisies), hors impôt. */
export function totalRetenuesNettes(b: Bulletin): number {
  return arrondi(
    b.lignes
      .filter((l) => l.nature === 'retenue' && l.code !== 'PAS')
      .reduce((s, l) => s + Math.abs(l.montant ?? 0), 0),
  );
}

/** Effectif retenu : saisie utilisateur prioritaire sur le bulletin. */
export function effectif(ctx: ContexteControle): number | undefined {
  return ctx.options.effectif ?? ctx.bulletin.employeur.effectif;
}

/** Taux horaire moyen déduit du salaire de base. */
export function tauxHoraireDeBase(b: Bulletin): number | undefined {
  const base = ligneParCode(b, 'SALAIRE_BASE');
  if (base?.tauxUnitaire && base.tauxUnitaire > 1 && base.tauxUnitaire < 500) return base.tauxUnitaire;
  if (base?.nombre && base.montant && base.nombre > 20) return arrondi(base.montant / base.nombre, 4);
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Présentation                                                        */
/* ------------------------------------------------------------------ */

export function euros(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function pourcent(v: number): string {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} %`;
}

/** Sévérité déduite de l'ampleur d'un écart en euros. */
export function severiteSelonEcart(ecart: number, seuilMajeur = 5, seuilCritique = 50): Severite {
  const a = Math.abs(ecart);
  if (a >= seuilCritique) return 'critique';
  if (a >= seuilMajeur) return 'majeure';
  if (a >= 0.5) return 'mineure';
  return 'info';
}
