import type { NatureLigne } from '../types';
import { normaliserTexte } from './montants';

/**
 * Dictionnaire de reconnaissance des libellés de bulletin.
 *
 * Chaque éditeur de paie (Silae, Sage, Cegid, ADP, PayFit, Nibelis…) utilise
 * ses propres libellés. On les ramène tous à un code normalisé, seule clé
 * utilisée ensuite par le moteur de contrôle.
 *
 * L'ordre du tableau fait la priorité : les motifs les plus spécifiques
 * doivent précéder les plus généraux.
 */

export interface RegleReconnaissance {
  code: string;
  nature: NatureLigne;
  /** Motifs appliqués au libellé normalisé (minuscules, sans accents). */
  motifs: RegExp[];
  /** Motifs d'exclusion, évalués avant les motifs positifs. */
  exclusions?: RegExp[];
}

export const REGLES: RegleReconnaissance[] = [
  /* ---------------- Totaux et agrégats (à isoler en premier) --------------- */
  { code: 'TOTAL_BRUT', nature: 'info', motifs: [/\b(total|salaire|remuneration|montant)\s+brut\b/, /^brut\b/, /\bbrut\s+(fiscal|social|total)\b/] },
  { code: 'NET_SOCIAL', nature: 'info', motifs: [/montant net social/, /\bnet social\b/] },
  { code: 'NET_IMPOSABLE', nature: 'info', motifs: [/net (imposable|fiscal)/, /\bimposable\b/], exclusions: [/cumul/] },
  { code: 'NET_AVANT_IMPOT', nature: 'info', motifs: [/net a payer avant impot/, /net avant impot/] },
  { code: 'NET_A_PAYER', nature: 'info', motifs: [/net a payer/, /^net paye/, /\bnet verse\b/, /virement/] },
  { code: 'TOTAL_COT_SALARIALES', nature: 'info', motifs: [/total\s+(des\s+)?(cotisations|retenues)\s+(et\s+contributions\s+)?salarial/, /total retenues salariales/, /total\s+part\s+salarial/] },
  { code: 'TOTAL_COT_PATRONALES', nature: 'info', motifs: [/total\s+(des\s+)?(cotisations|charges|contributions)\s+patronal/, /total\s+part\s+patronal/] },
  { code: 'COUT_EMPLOYEUR', nature: 'info', motifs: [/(cout|coup) (total|global) employeur/, /total verse par l employeur/, /cout du travail/] },
  { code: 'ALLEGEMENTS', nature: 'info', motifs: [/(total )?(des )?allegement/, /exonerations de cotisations/] },

  /* ---------------- Impôt sur le revenu ---------------------------------- */
  { code: 'PAS', nature: 'retenue', motifs: [/prelevement a la source/, /impot sur le revenu (preleve|prelevement)/, /^pas\b/, /retenue a la source/] },

  /* ---------------- Éléments de rémunération ------------------------------ */
  { code: 'SALAIRE_BASE', nature: 'remuneration', motifs: [/salaire (de )?base/, /appointements/, /^salaire mensuel/, /remuneration (de base|mensuelle)/, /traitement de base/] },
  { code: 'HEURES_SUPP_25', nature: 'remuneration', motifs: [/heures? sup\w*\s*(a\s*)?(25|125)/, /h\.?s\.?\s*25/, /majoration 25/, /heures? sup\w* (majorees? )?25/] },
  { code: 'HEURES_SUPP_50', nature: 'remuneration', motifs: [/heures? sup\w*\s*(a\s*)?(50|150)/, /h\.?s\.?\s*50/, /majoration 50/] },
  { code: 'HEURES_SUPP_AUTRE', nature: 'remuneration', motifs: [/heures? sup/, /h\.?sup/] },
  { code: 'HEURES_COMPLEMENTAIRES', nature: 'remuneration', motifs: [/heures? complementaires?/, /h\.?\s?comp\b/] },
  { code: 'PRIME_ANCIENNETE', nature: 'remuneration', motifs: [/prime.*anciennete/, /anciennete/] },
  { code: 'PRIME_PRECARITE', nature: 'remuneration', motifs: [/precarite/, /indemnite de fin de (contrat|mission)/, /\bifc\b/] },
  { code: 'INDEMNITE_CP', nature: 'remuneration', motifs: [/indemnite compensatrice (de )?conges/, /indemnite compensatrice cp/, /icp\b/] },
  { code: 'CONGES_PAYES_PRIS', nature: 'remuneration', motifs: [/conges payes (pris|indemnite)/, /indemnite (de )?conges payes/, /absence conges payes/, /^conges payes\b/] },
  { code: 'TREIZIEME_MOIS', nature: 'remuneration', motifs: [/13\s?(eme|e)?\s?mois/, /treizieme mois/, /prime annuelle/] },
  { code: 'PRIME_PARTAGE_VALEUR', nature: 'remuneration', motifs: [/prime de partage de la valeur/, /\bppv\b/, /prime macron/] },
  { code: 'RAPPEL', nature: 'remuneration', motifs: [/rappel/, /regularisation (de )?salaire/] },
  { code: 'AVANTAGE_NATURE', nature: 'remuneration', motifs: [/avantage(s)? en nature/, /\ba\.?n\.? (vehicule|repas|logement)/] },
  { code: 'MAINTIEN_SALAIRE', nature: 'remuneration', motifs: [/maintien (de )?salaire/, /complement employeur/, /garantie de salaire/] },
  { code: 'IJSS', nature: 'remuneration', motifs: [/\bijss\b/, /indemnites? journalieres?/, /subrogation/] },
  { code: 'PRIME', nature: 'remuneration', motifs: [/\bprime\b/, /\bbonus\b/, /gratification/, /commission/] },

  /* ---------------- Absences et retenues sur brut ------------------------- */
  { code: 'ABSENCE_MALADIE', nature: 'remuneration', motifs: [/absence.*(maladie|arret)/, /(maladie|arret de travail).*absence/, /retenue maladie/] },
  { code: 'ABSENCE', nature: 'remuneration', motifs: [/absence/, /retenue pour (absence|entree|sortie)/, /entree.*sortie/] },

  /* ---------------- Cotisations de sécurité sociale ----------------------- */
  { code: 'MALADIE_ALSACE_MOSELLE', nature: 'cotisation', motifs: [/alsace/, /moselle/] },
  { code: 'MALADIE', nature: 'cotisation', motifs: [/maladie/, /securite sociale.*(maladie|maternite)/, /assurance maladie/], exclusions: [/absence/, /indemnite/, /prevoyance/] },
  { code: 'VIEILLESSE_PLAFONNEE', nature: 'cotisation', motifs: [/vieillesse (plafonnee|plaf)/, /securite sociale plafonnee/, /assurance vieillesse plaf/, /^ss plaf/] },
  { code: 'VIEILLESSE_DEPLAFONNEE', nature: 'cotisation', motifs: [/vieillesse (deplafonnee|deplaf)/, /securite sociale deplafonnee/, /assurance vieillesse deplaf/, /^ss deplaf/, /vieillesse.*totalite/] },
  { code: 'ALLOCATIONS_FAMILIALES', nature: 'cotisation', motifs: [/allocations? familiales?/, /\baf\b/] },
  { code: 'CSA', nature: 'cotisation', motifs: [/solidarite autonomie/, /\bcsa\b/, /contribution autonomie/] },
  { code: 'ACCIDENT_TRAVAIL', nature: 'cotisation', motifs: [/accident(s)? du travail/, /\bat\/?mp\b/, /accidents? travail/, /risque professionnel/] },

  /* ---------------- Chômage, logement, dialogue social -------------------- */
  { code: 'CHOMAGE', nature: 'cotisation', motifs: [/assurance chomage/, /^chomage/, /pole emploi/, /france travail/], exclusions: [/\bags\b/] },
  { code: 'AGS', nature: 'cotisation', motifs: [/\bags\b/, /garantie des salaires/, /fonds de garantie/] },
  { code: 'FNAL_50_PLUS', nature: 'cotisation', motifs: [/fnal.*(deplafonne|totalite|50)/, /fnal supplementaire/] },
  { code: 'FNAL_MOINS_50', nature: 'cotisation', motifs: [/\bfnal\b/, /fonds national d aide au logement/, /aide au logement/] },
  { code: 'DIALOGUE_SOCIAL', nature: 'cotisation', motifs: [/dialogue social/, /organisations syndicales/] },
  { code: 'VERSEMENT_MOBILITE', nature: 'cotisation', motifs: [/versement (mobilite|transport)/, /\bvm\b/] },

  /* ---------------- Retraite complémentaire ------------------------------- */
  { code: 'RETRAITE_COMP_T1', nature: 'cotisation', motifs: [/retraite (complementaire|comp).*(t1|tranche 1|ta\b)/, /agirc.?arrco.*(t1|tranche 1)/, /^rc t1/, /retraite unifiee t1/] },
  { code: 'RETRAITE_COMP_T2', nature: 'cotisation', motifs: [/retraite (complementaire|comp).*(t2|tranche 2|tb\b)/, /agirc.?arrco.*(t2|tranche 2)/, /^rc t2/, /retraite unifiee t2/] },
  { code: 'CEG_T1', nature: 'cotisation', motifs: [/(ceg|equilibre general).*(t1|tranche 1|ta\b)/] },
  { code: 'CEG_T2', nature: 'cotisation', motifs: [/(ceg|equilibre general).*(t2|tranche 2|tb\b)/] },
  { code: 'CEG_T1', nature: 'cotisation', motifs: [/\bceg\b/, /contribution d equilibre general/] },
  { code: 'CET', nature: 'cotisation', motifs: [/\bcet\b/, /equilibre technique/] },
  { code: 'APEC', nature: 'cotisation', motifs: [/\bapec\b/, /emploi des cadres/] },
  { code: 'RETRAITE_COMP_T1', nature: 'cotisation', motifs: [/agirc.?arrco/, /retraite complementaire/] },
  { code: 'RETRAITE_SUPPLEMENTAIRE', nature: 'cotisation', motifs: [/retraite supplementaire/, /article 83/, /\bperco\b/, /\bpere?co\b/] },

  /* ---------------- CSG / CRDS -------------------------------------------- */
  { code: 'CSG_DEDUCTIBLE', nature: 'cotisation', motifs: [/csg deductible/, /csg ded/] },
  { code: 'CSG_CRDS_NON_DEDUCTIBLE', nature: 'cotisation', motifs: [/csg.*crds.*non deductible/, /csg.*crds/] },
  { code: 'CSG_NON_DEDUCTIBLE', nature: 'cotisation', motifs: [/csg non deductible/, /csg non ded/] },
  { code: 'CRDS', nature: 'cotisation', motifs: [/\bcrds\b/, /remboursement de la dette sociale/] },
  { code: 'CSG_CRDS_NON_DEDUCTIBLE', nature: 'cotisation', motifs: [/csg\/crds/, /csg et crds/] },

  /* ---------------- Prévoyance, santé ------------------------------------- */
  { code: 'MUTUELLE', nature: 'cotisation', motifs: [/mutuelle/, /complementaire sante/, /frais de sante/, /^sante\b/] },
  { code: 'PREVOYANCE', nature: 'cotisation', motifs: [/prevoyance/, /incapacite/, /invalidite deces/, /\bidcp\b/] },
  { code: 'FORFAIT_SOCIAL_PREVOYANCE', nature: 'cotisation', motifs: [/forfait social/] },

  /* ---------------- Taxes assises sur les salaires ------------------------ */
  { code: 'TAXE_APPRENTISSAGE', nature: 'cotisation', motifs: [/(taxe d )?apprentissage/, /\bcufpa\b/] },
  { code: 'FORMATION_11_PLUS', nature: 'cotisation', motifs: [/formation professionnelle.*(1 %|1,00|11)/] },
  { code: 'FORMATION_MOINS_11', nature: 'cotisation', motifs: [/formation professionnelle/, /\bfpc\b/, /contribution formation/] },
  { code: 'CPF_CDD', nature: 'cotisation', motifs: [/cpf.?cdd/, /cpf cdd/] },
  { code: 'TAXE_SALAIRES', nature: 'cotisation', motifs: [/taxe sur les salaires/] },

  /* ---------------- Allègements et exonérations --------------------------- */
  { code: 'REDUCTION_GENERALE', nature: 'exoneration', motifs: [/reduction generale/, /allegement general/, /reduction fillon/, /\brgcp\b/] },
  { code: 'REDUCTION_SALARIALE_HS', nature: 'exoneration', motifs: [/reduction (salariale|de cotisations).*(heures? sup|hs)/, /exoneration.*heures? sup/, /reduction hs/] },
  { code: 'DEDUCTION_FORFAITAIRE_HS', nature: 'exoneration', motifs: [/deduction (forfaitaire|patronale).*(heures? sup|hs)/, /deduction forfaitaire/] },

  /* ---------------- Éléments non soumis ----------------------------------- */
  { code: 'TITRE_RESTAURANT', nature: 'retenue', motifs: [/titres? restaurant/, /tickets? restaurant/, /\btr\b.*(part|salarial)/, /cheques? dejeuner/] },
  { code: 'TRANSPORT_PUBLIC', nature: 'non_soumis', motifs: [/(abonnement|frais) (de )?transport/, /navigo/, /transport public/, /prise en charge transport/] },
  { code: 'FORFAIT_MOBILITES', nature: 'non_soumis', motifs: [/forfait mobilites?/] },
  { code: 'INDEMNITE_TELETRAVAIL', nature: 'non_soumis', motifs: [/teletravail/, /indemnite d occupation/] },
  { code: 'FRAIS_PROFESSIONNELS', nature: 'non_soumis', motifs: [/frais professionnels/, /remboursement de frais/, /note de frais/, /indemnite (de )?(repas|panier|grand deplacement)/, /panier/] },
  { code: 'SAISIE_ARRET', nature: 'retenue', motifs: [/saisie|cession sur salaire|pension alimentaire/] },
  { code: 'ACOMPTE', nature: 'retenue', motifs: [/acompte|avance sur salaire/] },
];

export interface Reconnaissance {
  code: string;
  nature: NatureLigne;
}

/** Associe un libellé de bulletin à un code normalisé. */
export function reconnaitreLigne(libelle: string): Reconnaissance | null {
  const t = normaliserTexte(libelle);
  if (!t || t.length < 2) return null;
  for (const regle of REGLES) {
    if (regle.exclusions?.some((r) => r.test(t))) continue;
    if (regle.motifs.some((r) => r.test(t))) {
      return { code: regle.code, nature: regle.nature };
    }
  }
  return null;
}

/** Libellé lisible associé à un code normalisé. */
export const LIBELLES_CODES: Record<string, string> = {
  SALAIRE_BASE: 'Salaire de base',
  HEURES_SUPP_25: 'Heures supplémentaires majorées à 25 %',
  HEURES_SUPP_50: 'Heures supplémentaires majorées à 50 %',
  HEURES_SUPP_AUTRE: 'Heures supplémentaires',
  HEURES_COMPLEMENTAIRES: 'Heures complémentaires',
  MALADIE: 'Assurance maladie',
  VIEILLESSE_PLAFONNEE: 'Vieillesse plafonnée',
  VIEILLESSE_DEPLAFONNEE: 'Vieillesse déplafonnée',
  RETRAITE_COMP_T1: 'Retraite complémentaire tranche 1',
  RETRAITE_COMP_T2: 'Retraite complémentaire tranche 2',
  CEG_T1: 'Contribution d’équilibre général tranche 1',
  CEG_T2: 'Contribution d’équilibre général tranche 2',
  CET: 'Contribution d’équilibre technique',
  APEC: 'APEC',
  CSG_DEDUCTIBLE: 'CSG déductible',
  CSG_CRDS_NON_DEDUCTIBLE: 'CSG/CRDS non déductible',
  CHOMAGE: 'Assurance chômage',
  AGS: 'AGS',
  MUTUELLE: 'Complémentaire santé',
  PREVOYANCE: 'Prévoyance',
  PAS: 'Prélèvement à la source',
  TITRE_RESTAURANT: 'Titres-restaurant',
  TRANSPORT_PUBLIC: 'Frais de transport',
};
