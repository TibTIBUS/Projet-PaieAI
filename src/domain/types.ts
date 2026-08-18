/**
 * Modèle de domaine PaieAI.
 * Tous les montants sont exprimés en euros, tous les taux en pourcentage (6.9 = 6,90 %).
 */

/* ------------------------------------------------------------------ */
/* Bulletin de paie                                                    */
/* ------------------------------------------------------------------ */

export type NatureLigne =
  | 'remuneration' // élément entrant dans le brut (salaire de base, primes, HS…)
  | 'cotisation' // cotisation ou contribution sociale
  | 'retenue' // retenue non-cotisation (avance, saisie, titre-restaurant…)
  | 'non_soumis' // remboursement de frais, transport, non soumis à cotisations
  | 'exoneration' // allègement / réduction (ligne négative de cotisation)
  | 'info'; // ligne informative (cumuls, mentions)

export interface LignePaie {
  /** Code normalisé PaieAI, ex. `VIEILLESSE_PLAF`. `null` si non reconnu. */
  code: string | null;
  /** Libellé tel qu'il figure sur le bulletin. */
  libelle: string;
  nature: NatureLigne;
  base?: number;
  tauxSalarial?: number;
  montantSalarial?: number;
  tauxPatronal?: number;
  montantPatronal?: number;
  /** Ligne de rémunération : nombre d'unités (heures, jours). */
  nombre?: number;
  /** Ligne de rémunération : taux unitaire (€/h). */
  tauxUnitaire?: number;
  /** Montant pour les lignes de rémunération / non soumis / retenues. */
  montant?: number;
  /** Numéro de ligne dans le texte source, pour la traçabilité. */
  ligneSource?: number;
}

export interface Salarie {
  nom?: string;
  matricule?: string;
  emploi?: string;
  qualification?: string;
  niveauCoefficient?: string;
  statutCadre?: boolean;
  tempsPartiel?: boolean;
  /** Quotité de travail mensuelle contractuelle en heures. */
  horaireMensuel?: number;
  dateEntree?: string;
  dateSortie?: string;
  ancienneteMois?: number;
}

export interface Employeur {
  raisonSociale?: string;
  siret?: string;
  codeApe?: string;
  conventionCollective?: string;
  idcc?: string;
  /** Effectif déclaré, utilisé pour FNAL, forfait social, déduction HS. */
  effectif?: number;
  /** Départements 57/67/68 : cotisation maladie salariale supplémentaire. */
  alsaceMoselle?: boolean;
}

export type TypeContrat = 'CDI' | 'CDD' | 'APPRENTISSAGE' | 'PROFESSIONNALISATION' | 'INTERIM' | 'AUTRE';

export interface Contrat {
  type?: TypeContrat;
  dateDebut?: string;
  dateFin?: string;
}

export interface HeuresSupplementaires {
  /** Taux de majoration en % (25, 50, 10…). */
  majoration: number;
  nombre: number;
  montant: number;
  libelle: string;
}

export interface BlocHeures {
  /** Heures normales rémunérées sur le mois. */
  normales?: number;
  supplementaires: HeuresSupplementaires[];
  complementaires: HeuresSupplementaires[];
  /** Heures d'absence retenues. */
  absences?: number;
}

export interface CongesPayes {
  acquisPeriodeN?: number;
  prisPeriodeN?: number;
  soldeN?: number;
  soldeN1?: number;
  /** Unité déclarée : jours ouvrables (30/an) ou ouvrés (25/an). */
  unite?: 'ouvrables' | 'ouvres';
}

export interface TotauxBulletin {
  brut?: number;
  totalCotisationsSalariales?: number;
  totalCotisationsPatronales?: number;
  netImposable?: number;
  /** Montant net social — obligatoire sur le bulletin depuis le 01/07/2023. */
  netSocial?: number;
  netAPayer?: number;
  netAvantImpot?: number;
  prelevementSource?: number;
  tauxPrelevementSource?: number;
  coutTotalEmployeur?: number;
  /** Total des allègements de cotisations patronales affiché sur le bulletin. */
  allegementsPatronaux?: number;
}

export interface Cumuls {
  brutAnnuel?: number;
  netImposableAnnuel?: number;
  heuresSuppAnnuelles?: number;
  montantHeuresSuppExonereesAnnuel?: number;
}

export interface Bulletin {
  id: string;
  nomFichier: string;
  /** Période de paie. */
  annee: number;
  mois: number; // 1-12
  dateVersement?: string;
  salarie: Salarie;
  employeur: Employeur;
  contrat: Contrat;
  heures: BlocHeures;
  conges?: CongesPayes;
  totaux: TotauxBulletin;
  cumuls?: Cumuls;
  lignes: LignePaie[];
  /** Texte brut extrait du PDF, conservé pour les contrôles de mentions. */
  texteBrut: string;
  /** Estimation 0→1 de la qualité de l'extraction. */
  qualiteExtraction: number;
  /** Champs que le parser n'a pas su lire et que l'utilisateur doit saisir. */
  champsManquants: string[];
  /** Origine : extraction automatique ou saisie manuelle. */
  source: 'pdf' | 'ocr' | 'manuel';
  importeLe: string;
}

/* ------------------------------------------------------------------ */
/* Anomalies                                                           */
/* ------------------------------------------------------------------ */

export type Severite = 'critique' | 'majeure' | 'mineure' | 'info';

export type CategorieControle =
  | 'arithmetique'
  | 'cotisations'
  | 'assiettes'
  | 'salaire_minimum'
  | 'temps_travail'
  | 'conges'
  | 'fiscal'
  | 'avantages'
  | 'conformite'
  | 'historique';

export interface ReferenceLegale {
  texte: string;
  url?: string;
}

/** Niveau de confiance dans le constat, exposé à l'utilisateur. */
export type Confiance = 'certaine' | 'probable' | 'a_verifier';

export interface Anomalie {
  /** Identifiant stable du contrôle, ex. `ARI-01`. */
  code: string;
  controle: string;
  titre: string;
  severite: Severite;
  categorie: CategorieControle;
  confiance: Confiance;
  /** Explication en langage courant, destinée au salarié. */
  explication: string;
  /** Détail du calcul, destiné au professionnel de paie. */
  detail: string;
  attendu?: number;
  constate?: number;
  ecart?: number;
  /**
   * Impact mensuel en euros pour le salarié.
   * Positif = somme due au salarié, négatif = trop-perçu.
   */
  impactMensuel?: number;
  /** Impact projeté sur 12 mois. */
  impactAnnuel?: number;
  /** Rappel potentiel sur la période de prescription (3 ans, L.3245-1). */
  rappelPotentiel?: number;
  references: ReferenceLegale[];
  /** Étapes concrètes recommandées. */
  actions: string[];
  /** Libellés des lignes du bulletin concernées. */
  lignesConcernees?: string[];
}

export interface ResultatAnalyse {
  bulletinId: string;
  annee: number;
  mois: number;
  anomalies: Anomalie[];
  /** Score de conformité 0→100. */
  score: number;
  /** Somme des impacts mensuels en faveur du salarié. */
  impactMensuelTotal: number;
  rappelPotentielTotal: number;
  controlesExecutes: number;
  controlesNonExecutes: { code: string; raison: string }[];
  /** Le référentiel utilisé était-il vérifié pour cette période ? */
  referentielFiable: boolean;
  analyseLe: string;
}
