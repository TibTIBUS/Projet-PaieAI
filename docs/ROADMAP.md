# Feuille de route

## État actuel

Ce qui fonctionne aujourd'hui, de bout en bout :

- import de PDF, avec reconnaissance optique de secours pour les scans
- 43 contrôles couvrant le calcul, les cotisations, le temps de travail, les congés, les
  avantages, la conformité du bulletin et la cohérence dans la durée
- référentiel légal daté et sourcé, vérifié jusqu'à la période 2025-05, corrigeable
  depuis l'application
- rapport détaillé, exportable en PDF ; suivi pluri-mensuel ; export du dossier en JSON
- analyse intégralement locale, sans compte ni serveur

## 1. Rendre l'abonnement réel

**C'est la seule fonctionnalité annoncée qui n'est pas réellement en place.** Le contrôle
de l'abonnement s'effectue aujourd'hui dans le navigateur : il relève de l'ergonomie, pas
de la sécurité, et reste contournable par quiconque sait ouvrir les outils de développement.
C'est dit explicitement à l'utilisateur sur la page Tarifs.

La difficulté tient au choix d'architecture : sans serveur, il n'existe aucun endroit sûr
où vérifier qu'un abonnement est actif. Deux options compatibles avec l'hébergement
gratuit :

**Option A — fonction serverless de vérification (recommandée).**
Netlify Functions ou Cloudflare Workers, tous deux gratuits dans les volumes attendus.
Stripe encaisse et émet une licence signée ; la fonction vérifie la signature ; le
navigateur conserve le jeton. Aucun bulletin ne transite : seule la licence circule.
Le modèle de confidentialité reste intact.

**Option B — licence signée hors ligne.**
Une paire de clés asymétriques : la clé privée signe les licences lors de l'achat, la clé
publique embarquée dans l'application les vérifie. Aucune infrastructure, mais la
révocation devient impossible et une licence partagée reste valable.

L'option A est préférable. Étapes :

- [ ] compte Stripe, produits « Suivi » et « Foyer », lien de paiement
- [ ] fonction de vérification (webhook Stripe → émission d'une licence signée)
- [ ] vérification de la signature côté client, avec durée de validité
- [ ] gestion du renouvellement, de l'expiration et de la révocation
- [ ] conditions générales de vente, mentions légales, droit de rétractation

## 2. Tenir le référentiel à jour

C'est ce dont dépend la crédibilité du produit. Une valeur périmée produit des faux
constats en série.

- [ ] mettre à jour la période 2026 dès publication des textes (actuellement reconduite
      de 2025 et signalée comme non vérifiée)
- [ ] procédure de veille : arrêté annuel du plafond, décret SMIC, circulaires
      Agirc-Arrco, BOSS, convention d'assurance chômage
- [ ] test de non-régression garantissant qu'aucune période ne reste `a_confirmer` plus
      d'un trimestre après sa date d'entrée en vigueur
- [ ] page publique d'historique du référentiel, consultable sans installer l'application

## 3. Élargir la couverture métier

Par ordre décroissant de valeur pour l'utilisateur :

- [ ] **Minima conventionnels par branche.** Aujourd'hui saisis à la main. Une base
      couvrant les vingt conventions les plus représentées (Syntec, HCR, métallurgie,
      commerce de détail, bâtiment…) débloquerait le contrôle le plus rentable en
      pratique.
- [ ] **Réduction générale de cotisations patronales.** Calcul du coefficient et
      vérification du montant : erreur fréquente, mais sans impact direct sur le net du
      salarié.
- [ ] **Régularisation progressive des plafonds.** Nécessite le cumul annuel, donc
      l'import de tous les bulletins de l'année.
- [ ] **Indemnités de rupture.** Régime social et fiscal des indemnités de licenciement
      et de rupture conventionnelle : enjeux financiers élevés, règles complexes.
- [ ] **Grille du taux neutre de prélèvement à la source.** Permettrait de vérifier le
      taux appliqué sans que l'utilisateur ait à le saisir.
- [ ] **Avantages en nature au forfait** : véhicule, logement, repas.
- [ ] **Barèmes propres** : apprentis, VRP, intermittents, mandataires sociaux.

## 4. Fiabiliser l'extraction

- [ ] jeu de bulletins réels anonymisés issus des principaux éditeurs (Silae, Sage,
      Cegid, ADP, PayFit, Nibelis), servant de tests de non-régression du parser
- [ ] écran de correction manuelle : afficher les lignes lues, permettre de rectifier
      un montant mal extrait avant analyse
- [ ] enrichissement du dictionnaire de libellés à partir des cas non reconnus
- [ ] import direct du fichier DSN lorsqu'il est accessible au salarié — la donnée y est
      structurée, l'extraction devient exacte

## 5. Faire valider par un professionnel

Étape indispensable avant toute commercialisation. Le protocole est décrit dans
[VALIDATION-EXPERT-COMPTABLE.md](VALIDATION-EXPERT-COMPTABLE.md).

- [ ] audit du référentiel période par période
- [ ] passage sur un échantillon de bulletins réels couvrant les cas types
- [ ] relecture des 43 contrôles et de leurs fondements
- [ ] recensement des contrôles manquants à forte valeur
- [ ] mention de la validation dans l'application, avec sa date et son périmètre

## 6. Diffusion

- [ ] page publique de démonstration sans import de fichier
- [ ] contenu éditorial : les erreurs de paie les plus fréquentes, comment lire son
      bulletin, comment réclamer un rappel de salaire
- [ ] modèles de courriers de réclamation, préremplis depuis le rapport
- [ ] version destinée aux TPE : le même moteur, vu du côté employeur, pour contrôler la
      paie avant émission

## Hors périmètre, volontairement

- **Héberger les bulletins.** Ce serait renoncer au seul avantage structurel du produit.
- **Se substituer à un professionnel.** L'outil détecte et documente ; la qualification
  juridique et la démarche relèvent d'un expert-comptable, d'un avocat ou d'un syndicat.
- **Produire des bulletins.** C'est un autre métier, lourdement réglementé.
