# Fiches des personnages

L'apparence de chaque personnage, pour que tous ses assets (portrait, variantes, sprite de combat, sprite de carte dessiné à la main) le montrent de la même façon. Le style commun est dans `docs/bible-style.md` ; ici, seulement ce qui distingue chacun.

Les sujets de prompt (en anglais) sont dans `art/personnages.json`, un par workflow (`portrait`, `combat`) : `node tools/comfy.ts portrait_anna --personnage anna --graines 1,2,3`. Ils ne décrivent que le personnage, sans mots de style. Si une fiche change ici, on reporte le changement dans le JSON.

**Statut** : propositions du 2026-11-11, à valider. Seule l'allure d'Anna existait déjà (son portrait du test de style). Le caractère vient des dialogues du chapitre 1.

## Anna

- **Rôle** : seigneuse, épéiste, cheffe de la bande (joueur). **Couleur** : rouge.
- **Caractère** : enthousiaste et sûre d'elle, improvise ses plans (« On a un plan. Il est… en cours d'élaboration. »).
- **Apparence** : jeune femme d'une vingtaine d'années, carré roux-brun en désordre, yeux bruns, grand sourire décidé. Veste rouge rapiécée, pantalon bleu foncé, bottes brunes.
- **Signe distinctif** : l'écharpe turquoise, toujours là.
- **Arme** : épée dont la lame est taillée dans un ressort d'acier, garde en tube de cuivre.

## Marc

- **Rôle** : lancier (joueur), le plus rapide de la bande. **Couleur** : bleu.
- **Caractère** : décontracté et gourmand, commente tout avec humour (« Je crois surtout aux repas chauds. Le plan, on verra. »).
- **Apparence** : jeune homme d'environ 22 ans, cheveux bruns courts en épis, sourire tranquille. Gilet matelassé bleu en toile rapiécée sur une chemise crème, pantalon gris.
- **Signe distinctif** : un quart en fer-blanc cabossé accroché à sa sangle (toujours prêt pour le repas).
- **Arme** : lance faite d'un tube d'acier, pointe en lame affûtée.

## Lise

- **Rôle** : archère (joueur). **Couleur** : vert.
- **Caractère** : calme, pince-sans-rire (« Je peux tirer de loin. Ça fait partie du plan ? »).
- **Apparence** : jeune femme d'environ 19 ans, longue tresse blonde sur l'épaule, taches de rousseur, regard mi-clos impassible. Cape à capuche verte en toile rapiécée, leggings bruns.
- **Signe distinctif** : la sangle de cuir du carquois en travers de la poitrine.
- **Arme** : arc taillé dans un vieux ski, flèches dans un carquois fait d'un tube de plastique.

## Brutus

- **Rôle** : chef des brigands, boss du chapitre 1, combattant à la hache (ennemi). **Couleur** : violet.
- **Caractère** : bien trop sûr de lui (« Impossible… Vaincu par une bande qui n'avait même pas de plan ! »).
- **Apparence** : grand costaud d'une quarantaine d'années, épaisse barbe noire, sourire suffisant. Bandana violet, gilet de cuir sombre, ceinture d'étoffe violette.
- **Signe distinctif** : une grosse épaulière de plaques de métal jaune cabossé.
- **Arme** : lourde hache à deux mains, lame épaisse en métal jaune cabossé.

## Rik

- **Rôle** : archer mercenaire, recrutable en payant (ennemi au départ). **Couleur** : orange.
- **Caractère** : désinvolte et vénal (« Je suis payé pour tirer sur n'importe qui. Vous payez mieux que lui ? »).
- **Apparence** : jeune homme d'environ 25 ans, visage mince, cheveux noirs en bataille noués en petite queue, sourire en coin. Lunettes d'aviateur relevées sur le front, veste orange rapiécée à multiples poches, pantalon cargo gris.
- **Signe distinctif** : une pièce de monnaie pendue à un cordon autour du cou.
- **Arme** : arc court fait d'un ressort de métal courbé.

## Gus

- **Rôle** : lancier brigand, recrutable en lui parlant (ennemi au départ). **Couleur** : brun.
- **Caractère** : bougon et désabusé (« On m'avait promis des primes et des tentes chauffées. J'ai eu une lance et un sermon. »).
- **Apparence** : homme d'une trentaine d'années, visage rond, moustache brune tombante, moue boudeuse. Manteau brun rapiécé à col de peau de mouton.
- **Signe distinctif** : une marmite cabossée en guise de casque.
- **Arme** : lance faite d'un manche en bois et d'une lame de cisaille de jardin.

## Premiers portraits (2026-11-11)

Planche `art/sources/fiches-portraits.png` (non versionnée) : 3 graines par personnage, puis leur réduction en 64×64. Chacun est reconnaissable et stable d'une graine à l'autre. À reprendre :

- **Gus** : la marmite ressemble à un casque ; préciser « a dented cooking pot with two small side handles worn upside down as a helmet ».
- **Anna** : la palette n'a pas de turquoise ; réduite, l'écharpe vire au vert ou au bleu ciel. Choisir l'un des deux pour l'écharpe, ou ajouter un turquoise à la palette.
- **Lise** : son visage reste un peu gris une fois réduit sur une graine (peau claire, voir la bible).

La bande a un fil conducteur : la nourriture (Marc et son quart, Gus et sa marmite, Anna qui recrute avec « Chez nous, les repas sont chauds »). À garder pour les prochains personnages si ça plaît.
