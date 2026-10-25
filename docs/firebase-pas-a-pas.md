# Firebase pas à pas

Objectif : activer la sauvegarde en ligne de la bibliothèque sur l’offre gratuite de Firebase,
sans compte utilisateur, puis vérifier qu’elle fonctionne et brancher un second appareil.
Compter une vingtaine de minutes. Aucune carte bancaire n’est demandée.

## A. Créer le projet Firebase

1. Ouvrir <https://console.firebase.google.com> et se connecter avec un compte Google.
2. **Créer un projet** (ou « Ajouter un projet »). Nom : `kine-bibliotheque` par exemple.
   Firebase propose un identifiant de projet dérivé du nom (ex. `kine-bibliotheque-3f2a1`) : c’est le
   **projectId**, à noter.
3. Quand Google Analytics est proposé : **désactiver** (inutile ici). Terminer la création.
4. Vérifier en bas du menu de gauche que le plan affiché est **Spark** (gratuit). Ne rien changer.

## B. Créer la base de données Firestore

1. Menu de gauche → **Créer** (ou « Build ») → **Firestore Database** → **Créer une base de données**.
2. Si un choix d’édition est proposé, prendre **Standard** (pas « Enterprise »).
3. Emplacement : choisir une région européenne, par exemple **eur3 (europe-west)** ou
   **europe-west1**. Ce choix est définitif pour le projet.
4. Mode de sécurité : **Mode production** (tout est refusé par défaut, nous mettrons nos règles juste après).
5. **Créer**. La base s’ouvre, vide.

## C. Publier les règles de sécurité

1. Dans Firestore Database, onglet **Règles**.
2. Supprimer tout le contenu de l’éditeur et coller le contenu du fichier `firestore.rules` du dépôt :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /libraries/{libraryId} {
      allow get, create, update: if libraryId.size() >= 20;
      allow list, delete: if false;

      match /{collection}/{docId} {
        allow read, write: if libraryId.size() >= 20
          && collection in ['families', 'exercises', 'sheets', 'media'];
      }
    }
  }
}
```

3. **Publier**. Ces règles font que personne ne peut lister les bibliothèques ni utiliser un
   identifiant court. **Attention** : le site étant public, toute personne qui ouvre son adresse
   accède à la bibliothèque. C’est le compromis choisi pour l’instant (pas de connexion).

## D. Récupérer la configuration web

1. Roue dentée en haut du menu de gauche → **Paramètres du projet** → onglet **Général**.
2. Descendre jusqu’à **Vos applications** → **Ajouter une application** → icône **Web** `</>`.
3. Surnom : `kine-web`. **Ne pas** cocher « Configurer Firebase Hosting ». **Enregistrer l’application**.
4. Firebase affiche un bloc `firebaseConfig`. Noter trois valeurs :
   - `apiKey` (commence par `AIza…`),
   - `projectId`,
   - `appId` (de la forme `1:1234…:web:…`, facultatif).
   Ces valeurs ne sont pas secrètes au sens strict : elles identifient le projet, ce sont les règles
   de l’étape C et la clé de bibliothèque qui protègent les données.
5. Ignorer la suite de l’assistant (installation du SDK) : l’application contient déjà tout.

## E. Donner la configuration au site

### Sur GitHub (site publié)

1. Dépôt GitHub `Madec01/kine` → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**, trois fois :
   - `VITE_FIREBASE_API_KEY` = la valeur `apiKey`
   - `VITE_FIREBASE_PROJECT_ID` = la valeur `projectId`
   - `VITE_FIREBASE_APP_ID` = la valeur `appId` (facultatif)
3. **Settings → Pages → Source : GitHub Actions** (si ce n’est pas déjà fait).
4. Fusionner la branche `claude/kine-exercise-library-zqiwlk` dans `main` (pull request). Le workflow
   « Déployer sur GitHub Pages » reconstruit le site avec la configuration ; attendre qu’il soit vert
   dans l’onglet **Actions**.

### En local (développement)

Créer un fichier `.env` à la racine du dépôt d’après `.env.example` :

```
VITE_FIREBASE_API_KEY=AIza…
VITE_FIREBASE_PROJECT_ID=kine-bibliotheque-3f2a1
VITE_FIREBASE_APP_ID=1:…:web:…
```

puis `npm run dev`.

## F. Vérifier que tout fonctionne

1. Ouvrir le site (<https://madec01.github.io/kine/>), forcer le rechargement une fois si l’ancienne
   version est encore en cache.
2. **Réglages → Sauvegarde en ligne (Firebase)** : l’état doit être « à jour ». L’indicateur en bas
   du menu passe de « Local seulement » à « Sauvegardé en ligne ».
3. Créer une famille, un tag et un exercice, puis appuyer sur **Sauvegarder maintenant** (sinon
   l’envoi part de lui-même une minute plus tard).
4. Dans la console Firebase → Firestore Database → onglet **Données** : une collection `libraries`
   apparaît, avec un document (identifiant de 24 caractères), et dedans les sous-collections
   `families`, `exercises` (et `media` dès qu’une image est ajoutée).
5. Dans **Réglages**, les compteurs « Aujourd’hui » indiquent quelques lectures et écritures. L’onglet
   **Utilisation** de Firestore dans la console montre la même chose avec un peu de retard.

## G. Brancher un second appareil

Ouvrir le site sur l’autre appareil (et l’installer sur l’écran d’accueil si souhaité) : il
rejoint automatiquement la même bibliothèque, sans rien saisir. Les exercices, familles et fiches
arrivent en quelques secondes ; les images complètes se téléchargent à l’ouverture de chaque fiche,
ou toutes d’un coup avec **Réglages → Télécharger les images**.

Pour voir tout de suite une modification faite ailleurs : **Réglages → Vérifier les modifications
en ligne** (sinon c’est automatique au démarrage et au retour au premier plan après quinze minutes).

## H. En cas de problème

| Message ou symptôme | Cause probable | Que faire |
| --- | --- | --- |
| « accès refusé par les règles Firestore » | règles non publiées ou mal copiées | refaire l’étape C, vérifier qu’il n’y a pas d’erreur rouge dans l’éditeur, **Publier** |
| indicateur « Local seulement » après déploiement | secrets absents ou mal nommés, ou ancien build en cache | vérifier les noms exacts des secrets, relancer le workflow, recharger la page |
| « hors connexion » alors que le réseau marche | réseau d’établissement bloquant `firestore.googleapis.com` | essayer en 4G ; les modifications partiront au retour du réseau |
| « quota Firebase épuisé » ou « en pause » | plafond du jour atteint (anormal en usage courant) | consulter l’onglet Utilisation, attendre le lendemain (réinitialisation vers 9 h, heure de Paris) ; les données restent sur l’appareil |
| une image n’apparaît pas sur le second appareil | pas encore téléchargée | ouvrir la fiche en ligne une fois, ou **Télécharger les images** dans Réglages |
| un appareil a utilisé une ancienne version avec une clé affichée | identifiant différent | rien à faire : au premier démarrage de la nouvelle version, son contenu est fusionné dans la bibliothèque partagée |

Le quota gratuit est de 50 000 lectures et 20 000 écritures par jour. L’usage attendu est de
quelques dizaines d’opérations par jour ; les compteurs de Réglages permettent de le constater.
