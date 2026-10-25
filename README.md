# Kiné · Bibliothèque d’exercices

Application web privée pour constituer **sa propre bibliothèque d’exercices de kinésithérapie en gériatrie**, utilisable sur ordinateur, téléphone et tablette, et partageable avec des collègues.

La bibliothèque est **entièrement vide au départ** : exercices, familles de tags et tags sont créés par l’utilisateur. Aucun contenu n’est prérempli.

## Ce que fait l’application

- **Exercices** : création, modification, duplication, suppression. Champs : nom, description, consignes, position de départ, matériel, dosage (séries, répétitions, durée, récupération), difficulté, variantes, progressions, précautions, notes personnelles, plusieurs images et une vidéo (fichier joint ou lien). Tous les champs sauf le nom peuvent rester vides.
- **Tags personnalisés en familles indépendantes** : familles et tags se créent, se renomment, se déplacent et se suppriment librement ; les associations sont mises à jour automatiquement. Un exercice peut porter plusieurs tags d’une même famille et de plusieurs familles.
- **Recherche multicritère** : texte (sans tenir compte des accents ni de la casse) combiné à des tags de plusieurs familles. **ET entre familles, OU à l’intérieur d’une famille** (commutable en ET), filtre de difficulté, exercices sans tag. Résultats en cartes ou en liste, filtres mémorisés dans l’adresse.
- **Fiches PDF** : sélection temporaire d’exercices, réordonnancement, titre et sous-titre, choix des rubriques (description, consignes, dosage, images, tags, précautions, variantes, vidéo, notes), génération d’un **PDF A4** téléchargeable avec images et **QR code vers la vidéo**. Les sélections peuvent être **enregistrées et rechargées**.
- **Sauvegarde** : export JSON complet (familles, tags, associations, exercices, images intégrées, fiches) et import (ajout ou remplacement).
- **Partage** (mode Supabase) : propriétaire, collaborateur (consultation et modification), lecteur (consultation et PDF). Les droits sont appliqués **en base de données** par des politiques RLS, pas seulement dans l’interface.
- **Application installable** (PWA) sur l’écran d’accueil ; l’interface fonctionne hors connexion.

## Architecture

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Interface | [Vite](https://vite.dev) + React + TypeScript, application monopage | Se publie sur un hébergement statique (le GitHub Pages déjà utilisé), sans serveur à maintenir. Next.js n’apporterait rien ici : toute la logique serveur est portée par Supabase. |
| Données, comptes, droits | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) | Sécurité côté serveur par RLS, stockage privé des médias, sauvegardes, export SQL possible. |
| PDF | `@react-pdf/renderer` dans le navigateur | Fiche A4 générée directement à partir des exercices, sans serveur. |
| Mode local | IndexedDB du navigateur | Permet d’essayer l’application sans compte ; données sur un seul appareil, **sans sécurité**. |

Le code s’appuie sur une interface `Repository` (`src/data/repository.ts`) implémentée pour Supabase et pour le mode local ; la recherche, l’export et l’import sont de la logique pure testée unitairement.

```
src/
  data/        types, interface Repository, adaptateurs Supabase et local
  domain/      recherche multicritère, export/import
  pdf/         document A4 et génération (chargés à la demande)
  state/       authentification, bibliothèque, sélection, notifications
  pages/       exercices, fiche, formulaire, tags, sélection, réglages, connexion
  components/  mise en page, filtres, chips, dialogues…
supabase/
  migrations/0001_schema.sql   schéma complet (tables, triggers, RPC, RLS, bucket)
  tests/                       vérification du schéma et des politiques sur un PostgreSQL local
tests/
  unit/        Vitest (recherche, export/import, dépôt local)
  e2e/         parcours complets dans Chromium (Playwright)
```

## Mise en route

### 1. Essayer immédiatement (mode local)

```sh
npm install
npm run dev
```

Ouvrir <http://localhost:5173>. Sans configuration Supabase, l’application tourne en **mode local** : un bandeau « Mode local » le rappelle, les données restent dans le navigateur. Pensez à exporter une sauvegarde depuis **Réglages**.

### 2. Mettre en place l’espace privé en ligne (Supabase)

1. Créer un projet sur <https://supabase.com> (offre gratuite suffisante pour démarrer), région Europe.
2. Dans **SQL Editor**, coller et exécuter le contenu de `supabase/migrations/0001_schema.sql`. Le script est idempotent : il peut être relancé sans dommage. Il crée les tables, les fonctions, les politiques RLS et le bucket privé `media`.
3. Dans **Authentication → Providers → Email**, laisser l’e-mail activé. Vous pouvez désactiver « Confirm email » pour simplifier la première connexion, ou le garder.
4. Dans **Authentication → URL Configuration**, renseigner la **Site URL** du site (par exemple `https://madec01.github.io/kine/`) et l’ajouter aux **Redirect URLs** (nécessaire pour les liens de confirmation et de réinitialisation de mot de passe).
5. Récupérer l’**URL du projet** et la **clé anon** dans **Project Settings → API**, puis les déclarer :
   - en local : fichier `.env` d’après `.env.example` ;
   - sur GitHub : **Settings → Secrets and variables → Actions**, secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
6. Déployer (ci-dessous), ouvrir le site, **créer votre compte** (onglet « Créer un compte »). La première connexion crée automatiquement votre bibliothèque.
7. **Rendre l’espace privé** : dans **Authentication → Sign In / Providers**, désactiver « Allow new users to sign up ». Même si une personne non invitée créait un compte, elle ne verrait qu’une bibliothèque vide : les politiques RLS n’exposent jamais vos données. Pour inviter plus tard un collègue, réactiver temporairement les inscriptions ou utiliser **Authentication → Users → Invite user**.

La clé « anon » est faite pour être embarquée dans le site : elle n’ouvre aucun droit par elle-même, ce sont les politiques RLS qui décident.

### 3. Déployer

**GitHub Pages (recommandé, déjà utilisé par ce dépôt)** : dans **Settings → Pages**, choisir **Source : GitHub Actions**. Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque poussée sur `main` avec les secrets ci-dessus. L’adresse reste <https://madec01.github.io/kine/>.

**Vercel ou Netlify** : importer le dépôt, commande `npm run build`, dossier `dist`, variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (ne pas définir `VITE_BASE`). Prévoir la réécriture de toutes les routes vers `index.html`.

### 4. Installer sur le téléphone

Ouvrir le site, puis **Réglages → Installer Kiné** (Android, Chrome) ou **Partager → Sur l’écran d’accueil** (iPhone, Safari).

## Partage avec des collègues

Depuis **Réglages → Partage**, le propriétaire saisit l’adresse e-mail d’un collègue et choisit son rôle. L’accès s’active dès que la personne se connecte avec un compte portant exactement cette adresse. Les rôles peuvent être modifiés ou retirés à tout moment ; un collègue qui accède à plusieurs bibliothèques choisit la bibliothèque active dans les réglages.

| Rôle | Exercices, tags, fiches | Médias | Partage |
| --- | --- | --- | --- |
| Propriétaire | lecture et écriture | lecture, envoi, suppression | gère les membres |
| Collaborateur | lecture et écriture | lecture, envoi, suppression | — |
| Lecteur | lecture, génération de PDF | lecture | — |

## Sauvegarde et pérennité

- **Export JSON** (Réglages) : exercices, familles, tags, associations, fiches et images (option). Format documenté dans `src/domain/exportImport.ts`, indépendant de Supabase : il suffit à repartir sur une autre solution technique.
- **Import** : « Ajouter » réutilise les familles et tags de même nom ; « Remplacer » vide la bibliothèque avant d’importer (irréversible, confirmation demandée).
- **Base de données** : Supabase conserve des sauvegardes quotidiennes sur les offres payantes ; sur l’offre gratuite, l’export JSON régulier est la sauvegarde. Un `pg_dump` reste possible via la CLI Supabase.
- **Médias** : bucket privé, accessibles uniquement par URL signée pour les membres de la bibliothèque. Les vidéos jointes ne sont pas incluses dans l’export JSON ; préférer un lien (YouTube, Drive…) pour les vidéos volumineuses.

## Sécurité et données personnelles

Toute règle d’accès est une **politique RLS** PostgreSQL (`supabase/migrations/0001_schema.sql`, section 6) ou une politique du bucket (section 7). Des triggers empêchent d’associer un tag ou un exercice à une bibliothèque étrangère. Le mode local n’offre aucune protection : il est réservé aux essais ou à un appareil personnel.

Cette bibliothèque n’est pas un dossier patient : **aucune donnée nominative de résident** ne doit y être saisie (ni dans les notes, ni dans les fiches). Les dosages et précautions relèvent de l’évaluation clinique du praticien.

## Développement

```sh
npm run dev         # serveur de développement
npm test            # tests unitaires (Vitest)
npm run typecheck   # vérification TypeScript
npm run build       # production dans dist/ (404.html et .nojekyll ajoutés pour GitHub Pages)
npm run test:e2e    # build puis parcours complets dans Chromium (test-results/) ; nécessite Playwright et Chromium
npm run icons       # régénère les icônes PNG à partir du SVG
```

Le test de bout en bout (Playwright : `npm i -D playwright && npx playwright install chromium` si absent) crée familles, tags, exercices avec image, vérifie la recherche combinée (ET entre familles, OU/ET dans une famille), la sélection, la génération du PDF, la duplication, le renommage et la suppression de tags, l’export et l’import, la persistance et l’affichage téléphone. La vérification du schéma SQL et des politiques RLS est décrite dans `supabase/tests/README.md`.

Variables de build : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE` (sous-dossier de publication, `/kine/` pour GitHub Pages), `VITE_DATA_MODE=local` pour forcer le mode local.

## Évolutions prévues

Version 2 du cahier des charges : gestion plus fine des médias (réordonnancement, recadrage), fiches réutilisables enrichies (déjà disponibles sous forme simple), consultation hors connexion des données Supabase, améliorations ergonomiques issues de l’usage réel.
