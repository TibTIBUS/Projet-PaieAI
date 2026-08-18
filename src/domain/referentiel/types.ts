/**
 * Référentiel des paramètres légaux de paie.
 *
 * Principe de conception : AUCUNE valeur n'est codée en dur dans le moteur de
 * contrôle. Toute valeur légale vit ici, porte une date d'entrée en vigueur,
 * une source et un niveau de fiabilité. Un expert-comptable peut donc valider
 * le référentiel séparément du code, et l'utilisateur peut surcharger une
 * valeur depuis l'écran « Paramètres légaux ».
 */

export type Fiabilite =
  /** Valeur vérifiée dans le texte officiel cité en source. */
  | 'verifie'
  /** Valeur reconduite de la période précédente faute de source vérifiée. */
  | 'reconduit'
  /** Valeur à confirmer avant toute exploitation. */
  | 'a_confirmer';

export type AssietteCode =
  | 'TOTALITE' // brut total
  | 'T1' // tranche 1 : 0 → 1 PMSS (= tranche A)
  | 'T2' // tranche 2 : 1 → 8 PMSS
  | 'TA_TB' // 0 → 4 PMSS (APEC, chômage)
  | 'PLAFOND_4' // 0 → 4 PMSS
  | 'CSG' // 98,25 % du brut + parts patronales prévoyance
  | 'PART_PAT_PREV' // part patronale prévoyance / mutuelle
  | 'SPECIFIQUE'; // assiette propre à la ligne, non contrôlable automatiquement

export interface BaremeCotisation {
  /** Code normalisé, sert de jointure avec les lignes du bulletin. */
  code: string;
  libelle: string;
  assiette: AssietteCode;
  tauxSalarial?: number;
  tauxPatronal?: number;
  /** Le taux dépend de l'entreprise (AT/MP, versement mobilité) : pas de contrôle de valeur. */
  tauxVariable?: boolean;
  /** Applicable seulement aux cadres. */
  cadresUniquement?: boolean;
  /** Applicable seulement en Alsace-Moselle. */
  alsaceMoselle?: boolean;
  /** Seuil d'effectif minimal d'application. */
  effectifMin?: number;
  /** Seuil d'effectif maximal d'application. */
  effectifMax?: number;
  /** Tolérance absolue en points de % pour le contrôle de taux. */
  tolerance?: number;
  fiabilite: Fiabilite;
  commentaire?: string;
  reference?: string;
}

export interface ParametresPeriode {
  /** Identifiant lisible, ex. `2025-01`. */
  cle: string;
  /** Date d'entrée en vigueur (ISO, incluse). */
  debut: string;
  /** Date de fin (ISO, incluse) ou null si toujours en vigueur. */
  fin: string | null;
  fiabilite: Fiabilite;
  sources: string[];
  /** Avertissement affiché à l'utilisateur pour cette période. */
  avertissement?: string;

  smicHoraire: number;
  /** SMIC mensuel pour 151,67 h, valeur officielle arrondie. */
  smicMensuel: number;
  minimumGaranti: number;

  plafondMensuelSS: number;
  plafondAnnuelSS: number;
  plafondHoraireSS: number;
  plafondJournalierSS: number;

  /** Abattement d'assiette CSG/CRDS pour frais professionnels, en %. */
  abattementCsg: number;
  /** Nombre de PASS au-delà duquel l'abattement CSG ne s'applique plus. */
  plafondAbattementCsgEnPass: number;

  /** Exonération maximale de la part patronale d'un titre-restaurant. */
  titreRestaurantExoMax: number;
  /** Bornes légales de la participation patronale au titre-restaurant, en %. */
  titreRestaurantPartPatronale: { min: number; max: number };

  /** Part minimale de l'employeur dans la complémentaire santé, en %. */
  mutuellePartPatronaleMin: number;
  /** Part de l'abonnement de transport public prise en charge, en %. */
  transportPublicPriseEnChargeMin: number;

  heuresSupplementaires: {
    /** Majoration légale des 8 premières heures, en %. */
    majoration8Premieres: number;
    majorationAuDela: number;
    /** Plancher conventionnel de majoration, en %. */
    majorationMinimaleConventionnelle: number;
    /** Taux maximal de la réduction salariale de cotisations vieillesse, en %. */
    reductionSalarialeMax: number;
    /** Plafond annuel d'exonération d'impôt sur le revenu, en euros. */
    plafondExoIRAnnuel: number;
    /** Déduction forfaitaire patronale par heure, selon l'effectif. */
    deductionForfaitairePatronale: { effectifMax: number; montantParHeure: number }[];
    /** Contingent annuel légal, en heures. */
    contingentAnnuel: number;
  };

  heuresComplementaires: {
    /** Majoration dans la limite du 1/10 de la durée contractuelle, en %. */
    majorationJusquauDixieme: number;
    majorationAuDela: number;
  };

  tempsPartiel: {
    /** Durée minimale hebdomadaire légale, en heures. */
    dureeMinimaleHebdo: number;
  };

  congesPayes: {
    acquisitionMensuelleOuvrables: number;
    acquisitionMensuelleOuvres: number;
    maxAnnuelOuvrables: number;
    /** Taux de l'indemnité compensatrice, en %. */
    tauxIndemniteCompensatrice: number;
  };

  cdd: {
    /** Indemnité de fin de contrat, en %. */
    tauxPrecarite: number;
    /** Taux réduit possible en cas d'accord de branche avec formation. */
    tauxPrecariteReduit: number;
  };

  /** Durée de prescription des salaires, en mois (L.3245-1). */
  prescriptionSalairesMois: number;
  /** Durée légale hebdomadaire et mensualisation. */
  dureeLegaleHebdo: number;
  dureeLegaleMensuelle: number;

  cotisations: BaremeCotisation[];
}
