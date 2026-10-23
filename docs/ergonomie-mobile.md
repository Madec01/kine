# Choix d’ergonomie mobile

La consultation rapide d’un exercice est la tâche principale. La présentation mobile est donc organisée autour de la recherche et des fiches, avec moins d’espace consacré aux statistiques.

## Références consultées

- [Android Developers — Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns) : navigation principale persistante à trois à cinq destinations ; adaptation à la taille d’écran ; actions secondaires dans un menu.
- [Apple — Human Interface Guidelines, Layout](https://developer.apple.com/design/human-interface-guidelines/layout) : hiérarchie des informations, espace pour le contenu essentiel, adaptation aux orientations et respect des zones de sécurité.
- [W3C — Understanding SC 2.5.5, Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) : référence de 44 × 44 pixels CSS pour les cibles tactiles. Il s’agit d’une référence de conception, pas d’une déclaration de conformité WCAG complète.

## Application au site

- Navigation inférieure avec quatre destinations libellées : Exercices, Favoris, Collections, Mon espace.
- Liste illustrée à une colonne sur téléphone ; chaque ligne ouvre la fiche, avec un bouton favori distinct.
- Texte principal de 16 pixels, contrôles tactiles d’au moins 44 pixels et saisies de 16 pixels.
- Recherche et filtres accessibles pendant le défilement ; les objectifs rapides défilent horizontalement.
- Filtres dans un panneau modal, choix regroupés par catégorie et nombre de résultats affiché avant validation. Fermer le panneau annule les modifications non appliquées.
- Conservation de la recherche, du tri et de la position de défilement pour chaque onglet pendant la session.
- Fiche en plein écran, contenu défilant entre l’en-tête et les actions ; raccourcis vers Consignes, Dosage et Vigilance.
- Actions fréquentes en bas de la fiche ; modification et impression dans le menu des actions sur téléphone.
- Retour du navigateur : ferme d’abord la fenêtre active, y compris lorsqu’un formulaire est ouvert au-dessus d’une fiche.
- Édition à une colonne, rubriques de classement repliables et bouton d’enregistrement toujours accessible.
- Zones de sécurité CSS pour les encoches et la barre d’accueil, prise en compte des hauteurs de fenêtre dynamiques et du mouvement réduit.

Les données, favoris et collections existants utilisent le même format et la même clé de stockage. Aucun remplacement de la bibliothèque n’est nécessaire.

## Vérification

`python tests/mobile.py` vérifie les parcours tactiles dans Chromium avec émulation mobile : 320 × 568, 360 × 780, 390 × 844, 430 × 932, 768 × 1024 et 844 × 390 pixels. Le test mesure les cibles visibles, vérifie le retour, les filtres, les onglets, l’édition et la persistance. `python tests/browser.py` couvre aussi les fonctions existantes sur ordinateur.

Cette vérification ne remplace pas un essai sur des appareils physiques avec Safari iOS et Chrome Android, en particulier pour les variations de clavier et de barres système.
