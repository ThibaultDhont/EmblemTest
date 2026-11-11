# Bible de style

Ce qui rend les assets du jeu cohérents entre eux. Elle sert à deux choses : écrire les prompts de ComfyUI (le texte de style qui entoure `{sujet}` dans les workflows) et juger une image générée avant de la garder. Elle concerne surtout ce que l'IA produit (portraits, sprites de combat) ; les sprites de carte et les tuiles, faits à la main, suivent les mêmes règles de couleur et de contour.

Le texte de prompt qui fait foi est celui des workflows enregistrés dans ComfyUI (copie dans `art/comfy/`). Si on le change là-bas, on reporte ici la règle qui a changé.

## Les règles

1. **Lisible en petit.** Tout finit en 64×64 (portrait) ou à peu près (combat). Un détail plus petit qu'un pixel final disparaît : à 64 px, un œil fait 2 ou 3 pixels. Donc des formes simples, de grands aplats, peu de petits motifs. L'image générée doit déjà avoir de « gros pixels ».
2. **Palette.** Celle du jeu (`art/palette.gpl`, 64 couleurs) ; une vingtaine de couleurs par portrait, une quinzaine par sprite de combat. Couleurs vives et chaudes. Les ombres tirent vers le violet ou le bleu, les lumières vers le jaune. Pas de gris terne en grandes surfaces. **Peaux aux tons chauds** : la palette n'a pas de peau très claire, une peau pâle et peu saturée tombe entre le gris et le crème et le visage vire au gris une fois réduit.
3. **Contour.** Un trait sombre et net autour des formes, teinté par la couleur qu'il entoure (brun foncé autour de la peau, bordeaux autour des cheveux roux) plutôt que noir partout.
4. **Ombrage.** Deux ou trois tons par couleur, en aplats nets (cel shading). Lumière venant d'en haut à gauche. Pas de dégradé lisse, presque pas de tramage.
5. **Visages.** Style anime simple : grands yeux expressifs, nez discret, petite bouche. Les personnages ont des expressions vivantes (le ton du jeu est léger).
6. **Univers.** Post-apocalyptique et solarpunk, joyeux plutôt que sombre : vêtements rapiécés de tissus récupérés aux couleurs vives, matériel bricolé (lames taillées dans un ressort, lances en tube, arcs de récupération, armures de panneaux routiers), petits motifs de plantes, technologie douce (panneau solaire, éolienne). Ni grisaille, ni gore, ni look militaire moderne.
7. **Couleur signature.** Chaque personnage garde sa couleur (celle de son portrait provisoire, `src/data/characters.ts`) dans sa tenue, pour qu'on le reconnaisse d'un coup d'œil : Anna rouge, Marc bleu, Lise vert, Brutus violet, Rik orange, Gus brun.
8. **Original.** Pas de personnage, de logo ou de costume repris d'un jeu existant, pas de nom de jeu ni d'artiste dans les prompts. On décrit ce qu'on veut voir.

## Par type d'asset

- **Portrait** (64×64, workflow `emblem_portrait`) : **gros plan**, tête, cou et haut des épaules seulement, de trois quarts **tourné vers la droite** (le jeu le retourne côté droit). Le visage occupe l'essentiel de l'image : en buste plus large, il ne fait plus que quelques pixels une fois réduit. Fond blanc uni, sans cadre. Réduction : `node tools/pixelize.ts <source> src/sprites/portrait_<id>.png --taille 64x64 --fond auto --recadrage auto` (ou un recadrage choisi à la main).
- **Variantes d'un portrait** (yeux mi-clos ou fermés, bouche) : redessin depuis la source du portrait validé (`--depuis`, `--force` 0.45 à 0.6), même sujet plus l'expression voulue.
- **Sprite de combat** (lot 3, workflow `emblem_combat`) : corps entier de la tête aux pieds, **de profil tourné vers la gauche** (proposition : les unités du joueur sont à droite de l'écran ; les ennemis sont retournés par le jeu), en garde, l'arme bien visible, environ cinq têtes de haut, de la marge tout autour. Fond blanc uni, sans sol ni ombre portée. À ce stade, on génère des poses clés ; les images intermédiaires d'une animation se feront à la main.

## Le texte de style (anglais : le modèle le comprend mieux)

Portrait :

> Pixel art style. Character portrait for a 16-bit handheld tactics RPG. {sujet}. Close-up portrait: head, neck and the top of the shoulders only, three-quarter view facing right, the face fills most of the image. Chunky low-resolution pixel art with large pixels and simple shapes, few fine details, about 20 colors. Clean dark selective outlines, cel shading with two or three flat tones per color, light from the upper left, no gradients. Bright warm hopeful colors, shadows tinted purple, skin rendered with warm saturated tones, never greyish. Post-apocalyptic solarpunk world: clothes patched together from bright recycled fabrics, scavenged gear, small plant details. Isolated on a solid flat white background, no frame, no border, no text, no logo.

Combat :

> Pixel art style. Battle sprite for a 16-bit handheld tactics RPG. {sujet}. Full body from head to feet, side view facing left, in a ready combat stance, the weapon clearly visible, about five heads tall, the whole character inside the image with empty space around. Chunky low-resolution pixel art with large pixels and simple shapes, few fine details, about 16 colors. Clean dark selective outlines, cel shading with two or three flat tones per color, light from the upper left, no gradients. Bright warm colors, shadows tinted purple. Post-apocalyptic solarpunk world: clothes patched together from bright recycled fabrics, weapons made from scrap. Isolated on a solid flat white background, no ground, no shadow, no frame, no text.

Le sujet (`--prompt`) ne décrit que le personnage : âge, allure, cheveux, tenue et sa couleur signature, arme, expression. Pas de mots de style, pas de nom propre (le modèle risquerait de l'écrire).

## Juger une image

- Réduite à sa taille finale, la silhouette et le visage se lisent-ils encore (yeux visibles) ?
- La couleur signature du personnage domine-t-elle sa tenue ?
- Contour net, aplats, pas de dégradé ni de petits motifs qui deviendront du bruit ?
- Fond uni, pas de texte, pas de cadre ?
- Cadrage et orientation conformes au type d'asset ?

Si une règle échoue souvent, on renforce son texte dans le workflow (à l'œil, dans ComfyUI), puis on le reporte ici.

## Essais (2026-11-11)

Quatre personnages (Anna, Marc, Lise, Brutus), deux graines chacun, sujets d'essai inventés pour l'occasion (leur apparence reste à fixer, sauf celle d'Anna). Planches dans `art/sources/` (non versionné) : `bible-portraits.png`, `bible-portraits-serres.png`, `bible-peau.png`, `bible-combat.png`.

- **Sans la bible** (prompt de base seul) : propre, mais chaque personnage a un peu son rendu (plus ou moins de détails, contour variable), et les tenues restent ordinaires.
- **Avec la bible** : rendu commun aux quatre (même contour, aplats, couleurs vives, vêtements rapiécés de couleurs vives), couleur signature respectée.
- **Cadrage** : en buste, le visage réduit en 64×64 devient trop petit. Le gros plan (tête, cou, haut des épaules) le rend lisible : c'est la règle retenue.
- **Peau** : réduites sur la palette, les peaux claires viraient au gris (Anna, Lise). « Warm saturated skin tones » corrige 3 cas sur 4 ; le dernier reste un peu terne. La vraie correction est côté réduction ou palette (une peau claire en plus), à voir plus tard.
- **Combat** : prometteur pour des poses clés. Anna est cohérente d'une graine à l'autre (profil vers la gauche, en garde, ses couleurs). Brutus l'est moins : de face sur une graine, et « road sign » pris au pied de la lettre (un panneau flotte à côté de lui). Une ombre au sol apparaît parfois malgré « no shadow ». Décrire l'objet plutôt que son origine (« shoulder armor of dented yellow metal plates » plutôt que « made from a road sign »).
