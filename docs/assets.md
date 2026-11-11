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
- **Terrains branchés dans le jeu** : tout PNG `src/sprites/tile_<terrain>_<n>.png` (`plain`, `forest`, `mountain`, `wall`, n à partir de 1) remplace l'aplat provisoire de ce terrain, sans toucher au code. La variante d'une case dépend de sa position, donc elle ne change jamais. Une tuile dessinée n'a pas le quadrillage des aplats. Un PNG qui n'est pas en 16×16 déclenche un avertissement dans la console du navigateur. Après avoir ajouté un fichier, recharger la page.
- **Unités branchées** : `src/sprites/unit_<id>.png`, où `<id>` est l'identifiant d'une unité (`anna`) ou une classe (`swordsman`, pour toutes les unités de la classe qui n'ont pas leur propre fichier). Pour l'instant seule l'image en haut à gauche de la feuille (16×16, repos) est dessinée ; elle est grisée automatiquement quand l'unité a agi. La barre de PV passe sur les 2 dernières lignes du sprite.
- **Unités générées par règles** (prototype écarté, voir plus bas) : `node tools/sprite.ts` a fabriqué la feuille provisoire d'Anna. Les sprites de carte se feront à la main.
- **Portraits branchés** : `src/sprites/portrait_<personnage>.png`, 64×64, tourné vers la droite. Le jeu le retourne du côté droit de l'écran et l'assombrit quand le personnage ne parle pas. Pas de cadre : le fond transparent laisse voir la carte. Les yeux et la bouche animés ne sont pas encore branchés.
- **L'interface et la police** ne sont pas encore branchées.

## Lot 1 : remplacer les placeholders du chapitre 1

| Asset | Taille | Quantité et détails |
|---|---|---|
| **Terrains** | 16×16 | 4 tuiles (plaine, forêt, montagne, mur), plus 2 ou 3 variantes de plaine pour éviter la répétition. Plaine : 3 variantes d'herbe faites. Le mur est du béton ancien avec des armatures rouillées et du lierre, pas de la pierre médiévale. |
| **Unités sur la carte** | 32×32 par image (proposé) | **À la main** (décision du 2026-11-11). 12 images par unité : respiration sur 3 images (unité survolée), marche vers le bas, vers le haut et de côté sur 3 images chacune (la gauche est le miroir de la droite). Format proposé, à confirmer : images de 32×32, personnage en bas au centre (comme sur GBA, où il fait environ 14×16), feuille de 96×128 (3 colonnes, 4 lignes : respiration, bas, haut, côté). 4 classes (épéiste, lancier, archer, combattant), plus Anna (seigneuse) et Brutus (boss), soit 6 feuilles. L'Anna actuelle (faite par règles) est provisoire. |
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

1. **Palette unique** : choisie, `palette_16bit_amelioree_64` (64 couleurs). Ce que l'IA génère est ramené dessus. C'est le meilleur levier de cohérence. Elle est rangée dans `art/palette.gpl` (convertie depuis le fichier `.ase` d'origine par `tools/palette.ts`).
2. **Couleurs d'équipe** : recommandé, dessiner chaque feuille une seule fois avec une rampe de bleu réservée (3 tons), que le code remplace par du rouge (ennemis) ou du vert (alliés). Cela divise le travail par deux, mais demande un petit morceau de code. Avec les sprites par règles, ce sera une matière par équipe sur une zone choisie (l'accent, par exemple), sans code dans le jeu.
3. **Taille des portraits** : 64×64, fait (`PORTRAIT_SIZE` dans `src/render/sprites.ts`). Trois portraits de chaque côté ne tiendraient plus ensemble, mais ce cas est rare.
4. **Sens des portraits** : à dessiner tournés vers la droite ; le code retourne ceux du côté droit (fait). Reste : poser les yeux et la bouche à un décalage propre à chaque personnage (dans `src/data/characters.ts`), faire bouger la bouche pendant l'écriture du texte et faire cligner les yeux à intervalle irrégulier, avec un petit minuteur actif seulement pendant un dialogue. Le script n'a pas besoin de commande d'expression tant qu'il n'y a pas de visages complets.
5. **Outil de génération** : en test depuis le 2026-11-11, en local et gratuit : ComfyUI + Z-Image Turbo + LoRA pixel art, tous sous licence Apache 2.0 (risque n°2 du cadrage). Chaîne et recettes dans `CLAUDE.md`, outils dans `tools/`. Réservé aux portraits et aux sprites de combat (décision du 2026-11-11), conditionné par la bible de style (`docs/bible-style.md`) : son texte de style est dans les workflows `emblem_portrait` et `emblem_combat`, réglables dans l'interface de ComfyUI.

## Méthode conseillée

Commencer par un **test de style** : les 4 terrains, la feuille d'Anna et son portrait neutre. Ils sont intégrés dans le jeu (chargeur d'images et dessin des sprites, sans dépendance), on juge le rendu en situation, puis on lance la production.

L'IA tient mal le 16×16, et la cohérence des animations de marche est ce qui coûte le plus à retoucher. Générer plus grand, réduire sur la palette, puis retoucher à la main.

**Test de style du 2026-11-11** : montagne, mur, Anna sur la carte (image de repos seule) et son portrait, générés puis réduits par `tools/`, branchés dans le jeu. Constats : le portrait est très bon dès la réduction ; l'unité est lisible mais demande une retouche ; la montagne et le mur sont des bases correctes, moins fines que les tuiles faites main ; les animations ne sont pas encore abordées. Avis de l'utilisateur : on reconnaît les formes, mais la réduction perd trop d'informations ; elle est à améliorer avant de produire en masse. Avec la vraie palette, le roux d'Anna virait au rose : corrigé en donnant plus de poids à la teinte qu'à la luminosité au moment de choisir la couleur (`--teinte 3`). Une détection de la grille des « gros pixels » de l'IA a aussi été essayée (`--grille auto`) : gain modeste, car le modèle dessine environ 130 à 170 vrais pixels par image, avec des pixels irréguliers. Pour le 16×16, la perte vient surtout de la réduction d'environ ×6, inévitable sans dessiner directement à cette échelle. Une boucle « réduire, agrandir, faire redessiner par l'IA » n'a rien donné : le modèle garde les blocs tels quels ou revient à sa propre résolution. Des règles de nettoyage après réduction (`tools/cleanup.ts` : contour teinté d'un pixel, 10 couleurs au plus, pixels isolés fondus, détails sombres gardés) rendent le sprite d'Anna nettement plus lisible sur la carte : yeux visibles, silhouette détachée de l'herbe. Sans remplacer un vrai dessin : restent possibles un outil qui dessine nativement en petit (PixelLab) et la retouche à la main sur la base IA. En revanche, le redessin d'image marche bien pour les variantes d'un portrait (yeux fermés à force 0.45-0.6, personnage inchangé).

**Sprites par règles (2026-11-11)** : l'utilisateur a jugé que la réduction restait moyenne et qu'il valait mieux produire des assets justes dès le départ. Pour le 16×16, `tools/sprite.ts` pose chaque pixel à sa taille finale : des pièces (corps, tenue, cheveux, écharpe, arme) dessinées en zones plutôt qu'en couleurs, une matière par zone qui donne quatre couleurs de la palette (clair, moyen, ombre, trait), un contour sélectif automatique et le repos calculé (le torse puis la tête descendent d'un pixel). Premier jet : Anna, nettement plus propre que la version IA réduite (gardée dans `art/sources/unit_anna_ia.png`). Les mêmes pièces avec d'autres matières donnent d'autres unités, et les couleurs d'équipe deviendront un simple changement de matière. Puis la marche : les mêmes pièces en trois vues (face, dos, côté), des images de 32×32 avec le personnage en bas au centre (format mesuré sur les sprites GBA : environ 14×16 dans 32×32), 4 images par direction calculées par règles (pied levé et corps qui monte d'un pixel de face et de dos, jambes écartées puis jointes de côté). Avis de l'utilisateur sur ce premier dessin : règles d'animation et vues très bien, mais corps trop large et tête trop grosse. Anna a été redessinée plus fine d'après les proportions mesurées sur les sprites GBA (silhouette en poire : tête d'environ 9 px, bras détachés, taille fine, jambes séparées ; voir `CLAUDE.md`), la première version est gardée dans `art/sources/unit_anna_v1.png`. **Verdict de l'utilisateur** : les règles d'animation et les vues sont très bien, mais le dessin ne convient pas. Décision : les sprites de carte se feront à la main (12 images par unité, voir le lot 1). ComfyUI gardera les sprites de combat et les portraits, à condition de le tenir fermement au style du jeu.
