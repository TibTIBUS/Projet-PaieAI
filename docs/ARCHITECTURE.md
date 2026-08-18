# Architecture

## Le choix structurant : tout se passe dans le navigateur

Un bulletin de paie contient le nom du salarié, son employeur, sa rémunération, parfois
son numéro de sécurité sociale et sa situation de santé — au sens du RGPD, l'une des
catégories de données les plus sensibles qu'un particulier puisse manipuler.

L'application ne comporte donc **aucun serveur applicatif**. L'extraction du PDF, la
reconnaissance optique, l'analyse et la production du rapport s'exécutent intégralement
dans le navigateur. Il en découle trois conséquences, toutes favorables :

1. **Conformité par construction.** Sans collecte, il n'y a ni responsable de traitement,
   ni destinataire, ni durée de conservation, ni obligation d'information à gérer.
2. **Hébergement gratuit et durable.** Le produit est un ensemble de fichiers statiques.
   Le coût marginal d'un utilisateur est nul, ce qui rend soutenable un abonnement à
   quelques euros par mois.
3. **Argument commercial vérifiable.** « Vos bulletins ne quittent pas votre appareil »
   n'est pas une promesse contractuelle mais une propriété observable — l'application
   fonctionne hors connexion une fois chargée.

La contrepartie est réelle et assumée : pas de synchronisation entre appareils, pas de
sauvegarde de secours, et un contrôle d'abonnement qui ne peut pas être appliqué côté
serveur. Voir [ROADMAP.md](ROADMAP.md).

## Découpage

```
src/
  domain/          cœur métier — aucune dépendance au DOM ni à React
    types.ts       modèle : Bulletin, LignePaie, Anomalie, ResultatAnalyse
    referentiel/   paramètres légaux datés, sourcés, avec niveau de fiabilité
    parsing/       PDF → texte → Bulletin structuré
    engine/        catalogue de contrôles + orchestrateur
    fixtures/      bulletins de démonstration
  lib/             état persisté, import de fichiers, exports PDF et JSON
  ui/              composants et pages React
scripts/           génération du catalogue de contrôles
```

`domain/` est du TypeScript pur, testable en Node. Le moteur peut donc être validé sans
navigateur, réutilisé dans une extension, un service ou un outil en ligne de commande, et
audité indépendamment de l'interface.

## Chaîne de traitement

```
Fichier PDF
  └─ pdf.js ─────────────► fragments de texte positionnés
       └─ reconstruction ► lignes de texte, colonnes préservées
            └─ parser ───► Bulletin (lignes typées, totaux, en-tête)
                 └─ moteur ► ResultatAnalyse (anomalies chiffrées et sourcées)
                      └─ interface ► rapport lisible, export PDF
```

### Reconstitution de la mise en page

C'est le point technique le plus délicat. Un bulletin de paie est un tableau :

```
Sécurité sociale plafonnée   3 925,00   6,900   270,83   8,550   335,59
                             ▲ base     ▲ taux  ▲ part   ▲ taux  ▲ part
                                          sal.    sal.     pat.    pat.
```

Concaténer les fragments dans l'ordre de lecture perd l'alignement, et avec lui
l'information qui distingue une retenue salariale d'une charge patronale. Chaque fragment
est donc reprojeté sur une grille de caractères déduite de son abscisse, la largeur de
référence étant la médiane observée sur la page. Le résultat est un texte à chasse fixe
où les colonnes restent alignées.

### Interprétation des colonnes

Chaque éditeur de paie omet des colonnes différentes. Le parser tranche par ordre de
fiabilité décroissante :

1. **Cohérence arithmétique** : un triplet `(base, taux, montant)` tel que
   `base × taux ÷ 100 = montant` est presque certainement une vraie colonne.
2. **Barème attendu** : si le taux observé colle exactement au taux salarial ou patronal
   de référence, le côté est déterminé.
3. **Position apprise** : la frontière entre colonne salariale et colonne patronale est
   déduite des seules lignes que le barème a permis de trancher sans ambiguïté, puis
   appliquée aux lignes ambiguës.
4. **Ordre des colonnes** : à défaut, la part salariale précède la part patronale.

L'étape 3 est indispensable. Deux cas la rendent nécessaire, et aucune autre règle ne les
résout :

- une **cotisation à taux légitimement majoré** — maladie à 13 % au-delà de 2,5 SMIC —
  serait rattachée au mauvais côté par simple proximité au barème ;
- une **cotisation dont le taux est justement erroné** — 7,90 % au lieu de 6,90 % pour la
  vieillesse plafonnée — se retrouverait plus proche du taux patronal (8,55 %) que du
  taux salarial attendu, et l'erreur passerait inaperçue.

### Moteur de contrôle

Chaque contrôle est un objet autonome :

```ts
interface Controle {
  code: string;                  // ARI-01, COT-03…
  nom: string;
  categorie: CategorieControle;
  description: string;           // reprise telle quelle dans la documentation
  references: ReferenceLegale[];
  applicable?: (ctx) => string | null;   // raison de l'écartement, ou null
  executer: (ctx) => Anomalie[];
}
```

L'orchestrateur (`engine/index.ts`) :

- écarte les contrôles non applicables **en conservant la raison**, restituée à
  l'utilisateur ;
- **capture les exceptions** : un cas de paie exotique ne prive jamais l'utilisateur du
  reste du rapport ;
- **dégrade la confiance** de tous les constats non arithmétiques lorsque le référentiel
  de la période n'est pas vérifié ;
- **déduplique**, trie par gravité puis par montant, et calcule le score de conformité.

Ajouter un contrôle consiste à écrire un objet et à l'ajouter à un tableau. La
documentation se régénère avec `npm run docs`.

## Tests

`npm test` couvre la lecture des nombres, le parser et le moteur. Les tests s'appuient sur
trois bulletins de démonstration :

| Bulletin | Attendu |
| --- | --- |
| conforme | score 100, aucune anomalie, aucun impact chiffré |
| avec erreurs | huit anomalies documentées, 133,62 € d'écart mensuel |
| cadre | tranche 2, CET et APEC correctement traités, taux majorés acceptés |

Le bulletin conforme joue le rôle de témoin : il détecte les faux positifs, qui sont le
défaut le plus coûteux pour ce type d'outil.

## Performance

Le bundle initial pèse environ 78 Ko compressés. Sont chargés à la demande :

| Module | Déclenchement |
| --- | --- |
| pdf.js (107 Ko) | premier dépôt d'un PDF |
| Tesseract | uniquement si le PDF n'a pas de couche texte |
| jsPDF (118 Ko) | téléchargement d'un rapport |
| Recharts (151 Ko) | ouverture de l'écran de suivi |
