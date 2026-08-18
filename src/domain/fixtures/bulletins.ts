/**
 * Bulletins de démonstration.
 *
 * Ils servent à deux choses : jeu de tests du parser et du moteur de contrôle,
 * et mode « essayer sans déposer de document » dans l'application.
 * Les données sont fictives.
 */

export interface BulletinDemo {
  cle: string;
  titre: string;
  description: string;
  /** Anomalies volontairement introduites, pour la documentation. */
  anomaliesAttendues: string[];
  texte: string;
}

/** Bulletin conforme : sert de référence, aucune anomalie majeure attendue. */
const CONFORME = `ENTREPRISE EXEMPLE SAS
12 rue de la Paix - 75002 PARIS
SIRET 123 456 789 00012 - Code APE 6201Z
URSSAF Ile-de-France - Organisme de recouvrement
Convention collective nationale : Syntec - IDCC : 1486
Effectif de l'entreprise : 8

BULLETIN DE PAIE
Période du 01/07/2025 au 31/07/2025 - Paiement le 31/07/2025

Matricule : 000145
Nom et prénom : Martin DUPONT
Emploi : Développeur informatique
Qualification : Non cadre - Coefficient : 275
Date d'entrée : 15/03/2021
Contrat : CDI - Temps complet
Horaire mensuel : 151,67 h

DESIGNATION                            BASE       TAUX      PART SALARIE    TAUX      PART EMPLOYEUR
Salaire de base                      151,67    13,1866         2 000,00
TOTAL BRUT                                                     2 000,00
Sécurité sociale - Maladie          2 000,00                                7,000            140,00
Sécurité sociale plafonnée          2 000,00     6,900           138,00     8,550            171,00
Sécurité sociale déplafonnée        2 000,00     0,400             8,00     2,020             40,40
Allocations familiales              2 000,00                                3,450             69,00
Contribution solidarité autonomie   2 000,00                                0,300              6,00
Accidents du travail                2 000,00                                1,200             24,00
FNAL                                2 000,00                                0,100              2,00
Assurance chômage                   2 000,00                                4,000             80,00
AGS                                 2 000,00                                0,250              5,00
Contribution dialogue social        2 000,00                                0,016              0,32
Retraite complémentaire T1          2 000,00     3,150            63,00     4,720             94,40
Contribution équilibre général T1   2 000,00     0,860            17,20     1,290             25,80
Complémentaire santé                   50,00    50,000            25,00    50,000             25,00
CSG déductible                      1 990,00     6,800           135,32
CSG/CRDS non déductible             1 990,00     2,900            57,71
Taxe d'apprentissage                2 000,00                                0,680             13,60
Formation professionnelle           2 000,00                                0,550             11,00
TOTAL DES COTISATIONS SALARIALES                                 444,23                      707,52
NET A PAYER AVANT IMPOT SUR LE REVENU                          1 555,77
MONTANT NET SOCIAL                                             1 580,77
NET IMPOSABLE                                                  1 638,48
Impôt sur le revenu prélevé à la source  1 638,48   3,500        57,35
NET A PAYER                                                    1 498,42
Total versé par l'employeur                                    2 707,52
Congés payés acquis 2,50 - pris 0,00 - solde 12,50 jours ouvrables
Cumul brut annuel 14 000,00 - Cumul net imposable 11 469,36
Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin sans limitation de durée.`;

/**
 * Bulletin comportant des erreurs courantes :
 *  - taux de vieillesse plafonnée salarial majoré (6,90 % → 7,90 %) ;
 *  - assiette de retraite complémentaire T1 supérieure au plafond ;
 *  - heures supplémentaires majorées à 10 % au lieu de 25 % ;
 *  - part patronale de complémentaire santé inférieure à 50 % ;
 *  - montant net social absent ;
 *  - FNAL au taux déplafonné de 0,50 % alors que l'effectif est de 32 salariés ;
 *  - aucune réduction salariale de cotisations sur les heures supplémentaires ;
 *  - mentions obligatoires manquantes (organisme de recouvrement, conservation).
 */
const AVEC_ERREURS = `SOCIETE TEST SARL
5 avenue des Champs - 69003 LYON
SIRET 987 654 321 00034 - Code APE 4711D
Convention collective nationale : Commerce de détail - IDCC : 2216
Effectif de l'entreprise : 32

BULLETIN DE PAIE
Période du 01/09/2025 au 30/09/2025 - Paiement le 30/09/2025

Matricule : 000312
Nom et prénom : Claire BERNARD
Emploi : Vendeuse
Qualification : Non cadre - Coefficient : 190
Date d'entrée : 02/01/2023
Contrat : CDI - Temps complet
Horaire mensuel : 151,67 h

DESIGNATION                            BASE       TAUX      PART SALARIE    TAUX      PART EMPLOYEUR
Salaire de base                      151,67    12,0000         1 820,04
Heures supplémentaires 25%            10,00    13,2000           132,00
TOTAL BRUT                                                     1 952,04
Sécurité sociale - Maladie          1 952,04                                7,000            136,64
Sécurité sociale plafonnée          1 952,04     7,900           154,21     8,550            166,90
Sécurité sociale déplafonnée        1 952,04     0,400             7,81     2,020             39,43
Allocations familiales              1 952,04                                3,450             67,35
Contribution solidarité autonomie   1 952,04                                0,300              5,86
Accidents du travail                1 952,04                                2,100             40,99
FNAL                                1 952,04                                0,500              9,76
Assurance chômage                   1 952,04                                4,000             78,08
AGS                                 1 952,04                                0,250              4,88
Retraite complémentaire T1          4 100,00     3,150           129,15     4,720            193,52
Contribution équilibre général T1   1 952,04     0,860            16,79     1,290             25,18
Complémentaire santé                   40,00    70,000            28,00    30,000             12,00
CSG déductible                      1 929,68     6,800           131,22
CSG/CRDS non déductible             1 929,68     2,900            55,96
Taxe d'apprentissage                1 952,04                                0,680             13,27
Formation professionnelle           1 952,04                                1,000             19,52
TOTAL DES COTISATIONS SALARIALES                                 523,14                      813,38
NET A PAYER AVANT IMPOT SUR LE REVENU                          1 428,90
NET IMPOSABLE                                                  1 496,86
Impôt sur le revenu prélevé à la source  1 496,86   1,300        19,46
NET A PAYER                                                    1 409,44
Total versé par l'employeur                                    2 765,42
Congés payés acquis 2,50 - pris 0,00 - solde 20,00 jours ouvrables`;

/**
 * Bulletin cadre au-delà du plafond, avec tranche 2, CET et APEC.
 * Erreur volontaire : le salaire est inférieur au minimum conventionnel saisi
 * et l'assiette de tranche 2 est mal découpée.
 */
const CADRE = `GROUPE CONSEIL SAS
40 rue de Rivoli - 75001 PARIS
SIRET 552 100 554 00021 - Code APE 7022Z
URSSAF Ile-de-France - Organisme de recouvrement
Convention collective nationale : Syntec - IDCC : 1486
Effectif de l'entreprise : 240

BULLETIN DE PAIE
Période du 01/06/2025 au 30/06/2025 - Paiement le 30/06/2025

Matricule : 000078
Nom et prénom : Julien MOREAU
Emploi : Consultant senior
Qualification : Cadre - Position 3.1
Date d'entrée : 01/09/2019
Contrat : CDI - Temps complet
Horaire mensuel : 151,67 h

DESIGNATION                            BASE       TAUX      PART SALARIE    TAUX      PART EMPLOYEUR
Salaire de base                      151,67    39,5600         6 000,00
Prime de performance                                             500,00
TOTAL BRUT                                                     6 500,00
Sécurité sociale - Maladie          6 500,00                               13,000            845,00
Sécurité sociale plafonnée          3 925,00     6,900           270,83     8,550            335,59
Sécurité sociale déplafonnée        6 500,00     0,400            26,00     2,020            131,30
Allocations familiales              6 500,00                                5,250            341,25
Contribution solidarité autonomie   6 500,00                                0,300             19,50
Accidents du travail                6 500,00                                0,900             58,50
FNAL                                6 500,00                                0,500             32,50
Assurance chômage                   6 500,00                                4,000            260,00
AGS                                 6 500,00                                0,250             16,25
Retraite complémentaire T1          3 925,00     3,150           123,64     4,720            185,26
Retraite complémentaire T2          2 575,00     8,640           222,48    12,950            333,46
Contribution équilibre général T1   3 925,00     0,860            33,76     1,290             50,63
Contribution équilibre général T2   2 575,00     1,080            27,81     1,620             41,72
Contribution équilibre technique    6 500,00     0,140             9,10     0,210             13,65
APEC                                6 500,00     0,024             1,56     0,036              2,34
Complémentaire santé                   80,00    50,000            40,00    50,000             40,00
CSG déductible                      6 428,75     6,800           437,15
CSG/CRDS non déductible             6 428,75     2,900           186,43
TOTAL DES COTISATIONS SALARIALES                               1 378,76                    2 366,45
NET A PAYER AVANT IMPOT SUR LE REVENU                          5 121,24
MONTANT NET SOCIAL                                             5 161,24
NET IMPOSABLE                                                  5 347,67
Impôt sur le revenu prélevé à la source  5 347,67  11,200       598,94
NET A PAYER                                                    4 522,30
Total versé par l'employeur                                    8 866,45
Congés payés acquis 2,50 - pris 5,00 - solde 8,00 jours ouvrables
Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin sans limitation de durée.`;

export const BULLETINS_DEMO: BulletinDemo[] = [
  {
    cle: 'conforme',
    titre: 'Bulletin conforme — non-cadre, 2 000 € brut',
    description:
      'Bulletin de juillet 2025 sans erreur connue. Sert de témoin : le rapport ne doit remonter aucune anomalie majeure.',
    anomaliesAttendues: [],
    texte: CONFORME,
  },
  {
    cle: 'erreurs',
    titre: 'Bulletin avec erreurs — non-cadre, heures supplémentaires',
    description:
      'Bulletin de septembre 2025 contenant cinq erreurs représentatives de ce que l’on rencontre en pratique.',
    anomaliesAttendues: [
      'Taux de vieillesse plafonnée salarial à 7,90 % au lieu de 6,90 %',
      'Assiette de retraite complémentaire tranche 1 supérieure au plafond mensuel',
      'Heures supplémentaires majorées en deçà de 25 %',
      'Part patronale de complémentaire santé inférieure à 50 %',
      'Montant net social absent du bulletin',
      'FNAL au taux de 0,50 % pour un effectif de 32 salariés (0,10 % attendu)',
      'Absence de réduction salariale de cotisations sur les heures supplémentaires',
      'Mentions obligatoires manquantes : organisme de recouvrement, conservation du bulletin',
    ],
    texte: AVEC_ERREURS,
  },
  {
    cle: 'cadre',
    titre: 'Bulletin cadre — 6 500 € brut, tranche 2',
    description:
      'Bulletin de juin 2025 d’un cadre dont la rémunération dépasse le plafond de la Sécurité sociale : tranche 2, CET et APEC.',
    anomaliesAttendues: [],
    texte: CADRE,
  },
];

export function bulletinDemo(cle: string): BulletinDemo | undefined {
  return BULLETINS_DEMO.find((b) => b.cle === cle);
}
