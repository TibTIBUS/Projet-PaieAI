# Référentiel des paramètres légaux

Toutes les valeurs légales utilisées par les contrôles vivent dans un seul fichier :
[`src/domain/referentiel/data.ts`](../src/domain/referentiel/data.ts). Aucune valeur
n'est codée en dur dans le moteur. C'est un choix délibéré : un professionnel de la paie
peut valider le référentiel sans lire le code des contrôles, et réciproquement.

## Structure

Le référentiel est une liste de **périodes**, chacune étant un instantané complet des
paramètres en vigueur entre deux dates. La sélection se fait par date : on retient la
dernière période entrée en vigueur avant la fin du mois de paie analysé.

Une période ouverte en cours d'année est donc normale — la baisse de la contribution
patronale d'assurance chômage au 1er mai 2025 a créé la période `2025-05`, distincte
de `2025-01` alors que le SMIC et le plafond n'ont pas bougé.

## Niveaux de fiabilité

Chaque période, et chaque ligne de barème, porte un niveau de fiabilité :

| Niveau | Signification | Effet dans l'application |
| --- | --- | --- |
| `verifie` | Valeur relevée dans le texte officiel cité en source | Les anomalies peuvent être présentées comme certaines |
| `reconduit` | Valeur de la période précédente reprise faute de source vérifiée | Anomalies rétrogradées en « à vérifier » |
| `a_confirmer` | Valeur à confirmer impérativement avant exploitation | Bandeau d'avertissement sur le rapport, pénalité de score divisée par deux |

Cette gradation est visible par l'utilisateur : un rapport portant sur une période non
vérifiée affiche un bandeau explicite et invite à corriger les paramètres.

**Les contrôles purement arithmétiques ne sont jamais dégradés** : vérifier que
`base × taux = montant` ne dépend d'aucune valeur légale, et reste donc un constat ferme
quelle que soit la période.

## Mettre à jour une période

### 1. Sources officielles à consulter

| Paramètre | Source de référence |
| --- | --- |
| SMIC horaire et mensuel | Décret ou arrêté annuel de revalorisation, publié au *Journal officiel* |
| Plafond de la sécurité sociale | Arrêté annuel « portant fixation du plafond de la sécurité sociale », *Journal officiel* |
| Taux de cotisations de sécurité sociale | Code de la sécurité sociale, articles D.242-3 et suivants |
| Barème général, assiettes, exonérations | [BOSS — Bulletin officiel de la sécurité sociale](https://boss.gouv.fr) |
| Retraite complémentaire, CEG, CET | Circulaires Agirc-Arrco |
| Assurance chômage et AGS | Convention d'assurance chômage en vigueur ; décisions du conseil d'administration de l'AGS |
| Titres-restaurant, frais professionnels | BOSS, rubrique « Avantages en nature et frais professionnels » |
| Minima conventionnels | Convention collective de branche applicable (identifiée par son IDCC) |

### 2. Deux façons de corriger

**Depuis l'application**, écran *Paramètres* → *Paramètres légaux*. Chaque période est
dépliable : on y corrige le SMIC, le plafond et les principaux seuils, puis on coche
« J'ai vérifié ces valeurs à la source ». La correction est enregistrée localement et
prime sur le référentiel livré. C'est la voie destinée à l'expert-comptable qui valide
l'outil sans toucher au code.

**Dans le code**, pour une correction destinée à tous les utilisateurs : ajoutez une
entrée dans `PERIODES`, renseignez `sources` avec la référence exacte du texte, passez
`fiabilite` à `'verifie'`, et mettez à jour la constante `DERNIERE_PERIODE_VERIFIEE`.

### 3. Ajouter une nouvelle période

```ts
{
  cle: '2026-01',
  debut: '2026-01-01',
  fin: null,                      // null = toujours en vigueur
  fiabilite: 'verifie',
  sources: [
    'Arrêté du … portant fixation du plafond de la sécurité sociale pour 2026',
    'Décret n° …-… du … relatif au salaire minimum de croissance',
  ],
  smicHoraire: …,
  smicMensuel: …,                 // valeur officielle arrondie, pas le produit recalculé
  plafondMensuelSS: …,
  plafondAnnuelSS: …,
  // … les autres champs sont documentés dans referentiel/types.ts
  cotisations: socleCotisations({ chomage: …, ags: … }),
}
```

Fermez la période précédente en renseignant sa date de `fin`, puis exécutez
`npm test` : les tests du moteur vérifient que la sélection par date reste cohérente.
Terminez par `npm run docs` pour régénérer le tableau des périodes dans le catalogue.

## État actuel

Les valeurs sont vérifiées jusqu'à la période **2025-05** incluse. La période **2026-01**
reconduit les valeurs de 2025 et porte un avertissement explicite : elle **doit** être
mise à jour avant d'exploiter un rapport portant sur 2026.

Ce n'est pas un oubli mais une position assumée : reconduire une valeur en le signalant
vaut mieux qu'inventer un chiffre plausible. L'application dégrade automatiquement la
confiance des constats qui en découlent.

## Points d'attention connus

- **Taux AGS** : révisé par le conseil d'administration de l'AGS, hors calendrier
  législatif. Il est marqué `a_confirmer` en permanence et ne déclenche jamais de constat
  ferme.
- **Taux AT/MP et versement mobilité** : propres à chaque entreprise et à chaque commune.
  Ils sont marqués `tauxVariable` et exclus du contrôle de conformité des taux — seule
  leur cohérence arithmétique est vérifiée.
- **Minima conventionnels** : il n'existe pas de base publique exploitable couvrant les
  quelque 400 conventions collectives. Le contrôle correspondant (`SMI-03`) n'est activé
  que si l'utilisateur saisit lui-même le minimum applicable à son coefficient.
