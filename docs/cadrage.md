# Cadrage du projet

Document de référence des décisions de conception. Dernière mise à jour : 2026-11-03, après la revue complète des thèmes (jalons 1 à 3 et étapes 4a à 4i, 5a, 5b, 6a et 6b terminés).

Ce document remplace les choix précédents quand ils diffèrent (voir « Changements par rapport au départ »).

## 1. Vision

- **Piliers** : la tactique, l'histoire et les personnages, l'attachement aux unités.
- **Repris de Blazing Sword** : les règles de combat, le look pixel art GBA, la structure en chapitres.
- **Pas repris** : son univers et son ton. Les noms, classes, univers et assets sont originaux.
- **Taille visée** : une campagne complète, 20 chapitres ou plus.
- **Finalité** : un jeu partagé entre amis.

## 2. Équipe et diffusion

- Une seule personne, avec Claude. Sans échéance.
- Diffusion : un lien web d'abord, une application téléchargeable éventuellement plus tard.
- Sauvegarde : locale, dans le navigateur de chacun.

## 3. Univers et récit

- **Univers** : original, à définir ensemble (pas encore fixé).
- **Ton** : léger et humoristique.
- **Structure** : plusieurs routes et plusieurs fins.
- **Personnages** : 20 à 30 personnages jouables.
- **Relations** : soutiens avec bonus de combat, et romances.

### Vocabulaire du récit

- **Script** : le fichier d'un chapitre. Il contient des événements.
- **Événement** : un déclencheur (début de chapitre, tour N, mort d'une unité…), des conditions éventuelles et un contenu.
- **Dialogue** : une suite de répliques affichées dans la boîte en bas de l'écran, avec les portraits. Trois usages : encadrer un niveau (début et fin, pour donner le contexte), les échanges pendant un niveau (tutoriel, recruter une unité en lui parlant, première attaque contre un ennemi, début d'un tour, lieu visité), et les réactions aux événements de la partie (mort d'une unité).
- **Narration** : les passages entre les niveaux qui racontent l'histoire. Présentation à définir, hors de la carte. À construire avec l'enchaînement des chapitres.

## 4. Règles de combat

- **Statistiques** : PV, Force, Magie, Technique, Vitesse, Chance, Défense, Résistance. Pas de Constitution ni de poids des armes.
- **Armes** : épée, lance, hache, arc, plus la magie avec son propre triangle, les bâtons de soin, les armes efficaces contre un type de cible, la durabilité et les rangs d'arme. Triangle physique : épée > hache > lance > épée.
- **Classes** : fantassins et archers, plus cavaliers, unités volantes, magiciens et soigneurs, voleurs et utilitaires.
- **Cartes** : villages, coffres et portes, objectifs variés (survie, escorte, fuite…), renforts en cours de bataille. Pas de brouillard de guerre.
- **Hasard** : deux tirages moyennés (2RN), avec affichage du pourcentage réel dans la prévision.
- **Mort définitive** : au choix du joueur, mode classique ou mode décontracté.

## 5. Progression et structure de campagne

- **Niveaux** : croissances aléatoires.
- **Promotion** : arbre de classes avec choix.
- **Équipement** : inventaire limité, boutique et armurerie, forge et amélioration, convoi partagé.
- **Entre les chapitres** : préparation de bataille, base ou camp, carte du monde.

## 6. Difficulté et IA

- Un seul niveau de difficulté.
- IA ennemie : les trois profils actuels, `charge`, `guard` et `stationary`.

## 7. Art et son

- **Résolution** : tuiles 16×16, écran logique 384×256 (24×16 tuiles), agrandissement entier.
- **Production des assets** : génération par IA, retouchée à la main.
- **Combats** : écran de combat dédié par défaut, avec une option de combats rapides sur la carte.
- **Son** : effets sonores, musique chiptune, voix ou cris courts. Dans un second temps.

## 8. Interface et contrôles

- **Contrôles** : souris et tactile mobile. Pas de clavier ni de manette prévus.
- **Cartes** : plus grandes que l'écran, la caméra suit le curseur.
- **Style de l'interface** : pas encore décidé.
- **Options** : vitesse des animations, lisibilité du texte.

## 9. Technique

- TypeScript strict, Canvas 2D, Vite. Aucune bibliothèque de jeu.
- Tests avec `node --test`. Pas d'outillage supplémentaire pour l'instant.
- Contenu (récit, événements, embranchements) écrit dans un format de script dédié : du texte façon scénario (fichiers `.script`), lu par un analyseur écrit pour le projet, sans dépendance. Les répliques sont des clés de traduction seules, les textes vivent dans `src/i18n/story.fr.json`. Les portraits s'affichent au-dessus de la boîte de dialogue, plusieurs de chaque côté.
- Méthode de création des cartes : à décider plus tard (texte dans le code aujourd'hui).
- Langue : français d'abord. L'infrastructure i18n (fr/en) reste en place.

## 10. Méthode

- **Tranche verticale** : un chapitre complet de bout en bout (récit, art, son, progression), puis on étend.
- **Premier chantier** : le récit et les dialogues.
- **Premiers tests entre amis** : après quelques chapitres.

## Changements par rapport au départ

| Avant | Maintenant |
|---|---|
| Site statique sans sauvegarde | Sauvegarde locale indispensable (campagne de 20+ chapitres) |
| Carte de la taille de l'écran, sans caméra | Cartes qui défilent avec le curseur |
| Aucune mécanique avancée au début | Magie, soins, cavaliers, volants, voleurs, durabilité, forge, base et carte du monde |
| Un seul objectif : vaincre le boss | Objectifs variés, renforts, plusieurs routes |
| Souris d'abord, puis clavier et manette | Souris et tactile mobile |
| Français + anglais dès le départ | Français d'abord |

## Points d'attention

1. **Volume** : 20 chapitres, plusieurs routes et 20 à 30 personnages (portraits, sprites, dialogues, soutiens, romances) pour une seule personne. La tranche verticale mesurera le coût réel. Prévoir de couper si besoin (nombre de routes, de soutiens).
2. **Art par IA** : la cohérence de style demande de figer tôt une direction artistique (palette, gabarits de sprites, outil). Vérifier les conditions d'utilisation de l'outil choisi.
3. **Écran de combat dédié par défaut** : une animation par classe et par arme, très coûteux avec magie, cavaliers et volants. L'option rapide sur la carte reste la référence.
4. **Format de script** : créer un mini-langage est un projet en soi. À cadrer précisément pour éviter la sur-ingénierie.
5. **Défilement et tactile** : ils touchent la base (coordonnées, entrées). Les poser avant d'empiler des menus.
6. **Sauvegarde locale seule** : le navigateur peut effacer les données. Un export de fichier servirait de filet plus tard.

## Questions ouvertes

- L'univers et le nom du jeu.
- Le style de l'interface.
- La méthode de création des cartes (texte, Tiled, éditeur maison).
- La direction artistique précise et l'outil de génération d'images.
- La disposition mobile en portrait.

## Ordre de jalons proposé

1. Récit et dialogues (jalon 4), découpé en étapes :
   - **4a (fait)** : format de script, analyseur, boîte de dialogue avec portraits, dialogues de début et de fin de chapitre.
   - **4b (fait)** : déclencheurs de début de tour (joueur et ennemi) et de mort d'une unité, conditions (vivant, mort, tour, drapeaux), blocs @si/@sinon, drapeaux, événements joués une seule fois.
   - **4c (fait)** : mode Auto (passage automatique après 3 secondes), passer un dialogue avec confirmation, historique de tous les dialogues déjà vus. La vitesse du texte réglable est venue avec le menu d'options (étape 6a).
   - **4d (fait)** : choix du joueur dans les dialogues (`@choix` / `@option`, jusqu'à 4 options, panneau au milieu de l'écran), drapeaux d'embranchement relus par les dialogues suivants. « Passer » s'arrête au choix, Auto est en pause, le choix entre dans l'historique. Changer de route ou de chapitre suppose l'enchaînement des chapitres.
   - **4e (fait)** : mise en scène des unités : apparition depuis une réserve (`@apparait`), déplacement animé (`@deplace`), ennemi qui passe dans le camp (`@recrute`). Le dialogue s'efface pendant l'action, « Passer » applique tout instantanément.
   - **4f (fait)** : objectifs de chapitre : vaincre le boss (par défaut), vaincre tous les ennemis (`deroute`), survivre jusqu'à la fin du tour N (`survie N`), changeables par `@objectif`. Affichés dans le HUD et annoncés par une bannière au début du chapitre et à chaque changement. La défaite (mort du seigneur) ne dépend pas de l'objectif. Les objectifs « atteindre une case » et « escorter » sont venus à l'étape 4i.
   - **4g (fait)** : déclencheurs d'actions du joueur : `selection(id)` (sélection d'une unité, utile au tutoriel), `attaque(id)` (avant le combat), `case(x,y)` et `case(id,x,y)` (arrivée sur une case après un déplacement).
   - **4h (fait)** : commande « Parler » : une entrée de menu apparaît quand une unité est voisine d'une autre pour qui le script prévoit un événement `parler(a,b)` non joué. Un seul interlocuteur : la conversation se lance ; plusieurs : on désigne lequel (surbrillance verte). Elle termine l'action de l'unité et peut recruter (`@recrute`). Les soutiens avec bonus de combat restent à faire.
   - **4i (fait)** : objectifs « atteindre une case » (`atteindre x y` : une unité du joueur sur la case suffit) et « escorter » (`escorte unité x y` : seule l'unité désignée gagne en arrivant, et sa mort fait perdre). La case visée est marquée sur la carte (voile jaune et coins) et le HUD l'annonce. La victoire se déclenche dès l'arrivée, sans attendre la fin de l'action de l'unité. Dans le chapitre 1, la voie prudente bascule en escorte de Marc (ou en « atteindre » si Marc est mort) vers la case (1,14), la voie audacieuse reste en « survie 4 ». Limite connue : `@recrute` et `@objectif` ne réévaluent pas la victoire sur le champ (elle l'est après une mort, à la fin de la phase ennemie et à l'arrivée d'une unité du joueur). Le jalon 4 est terminé ; la narration entre les chapitres relève de l'étape 6.
2. Caméra et défilement, entrées tactiles, découpés en deux étapes :
   - **5a (fait)** : caméra en tuiles entières, bornée à la carte (une carte plus petite que la vue est centrée). À la souris, le pointeur resté sur la rangée de bord de l'écran fait défiler d'une tuile toutes les 150 ms, la molette défile aussi (verticalement, horizontalement avec un pavé tactile). Le défilement du bord ne repart qu'après un mouvement du pointeur quand un dialogue ou la phase ennemie l'a interrompu. La caméra suit l'action : curseur, menu d'actions (toujours entièrement visible), ennemis qui bougent ou attaquent, mise en scène des dialogues. `ui.cursor` reste la case de la carte, `ui.pointer` est la case de l'écran (boutons et choix des dialogues). Le chapitre 1 passe à 32×20 (terrain ajouté à droite et en bas) et son renfort entre par le bord est en (31,8). Sauts instantanés : le défilement animé et un repère pour une case d'objectif hors écran restent possibles plus tard.
   - **5b (fait)** : entrées tactiles. Doigt et stylet : poser place le curseur (aperçu), lever sans avoir bougé valide comme un clic, glisser de plus de ~10 px fait défiler la carte tuile par tuile sans rien valider ; un second doigt est ignoré, un geste interrompu par le système n'a aucun effet (`input/gesture.ts`, pur et testé). Un bouton « Retour » (en haut au centre, tuiles 10 à 13) apparaît dès qu'une annulation est possible (unité choisie, menu, ciblage, menu « Fin de tour ») et remplace le clic droit, qui reste. La page bloque zoom, rebond, sélection et menu d'appui long. `mouse.ts` devient `pointer.ts`. Non testé sur un vrai téléphone (gestes simulés par de vrais `PointerEvent` de type `touch`). Restent ouverts : la précision du doigt (une case fait ~22 px à l'écran en paysage ; validation en deux temps possible) et la disposition en portrait.
3. Sauvegarde, écran titre et menus, options, découpés en deux étapes :
   - **6a (fait)** : écran titre (« Nouvelle partie », « Options ») au chargement de la page, écran d'options (vitesse du texte : lente, normale, rapide, instantanée ; vitesse des animations : normale, rapide, très rapide ; langue : Français, English), atteignable aussi depuis le menu d'une case vide en cours de partie, avec retour exact à la partie. Un clic sur une ligne passe à la valeur suivante, le choix s'applique tout de suite et s'enregistre dans le navigateur (`localStorage`, tolérant à son absence). La langue suit : choix enregistré, puis `?lang=`, puis le navigateur. Le nom du jeu affiché est provisoire. Réglages (`core/settings.ts`) et zones des écrans (`core/screens.ts`) sont purs et testés.
   - **6b (fait)** : sauvegarde de partie, libre (on sauvegarde et on recharge à volonté pendant son tour, hors dialogue et hors phase ennemie). Un emplacement automatique, écrit après l'ouverture du chapitre puis au début de chaque tour du joueur (jamais une fois la partie gagnée ou perdue), plus trois emplacements manuels. Le menu d'une case vide devient « Fin de tour », « Sauvegarder », « Options », « Titre » ; « Sauvegarder » ouvre l'écran des emplacements (l'automatique y est grisé), écraser un emplacement occupé et retourner au titre demandent confirmation (écran Oui / Non). « Continuer » sur l'écran titre, grisé sans sauvegarde lisible, ouvre les emplacements en mode chargement ; « Nouvelle partie » repart d'un chapitre neuf, même après un retour au titre. Format versionné (`core/save.ts` : version, chapitre, date, état, historique des dialogues), relu avec validation complète : un emplacement abîmé ou modifié à la main s'affiche « Illisible » sans faire planter le jeu et peut être remplacé. Non sauvegardés : caméra, mode Auto, menu ou sélection en cours. Reportés : export et import en fichier (filet contre l'effacement des données du navigateur), sauvegarde « de reprise » supprimée au chargement en mode classique (suppose le choix classique / décontracté, qui viendra avec la progression), registre de chapitres (la sauvegarde note `chapter1` ; le registre viendra quand les chapitres s'enchaîneront).
4. Progression : XP, croissances, promotion.
5. Combat étendu : magie, soins, cavaliers, volants, durabilité et rangs.
6. Entre les chapitres : narration, inventaire, boutique, forge, convoi, préparation de bataille, base, carte du monde.
7. Art, écran de combat dédié, audio.
8. Tranche verticale : un chapitre complet, puis quelques chapitres pour les premiers tests.

## État actuel du code (jalons 1 à 3 et étapes 4a à 4i, 5a, 5b, 6a et 6b)

**Fait** : grille et déplacement avec coût de terrain, combat (triangle physique, double attaque, riposte selon la portée, critique, 2RN), mort définitive, phases joueur et ennemie, IA à trois profils, seigneur et boss avec écran de fin, objectifs de chapitre (boss, déroute, survie, atteindre une case, escorter) affichés dans le HUD, avec la case visée marquée sur la carte, et annoncés par une bannière, déplacements animés, i18n fr/en, script de dialogues (format texte, analyseur, interpréteur avec blocs @si et drapeaux), dialogues avec portraits provisoires et texte progressif (mode Auto, passer avec confirmation, historique, choix du joueur, mise en scène des unités), déclencheurs de début et de fin de chapitre, de début de tour, de mort d'une unité et d'actions du joueur (sélection, attaque, arrivée sur une case), commande « Parler » avec recrutement par la parole, caméra et défilement à la souris (bords de l'écran, molette) sur des cartes plus grandes que la vue, entrées tactiles (toucher, glisser, bouton « Retour »), écran titre et options enregistrées (vitesse du texte et des animations, langue), sauvegarde de partie (un emplacement automatique, trois manuels, « Continuer », retour au titre), tests.

**Pas encore fait** : tout ce qui n'est pas listé ci-dessus, en particulier la narration entre les niveaux, l'export de sauvegarde, la progression, la magie, l'inventaire et les vrais assets.
