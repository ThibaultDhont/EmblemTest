# Liste des assets graphiques

Liste de travail pour produire les assets en parallèle du code. Les tailles viennent du code (`src/config.ts`, `src/render/`). Les décisions d'art restent ouvertes dans `docs/cadrage.md` (section 7 et « Questions ouvertes »).

## Univers

Post-apocalyptique et solarpunk : une catastrophe a frappé l'ancien monde, l'humanité vit plus en harmonie avec la nature et a reconstruit sur les bases des ruines. Les assets doivent le montrer : béton ancien envahi de végétation, matériaux de récupération, technologie douce (solaire, éolien). Voir `docs/cadrage.md`, section 3.

## Contraintes valables pour tout

- **Tuile** : 16×16 px. **Écran** : 384×256 px, soit 24×16 tuiles.
- **Échelle** : le jeu agrandit par un facteur entier avec un rendu `pixelated`. Tout se dessine donc à l'échelle 1, sans anti-crénelage ni demi-pixel.
- **Format** : PNG avec transparence. Les fichiers sources (Aseprite ou autre) restent hors du jeu.
- **Éditeur** : Pixelorama (libre). Le projet `.pxo` est le fichier source, le PNG exporté est l'asset.
- **Dossier** : `src/sprites/`, avec des sous-dossiers proposés `tiles/`, `units/`, `portraits/`, `ui/`, `icons/`, `fx/`. Noms du type `tile_plain_1.png`, `unit_swordsman.png`, `portrait_anna.png`.
- **Terrains branchés dans le jeu** : tout PNG `src/sprites/tile_<terrain>_<n>.png` (`plain`, `forest`, `mountain`, `wall`, n à partir de 1) remplace l'aplat provisoire de ce terrain, sans toucher au code. La variante d'une case dépend de sa position, donc elle ne change jamais. Une tuile dessinée n'a pas le quadrillage des aplats. Un PNG qui n'est pas en 16×16 déclenche un avertissement dans la console du navigateur. Après avoir ajouté un fichier, recharger la page. Les unités, portraits et l'interface ne sont pas encore branchés.

## Lot 1 : remplacer les placeholders du chapitre 1

| Asset | Taille | Quantité et détails |
|---|---|---|
| **Terrains** | 16×16 | 4 tuiles (plaine, forêt, montagne, mur), plus 2 ou 3 variantes de plaine pour éviter la répétition. Plaine : 3 variantes d'herbe faites. Le mur est du béton ancien avec des armatures rouillées et du lierre, pas de la pierre médiévale. |
| **Unités sur la carte** | 16×16 par image | Une feuille de 64×64 par classe : repos sur 3 images, puis marche vers le bas, vers le haut et de côté (4 images chacune, la gauche est le miroir de la droite). 4 classes (épéiste, lancier, archer, combattant), plus Anna (seigneuse) et Brutus (boss), soit 6 feuilles. |
| **Portraits** | 64×64 la tête | 6 personnages (Anna, Marc, Lise, Brutus, Rik, Gus). Par personnage : 1 tête de base (yeux ouverts, bouche fermée), 3 images d'yeux (ouvert, mi-clos, fermé, environ 24×8) et 3 images de bouche (fermée, mi-ouverte, ouverte, environ 16×8), soit environ 7 images. Yeux et bouche s'animent séparément, comme dans Fire Emblem : la bouche bouge pendant que le texte s'écrit, les yeux clignent. Des visages complets en plus (en colère, content) restent possibles plus tard pour les personnages principaux. |
| **Cadre d'interface** | 24×24, découpé en 9 (coins de 8×8) | Un cadre de fenêtre, pour les menus, les panneaux, la boîte de dialogue et les boutons. |
| **Curseur** | 16×16 | 2 à 4 images pour le clignotement. |
| **Icônes d'arme** | 16×16 | 4 icônes : épée, lance, hache, arc. |
| **Indicateur de dialogue** | 8×8 | La flèche « suite », sur 2 images. |
| **Police** | 8 px de haut | Une police pixel sous licence libre, avec les accents français (é è ê à ç œ « » …). Le texte actuel est de la police système en 8 px. |
| **Écran titre** | 384×256 | Un fond, plus un logo à faire quand le nom du jeu sera fixé (il est provisoire). |

Unités : costumes de récupération (tissus recyclés, couleurs vives) et armes de ferraille (lames taillées dans un ressort, lances en tube, arcs bricolés). Le triangle épée, hache, lance ne change pas.

Le code dessine déjà seul les zones de déplacement et d'attaque, les barres de PV, l'unité grisée après action, les flashs et le texte flottant. Ils n'ont pas besoin d'asset.

## Lot 2 : avec les jalons suivants

- **Terrains** : eau, route, pont, sable, neige, village, maison, coffre, porte, trône, fort, et ceux de l'univers : ruines, route fissurée, voie ferrée, éoliennes, panneaux solaires, serres, villages de bois et de verre récupéré. Il faudra aussi des bords de raccord pour les forêts et les montagnes.
- **Classes** : magiciens, soigneurs, cavaliers, volants, voleurs et promotions. Environ 15 à 25 feuilles de plus.
- **Icônes d'objets** : une par arme et par objet, en 16×16, pour environ 60 à 100 au total.
- **Interface étendue** : inventaire, boutique, forge, préparation de bataille, jauge d'XP, icônes de statut. Ajouter de petits visages de 32×32 (mini-portraits), dessinés à la main : les réduire depuis la grande version donne un résultat flou.
- **Effets** : étincelle de coup, critique, soin, montée de niveau, magie, en 16×16 ou 32×32.
- **Écrans hors carte** : illustrations de narration, camp et carte du monde, en 384×256 (la carte du monde peut être plus grande et défiler).

## Lot 3 : plus tard, le plus coûteux

- **Écran de combat dédié** : grands sprites de combat (environ 64×64 à 96×64, 8 à 12 images d'attaque) par classe et par arme, plus des fonds par terrain.
- C'est le risque n°3 du cadrage. À ne pas lancer avant que la tranche verticale ait mesuré le coût réel.

## Décisions à prendre avant de produire en masse

1. **Palette unique** : choisie, `palette_16bit_amelioree_64` (64 couleurs ; le fichier `.gpl` est dans Téléchargements et reste à ranger dans le dépôt). Ce que l'IA génère est ramené dessus. C'est le meilleur levier de cohérence.
2. **Couleurs d'équipe** : recommandé, dessiner chaque feuille une seule fois avec une rampe de bleu réservée (3 tons), que le code remplace par du rouge (ennemis) ou du vert (alliés). Cela divise le travail par deux, mais demande un petit morceau de code.
3. **Taille des portraits** : recommandé, 64×64, plus facile à produire que les 56×64 du code actuel (une constante à changer dans `src/render/dialogue.ts`). Trois portraits de chaque côté ne tiendraient plus ensemble, mais ce cas est rare.
4. **Sens des portraits** : à dessiner tournés vers la droite. Le code devra retourner ceux du côté droit, ce qu'il ne fait pas encore. Le dialogue devra aussi poser les yeux et la bouche à un décalage propre à chaque personnage (dans `src/data/characters.ts`), faire bouger la bouche pendant l'écriture du texte et faire cligner les yeux à intervalle irrégulier, avec un petit minuteur actif seulement pendant un dialogue. Le script n'a pas besoin de commande d'expression tant qu'il n'y a pas de visages complets.
5. **Outil de génération** : à choisir, et à vérifier côté conditions d'utilisation (risque n°2 du cadrage).

## Méthode conseillée

Commencer par un **test de style** : les 4 terrains, la feuille d'Anna et son portrait neutre. Ils sont intégrés dans le jeu (chargeur d'images et dessin des sprites, sans dépendance), on juge le rendu en situation, puis on lance la production.

L'IA tient mal le 16×16, et la cohérence des animations de marche est ce qui coûte le plus à retoucher. Générer plus grand, réduire sur la palette, puis retoucher à la main.
