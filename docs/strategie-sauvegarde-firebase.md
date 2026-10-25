# Stratégie de sauvegarde : IndexedDB + Firebase (Firestore)

Document de conception, préalable à l’implémentation. Objectif : garder l’application
utilisable hors connexion, sauvegarder en ligne sans consommer le quota gratuit de
Firebase, et permettre de changer d’appareil sans tout retélécharger à chaque fois.

## 1. Contraintes et faits vérifiés

| Point | Conséquence pour la conception |
| --- | --- |
| Quota Firestore gratuit (offre Spark) : environ 50 000 lectures, 20 000 écritures et 20 000 suppressions **par jour**, 1 Gio stocké, 10 Gio de sortie par mois. | Très confortable pour une bibliothèque personnelle **à condition** de ne jamais relire toute la base au démarrage ni d’écrire à chaque frappe. |
| Chaque requête coûte au minimum 1 lecture, même vide ; un document lu coûte 1 lecture quelle que soit sa taille (jusqu’à 1 Mio). | Regrouper l’information dans peu de documents ; éviter les requêtes inutiles. |
| **Cloud Storage for Firebase n’est plus disponible sur l’offre gratuite** : il exige le plan Blaze (carte bancaire, facturation à l’usage, avec une franchise gratuite). | Sans Blaze, les images ne peuvent pas aller dans Storage. Elles iront dans Firestore sous forme compressée (voir § 7). Les vidéos ne seront pas synchronisées. |
| Les écouteurs temps réel (« onSnapshot ») sur une collection se font refacturer les lectures lorsqu’ils se reconnectent après une longue coupure. | **Aucun écouteur de collection.** Lectures uniquement par requêtes ciblées, à des moments choisis. |
| Pas de sécurité élaborée au départ, pas de données nominatives de résidents. | Authentification e-mail/mot de passe et règles minimales « chacun lit et écrit sa bibliothèque ». Le partage viendra plus tard sans changer la structure. |

## 2. Principe général

```
          écritures immédiates                lot d’écritures, seulement ce qui a changé
Interface ───────────────▶ IndexedDB ─────────────────────────────────────────▶ Firestore
   ▲                      (source de vérité locale,               ▲   déclencheurs : minuterie après un changement,
   │                       journal des modifications)             │   fermeture de l’application, bouton « Sauvegarder »
   └──────────────────────── lecture locale uniquement            │
                                                                  └── téléchargement incrémental : seulement les documents
                                                                      modifiés depuis la dernière synchronisation
```

- **IndexedDB est la source de vérité de l’appareil.** Toute modification y est écrite tout de
  suite. L’interface ne lit jamais Firestore directement : zéro lecture pendant l’usage courant.
- **Firestore est un miroir** alimenté par un journal des modifications (« outbox »). Il ne
  reçoit que les entités modifiées, groupées en un seul lot.
- **La synchronisation descendante est incrémentale** : une lecture pour savoir s’il y a du
  nouveau, puis seulement les documents modifiés depuis la dernière fois. Sur un appareil
  neuf, le premier téléchargement est complet (une seule fois), sans les images.

## 3. Modèle de données Firestore

L’identifiant de bibliothèque vaut l’identifiant utilisateur au départ (`libraryId = uid`). Les
chemins sont déjà « par bibliothèque », ce qui permettra plus tard d’inviter des collègues sans
migration.

```
libraries/{libraryId}
  name, owner (uid), syncToken (uuid changé à chaque lot), updatedAt, createdAt

libraries/{libraryId}/families/{familyId}
  name, description, color, position, updatedAt, deletedAt?
  tags: [ { id, name, position, updatedAt, deletedAt? } ]      ← tags imbriqués : 1 document par famille

libraries/{libraryId}/exercises/{exerciseId}
  name, description, instructions, startPosition, equipment, dosage{sets,reps,duration,rest},
  difficulty, variants, progressions, precautions, notes, videoUrl,
  tagIds: [ … ],                                                ← associations dans l’exercice : pas de table de liaison
  media: [ { id, kind, caption, position, mime, bytes, width, height } ],   ← métadonnées seulement
  thumb: base64 JPEG ≤ 8 Ko de la première image (pour les listes, sans lecture supplémentaire)
  updatedAt, deletedAt?

libraries/{libraryId}/media/{mediaId}
  exerciseId, kind: 'image', mime, bytes, data (base64, ≤ 250 Ko), updatedAt, deletedAt?

libraries/{libraryId}/sheets/{sheetId}
  title, subtitle, options, exerciseIds: [ … ], updatedAt, deletedAt?
```

Choix qui économisent le quota :

- **Un document par entité métier** (famille avec ses tags, exercice avec ses tags et ses
  métadonnées de médias, fiche). Modifier un exercice = 1 écriture. Renommer un tag = 1 écriture
  (le document de sa famille), quel que soit le nombre d’exercices qui le portent.
- **Supprimer un tag ou une famille ne réécrit pas les exercices.** Les identifiants orphelins
  sont ignorés à l’affichage et dans la recherche (déjà le cas aujourd’hui) et nettoyés
  « paresseusement » lors de la prochaine sauvegarde de chaque exercice.
- **Suppressions par pierre tombale** (`deletedAt`) : un document supprimé n’est pas effacé mais
  marqué, afin que les autres appareils apprennent la suppression lors de leur synchronisation
  incrémentale. Les tombales de plus de 60 jours sont purgées lors d’un lot ultérieur.
- `updatedAt` est un horodatage **serveur** (`serverTimestamp()`), ce qui rend la requête
  incrémentale fiable même si l’horloge d’un téléphone est fausse.

## 4. Stockage local (IndexedDB)

Le mode local actuel range toute la bibliothèque dans un seul enregistrement. Il sera remplacé
par une base structurée (bibliothèque `idb`), avec migration automatique des données existantes :

| Magasin | Contenu |
| --- | --- |
| `families`, `exercises`, `sheets` | une entrée par entité, mêmes champs que Firestore, plus `dirty` (modifié localement, pas encore envoyé) |
| `media` | métadonnées + `blob` du fichier (images et vidéos locales) + `remote` (présent dans Firestore ou non) |
| `outbox` | journal des modifications à envoyer : clé `collection/id`, opération (`upsert` ou `delete`), date du changement |
| `meta` | `uid`, `libraryId`, `syncToken` connu, `lastPullAt` (horodatage serveur du dernier document reçu), compteurs de quota du jour, date de la dernière sauvegarde réussie |

Les blobs des images restent dans IndexedDB, y compris après envoi : l’affichage ne relit jamais
Firestore pour une image déjà présente sur l’appareil.

## 5. Écritures : quand et comment

**Ce qui déclenche un envoi** (« flush ») :

1. **Minuterie après changement** : 60 secondes après la dernière modification locale, si le
   journal n’est pas vide (la minuterie repart à chaque nouvelle modification, avec un plafond
   de 5 minutes d’attente pour qu’une saisie continue finisse par être sauvegardée).
2. **Fermeture ou mise en arrière-plan** : événements `visibilitychange` (onglet masqué) et
   `pagehide`. L’envoi est tenté immédiatement ; s’il n’aboutit pas (onglet tué, réseau coupé),
   rien n’est perdu : les données sont déjà dans IndexedDB et le journal sera rejoué à la
   prochaine ouverture.
3. **Bouton « Sauvegarder »** visible en permanence, avec l’état : *synchronisé*, *modifications
   en attente (n)*, *hors connexion*, *erreur*. Il force l’envoi et une vérification descendante.
4. Jamais à chaque frappe : les formulaires n’écrivent qu’à l’enregistrement, et la minuterie
   regroupe plusieurs enregistrements rapprochés.

**Ce qui est envoyé** : uniquement les entrées du journal, regroupées par identifiant (dix
modifications du même exercice = une seule écriture). Un envoi = **un seul lot Firestore**
(`writeBatch`, 500 opérations au maximum ; au-delà, lots successifs) contenant :

- `set` complet de chaque entité modifiée, avec `updatedAt: serverTimestamp()` ;
- `set` partiel `{ deletedAt, updatedAt }` pour chaque suppression ;
- les images nouvelles (un document `media` chacune, données compressées) ;
- la mise à jour du document de bibliothèque : nouveau `syncToken`, `updatedAt`.

Après succès : les entrées du journal envoyées sont retirées (sauf si l’entité a de nouveau
changé pendant l’envoi), `syncToken` local = celui que l’on vient d’écrire. En cas d’échec :
le journal est conservé, nouvel essai avec délai croissant (30 s, 1 min, 2 min, 5 min… plafonné
à 30 min), **jamais de boucle serrée**.

Coût typique : *n* entités modifiées → *n* + 1 écritures.

## 6. Lectures : savoir s’il y a du nouveau sans tout relire

**Au démarrage** (et sur « Sauvegarder », et au retour au premier plan après plus de 15 minutes) :

1. Lire le document `libraries/{libraryId}` : **1 lecture**.
2. Si son `syncToken` est égal au jeton local : rien n’a changé ailleurs, **fin**. C’est le cas
   normal quand on utilise un seul appareil : le démarrage coûte une lecture.
3. Sinon, pour `families`, `exercises` et `sheets` : requête `where('updatedAt', '>', lastPullAt − 5 min)`.
   Seuls les documents modifiés (et les tombales) sont lus. Fusion dans IndexedDB (voir § 8),
   puis `lastPullAt` = plus grand `updatedAt` reçu, `syncToken` local = jeton distant.
4. Les documents `media` **ne sont jamais lus au démarrage**.

**Appareil neuf ou réinstallation** : `lastPullAt` est vide, les trois requêtes renvoient tout
(une fois). Pour 300 exercices, 8 familles et 20 fiches : environ 330 lectures, à comparer aux
50 000 quotidiennes. Les vignettes intégrées aux exercices permettent d’afficher les listes
immédiatement, sans les images.

**Images à la demande** : une image est téléchargée (1 lecture) uniquement quand elle est
nécessaire et absente de l’appareil : ouverture de la fiche, génération d’un PDF. Un bouton
« Télécharger toutes les images sur cet appareil » dans Réglages permet de préparer un usage
hors connexion complet, en indiquant le nombre de lectures que cela représente.

**Pendant l’usage** : aucune lecture. Optionnel plus tard : un écouteur sur le seul document de
bibliothèque (1 lecture par changement distant) pour prévenir « modifié sur un autre appareil ».

## 7. Médias

- **Images** : compressées avant stockage (côté le plus long 1 000 px, JPEG qualité 0,8, soit en
  général 60 à 180 Ko, 250 Ko maximum en base64), un document Firestore par image. Une vignette
  de 160 px (≈ 6 Ko) est rangée dans l’exercice pour les listes et les cartes. Volumes : 300
  images ≈ 50 Mo stockés sur 1 Gio ; téléchargement complet sur un appareil neuf ≈ 50 Mo sur
  10 Gio mensuels.
- **Vidéos** : non synchronisées (trop lourdes pour Firestore). Deux possibilités dans
  l’application : un **lien** (YouTube, Drive…), qui est synchronisé comme simple texte et
  utilisé pour le QR code du PDF ; ou un **fichier local**, conservé dans IndexedDB de
  l’appareil et signalé « non sauvegardé en ligne ».
- **Si le plan Blaze est accepté un jour** (carte bancaire, franchise gratuite de 5 Go de
  Storage et 1 Go de téléchargement par jour) : les images et vidéos pourront migrer vers
  Cloud Storage sans changer le reste du modèle (le champ `media[]` pointe alors vers un chemin
  Storage au lieu d’un document Firestore).

## 8. Fusion et conflits

Usage visé : une personne, plusieurs appareils, rarement en même temps. Règle simple :

- Par entité, **la version la plus récente gagne** (`updatedAt` serveur).
- Si une entité est **modifiée localement et pas encore envoyée** alors qu’une version distante
  plus récente arrive, **la version locale est conservée** (c’est le travail en cours de
  l’utilisateur) et sera envoyée au prochain lot. L’autre version est perdue, ce qui n’arrive
  qu’en modifiant la même fiche sur deux appareils sans synchroniser entre les deux.
- Les tags imbriqués dans une famille sont fusionnés **tag par tag** (par identifiant et
  `updatedAt`), pour qu’un tag créé sur un appareil et un autre renommé ailleurs cohabitent.
- Une tombale distante supprime l’entité locale, sauf si celle-ci a été modifiée localement
  après la suppression (elle est alors renvoyée et « ressuscite »).

## 9. Authentification et règles de sécurité (version de départ)

- **Firebase Authentication, e-mail + mot de passe** (ajout possible de « Se connecter avec
  Google » sans changer le reste). Un seul compte au début.
- Règles Firestore minimales, suffisantes pour qu’un inconnu ne puisse pas lire ni écrire la
  bibliothèque alors que la configuration du projet est publique dans le site :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /libraries/{libraryId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == libraryId;
    }
  }
}
```

- Le « mode test » de Firebase (tout ouvert) est déconseillé : il expire au bout de 30 jours et
  laisse la base lisible par quiconque trouve l’adresse. Les règles ci-dessus coûtent le même
  effort et ne limitent rien pour l’usage prévu.
- Le partage avec des collègues viendra ensuite : ajout d’un champ `members` dans le document de
  bibliothèque et extension des règles, sans toucher aux documents existants.

## 10. Garde-fous quota

| Garde-fou | Détail |
| --- | --- |
| Compteurs locaux | lectures et écritures estimées par jour, affichées dans Réglages avec la date de dernière sauvegarde |
| Plafonds internes | 5 000 lectures et 3 000 écritures par jour ; au-delà, l’application passe en « local seulement » et le signale, plutôt que d’atteindre la limite Firebase |
| Espacement | au moins 30 s entre deux envois ; au moins 15 min entre deux vérifications descendantes automatiques |
| Erreurs | `resource-exhausted` ou réseau : délai croissant, jamais de nouvel essai immédiat ; les données restent locales |
| Pas d’écouteur de collection | les lectures sont toujours des requêtes ciblées et datées |
| Taille des documents | images limitées à 250 Ko encodées ; refus avec message au-delà de 900 Ko après compression |

**Budget estimé** (bibliothèque de 300 exercices, 300 images, 8 familles, 20 fiches) :

| Scénario | Lectures | Écritures |
| --- | --- | --- |
| Journée ordinaire sur un appareil, 10 modifications | 1 à 4 | ≈ 12 |
| Séance de création : 50 exercices avec une image chacun | 1 | ≈ 105 |
| Premier démarrage sur un nouvel appareil (sans images) | ≈ 330 | 0 |
| Téléchargement de toutes les images sur ce nouvel appareil | 300 | 0 |
| Un mois d’usage sur deux appareils | quelques centaines | quelques centaines |

Soit moins de 1 % du quota gratuit quotidien dans tous les cas courants.

## 11. Scénarios

- **Hors connexion** : tout fonctionne (création, recherche, PDF avec les images présentes sur
  l’appareil). Le journal s’accumule ; l’envoi reprend au retour du réseau ou au prochain
  démarrage. L’état affiche « hors connexion, n modifications en attente ».
- **Changement de téléphone** : connexion → 1 lecture → téléchargement complet des textes
  (quelques centaines de lectures, une fois) → listes avec vignettes immédiatement → images à la
  demande ou en bloc.
- **Deux appareils en alternance** : chacun ne télécharge que ce que l’autre a modifié.
- **Réinstallation ou effacement du navigateur** : identique au changement de téléphone ; rien
  n’est perdu tant que le dernier envoi a réussi (d’où le bouton « Sauvegarder » et l’indicateur).
- **Export JSON** : conservé comme sauvegarde de secours indépendante de Firebase, avec les
  images intégrées, et comme moyen de changer de solution technique.

## 12. Plan d’implémentation proposé

1. **Stockage local structuré** : remplacer le document unique du mode local par la base
   IndexedDB du § 4, avec migration automatique des données existantes et journal des
   modifications alimenté par toutes les mutations. Tests unitaires de coalescence et de
   migration. *(Sans Firebase, l’application reste strictement équivalente à aujourd’hui.)*
2. **Connexion Firebase** : configuration par variables `VITE_FIREBASE_*`, page de connexion
   e-mail/mot de passe, règles Firestore ci-dessus, document de bibliothèque créé à la première
   connexion.
3. **Moteur de synchronisation** : envoi par lots (§ 5), vérification et téléchargement
   incrémental (§ 6), fusion (§ 8), images à la demande (§ 7), compteurs et plafonds (§ 10).
   Tests unitaires avec un Firestore simulé en mémoire ; test de bout en bout contre l’émulateur
   Firestore si l’environnement le permet, sinon contre un projet réel.
4. **Interface** : bouton et indicateur « Sauvegarder », section Réglages (compte, état,
   compteurs, dernière sauvegarde, téléchargement des images, déconnexion), messages hors
   connexion.
5. **Nettoyage** : le code Supabase (adaptateur, SQL, section du README) devient inutile ; à
   retirer pour garder une seule voie, sauf avis contraire.

## 13. Décisions prises (25 octobre 2026)

1. Offre gratuite : images compressées dans Firestore, vidéos par lien ou fichier local non synchronisé.
2. Pas de connexion : une **clé de bibliothèque** aléatoire remplace l’identifiant (voir § 9 bis). Les règles
   Firestore refusent les identifiants courts et interdisent de lister les bibliothèques.
3. Code Supabase supprimé.
4. Délais : 60 s après la dernière modification, 5 min au plus en saisie continue, 15 min entre vérifications.

### 9 bis. Accès par clé de bibliothèque

```
match /libraries/{libraryId} {
  allow get, create, update: if libraryId.size() >= 20;
  allow list, delete: if false;
  match /{collection}/{docId} {
    allow read, write: if libraryId.size() >= 20
      && collection in ['families', 'exercises', 'sheets', 'media'];
  }
}
```

La clé (24 caractères parmi 31, soit environ 10^35 possibilités) est générée sur le premier appareil,
affichée dans Réglages et recopiée sur les autres. Changer de clé fusionne le contenu local dans la
bibliothèque rejointe. Le passage à des comptes et des rôles se fera en ajoutant un champ `members`
et en remplaçant la condition de taille par une vérification d’identité.

## 13 ter. Questions initialement posées

1. **Plan Firebase** : rester sur l’offre gratuite (images dans Firestore, vidéos par lien ou
   locales) ou passer en Blaze pour utiliser Storage ? Proposition : gratuit d’abord, la
   conception permet de migrer ensuite.
2. **Connexion** : e-mail/mot de passe seul, ou aussi Google ? Proposition : e-mail/mot de passe.
3. **Supabase** : supprimer le code et le schéma maintenant, ou les conserver quelque temps ?
   Proposition : supprimer une fois Firebase opérationnel.
4. **Délais** : 60 s après la dernière modification et 15 min entre vérifications automatiques
   vous conviennent-ils ?
5. **Vidéos** : liens uniquement, ou aussi fichiers locaux non synchronisés ? Proposition : les deux,
   avec mention claire.

## 14. Point d’étape

- **En place** : application complète en mode local (IndexedDB, document unique) et adaptateur
  Supabase non retenu ; export/import JSON ; interface `Repository` qui isole déjà l’interface
  utilisateur du stockage.
- **À construire** : les étapes 1 à 4 ci-dessus. L’étape 1 ne dépend d’aucune décision et peut
  démarrer immédiatement ; l’étape 2 nécessite un projet Firebase (création, activation de
  l’authentification e-mail/mot de passe, création de la base Firestore en mode production avec
  les règles du § 9, récupération de la configuration web).

Sources consultées : [FAQ Firebase sur les changements de Cloud Storage (septembre 2024)](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024),
[grille tarifaire Firebase](https://firebase.google.com/pricing/?hl=fr).
