import type { BaremeCotisation, ParametresPeriode } from './types';

/**
 * ⚠️ Zone à valider par un professionnel de la paie avant mise en production.
 *
 * Chaque période est un instantané complet des paramètres en vigueur. La
 * recherche se fait par date : on retient la dernière période dont `debut`
 * est antérieur ou égal au dernier jour du mois de paie.
 *
 * Convention de fiabilité :
 *  - `verifie`     : valeur relevée dans le texte officiel cité en source ;
 *  - `reconduit`   : valeur de la période précédente reprise faute de source ;
 *  - `a_confirmer` : valeur à confirmer impérativement avant exploitation.
 *
 * Le moteur dégrade automatiquement la confiance des anomalies issues d'une
 * valeur `reconduit` ou `a_confirmer` (voir `engine/index.ts`).
 */

/* ------------------------------------------------------------------ */
/* Barème de cotisations — socle commun                                */
/* ------------------------------------------------------------------ */

interface SocleOptions {
  /** Taux de la contribution patronale d'assurance chômage. */
  chomage: number;
  /** Taux AGS. */
  ags: number;
  fiabiliteChomage?: BaremeCotisation['fiabilite'];
  fiabiliteAgs?: BaremeCotisation['fiabilite'];
}

function socleCotisations(o: SocleOptions): BaremeCotisation[] {
  return [
    /* --- Sécurité sociale --- */
    {
      code: 'MALADIE',
      libelle: 'Sécurité sociale - Maladie, maternité, invalidité, décès',
      assiette: 'TOTALITE',
      tauxSalarial: 0,
      tauxPatronal: 7,
      fiabilite: 'verifie',
      commentaire:
        "Taux patronal réduit de 7 % pour les rémunérations n'excédant pas 2,5 SMIC ; 13 % au-delà.",
      reference: 'Article D.242-3 du Code de la sécurité sociale',
    },
    {
      code: 'MALADIE_ALSACE_MOSELLE',
      libelle: 'Cotisation salariale maladie supplémentaire (Alsace-Moselle)',
      assiette: 'TOTALITE',
      tauxSalarial: 1.3,
      alsaceMoselle: true,
      fiabilite: 'verifie',
      reference: 'Article D.242-25 du Code de la sécurité sociale',
    },
    {
      code: 'VIEILLESSE_PLAFONNEE',
      libelle: 'Sécurité sociale - Vieillesse plafonnée',
      assiette: 'T1',
      tauxSalarial: 6.9,
      tauxPatronal: 8.55,
      fiabilite: 'verifie',
      reference: 'Article D.242-4 du Code de la sécurité sociale',
    },
    {
      code: 'VIEILLESSE_DEPLAFONNEE',
      libelle: 'Sécurité sociale - Vieillesse déplafonnée',
      assiette: 'TOTALITE',
      tauxSalarial: 0.4,
      tauxPatronal: 2.02,
      fiabilite: 'verifie',
      reference: 'Article D.242-4 du Code de la sécurité sociale',
    },
    {
      code: 'ALLOCATIONS_FAMILIALES',
      libelle: 'Allocations familiales',
      assiette: 'TOTALITE',
      tauxPatronal: 3.45,
      fiabilite: 'verifie',
      commentaire: 'Taux réduit de 3,45 % jusqu’à 3,5 SMIC ; 5,25 % au-delà.',
      reference: 'Article L.241-6-1 du Code de la sécurité sociale',
    },
    {
      code: 'CSA',
      libelle: 'Contribution solidarité autonomie',
      assiette: 'TOTALITE',
      tauxPatronal: 0.3,
      fiabilite: 'verifie',
      reference: 'Article L.14-10-4 du Code de l’action sociale et des familles',
    },
    {
      code: 'ACCIDENT_TRAVAIL',
      libelle: 'Accidents du travail et maladies professionnelles',
      assiette: 'TOTALITE',
      tauxVariable: true,
      fiabilite: 'verifie',
      commentaire: 'Taux notifié annuellement à l’employeur par la CARSAT : non contrôlable a priori.',
      reference: 'Articles L.242-5 et D.242-6-1 du Code de la sécurité sociale',
    },

    /* --- Logement, chômage, dialogue social --- */
    {
      code: 'FNAL_MOINS_50',
      libelle: 'FNAL (entreprises de moins de 50 salariés)',
      assiette: 'T1',
      tauxPatronal: 0.1,
      effectifMax: 49,
      fiabilite: 'verifie',
      reference: 'Article L.834-1 du Code de la sécurité sociale',
    },
    {
      code: 'FNAL_50_PLUS',
      libelle: 'FNAL (entreprises de 50 salariés et plus)',
      assiette: 'TOTALITE',
      tauxPatronal: 0.5,
      effectifMin: 50,
      fiabilite: 'verifie',
      reference: 'Article L.834-1 du Code de la sécurité sociale',
    },
    {
      code: 'CHOMAGE',
      libelle: 'Assurance chômage',
      assiette: 'PLAFOND_4',
      tauxPatronal: o.chomage,
      fiabilite: o.fiabiliteChomage ?? 'verifie',
      reference: 'Convention d’assurance chômage, article L.5422-9 du Code du travail',
    },
    {
      code: 'AGS',
      libelle: 'AGS - Garantie des salaires',
      assiette: 'PLAFOND_4',
      tauxPatronal: o.ags,
      fiabilite: o.fiabiliteAgs ?? 'a_confirmer',
      commentaire: 'Taux révisé par le conseil d’administration de l’AGS, à vérifier à chaque évolution.',
      reference: 'Article L.3253-18 du Code du travail',
    },
    {
      code: 'DIALOGUE_SOCIAL',
      libelle: 'Contribution au dialogue social',
      assiette: 'TOTALITE',
      tauxPatronal: 0.016,
      tolerance: 0.005,
      fiabilite: 'verifie',
      reference: 'Article L.2135-10 du Code du travail',
    },

    /* --- Retraite complémentaire Agirc-Arrco --- */
    {
      code: 'RETRAITE_COMP_T1',
      libelle: 'Retraite complémentaire Agirc-Arrco tranche 1',
      assiette: 'T1',
      tauxSalarial: 3.15,
      tauxPatronal: 4.72,
      fiabilite: 'verifie',
      commentaire: 'Taux d’appel de 127 % appliqué au taux de calcul de 6,20 %.',
      reference: 'Accord national interprofessionnel Agirc-Arrco',
    },
    {
      code: 'RETRAITE_COMP_T2',
      libelle: 'Retraite complémentaire Agirc-Arrco tranche 2',
      assiette: 'T2',
      tauxSalarial: 8.64,
      tauxPatronal: 12.95,
      fiabilite: 'verifie',
      commentaire: 'Taux d’appel de 127 % appliqué au taux de calcul de 17 %.',
      reference: 'Accord national interprofessionnel Agirc-Arrco',
    },
    {
      code: 'CEG_T1',
      libelle: 'Contribution d’équilibre général tranche 1',
      assiette: 'T1',
      tauxSalarial: 0.86,
      tauxPatronal: 1.29,
      fiabilite: 'verifie',
      reference: 'Accord national interprofessionnel Agirc-Arrco',
    },
    {
      code: 'CEG_T2',
      libelle: 'Contribution d’équilibre général tranche 2',
      assiette: 'T2',
      tauxSalarial: 1.08,
      tauxPatronal: 1.62,
      fiabilite: 'verifie',
      reference: 'Accord national interprofessionnel Agirc-Arrco',
    },
    {
      code: 'CET',
      libelle: 'Contribution d’équilibre technique',
      assiette: 'T1',
      tauxSalarial: 0.14,
      tauxPatronal: 0.21,
      fiabilite: 'verifie',
      commentaire: 'Due uniquement si la rémunération dépasse le plafond mensuel de la Sécurité sociale.',
      reference: 'Accord national interprofessionnel Agirc-Arrco',
    },
    {
      code: 'APEC',
      libelle: 'APEC - Association pour l’emploi des cadres',
      assiette: 'TA_TB',
      tauxSalarial: 0.024,
      tauxPatronal: 0.036,
      tolerance: 0.005,
      cadresUniquement: true,
      fiabilite: 'verifie',
      reference: 'Convention nationale APEC du 18 novembre 1966',
    },

    /* --- CSG / CRDS --- */
    {
      code: 'CSG_DEDUCTIBLE',
      libelle: 'CSG déductible de l’impôt sur le revenu',
      assiette: 'CSG',
      tauxSalarial: 6.8,
      fiabilite: 'verifie',
      reference: 'Article L.136-8 du Code de la sécurité sociale',
    },
    {
      code: 'CSG_CRDS_NON_DEDUCTIBLE',
      libelle: 'CSG/CRDS non déductible de l’impôt sur le revenu',
      assiette: 'CSG',
      tauxSalarial: 2.9,
      fiabilite: 'verifie',
      commentaire: 'CSG non déductible 2,40 % + CRDS 0,50 %.',
      reference: 'Articles L.136-8 du CSS et 14 de l’ordonnance n° 96-50',
    },
    {
      code: 'CSG_NON_DEDUCTIBLE',
      libelle: 'CSG non déductible',
      assiette: 'CSG',
      tauxSalarial: 2.4,
      fiabilite: 'verifie',
      reference: 'Article L.136-8 du Code de la sécurité sociale',
    },
    {
      code: 'CRDS',
      libelle: 'CRDS',
      assiette: 'CSG',
      tauxSalarial: 0.5,
      fiabilite: 'verifie',
      reference: 'Ordonnance n° 96-50 du 24 janvier 1996',
    },

    /* --- Prévoyance, forfait social, taxes assises sur les salaires --- */
    {
      code: 'FORFAIT_SOCIAL_PREVOYANCE',
      libelle: 'Forfait social sur la prévoyance',
      assiette: 'PART_PAT_PREV',
      tauxPatronal: 8,
      effectifMin: 11,
      fiabilite: 'verifie',
      reference: 'Article L.137-15 du Code de la sécurité sociale',
    },
    {
      code: 'TAXE_APPRENTISSAGE',
      libelle: 'Taxe d’apprentissage',
      assiette: 'TOTALITE',
      tauxPatronal: 0.68,
      fiabilite: 'verifie',
      commentaire: 'Taux de 0,44 % en Alsace-Moselle.',
      reference: 'Article L.6241-1 du Code du travail',
    },
    {
      code: 'FORMATION_MOINS_11',
      libelle: 'Contribution à la formation professionnelle (moins de 11 salariés)',
      assiette: 'TOTALITE',
      tauxPatronal: 0.55,
      effectifMax: 10,
      fiabilite: 'verifie',
      reference: 'Article L.6331-1 du Code du travail',
    },
    {
      code: 'FORMATION_11_PLUS',
      libelle: 'Contribution à la formation professionnelle (11 salariés et plus)',
      assiette: 'TOTALITE',
      tauxPatronal: 1,
      effectifMin: 11,
      fiabilite: 'verifie',
      reference: 'Article L.6331-1 du Code du travail',
    },
    {
      code: 'CPF_CDD',
      libelle: 'Contribution CPF-CDD',
      assiette: 'TOTALITE',
      tauxPatronal: 1,
      fiabilite: 'verifie',
      commentaire: 'Due sur les rémunérations des salariés en CDD uniquement.',
      reference: 'Article L.6331-6 du Code du travail',
    },
    {
      code: 'VERSEMENT_MOBILITE',
      libelle: 'Versement mobilité',
      assiette: 'TOTALITE',
      tauxVariable: true,
      fiabilite: 'verifie',
      commentaire: 'Taux fixé par l’autorité organisatrice de mobilité : non contrôlable a priori.',
      reference: 'Article L.2333-64 du Code général des collectivités territoriales',
    },
    {
      code: 'PREVOYANCE',
      libelle: 'Prévoyance',
      assiette: 'SPECIFIQUE',
      tauxVariable: true,
      fiabilite: 'verifie',
      commentaire: 'Taux fixé par l’accord de branche ou le contrat collectif.',
    },
    {
      code: 'MUTUELLE',
      libelle: 'Complémentaire santé',
      assiette: 'SPECIFIQUE',
      tauxVariable: true,
      fiabilite: 'verifie',
      commentaire: 'Montant forfaitaire ou taux issu du contrat collectif.',
      reference: 'Article L.911-7 du Code de la sécurité sociale',
    },
  ];
}

/** Applique des modifications ciblées au socle, par code de cotisation. */
function ajuster(
  base: BaremeCotisation[],
  patchs: Record<string, Partial<BaremeCotisation>>,
): BaremeCotisation[] {
  return base.map((c) => (patchs[c.code] ? { ...c, ...patchs[c.code] } : c));
}

/* ------------------------------------------------------------------ */
/* Constantes stables d'une période à l'autre                          */
/* ------------------------------------------------------------------ */

const CONSTANTES_STABLES = {
  abattementCsg: 1.75,
  plafondAbattementCsgEnPass: 4,
  titreRestaurantPartPatronale: { min: 50, max: 60 },
  mutuellePartPatronaleMin: 50,
  transportPublicPriseEnChargeMin: 50,
  heuresComplementaires: { majorationJusquauDixieme: 10, majorationAuDela: 25 },
  tempsPartiel: { dureeMinimaleHebdo: 24 },
  congesPayes: {
    acquisitionMensuelleOuvrables: 2.5,
    acquisitionMensuelleOuvres: 2.08,
    maxAnnuelOuvrables: 30,
    tauxIndemniteCompensatrice: 10,
  },
  cdd: { tauxPrecarite: 10, tauxPrecariteReduit: 6 },
  prescriptionSalairesMois: 36,
  dureeLegaleHebdo: 35,
  dureeLegaleMensuelle: 151.67,
} as const;

const HS_COMMUN = {
  majoration8Premieres: 25,
  majorationAuDela: 50,
  majorationMinimaleConventionnelle: 10,
  reductionSalarialeMax: 11.31,
  plafondExoIRAnnuel: 7500,
  deductionForfaitairePatronale: [
    { effectifMax: 19, montantParHeure: 1.5 },
    { effectifMax: 249, montantParHeure: 0.5 },
  ],
  contingentAnnuel: 220,
};

/* ------------------------------------------------------------------ */
/* Périodes                                                            */
/* ------------------------------------------------------------------ */

export const PERIODES: ParametresPeriode[] = [
  {
    cle: '2023-01',
    debut: '2023-01-01',
    fin: '2023-04-30',
    fiabilite: 'verifie',
    sources: [
      'Décret n° 2022-1608 du 22 décembre 2022 (SMIC au 1er janvier 2023)',
      'Arrêté du 9 décembre 2022 portant fixation du plafond de la sécurité sociale pour 2023',
    ],
    smicHoraire: 11.27,
    smicMensuel: 1709.28,
    minimumGaranti: 4.01,
    plafondMensuelSS: 3666,
    plafondAnnuelSS: 43992,
    plafondHoraireSS: 27,
    plafondJournalierSS: 202,
    titreRestaurantExoMax: 6.5,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.05, ags: 0.15, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2023-05',
    debut: '2023-05-01',
    fin: '2023-12-31',
    fiabilite: 'verifie',
    sources: [
      'Arrêté du 26 avril 2023 relatif au relèvement du salaire minimum de croissance',
      'Arrêté du 9 décembre 2022 (plafond de la sécurité sociale 2023)',
      'Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie (montant net social)',
    ],
    avertissement:
      'Le « montant net social » est obligatoire sur les bulletins émis à compter du 1er juillet 2023.',
    smicHoraire: 11.52,
    smicMensuel: 1747.2,
    minimumGaranti: 4.1,
    plafondMensuelSS: 3666,
    plafondAnnuelSS: 43992,
    plafondHoraireSS: 27,
    plafondJournalierSS: 202,
    titreRestaurantExoMax: 6.91,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.05, ags: 0.15, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2024-01',
    debut: '2024-01-01',
    fin: '2024-10-31',
    fiabilite: 'verifie',
    sources: [
      'Décret n° 2023-1216 du 20 décembre 2023 (SMIC au 1er janvier 2024)',
      'Arrêté du 19 décembre 2023 portant fixation du plafond de la sécurité sociale pour 2024',
      'BOSS - Bulletin officiel de la sécurité sociale, rubrique « Avantages en nature et frais professionnels »',
    ],
    smicHoraire: 11.65,
    smicMensuel: 1766.92,
    minimumGaranti: 4.15,
    plafondMensuelSS: 3864,
    plafondAnnuelSS: 46368,
    plafondHoraireSS: 29,
    plafondJournalierSS: 213,
    titreRestaurantExoMax: 7.18,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.05, ags: 0.25, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2024-11',
    debut: '2024-11-01',
    fin: '2024-12-31',
    fiabilite: 'verifie',
    sources: [
      'Décret n° 2024-951 du 23 octobre 2024 (relèvement du SMIC au 1er novembre 2024)',
      'Arrêté du 19 décembre 2023 (plafond de la sécurité sociale 2024)',
    ],
    smicHoraire: 11.88,
    smicMensuel: 1801.8,
    minimumGaranti: 4.15,
    plafondMensuelSS: 3864,
    plafondAnnuelSS: 46368,
    plafondHoraireSS: 29,
    plafondJournalierSS: 213,
    titreRestaurantExoMax: 7.18,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.05, ags: 0.25, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2025-01',
    debut: '2025-01-01',
    fin: '2025-04-30',
    fiabilite: 'verifie',
    sources: [
      'Arrêté du 19 décembre 2024 portant fixation du plafond de la sécurité sociale pour 2025',
      'SMIC maintenu à 11,88 € au 1er janvier 2025 (revalorisation anticipée au 1er novembre 2024)',
    ],
    smicHoraire: 11.88,
    smicMensuel: 1801.8,
    minimumGaranti: 4.22,
    plafondMensuelSS: 3925,
    plafondAnnuelSS: 47100,
    plafondHoraireSS: 29,
    plafondJournalierSS: 216,
    titreRestaurantExoMax: 7.26,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.05, ags: 0.25, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2025-05',
    debut: '2025-05-01',
    fin: '2025-12-31',
    fiabilite: 'verifie',
    sources: [
      'Convention d’assurance chômage du 15 novembre 2024 (baisse de la contribution patronale à 4,00 % au 1er mai 2025)',
      'Arrêté du 19 décembre 2024 (plafond de la sécurité sociale 2025)',
    ],
    smicHoraire: 11.88,
    smicMensuel: 1801.8,
    minimumGaranti: 4.22,
    plafondMensuelSS: 3925,
    plafondAnnuelSS: 47100,
    plafondHoraireSS: 29,
    plafondJournalierSS: 216,
    titreRestaurantExoMax: 7.26,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: socleCotisations({ chomage: 4.0, ags: 0.25, fiabiliteAgs: 'a_confirmer' }),
  },
  {
    cle: '2026-01',
    debut: '2026-01-01',
    fin: null,
    fiabilite: 'a_confirmer',
    sources: [
      'AUCUNE SOURCE VÉRIFIÉE — valeurs reconduites de la période 2025-05.',
      'À mettre à jour depuis : arrêté annuel du plafond de la sécurité sociale, décret SMIC, BOSS.',
    ],
    avertissement:
      'Les paramètres 2026 (SMIC, plafond de la sécurité sociale, taux de cotisations) sont reconduits de 2025 et N’ONT PAS ÉTÉ VÉRIFIÉS. Mettez-les à jour dans « Paramètres légaux » avant d’exploiter un rapport portant sur cette période.',
    smicHoraire: 11.88,
    smicMensuel: 1801.8,
    minimumGaranti: 4.22,
    plafondMensuelSS: 3925,
    plafondAnnuelSS: 47100,
    plafondHoraireSS: 29,
    plafondJournalierSS: 216,
    titreRestaurantExoMax: 7.26,
    ...CONSTANTES_STABLES,
    heuresSupplementaires: HS_COMMUN,
    cotisations: ajuster(
      socleCotisations({ chomage: 4.0, ags: 0.25, fiabiliteAgs: 'a_confirmer' }),
      Object.fromEntries(
        [
          'MALADIE',
          'VIEILLESSE_PLAFONNEE',
          'VIEILLESSE_DEPLAFONNEE',
          'ALLOCATIONS_FAMILIALES',
          'CHOMAGE',
          'AGS',
          'RETRAITE_COMP_T1',
          'RETRAITE_COMP_T2',
          'CEG_T1',
          'CEG_T2',
          'CET',
          'CSG_DEDUCTIBLE',
          'CSG_CRDS_NON_DEDUCTIBLE',
          'CSG_NON_DEDUCTIBLE',
          'CRDS',
        ].map((code) => [code, { fiabilite: 'reconduit' as const }]),
      ),
    ),
  },
];

/** Dernière période dont les valeurs ont été vérifiées à la source. */
export const DERNIERE_PERIODE_VERIFIEE = '2025-05';
