# Catalogue des contrôles

> Ce fichier est généré automatiquement par `npm run docs` à partir du code source (`src/domain/engine/controles/`). Ne le modifiez pas à la main : corrigez le contrôle, puis régénérez.

PaieAI exécute **43 contrôles** sur chaque bulletin. Un contrôle qui a besoin d’une information absente du bulletin n’est pas exécuté : il est listé dans le rapport avec la raison de son écartement, plutôt que de produire un constat hasardeux.

## Sommaire

- [Cohérence arithmétique](#coherence-arithmetique) — 8 contrôle(s)
- [Taux de cotisations](#taux-de-cotisations) — 3 contrôle(s)
- [Assiettes de cotisations](#assiettes-de-cotisations) — 4 contrôle(s)
- [Salaire minimum](#salaire-minimum) — 3 contrôle(s)
- [Temps de travail](#temps-de-travail) — 7 contrôle(s)
- [Congés et fin de contrat](#conges-et-fin-de-contrat) — 4 contrôle(s)
- [Fiscalité](#fiscalite) — 3 contrôle(s)
- [Avantages et protection sociale](#avantages-et-protection-sociale) — 5 contrôle(s)
- [Conformité du bulletin](#conformite-du-bulletin) — 2 contrôle(s)
- [Cohérence dans la durée](#coherence-dans-la-duree) — 4 contrôle(s)

## Cohérence arithmétique

### `ARI-01` — Cohérence base × taux de chaque cotisation

Vérifie que, pour chaque ligne de cotisation, le montant retenu correspond bien à la base multipliée par le taux affiché.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-02` — Total brut = somme des éléments de rémunération

Additionne les éléments de rémunération et compare le résultat au brut affiché.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-03` — Total des cotisations salariales

Additionne les parts salariales de toutes les cotisations et compare au total affiché.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-04` — Net à payer avant impôt

Vérifie que le net avant impôt correspond au brut diminué des cotisations salariales.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-05` — Net à payer après impôt

Vérifie que le net versé correspond au net avant impôt diminué du prélèvement à la source et des retenues.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-07` — Montant net social

Recalcule le montant net social : rémunération brute augmentée des contributions patronales de protection sociale complémentaire, diminuée des cotisations salariales.

**Fondement :**

- [Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie (montant net social)](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047088980)

### `ARI-08` — Total versé par l’employeur

Vérifie que le coût employeur affiché correspond au brut augmenté des cotisations patronales et diminué des allègements.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)

### `ARI-10` — Cohérence des lignes de protection sociale complémentaire

Vérifie que les parts salariale et patronale des lignes de mutuelle et de prévoyance sont bien toutes deux renseignées.

**Fondement :**

- Article L.911-7 du Code de la sécurité sociale

## Taux de cotisations

### `COT-01` — Conformité des taux de cotisations

Compare chaque taux de cotisation figurant sur le bulletin au taux légal ou conventionnel en vigueur sur la période.

**Fondement :**

- Articles D.242-3 et suivants du Code de la sécurité sociale
- Accord national interprofessionnel Agirc-Arrco

### `COT-03` — Présence des cotisations obligatoires

Vérifie que les cotisations obligatoires du régime général figurent bien sur le bulletin.

**Fondement :**

- Article R.3243-1 du Code du travail
- Article L.242-1 du Code de la sécurité sociale

### `COT-04` — Cotisations salariales indues

Détecte les retenues salariales qui ne devraient pas exister, comme une cotisation maladie salariale hors Alsace-Moselle.

**Fondement :**

- Article D.242-3 du Code de la sécurité sociale

## Assiettes de cotisations

### `ASS-01` — Assiette des cotisations plafonnées

Vérifie que les cotisations de tranche 1 sont calculées sur une assiette limitée au plafond mensuel de la Sécurité sociale.

**Fondement :**

- Article D.242-17 du Code de la sécurité sociale
- BOSS — Assiette générale, plafond de la Sécurité sociale

### `ASS-02` — Découpage des tranches 1 et 2

Vérifie que la tranche 1 s’arrête au plafond mensuel et que la tranche 2 couvre exactement la part comprise entre 1 et 8 plafonds.

**Fondement :**

- Accord national interprofessionnel Agirc-Arrco — tranches de cotisation

### `ASS-03` — Assiette de CSG et de CRDS

Recalcule l’assiette de CSG/CRDS : 98,25 % de la rémunération brute, augmentée des contributions patronales de protection sociale complémentaire.

**Fondement :**

- Article L.136-1-1 du Code de la sécurité sociale
- Article L.136-8 du Code de la sécurité sociale — abattement de 1,75 % plafonné à 4 PASS

### `ASS-04` — Assiette des cotisations déplafonnées

Vérifie que les cotisations dues sur la totalité du salaire portent bien sur l’intégralité du brut.

**Fondement :**

- Article L.242-1 du Code de la sécurité sociale

## Salaire minimum

### `SMI-01` — Respect du SMIC horaire

Compare le taux horaire du salaire de base au SMIC horaire en vigueur sur la période.

**Fondement :**

- Articles L.3231-2 et suivants du Code du travail — salaire minimum de croissance

### `SMI-02` — Respect du SMIC mensuel

Compare la rémunération mensuelle brute au SMIC mensualisé, pour un salarié à temps complet et sans absence.

**Fondement :**

- Article L.3232-1 du Code du travail

### `SMI-03` — Respect du minimum conventionnel

Compare la rémunération au minimum conventionnel de la branche saisi par l’utilisateur.

**Fondement :**

- Article L.2253-1 du Code du travail — primauté de la branche sur les salaires minima hiérarchiques

## Temps de travail

### `HRS-01` — Majoration des heures supplémentaires

Vérifie que chaque heure supplémentaire est payée avec la majoration annoncée, calculée sur le taux horaire de base.

**Fondement :**

- Article L.3121-36 du Code du travail — majoration de 25 % puis 50 %
- Article L.3121-33 du Code du travail — taux conventionnel minimal de 10 %

### `HRS-02` — Réduction salariale sur heures supplémentaires

Vérifie la présence de la réduction de cotisations salariales d’assurance vieillesse due sur les heures supplémentaires.

**Fondement :**

- Article L.241-17 du Code de la sécurité sociale
- Article D.241-21 du Code de la sécurité sociale — taux plafonné à 11,31 %

### `HRS-04` — Déduction forfaitaire patronale sur heures supplémentaires

Vérifie la présence de la déduction forfaitaire de cotisations patronales pour les entreprises de moins de 250 salariés.

**Fondement :**

- Article L.241-18 du Code de la sécurité sociale

### `HRS-05` — Majoration des heures complémentaires

Vérifie que les heures complémentaires d’un temps partiel sont majorées d’au moins 10 %.

**Fondement :**

- Article L.3123-29 du Code du travail — majoration de 10 % puis 25 %

### `HRS-06` — Durée minimale du temps partiel

Vérifie que la durée contractuelle d’un temps partiel atteint le minimum légal de 24 heures hebdomadaires.

**Fondement :**

- Article L.3123-27 du Code du travail — durée minimale de 24 heures par semaine
- Article L.3123-7 du Code du travail — dérogations

### `HRS-07` — Contingent annuel d’heures supplémentaires

Suit le cumul annuel d’heures supplémentaires et alerte à l’approche du contingent légal.

**Fondement :**

- Article L.3121-30 du Code du travail — contrepartie obligatoire en repos au-delà du contingent
- Article D.3121-24 du Code du travail — contingent de 220 heures à défaut d’accord

### `HRS-08` — Valorisation des absences

Vérifie que la retenue pour absence est valorisée au même taux horaire que le salaire de base.

**Fondement :**

- Cour de cassation, chambre sociale — la retenue doit être strictement proportionnelle à la durée de l’absence

## Congés et fin de contrat

### `CP-01` — Acquisition mensuelle des congés payés

Vérifie que le compteur de congés progresse de 2,5 jours ouvrables (ou 2,08 jours ouvrés) par mois travaillé.

**Fondement :**

- Article L.3141-3 du Code du travail — 2,5 jours ouvrables par mois de travail effectif
- Article L.3141-5 du Code du travail — périodes assimilées à du travail effectif

### `CP-02` — Cohérence du compteur de congés payés

Détecte un solde de congés négatif ou une évolution incohérente du compteur.

**Fondement :**

- Article R.3243-1 du Code du travail — mention des congés sur le bulletin

### `CP-03` — Indemnité compensatrice de congés payés

Vérifie que l’indemnité compensatrice atteint au moins le dixième de la rémunération brute de la période de référence.

**Fondement :**

- Article L.3141-24 du Code du travail — règle du dixième et du maintien de salaire
- Article L.3141-28 du Code du travail — indemnité compensatrice en fin de contrat

### `CP-04` — Indemnité de fin de contrat à durée déterminée

Vérifie que l’indemnité de précarité atteint 10 % de la rémunération brute totale du contrat.

**Fondement :**

- Article L.1243-8 du Code du travail — indemnité de fin de contrat de 10 %
- Article L.1243-9 du Code du travail — taux réduit de 6 % sous conditions

## Fiscalité

### `ARI-06` — Net imposable

Recalcule le net imposable : net avant impôt, augmenté de la CSG/CRDS non déductible et de la part patronale de protection sociale complémentaire.

**Fondement :**

- Article 83 du Code général des impôts
- Article L.136-8 du Code de la sécurité sociale — CSG non déductible

### `ARI-09` — Calcul du prélèvement à la source

Vérifie que l’impôt retenu correspond au net imposable multiplié par le taux appliqué.

**Fondement :**

- Article 204 H du Code général des impôts — assiette du prélèvement à la source

### `HRS-03` — Exonération d’impôt sur les heures supplémentaires

Vérifie que la rémunération des heures supplémentaires est bien exclue du net imposable, dans la limite annuelle légale.

**Fondement :**

- Article 81 quater du Code général des impôts — exonération plafonnée à 7 500 € nets par an

## Avantages et protection sociale

### `AVA-01` — Participation de l’employeur à la complémentaire santé

Vérifie que l’employeur finance au moins la moitié de la couverture collective obligatoire de complémentaire santé.

**Fondement :**

- Article L.911-7 du Code de la sécurité sociale — financement patronal d’au moins 50 %
- Article D.911-1 du Code de la sécurité sociale — panier de soins minimal

### `AVA-02` — Titres-restaurant

Vérifie que la participation patronale au titre-restaurant reste dans les bornes légales et sous le plafond d’exonération.

**Fondement :**

- Article R.3262-4 du Code du travail — participation patronale comprise entre 50 % et 60 %
- Article 81, 19° du Code général des impôts — plafond d’exonération

### `AVA-03` — Prise en charge des frais de transport public

Vérifie que l’employeur rembourse au moins la moitié de l’abonnement de transport public du salarié.

**Fondement :**

- Article L.3261-2 du Code du travail — prise en charge obligatoire de 50 %
- Article R.3261-1 du Code du travail

### `AVA-04` — Réintégration de la part patronale de protection sociale complémentaire

Vérifie que la part patronale de mutuelle et de prévoyance est bien ajoutée au net imposable.

**Fondement :**

- Article 83, 1° quater du Code général des impôts
- Article L.242-1 du Code de la sécurité sociale

### `AVA-05` — Évolution de la cotisation de protection sociale complémentaire

Signale une hausse importante de la part salariale de mutuelle par rapport au mois précédent.

**Fondement :**

- Article L.911-1 du Code de la sécurité sociale

## Conformité du bulletin

### `CNF` — Mentions obligatoires du bulletin de paie

Vérifie la présence des mentions que le Code du travail impose de faire figurer sur le bulletin de paie.

**Fondement :**

- [Article R.3243-1 du Code du travail — mentions obligatoires du bulletin de paie](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047251955)
- Arrêté du 31 janvier 2023 modifiant le modèle de bulletin de paie

### `CNF-09` — Fiabilité de la lecture du bulletin

Signale une extraction incomplète, qui rendrait les autres contrôles peu fiables.

## Cohérence dans la durée

### `HIS-01` — Variation du salaire brut

Compare le brut au bulletin précédent et signale une variation inexpliquée.

**Fondement :**

- Article L.1221-1 du Code du travail — force obligatoire du contrat de travail

### `HIS-02` — Disparition d’un élément de rémunération récurrent

Repère les primes et avantages présents sur les bulletins précédents et absents du bulletin courant.

**Fondement :**

- Cour de cassation — une prime constante, générale et fixe devient un usage d’entreprise obligatoire

### `HIS-03` — Changement de taux de cotisation

Signale un taux de cotisation qui change d’un mois à l’autre sans changement de barème.

**Fondement :**

- Barèmes de cotisations sociales en vigueur

### `HIS-04` — Cohérence des cumuls annuels

Compare le cumul annuel affiché sur le bulletin à la somme des bruts des bulletins importés.

**Fondement :**

- Article R.3243-1 du Code du travail

## Référentiel légal utilisé

Les contrôles s’appuient sur 7 périodes de paramètres, vérifiées jusqu’à la période **2025-05** incluse.

| Période | Entrée en vigueur | SMIC horaire | Plafond mensuel SS | Fiabilité |
| --- | --- | ---: | ---: | --- |
| 2023-01 | 2023-01-01 | 11.27 € | 3 666 € | Vérifié |
| 2023-05 | 2023-05-01 | 11.52 € | 3 666 € | Vérifié |
| 2024-01 | 2024-01-01 | 11.65 € | 3 864 € | Vérifié |
| 2024-11 | 2024-11-01 | 11.88 € | 3 864 € | Vérifié |
| 2025-01 | 2025-01-01 | 11.88 € | 3 925 € | Vérifié |
| 2025-05 | 2025-05-01 | 11.88 € | 3 925 € | Vérifié |
| 2026-01 | 2026-01-01 | 11.88 € | 3 925 € | **À confirmer** |

Voir [REFERENTIEL.md](REFERENTIEL.md) pour la procédure de mise à jour et les sources officielles.
