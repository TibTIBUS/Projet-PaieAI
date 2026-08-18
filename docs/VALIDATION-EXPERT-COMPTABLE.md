# Protocole de validation par un professionnel de la paie

Ce document s'adresse à l'expert-comptable, au gestionnaire de paie ou au juriste en
droit social sollicité pour valider PaieAI. Il décrit ce qu'il faut vérifier, dans quel
ordre, et ce que l'outil garantit déjà par construction.

L'objectif n'est pas d'obtenir un blanc-seing, mais d'identifier précisément où l'outil
se trompe, où il est trop prudent, et où il manque un contrôle qui aurait de la valeur.

## Ce que la conception garantit déjà

Avant d'entrer dans le détail, trois propriétés structurelles limitent le risque de
constat erroné :

1. **Séparation entre le droit et le code.** Toutes les valeurs légales sont regroupées
   dans un fichier unique et daté ([`referentiel/data.ts`](../src/domain/referentiel/data.ts)),
   avec leur source et leur niveau de fiabilité. Aucun taux n'est codé en dur ailleurs.
   Vous pouvez donc auditer le droit sans lire la logique des contrôles.
2. **Aucun constat hasardeux.** Un contrôle qui a besoin d'une information absente du
   bulletin n'est pas exécuté. Il apparaît dans le rapport avec la raison de son
   écartement. Le rapport ne comble jamais un trou par une hypothèse.
3. **Gradation de la confiance.** Chaque anomalie porte un niveau — *certaine*,
   *probable*, *à vérifier* — et l'interface incite systématiquement à faire confirmer
   avant toute démarche.

## Étape 1 — Valider le référentiel légal (2 à 3 heures)

C'est l'étape la plus rentable : une erreur de référentiel se propage à tous les
bulletins.

Ouvrez [`docs/CONTROLES.md`](CONTROLES.md), section « Référentiel légal utilisé », qui
liste les périodes et leurs valeurs pivots. Puis, période par période, dans
[`referentiel/data.ts`](../src/domain/referentiel/data.ts) :

- [ ] SMIC horaire et mensuel, à la date d'entrée en vigueur exacte
- [ ] Plafonds de la sécurité sociale : mensuel, annuel, horaire, journalier
- [ ] Taux salariaux et patronaux de chaque ligne du barème
- [ ] Seuils d'effectif (FNAL, forfait social, contribution formation)
- [ ] Seuils de rémunération (maladie à 2,5 SMIC, allocations familiales à 3,5 SMIC)
- [ ] Plafonds d'exonération : titres-restaurant, heures supplémentaires
- [ ] Dates de bascule intra-annuelles (revalorisation du SMIC, évolution d'un taux)

Les valeurs se corrigent directement dans l'application, écran *Paramètres* →
*Paramètres légaux*, sans intervention sur le code. Cochez « J'ai vérifié ces valeurs
à la source » pour chaque période auditée.

**Signalez en priorité** toute valeur marquée `verifie` que vous savez inexacte : c'est
le cas le plus grave, puisque l'outil la présente alors comme certaine.

## Étape 2 — Éprouver le moteur sur des bulletins réels (une demi-journée)

Prenez une dizaine de bulletins issus de dossiers que vous connaissez, en variant
délibérément les cas :

- non-cadre au SMIC, cadre au-delà du plafond (tranche 2, CET, APEC)
- temps partiel avec heures complémentaires
- mois d'entrée ou de sortie (plafond réduit)
- arrêt maladie avec subrogation
- CDD avec indemnité de précarité
- établissement en Alsace-Moselle
- convention collective à primes spécifiques

Pour chacun, comparez le rapport à votre propre contrôle et notez :

| À noter | Pourquoi c'est important |
| --- | --- |
| **Faux positifs** | Anomalie signalée alors que le bulletin est correct. C'est le défaut le plus coûteux : il détruit la confiance et peut pousser un salarié à une démarche infondée. |
| **Faux négatifs** | Erreur réelle non détectée. Indique un contrôle manquant ou un seuil trop permissif. |
| **Montants inexacts** | L'impact chiffré est ce qui déclenche l'action : il doit être juste ou clairement présenté comme une estimation. |
| **Formulations trompeuses** | Le rapport s'adresse à un salarié non spécialiste. Une explication ambiguë est un défaut à part entière. |
| **Sévérité mal calibrée** | Une anomalie sans impact financier ne doit pas être classée « critique », et inversement. |

Le mode d'essai de l'application (page d'accueil, « Essayez avec un exemple ») permet de
se familiariser avec le format du rapport avant d'attaquer des bulletins réels.

## Étape 3 — Relire les contrôles un à un (2 à 4 heures)

Le catalogue [`docs/CONTROLES.md`](CONTROLES.md) est généré depuis le code : il décrit
exactement ce qui s'exécute. Pour chaque contrôle, vérifiez :

- [ ] Le fondement cité est le bon article, dans sa version applicable à la période
- [ ] La règle métier est correctement énoncée dans la description
- [ ] Les conditions d'écartement (`applicable`) couvrent bien les cas où le contrôle
      n'a pas de sens
- [ ] La tolérance d'arrondi est adaptée (les arrondis de paie se cumulent)
- [ ] Le niveau de confiance annoncé correspond à la solidité réelle du constat

Le code de chaque contrôle se trouve dans `src/domain/engine/controles/`, un fichier par
famille. Les contrôles sont écrits pour être lisibles par un non-développeur : nommage en
français, une règle par fonction, calcul explicite dans le champ `detail`.

## Étape 4 — Identifier les contrôles manquants

Question ouverte, et sans doute la plus utile : **quelles erreurs voyez-vous
régulièrement en cabinet que l'outil ne cherche pas ?**

Zones connues comme non couvertes à ce jour :

- régularisation progressive ou annuelle des plafonds
- calcul détaillé de la réduction générale de cotisations patronales
- indemnités de rupture et leur régime social et fiscal
- grille du taux neutre de prélèvement à la source
- minima conventionnels par branche et coefficient
- avantages en nature évalués au forfait (véhicule, logement, repas)
- salariés à employeurs multiples, expatriés, mandataires sociaux
- intermittents, VRP, apprentis (barèmes propres)

## Comment nous transmettre vos retours

Le plus efficace, pour un constat contesté :

1. Le **code du contrôle** (`ARI-01`, `COT-03`…), visible sur chaque carte du rapport
2. Le **contexte** : période, statut, situation particulière
3. Le **constat produit** et ce qui aurait dû être produit
4. Le **fondement** de votre position

Le rapport est exportable en PDF (bouton *Télécharger le rapport*), et le dossier complet
en JSON (écran *Mes bulletins*, *Exporter le dossier*) — cet export ne contient aucune
donnée nominative et se transmet sans risque.

## Après validation

Une fois une période auditée et corrigée, il reste à répercuter le résultat dans le code
pour que tous les utilisateurs en bénéficient : voir [REFERENTIEL.md](REFERENTIEL.md),
section « Mettre à jour une période ». Les corrections saisies dans l'application ne
valent que pour le navigateur où elles ont été faites.
