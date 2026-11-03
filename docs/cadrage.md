# Cadrage du projet

Document de référence des décisions de conception. Dernière mise à jour : 2026-11-03, après la revue complète des thèmes (jalons 1 à 3 et étape 4a terminés).

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
- Contenu (récit, événements, embranchements) écrit dans un format de script dédié : du texte façon scénario (fichiers `.scene`), lu par un analyseur écrit pour le projet, sans dépendance. Les répliques sont des clés de traduction seules, les textes vivent dans `src/i18n/story.fr.json`. Les portraits s'affichent au-dessus de la boîte de dialogue, plusieurs de chaque côté.
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
   - **4a (fait)** : format de script, analyseur, boîte de dialogue avec portraits, scènes de début et de fin de chapitre.
   - 4b : déclencheurs de début de tour et de mort d'une unité, conditions (vivant, mort, tour, drapeaux), événements uniques.
   - 4c : vitesse du texte réglable, passer la scène, historique des dialogues.
   - 4d : choix du joueur dans les dialogues, routes et drapeaux d'embranchement.
   - 4e : mise en scène : unités qui apparaissent ou se déplacent, changement d'objectif, ennemi qui passe dans le camp.
   - 4f : déclencheurs de case atteinte et commande « Parler » entre deux unités adjacentes.
2. Caméra et défilement, entrées tactiles.
3. Sauvegarde, écran titre et menus, options.
4. Progression : XP, croissances, promotion.
5. Combat étendu : magie, soins, cavaliers, volants, durabilité et rangs.
6. Inventaire, boutique, forge, convoi, préparation de bataille, base.
7. Art, écran de combat dédié, audio.
8. Tranche verticale : un chapitre complet, puis quelques chapitres pour les premiers tests.

## État actuel du code (jalons 1 à 3 et étape 4a)

**Fait** : grille et déplacement avec coût de terrain, combat (triangle physique, double attaque, riposte selon la portée, critique, 2RN), mort définitive, phases joueur et ennemie, IA à trois profils, seigneur et boss avec écran de fin, déplacements animés, i18n fr/en, script de scènes (format texte, analyseur, interpréteur), dialogues avec portraits provisoires et texte progressif, scènes de début et de fin de chapitre, tests.

**Pas encore fait** : tout ce qui n'est pas listé ci-dessus, en particulier la suite du récit (étapes 4b à 4f), la caméra, la sauvegarde, la progression, la magie, l'inventaire et les vrais assets.
