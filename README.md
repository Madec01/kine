# Kiné · Bibliothèque d’exercices

Application personnelle en **HTML, CSS et JavaScript**, destinée à organiser des exercices de kinésithérapie en gériatrie et en EHPAD. Aucun framework, compte ni serveur de données requis.

## Utilisation

Ouvrir `index.html` dans un navigateur récent. Pour une origine de stockage stable, utiliser de préférence un hébergement statique ou un serveur local :

```sh
python -m http.server 8765
```

Puis ouvrir <http://localhost:8765>. Conserver la même adresse et le même navigateur pour retrouver les données. Le stockage sous une adresse `file://` dépend du navigateur.

## Fonctions disponibles

- Interface conçue pour le téléphone : navigation en bas, liste illustrée lisible, recherche persistante et filtres avec aperçu des résultats. Grille et liste disponibles sur ordinateur.
- Fiches plein écran sur mobile, raccourcis Consignes / Dosage / Vigilance, retour du navigateur et recherche conservée entre les onglets.
- 16 fiches d’exemple modifiables, avec tous les champs du cahier des charges.
- Recherche libre sans distinction de casse ou d’accent, tri et sept catégories de filtres combinables.
- **ET entre catégories, OU entre tags d’une catégorie**, comme indiqué dans l’interface.
- Favoris persistants et collections personnelles.
- Ajout, modification et suppression de fiches dans l’interface.
- Tags normalisés et ajout de catégories sans toucher au code.
- Liens réciproques entre exercices, variantes et progressions.
- Photos importées (PNG, JPEG, WebP, GIF ; 1 Mo maximum), images et vidéos par adresse HTTPS directe.
- Impression d’une fiche, y compris ses commentaires et variantes ; enregistrement en PDF via le navigateur.
- Export JSON de toute la bibliothèque ou d’une collection et restauration d’une sauvegarde validée.

Les données sont conservées dans `localStorage`, sous la clé `kine-library-v1`. Une écriture refusée par le navigateur affiche une erreur et conserve l’état précédent en mémoire. Les images importées sont intégrées à la sauvegarde ; les vidéos et images externes restent des liens.

## Sauvegarde et changement d’appareil

Dans **Sauvegarde & données**, télécharger un export JSON. Sur l’autre appareil, importer ce fichier, vérifier le nombre de fiches puis confirmer le remplacement. **L’import remplace toute la bibliothèque locale ; il ne fusionne pas les collections.** Exporter les données existantes avant cette opération.

Il n’y a pas de synchronisation automatique, de base partagée ou de connexion utilisateur dans cette version. Le stockage est propre au navigateur et à l’adresse du site. Effacer les données du navigateur les supprime. La capacité de stockage varie selon le navigateur ; en cas de saturation, réduire les images après avoir exporté les données.

Les exemples initiaux sont copiés uniquement lorsqu’aucune sauvegarde locale n’existe. Modifier `data.js` ne remplace pas les données déjà personnalisées d’un utilisateur.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure HTML et navigation |
| `styles.css` | Présentation sur ordinateur et impression |
| `mobile.css` | Ergonomie mobile, navigation et panneaux tactiles |
| `data.js` | Fiches et catégories d’exemple |
| `illustrations.js` | Illustrations SVG originales |
| `model.js` | Validation des sauvegardes, recherche et filtres |
| `app.js` | Interface, édition et stockage |
| `assets/` | Icône du site |

Les polices DM Sans et Manrope sont chargées via Google Fonts avec un repli sur les polices du système. La bibliothèque reste fonctionnelle si les polices externes sont indisponibles.

## Vérification et hébergement

Les fichiers peuvent être servis tels quels par un hébergeur statique, y compris GitHub Pages. Un export de déploiement est également disponible sans dépendances :

```sh
npm test
npm run build
```

Le dossier `dist/` contient alors le site prêt à héberger. Node.js 18 ou supérieur suffit pour ces commandes ; il n’est pas nécessaire pour utiliser le site.

Tests des parcours dans Chromium, après lancement du serveur local ci-dessus, si Python, Playwright et Chromium sont installés :

```sh
python tests/browser.py
python tests/mobile.py
```

Le chemin du navigateur peut être adapté avec `CHROMIUM_PATH`, et l’URL avec `KINE_TEST_URL`. Les captures et le PDF de contrôle sont produits dans `test-results/`, exclu du dépôt.

Les [choix d’ergonomie mobile](docs/ergonomie-mobile.md) détaillent les références consultées et les vérifications.

## Cadre d’usage

Les exercices et les dosages fournis sont des **exemples d’organisation à individualiser**, sans validation clinique externe. Ils ne constituent pas une prescription automatique. Le choix de l’exercice, les précautions, l’aide nécessaire et le dosage relèvent de l’évaluation clinique. Les illustrations sont schématiques et accompagnent les consignes écrites. Les commentaires sont destinés aux observations sur les exercices ; le site n’est pas un dossier patient.

La préparation de séances structurées (version 3) reste une évolution future. Les collections et leur export sont déjà disponibles.
