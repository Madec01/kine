# Kiné · Bibliothèque d’exercices

Application web privée pour constituer **sa propre bibliothèque d’exercices de kinésithérapie en gériatrie**, utilisable sur ordinateur, téléphone et tablette, et partageable avec des collègues.

La bibliothèque est **entièrement vide au départ** : exercices, familles de tags et tags sont créés par l’utilisateur. Aucun contenu n’est prérempli.

## Ce que fait l’application

- **Exercices** : création, modification, duplication, suppression. Champs : nom, description, consignes, position de départ, matériel, dosage (séries, répétitions, durée, récupération), difficulté, variantes, progressions, précautions, notes personnelles, plusieurs images et une vidéo (fichier joint ou lien). Tous les champs sauf le nom peuvent rester vides.
- **Tags personnalisés en familles indépendantes** : familles et tags se créent, se renomment, se déplacent et se suppriment librement ; les associations sont mises à jour automatiquement. Un exercice peut porter plusieurs tags d’une même famille et de plusieurs familles.
- **Recherche multicritère** : texte (sans tenir compte des accents ni de la casse) combiné à des tags de plusieurs familles. **ET entre familles, OU à l’intérieur d’une famille** (commutable en ET), filtre de difficulté, exercices sans tag. Résultats en cartes ou en liste, filtres mémorisés dans l’adresse.
- **Fiches PDF** : sélection temporaire d’exercices, réordonnancement, titre et sous-titre, choix des rubriques (description, consignes, dosage, images, tags, précautions, variantes, vidéo, notes), génération d’un **PDF A4** téléchargeable avec images et **QR code vers la vidéo**. Les sélections peuvent être **enregistrées et rechargées**.
- **Hors connexion d’abord** : toutes les données vivent dans le navigateur (IndexedDB) ; l’application fonctionne sans réseau, y compris la génération de PDF avec les images présentes sur l’appareil.
- **Sauvegarde en ligne économe** (Firebase Firestore, offre gratuite) : seuls les éléments modifiés sont envoyés, par lots, une minute après le dernier changement, à la fermeture ou sur le bouton « Sauvegarder ». Au démarrage, une seule lecture suffit à savoir s’il y a du nouveau ; un autre appareil ne télécharge que ce qui a changé. Les images sont compressées et téléchargées à la demande.
- **Plusieurs appareils sans compte ni saisie** : tous les appareils qui ouvrent le site partagent automatiquement la même bibliothèque, identifiée à partir de la configuration Firebase intégrée au site.
- **Export JSON** complet (familles, tags, associations, exercices, images intégrées, fiches) et import (ajout ou remplacement) : sauvegarde de secours et porte de sortie vers une autre solution.
- **Application installable** (PWA) sur l’écran d’accueil.

## Architecture

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Interface | [Vite](https://vite.dev) + React + TypeScript, application monopage | Se publie sur un hébergement statique (le GitHub Pages déjà utilisé), sans serveur à maintenir. Next.js n’apporterait rien ici : il n’y a aucune logique serveur, la sauvegarde parle directement à Firestore. |
| Données | IndexedDB (bibliothèque `idb`), un enregistrement par entité avec journal des modifications | Source de vérité de l’appareil, lecture instantanée, fonctionnement hors connexion. |
| Sauvegarde en ligne | [Firebase Firestore](https://firebase.google.com) sans écouteur temps réel | Quota gratuit largement suffisant si l’on n’écrit que les changements et ne relit jamais toute la base ; voir `docs/strategie-sauvegarde-firebase.md`. |
| PDF | `@react-pdf/renderer` dans le navigateur | Fiche A4 générée directement à partir des exercices, sans serveur. |

Le code s’appuie sur une interface `Repository` (`src/data/repository.ts`) implémentée par le dépôt local ; un moteur de synchronisation (`src/sync/engine.ts`) rejoue le journal vers Firestore. La recherche, l’export, l’import, la fusion et la synchronisation sont testés unitairement.

```
src/
  data/        types, interface Repository, schéma IndexedDB, dépôt local avec journal
  sync/        moteur de synchronisation, règles de fusion, accès Firestore, clé de bibliothèque
  domain/      recherche multicritère, export/import
  pdf/         document A4 et génération (chargés à la demande)
  state/       dépôt, bibliothèque, synchronisation, sélection, notifications
  pages/       exercices, fiche, formulaire, tags, sélection, réglages
  components/  mise en page, filtres, chips, dialogues, indicateur de sauvegarde…
docs/
  strategie-sauvegarde-firebase.md   conception détaillée de la sauvegarde
firestore.rules                       règles Firestore à coller dans la console
tests/
  unit/        Vitest (recherche, export/import, dépôt local, synchronisation, PDF)
  e2e/         parcours complets dans Chromium (Playwright)
```

## Mise en route

### 1. Essayer immédiatement (sans sauvegarde en ligne)

```sh
npm install
npm run dev
```

Ouvrir <http://localhost:5173>. Sans configuration Firebase, l’indicateur affiche « Local seulement » : les données restent dans le navigateur. Pensez à exporter un fichier JSON depuis **Réglages**.

### 2. Activer la sauvegarde en ligne (Firebase, offre gratuite)

1. Créer un projet sur <https://console.firebase.google.com> (offre Spark, sans carte bancaire). Refuser Google Analytics, inutile ici.
2. **Build → Firestore Database → Créer une base de données**, emplacement en Europe (`eur3` ou `europe-west`), démarrer en **mode production**.
3. Onglet **Règles** : remplacer le contenu par celui du fichier `firestore.rules` du dépôt, puis **Publier**. Ces règles interdisent de lister les bibliothèques et n’acceptent que des identifiants longs.
4. **Paramètres du projet → Vos applications → Ajouter une application Web** (icône `</>`), sans hébergement Firebase. Relever `apiKey` et `projectId` (et `appId`).
5. Déclarer ces valeurs :
   - en local : fichier `.env` d’après `.env.example` ;
   - sur GitHub : **Settings → Secrets and variables → Actions**, secrets `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` (et `VITE_FIREBASE_APP_ID`).
6. Déployer (ci-dessous). À la première ouverture, l’application envoie les données déjà présentes sur l’appareil ; l’indicateur du menu passe à « Sauvegardé en ligne ».

**Attention, version sans compte** : le site est public et sa configuration Firebase est intégrée au code, donc **toute personne qui ouvre l’adresse du site peut lire et modifier la bibliothèque**. C’est le choix fait pour démarrer simplement ; quand vous voudrez fermer l’accès, l’étape suivante est une connexion Google (un appui par appareil) sans changer la structure des données.

### 3. Déployer

**GitHub Pages (déjà utilisé par ce dépôt)** : dans **Settings → Pages**, choisir **Source : GitHub Actions**. Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque poussée sur `main` avec les secrets ci-dessus. L’adresse reste <https://madec01.github.io/kine/>.

**Vercel ou Netlify** : importer le dépôt, commande `npm run build`, dossier `dist`, variables `VITE_FIREBASE_*` (ne pas définir `VITE_BASE`). Prévoir la réécriture de toutes les routes vers `index.html`.

### 4. Installer sur le téléphone

Ouvrir le site, puis **Réglages → Installer Kiné** (Android, Chrome) ou **Partager → Sur l’écran d’accueil** (iPhone, Safari).

## Utiliser plusieurs appareils

Ouvrir le site sur l’autre appareil : c’est tout. Les textes sont téléchargés (quelques centaines de lectures au plus, une seule fois), les listes s’affichent avec leurs vignettes, et chaque image complète est téléchargée à la première ouverture de sa fiche. Le bouton **Télécharger les images** (Réglages) prépare un usage hors connexion complet. Les modifications faites sur un appareil apparaissent sur l’autre à son prochain démarrage, à son retour au premier plan après quinze minutes, ou avec **Vérifier les modifications en ligne**.

Pour des besoins particuliers (bibliothèque de test, réinitialisation), la variable de build `VITE_LIBRARY_KEY` impose un autre identifiant de bibliothèque.

## Comment la sauvegarde économise le quota

- Chaque exercice, chaque famille (avec ses tags) et chaque fiche est **un seul document**. Dix modifications d’un même exercice avant l’envoi coûtent une écriture ; renommer un tag coûte une écriture quel que soit le nombre d’exercices concernés ; supprimer un tag ne réécrit aucun exercice.
- **Envoi** : une minute après le dernier changement (cinq minutes au plus en saisie continue), à la mise en arrière-plan ou à la fermeture, et sur le bouton « Sauvegarder ». Un seul lot par envoi.
- **Vérification** : au démarrage et au retour au premier plan après quinze minutes, une lecture du document de bibliothèque ; rien d’autre n’est lu si le jeton n’a pas changé. Sinon, seules les entités modifiées depuis la dernière synchronisation sont téléchargées (horodatage serveur, suppressions propagées par marqueurs).
- **Images** : compressées à 1 000 px au plus, un document chacune, jamais lues au démarrage ; une vignette de quelques kilo-octets est rangée dans l’exercice pour les listes. Les vidéos jointes restent sur l’appareil : utiliser un lien pour les retrouver ailleurs et dans le PDF.
- **Garde-fous** : compteurs du jour affichés dans Réglages, plafonds internes (5 000 lectures, 3 000 écritures) bien en dessous du quota gratuit, délais croissants en cas d’erreur, aucun écouteur temps réel.

Le détail (modèle de données, fusion entre appareils, scénarios, budget) est dans `docs/strategie-sauvegarde-firebase.md`.

## Sauvegarde et pérennité

- **Export JSON** (Réglages) : exercices, familles, tags, associations, fiches et images (option). Format documenté dans `src/domain/exportImport.ts`, indépendant de Firebase : il suffit à repartir sur une autre solution technique.
- **Import** : « Ajouter » réutilise les familles et tags de même nom ; « Remplacer » vide la bibliothèque avant d’importer (irréversible, confirmation demandée).
- **Firestore** : les données en ligne restent disponibles tant que le projet Firebase existe ; un export JSON régulier reste la sauvegarde indépendante recommandée.
- **Données personnelles** : cette bibliothèque n’est pas un dossier patient, **aucune donnée nominative de résident** ne doit y être saisie. Les dosages et précautions relèvent de l’évaluation clinique du praticien.

## Développement

```sh
npm run dev         # serveur de développement
npm test            # tests unitaires (Vitest)
npm run typecheck   # vérification TypeScript
npm run build       # production dans dist/ (404.html et .nojekyll ajoutés pour GitHub Pages)
npm run test:e2e    # build puis parcours complets dans Chromium (test-results/) ; nécessite Playwright et Chromium
npm run icons       # régénère les icônes PNG à partir du SVG
```

Le test de bout en bout (Playwright : `npm i -D playwright && npx playwright install chromium` si absent) crée familles, tags, exercices avec image, vérifie la recherche combinée (ET entre familles, OU/ET dans une famille), la sélection, la génération du PDF, la duplication, le renommage et la suppression de tags, l’export et l’import, la persistance et l’affichage téléphone. Les tests unitaires de synchronisation simulent deux appareils et un Firestore en mémoire : lots, lectures incrémentales, suppressions, conflits, images à la demande, hors connexion, quota.

Variables de build : `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (facultatif), `VITE_BASE` (sous-dossier de publication, `/kine/` pour GitHub Pages).

## Évolutions prévues

Comptes et partage par rôles (propriétaire, collaborateur, lecteur) au-dessus de la clé de bibliothèque, stockage des vidéos si le plan Blaze est un jour accepté, gestion plus fine des médias, améliorations ergonomiques issues de l’usage réel.
