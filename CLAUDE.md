# EmblemTest : mémo pour Claude

Tactical RPG au tour par tour, jouable dans le navigateur. Règles de combat et look GBA inspirés de Fire Emblem (Blazing Sword), univers, noms et assets originaux (post-apocalyptique solarpunk, ton léger). Projet d'une seule personne avec Claude, sans échéance, pour jouer entre amis.

## Documents de référence (à lire avant de toucher au design)

- `docs/cadrage.md` : toutes les décisions de conception, l'ordre des jalons, l'état actuel du code. **Il fait foi.** On le met à jour à chaque jalon (section « Ordre de jalons » et « État actuel du code »).
- `docs/assets.md` : liste des assets à produire, tailles, contraintes techniques, décisions d'art encore ouvertes.
- `docs/personnages.md` : les fiches des personnages (rôle, couleur signature, caractère, apparence, signe distinctif, arme), propositions à valider. Leurs sujets de prompt sont dans `art/personnages.json` (`node tools/comfy.ts <nom> --personnage <id>`).
- `docs/bible-style.md` : la bible de style (règles visuelles, cadrage par type d'asset, texte de style des prompts, comment juger une image). Le texte de style qui fait foi est dans les workflows de ComfyUI ; on reporte dans la bible toute règle qui change.

## Commandes

- `npm run dev` : serveur Vite sur http://localhost:5173 (`.claude/launch.json` → config `dev`).
- `npm test` : tests de `src/` et de `tools/` avec `node --test` (Node 24 lit le TypeScript directement, sans build).
- `npm run typecheck` : `tsc --noEmit`, sur `src/` seulement : `tools/` utilise les modules de Node et le projet n'a pas `@types/node`.
- `npm run build` : typecheck puis `vite build`.
- Après un changement : `npm test` et `npm run typecheck` doivent passer (276 tests au 2026-11-11).

## Stack et conventions

- TypeScript strict, Canvas 2D, Vite. **Aucune bibliothèque de jeu, aucune dépendance d'exécution.** Seules dépendances : `typescript` et `vite` (dev).
- `tsconfig` : `allowImportingTsExtensions` (les imports finissent par `.ts`), `verbatimModuleSyntax` (`import type` obligatoire pour les types), `erasableSyntaxOnly` (pas d'`enum`, pas de `namespace`, pas de propriétés de paramètres), `noUncheckedIndexedAccess`.
- Commentaires, docs, noms de commits et textes en **français**. Code : guillemets simples, point-virgule, 2 espaces.
- Commits : `feat: jalon 6b - sauvegarde de partie`, `docs: …`, corps en liste à puces par fichier. Travail directement sur `main`.
- Tests à côté du code (`x.ts` / `x.test.ts`). La logique testable vit dans `src/core/` (pure, sans DOM). `src/core/test-helpers.ts` aide à monter des états.
- Écran logique 384×256 (24×16 tuiles de 16 px), agrandi d'un facteur entier, rendu `pixelated`. Les dimensions ne viennent que de `src/config.ts`.

## Carte du code

- `src/main.ts` (~870 lignes) : boucle de jeu, état de l'interface, enchaînement phases joueur / ennemie, lecture des dialogues, écrans (titre, options, emplacements), sauvegarde auto. C'est le chef d'orchestre ; le reste est découpé en modules purs.
- `src/core/` : règles pures et testées.
  - `types.ts` (GameState sérialisable, Unit, Objective…), `grid.ts` (carte depuis des lignes de texte), `movement.ts` (portée, chemins), `combat.ts` (prévision, 2RN, résolution en événements), `ai.ts` (profils `charge` / `guard` / `stationary`), `turn.ts`, `objective.ts` (victoire / défaite).
  - `script.ts` (analyseur des `.script`), `dialogue.ts` (interpréteur : répliques, `@choix`, `@si`, mise en scène), `triggers.ts` (déclencheurs d'actions du joueur).
  - `camera.ts`, `selection.ts` (machine à états de la sélection et des menus), `screens.ts` (zones cliquables des écrans), `settings.ts`, `save.ts` (format versionné, lecture stricte).
- `src/render/` : dessin Canvas. `renderer.ts` (carte, unités, curseur, effets), `panels.ts` (HUD, menus, prévision, bannières), `dialogue.ts` (boîte, portraits 64×64, historique), `screens.ts` (titre, options, emplacements), `sprites.ts` + `variants.ts` (chargement des PNG, lecture des noms de fichiers).
- `tools/` : outils de production lancés à la main avec `node`, hors du jeu. `sprite.ts` (sprites d'unités par règles), `comfy.ts` (génération via ComfyUI, avec le workflow réglé dans son interface), `comfy-workflow.ts` (conversion de ce workflow au format de l'API, réglages d'une génération), `pixelize.ts` (réduction sur la palette), `grid.ts` (grille des « gros pixels » de l'IA), `cleanup.ts` (nettoyage des petits sprites), `png.ts` (lecture et écriture PNG sans dépendance), `palette.ts` (`.gpl` et `.ase`, couleur la plus proche en OKLab, conversion `.ase` → `.gpl`).
- `art/` (versionné sauf `sources/`) : `palette.gpl`, `comfy/` (workflows ComfyUI au format de l'interface), `zones.gpl`, `gabarits/` et `unites.json` (sprites par règles, prototype écarté), `sources/` (brouillons IA et aperçus).
- `src/input/` : `pointer.ts` (souris et tactile → actions), `gesture.ts` (tap / glisser, pur et testé), `actions.ts`.
- `src/data/` : contenu. `chapter1.ts` (carte en texte : `.` plaine, `f` forêt, `m` montagne, `#` mur ; unités), `chapter1.script` (dialogues et événements), `classes.ts`, `weapons.ts`, `terrains.ts`, `characters.ts` (portraits provisoires : couleur + initiale).
- `src/i18n/` : `fr.json` / `en.json` (interface), `story.fr.json` (répliques du récit, clés seules dans les scripts).
- `src/storage.ts` : `localStorage` tolérant à son absence (réglages, 4 emplacements de sauvegarde).

## Format de script (`src/data/*.script`)

`@event <id> quand <déclencheur>` puis un bloc indenté ; `#` commente une ligne. Déclencheurs : `chapitre.debut`, `chapitre.victoire`, `chapitre.defaite`, `tour.joueur(N)`, `tour.ennemi(N)`, `mort(id)`, `selection(id)`, `attaque(id)`, `case(x,y)`, `case(id,x,y)`, `parler(id,id)`. Répliques : `<perso>: <clé>` ou `narration: <clé>`. Commandes : `@montre <perso> gauche|droite`, `@cache`, `@drapeau` / `@efface`, `@si` / `@sinon` / `@fin`, `@choix` / `@option <clé>` / `@fin`, `@apparait id x y`, `@deplace id x y`, `@recrute id`, `@objectif …`. Une erreur de script fait échouer le chargement avec le numéro de ligne. Référence : `core/script.ts`.

## Assets

- Dossier `src/sprites/`, chargés par `import.meta.glob` dans `render/sprites.ts`, trouvés par leur nom, sans toucher au code (recharger la page après un ajout) :
  - `tile_<terrain>_<n>.png` (16×16) remplace l'aplat du terrain ; variante stable selon la position. Faites : plaine ×3, forêt ×3 (à la main), montagne ×1, mur ×1 (IA, test de style).
  - `unit_<id>.png` dessine une unité, par id (`anna`) ou par classe (`swordsman`) ; seule l'image 16×16 en haut à gauche est utilisée (repos), grisée automatiquement après action. Fait : `unit_anna.png` (feuille 128×112 générée par `tools/sprite.ts`, voir plus bas ; la version IA est gardée dans `art/sources/unit_anna_ia.png`).
  - `portrait_<personnage>.png` (64×64, tourné vers la droite) remplace le portrait provisoire ; retourné à droite de l'écran, assombri quand le personnage ne parle pas. Fait : `portrait_anna.png`.
- Pas encore branchés : animations (marche, repos sur 3 images), yeux et bouche des portraits, couleurs d'équipe, interface, police.
- Contraintes : échelle 1, pas d'anti-crénelage, PNG transparent. Éditeur : Pixelorama.
- **Palette** : `art/palette.gpl`, la palette `palette_16bit_amelioree_64` (64 couleurs, convertie depuis le `.ase` de l'utilisateur par `node tools/palette.ts <fichier.ase> art/palette.gpl "<nom>"`). Les tuiles faites main n'utilisent que ses couleurs. Elle a peu de rouges francs (ses rouges tirent vers le rose, ses orangés sont clairs) : en OKLab pur, un roux vire au rose. D'où `--teinte 3` par défaut dans `tools/pixelize.ts`, qui privilégie la teinte sur la luminosité.

## Sprites d'unités par règles (`tools/sprite.ts`) : prototype écarté

**Décision du 2026-11-11** : les sprites de carte se font **à la main**, 12 images par unité (respiration au survol, marche vers le bas, le haut et de côté, 3 images chacune ; voir `docs/assets.md`). L'IA (ComfyUI) sert aux portraits et aux sprites de combat. Ce générateur a donné l'Anna provisoire ; les règles d'animation plaisaient, le dessin non. Ce qui suit le documente pour mémoire.

- **Pièces** (`art/gabarits/<nom>.png`, 16×16) : dessinées en zones, pas en couleurs. 8 zones (`peau`, `cheveux`, `tenue`, `tenue2`, `metal`, `cuir`, `accent`, `yeux`) × 4 tons (clair, moyen, ombre, trait intérieur), avec la palette `art/zones.gpl` (à charger dans Pixelorama ; régénérée par `node tools/sprite.ts --zones art/zones.gpl`). Une couleur hors de cette palette fait échouer la génération avec la position du pixel. Laisser un pixel libre sur chaque bord : le contour est ajouté par les règles.
- **Vues** : `<nom>.png` est la pièce de face ; `<nom>.dos.png` et `<nom>.cote.png` (tournée vers la droite) servent pour la marche vers le haut et de côté. Sans variante, la pièce de face sert dans toutes les vues (l'épée d'Anna).
- **Description** (`art/unites.json`) : `taille`, `lignes` (`cou` = première ligne du torse, `taille` = première ligne des jambes sous les hanches, `milieu` = première colonne de la jambe droite à l'écran), `materiaux` (nom → `#rrggbb`, rampe de 4 tons calculée sur la palette, ou liste imposée de 4 couleurs clair/moyen/ombre/trait), `defaut` (matières par zone), `unites` (pièces empilées dans l'ordre, la suivante couvre la précédente ; `{ "nom": "epee", "suit": "torse" }` fait bouger une pièce d'un bloc ; `couleurs` : zone → matière).
- **Règles** : rampe calculée (clair plus lumineux vers le jaune, ombre vers le bleu-violet, trait sombre, au plus 0.4 de clarté OKLab même pour une matière claire) ; contour extérieur d'un pixel dans le trait de la zone bordée ; un vide d'un pixel dans le sujet devient un trait (séparation des jambes) ; repos sur 3 images (`REPOS` : tête et torse descendent d'un pixel, puis le torse remonte avant la tête) ; marche sur 4 images (`MARCHE_FACE`, de face et de dos : appui, pied gauche levé avec le corps monté d'un pixel, appui, pied droit ; `MARCHE_COTE` : jambes écartées, puis jointes avec le corps monté d'un pixel).
- **Feuille** (128×112 pour des pièces de 16×16, `sheetLayout`) : première ligne de 16 px, le repos en 3 images de 16×16 ; puis trois lignes de 32 px, la marche vers le bas, le haut et la droite, 4 images de 32×32 chacune (la gauche = miroir de la droite, à faire par le jeu). Dans une image de marche, le personnage est posé en bas au centre (en x = 8, y = 16) : la marge sert au mouvement, comme sur GBA, où le personnage fait environ 14×16 dans des images de 32×32.
- **Commande** : `node tools/sprite.ts [unité…] [--apercu 8]` écrit `src/sprites/unit_<unité>.png` et, avec `--apercu`, trois aperçus dans `art/sources/` : `.planche.png` (la feuille sur l'herbe), `.repos.png` et `.marche.png` (animés, en APNG : `encodeApng` de `tools/png.ts`, le navigateur les anime).
- **Pour dessiner ou corriger une pièce en texte** (brouillons, tests) : `layerFromText` / `layerToText` / `layerToImage` de `tools/sprite.ts`. Une lettre par zone et par ton (`LETTERS`, par exemple cheveux `HhiI` = clair, moyen, ombre, trait), `.` vide.
- **Proportions** (retour de l'utilisateur, 2026-11-11) : la première Anna (tête de 12 px de large, corps en bloc de 14 px sur 9 lignes) était trop massive. Viser une silhouette en poire, comme les sprites de carte GBA mesurés : tête d'environ 9 px de large contour compris, arrondie en haut (5, 7, 9 px), 7 lignes sur 16 ; bras détachés du torse par un pixel vide (il devient trait) ; taille fine (5 px) ; jambes séparées, pieds un peu écartés. On mesure les proportions d'une référence (largeur par ligne), on ne recopie jamais ses pixels.
- Pièces d'Anna : `corps` (peau, yeux, mains), `tenue_aventuriere`, `echarpe`, `cheveux_carre` (chacune de face, de dos et de côté), `epee` (une seule vue). Premier jet, à retoucher à l'œil. De côté, les images 1 et 3 sont identiques (de même 2 et 4) : faire passer l'autre jambe devant demanderait une pièce de jambes de plus.
- Restent : les couleurs d'équipe (une matière par équipe), les pièces des autres classes, l'animation de survol (unité sous le curseur), le branchement du repos et de la marche dans le jeu (aujourd'hui, seule l'image de repos en haut à gauche est dessinée).

## Chaîne de production des assets (IA)

1. `node tools/comfy.ts <nom> --graines 1,2,3,4 --prompt "<sujet>"` : brouillons 1024 px dans `art/sources/` (non versionné), avec le workflow réglé dans ComfyUI (voir plus bas). Le sujet remplace `{sujet}` dans le prompt du workflow, qui porte déjà « Pixel art style. » et le texte de style : ne pas les répéter dans `--prompt`. Avec `--depuis image.png --force 0.5`, redessine une image existante (image vers image) au lieu de partir de rien.
2. Choisir un brouillon, puis `node tools/pixelize.ts art/sources/<brouillon>.png src/sprites/<asset>.png --taille LxH [options]` : fond effacé, sujet cadré, réduction, palette. Options détaillées en tête du fichier. L'aperçu agrandi (`--apercu 10`) va dans `art/sources/`.
3. Retouche à la main dans Pixelorama si besoin.

Recettes du test de style (2026-11-11) :
- Portrait : `--taille 64x64 --recadrage 230,50,560,560 --fond auto` (vote, réduction ×9 : le « gros pixel » de la source fait à peu près un pixel d'arrivée).
- Unité : `--taille 16x16 --fond auto --recadrage auto --details 0.3 --couleurs 10 --nettoyage --contour teinte`. Le nettoyage (`tools/cleanup.ts`) rend le sprite lisible sur l'herbe : contour d'un pixel assombri d'après la couleur voisine, 10 couleurs au plus, pixels isolés fondus (sauf les points sombres, souvent les yeux), détails sombres gardés à la réduction. Le corps reste une masse sombre si la source dessine une veste sombre : c'est au prompt de demander des vêtements plus clairs.
- Tuiles : `--taille 16x16 --fond auto --recadrage auto --methode moyenne --sous src/sprites/tile_plain_1.png`. En réduction ×40 et plus, `moyenne` évite que les contours sombres gagnent le vote.
- `--grille auto` (option) : retrouve la grille des « gros pixels » et en fait de vrais pixels avant la réduction. Gain modeste : les pixels du modèle sont irréguliers (4 à 7 px, la détection varie d'un recadrage à l'autre) et souvent mêlés de zones lisses. Utile seulement quand le sujet a déjà à peu près la taille voulue en vrais pixels (au plus 25 % de plus : on rogne au lieu de réduire).
- Résolution du modèle : une image de 1024 px équivaut à un dessin d'environ 130 à 170 vrais pixels ; générer en 512 px ne change pas ce nombre (les pixels rapetissent) et affaiblit le style pixel art. Pour du 16×16, la réduction reste d'environ ×6 : la perte vient de là, pas de l'algorithme.
- Variantes d'un même personnage (yeux fermés, expression) : `--depuis` la source 1024 px du portrait, même prompt + « eyes closed », `--force 0.45` (yeux mi-clos) à `0.6` (fermés). Le personnage, le cadrage et la coiffure restent en place : de quoi découper les images d'yeux et de bouche des portraits animés.
- Boucle de redessin pour le 16×16 (essayée le 2026-11-11, **sans gain**) : sprite 16×16 agrandi ×64 puis redessiné. Jusqu'à `--force 0.75` le modèle garde les blocs tels quels ; à 0.8-0.85 il redessine à sa propre résolution (même perte à la réduction) ; à 0.9 et plus, avec « 16x16 sprite » dans le prompt, il dessine des planches de sprites. Ne pas retenter sous cette forme.
- Prompts qui marchent : sujet seul, « isolated on a solid flat white background, no frame, no text » ; pour une unité, « tiny chibi … full body, front view, 16-bit handheld tactics game map sprite ». La graine 2 a tendance à ajouter un cadre noir.

## Génération d'images en local (installée le 2026-11-11)

- ComfyUI portable v0.45.0 dans `D:\IA\ComfyUI_windows_portable` (hors dépôt). Lancement manuel : `run_nvidia_gpu.bat` ; interface et API sur http://127.0.0.1:8188.
- Modèles (licence Apache 2.0) : `diffusion_models/z_image_turbo_int8_convrot.safetensors`, `text_encoders/qwen_3_4b_fp8_mixed.safetensors` (CLIPLoader type `lumina2`), `vae/ae.safetensors`, LoRA `loras/pixel_art_style_z_image_turbo.safetensors` (tarn59, mot déclencheur « Pixel art style. »).
- Réglages du workflow officiel : ModelSamplingAuraFlow shift 3, KSampler 8 pas, cfg 1, `res_multistep` / `simple`, négatif = ConditioningZeroOut. LoRA à 0,9.
- Temps : ~100 s pour la première image (chargement), puis 6 à 11 s par image en 1024 px.
- **Le workflow se règle dans l'interface** (branché le 2026-11-11) : `tools/comfy.ts` génère avec le workflow **enregistré dans ComfyUI** (panneau Workflows → `emblem_portrait`, fichier `ComfyUI/user/default/workflows/emblem_portrait.json`), tel que l'utilisateur l'a réglé à l'œil puis enregistré (Ctrl+S). Il le lit par `GET /api/userdata/workflows%2F<nom>.json`, le convertit au format de l'API (`tools/comfy-workflow.ts`, avec la description des nœuds de `/api/object_info`) et ne change que : `{sujet}` dans le prompt positif (`--prompt`), la graine, la taille de l'image vide, la force des LoRA, le nom des fichiers, et l'image de départ (`--depuis` : LoadImage + VAEEncode branchés sur l'échantillonneur, denoise = `--force`). Le reste (modèle, pas, texte de style, nœuds ajoutés) vient du workflow. Contraintes : un seul KSampler ; les notes, relais, nœuds muets ou contournés sont gérés ; les sous-graphes non.
- Deux workflows, qui portent le texte de style de la bible (`docs/bible-style.md`) autour de `{sujet}` : `emblem_portrait` (par défaut, gros plan tourné vers la droite) et `emblem_combat` (corps entier de profil vers la gauche, lot 3). `--prompt` ne décrit donc que le personnage.
- `--personnage <id>` prend le sujet dans `art/personnages.json`, celui du workflow utilisé (`portrait` pour `emblem_portrait`, `combat` pour `emblem_combat`) ; un `--prompt` donné en plus s'y ajoute (« eyes closed »).
- `--workflow <nom>` choisit un autre workflow enregistré. À chaque génération, la version utilisée est copiée dans `art/comfy/<nom>.json` (versionné) si elle a changé : l'historique git garde les réglages. `node tools/comfy.ts --installer` remet les workflows du dépôt dans ComfyUI (sans écraser ceux qui y sont).
- Toute image générée garde son réglage exact (prompt, graine, force…) : la glisser dans la fenêtre de ComfyUI rouvre son workflow.
- Enregistrer un workflow dans ComfyUI depuis le code : `POST /api/userdata/workflows%2F<nom>.json?overwrite=true` (par défaut ComfyUI écrase ; `overwrite=false` répond 409 si le fichier existe). Pour passer du format API au format interface : dans la page de ComfyUI, `app.loadApiJson(api)` puis `app.graph.serialize()`.
- Constats du premier essai : portraits très bons ; tuiles de terrain inutilisables telles quelles ; sprites d'unités à cadrer mieux dans le prompt ; le modèle invente du texte si on ne lui interdit pas (« no text »).

## Pièges connus

- Windows : cloner avec `git -c core.longpaths=true clone …` si le chemin est profond (sinon « Filename too long »). `core.longpaths` est activé dans ce dépôt.
- Tout PNG de `src/sprites/` est embarqué dans le jeu par Vite : n'y mettre que des assets finis (les aperçus et brouillons vont dans `art/sources/`).
- `@recrute` et `@objectif` ne réévaluent pas la victoire sur le champ (limite connue, cadrage 4i).
- Le tactile n'a jamais été testé sur un vrai téléphone.
