# PaieAI

Analyse automatisée des bulletins de paie français et détection des erreurs.

PaieAI recalcule intégralement un bulletin de paie, confronte chaque ligne au droit
en vigueur **le mois concerné**, et chiffre en euros ce qu'une anomalie coûte au
salarié — sur le mois, puis sur les trois années de prescription des salaires
(article L.3245-1 du Code du travail).

**Tout s'exécute dans le navigateur, par défaut.** Aucun bulletin n'est téléversé,
aucun compte n'est requis, aucune donnée ne transite par un serveur. Ce n'est pas une
limitation technique mais le cœur du produit : un bulletin de paie est une donnée
personnelle sensible, et la meilleure garantie que l'on puisse offrir est de ne pas la
collecter. Une seule fonctionnalité optionnelle déroge à cette règle — l'assistant
conversationnel, décrit plus bas — et seulement si l'utilisateur l'active lui-même.

## Ce que fait l'outil

- **43 contrôles** par bulletin — voir le [catalogue complet](docs/CONTROLES.md)
- **Référentiel légal daté** : un bulletin de mars 2024 est contrôlé avec les valeurs
  de mars 2024, pas celles d'aujourd'hui
- **Contrôles longitudinaux** : prime disparue, taux modifié, compteur de congés
  incohérent — ce qu'un bulletin isolé ne peut pas révéler
- **Rapport transmissible** : chaque constat cite le texte applicable, exportable en PDF
  pour le service paie, un expert-comptable ou un conseil
- **Assistant conversationnel (optionnel)** : explique le rapport en langage courant et
  retient au fil de la discussion les informations que le moteur ne peut pas lire sur le
  bulletin (effectif, minimum conventionnel…), au lieu de les demander dans un formulaire

## L'assistant conversationnel

Sur chaque rapport, un bouton « Activer l'assistant » ouvre une conversation en langage
naturel. Il ne calcule rien et n'invente aucun taux ni article de loi : il reçoit les
résultats déjà produits par le moteur déterministe et se contente de les expliquer, de
répondre aux questions, et de mémoriser ce que l'utilisateur lui dit sur sa situation
(via un appel d'outil qui met à jour les mêmes paramètres que l'écran *Paramètres*).

C'est la seule fonctionnalité de l'application qui communique avec l'extérieur, et elle
est strictement volontaire :

- **Fonctionnement « apportez votre clé » (BYOK)** : chaque personne colle sa propre clé
  API Anthropic (obtenue sur [console.anthropic.com](https://console.anthropic.com/settings/keys)),
  conservée uniquement dans le stockage local de son navigateur. Aucune clé partagée ne
  transite par un serveur à nous — c'est le seul modèle compatible avec une application
  100 % statique, sans backend, et c'est ce qui a permis de garder GitHub Pages comme
  hébergement sans rien changer d'autre à l'architecture.
- **Rien par défaut** : la politique de sécurité de contenu n'autorise qu'une seule
  destination hors de l'application (`api.anthropic.com`), et aucune requête ne part tant
  qu'aucune clé n'a été saisie.
- **Coût à la charge de l'utilisateur** : chaque question est facturée par Anthropic
  directement au titulaire de la clé, de l'ordre de quelques centimes. PaieAI ne
  facture rien pour cette fonctionnalité et n'en tire aucune marge.

La page *Confidentialité* de l'application (menu bas de page) détaille précisément ce
que cette fonctionnalité change une fois activée.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
```

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert le build de production |
| `npm test` | suite de tests (parser + moteur de contrôle) |
| `npm run docs` | régénère `docs/CONTROLES.md` depuis le code |

Aucune variable d'environnement, aucune base de données, aucun service externe.

## Architecture

```
src/
  domain/              cœur métier, sans dépendance au navigateur ni à React
    types.ts             modèle : Bulletin, LignePaie, Anomalie, ResultatAnalyse
    referentiel/         paramètres légaux datés, sourcés, avec niveau de fiabilité
    parsing/             PDF → texte → Bulletin structuré
    engine/              catalogue de contrôles et orchestrateur
    fixtures/            bulletins de démonstration (tests + mode essai)
  lib/                 état persisté, import de fichiers, exports
  ui/                  composants et pages React
```

Le dossier `domain/` ne connaît ni le DOM ni React : il est testable en Node, ce qui
permet de valider le moteur indépendamment de l'interface. Voir
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le détail des choix de conception.

## Fiabilité et limites

L'honnêteté sur ce que l'outil ne sait pas faire est une exigence de conception :

- **Le référentiel est daté et vérifié jusqu'à une période précise.** Au-delà, les
  valeurs sont reconduites, signalées comme non vérifiées, les anomalies qui en
  découlent sont affichées « à vérifier » et pèsent moitié moins dans le score.
  La procédure de mise à jour est décrite dans [docs/REFERENTIEL.md](docs/REFERENTIEL.md).
- **Un contrôle sans l'information nécessaire n'est pas exécuté.** Il apparaît dans le
  rapport avec la raison de son écartement, plutôt que de produire un faux constat.
- **Certaines situations sortent du champ couvert** : régimes spéciaux, expatriation,
  mandataires sociaux, certaines exonérations sectorielles, conventions collectives aux
  règles propres. Un écart signalé peut être parfaitement légitime dans ces cas.
- **Le rapport n'est ni un conseil juridique, ni une attestation comptable.** Il est
  conçu pour être vérifié par un professionnel : c'est pourquoi chaque constat expose
  son calcul complet et cite son fondement.

Le protocole de validation par un expert-comptable est décrit dans
[docs/VALIDATION-EXPERT-COMPTABLE.md](docs/VALIDATION-EXPERT-COMPTABLE.md).

## Déploiement

Le site est un ensemble de fichiers statiques, sans dépendance à aucun service externe :
n'importe quel hébergeur statique convient.

### GitHub Pages (gratuit sur dépôt public)

Le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) construit et
publie le site à chaque `push` sur `main`. Il active GitHub Pages tout seul au premier
passage, injecte le bon chemin de base et dépose un `404.html` pour que le routage côté
client fonctionne sur les liens directs.

Deux prérequis, à faire une fois :

1. **Rendre le dépôt public** — *Settings* → *General* → *Change repository visibility*.
   GitHub Pages n'est gratuit que sur les dépôts publics.
2. **Amener le code sur `main`** — le workflow s'y déclenche. L'environnement
   `github-pages` restreint par défaut les déploiements à la branche par défaut.

Le site est ensuite servi sur `https://<compte>.github.io/Projet-PaieAI/`.

### Chemin de base

Le build lit la variable `VITE_BASE` (`/` par défaut) : c'est ce qui permet au même code
de fonctionner à la racine d'un domaine comme sous un sous-chemin.

```bash
npm run build                            # racine : https://exemple.fr/
VITE_BASE=/Projet-PaieAI/ npm run build  # sous-chemin : https://compte.github.io/Projet-PaieAI/
```

### Quasiment aucune ressource externe

L'application ne charge rien depuis un tiers : la police de caractères est auto-hébergée,
et le moteur de reconnaissance optique — habituellement récupéré depuis un CDN — est copié
depuis `node_modules` vers `public/tesseract/` avant chaque build (`npm run ressources`,
exécuté automatiquement par `prebuild`).

Une politique de sécurité de contenu déclarée dans [`index.html`](index.html) verrouille ce
comportement : `connect-src` n'autorise que l'application elle-même (`'self'`) et, à titre
de seule exception nommément déclarée, `api.anthropic.com` pour l'assistant conversationnel
optionnel décrit plus haut — jamais sollicité tant qu'aucune clé n'est renseignée. La
promesse « vos bulletins ne quittent pas votre appareil, sauf si vous choisissez le
contraire » devient ainsi une règle appliquée par le navigateur, qu'une régression du code
ferait échouer visiblement.

## Feuille de route

Les étapes suivantes — paiement réel, mise à jour assistée du référentiel, couverture
conventionnelle — sont décrites dans [docs/ROADMAP.md](docs/ROADMAP.md).

## Licence

Aucune licence n'est encore attachée à ce dépôt. Tant qu'aucun fichier `LICENSE` n'est
ajouté, tous les droits sont réservés par défaut.
