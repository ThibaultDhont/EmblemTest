// Génère les sprites d'unités par des règles, sans IA ni réduction : chaque pixel est posé à sa taille finale.
// Une unité, c'est une pile de pièces dessinées en zones (art/gabarits/*.png) et une matière par zone
// (art/unites.json).
//
//   node tools/sprite.ts [unité…] [--apercu 8]    écrit src/sprites/unit_<unité>.png (toutes les unités si aucune) ;
//                                                   --apercu : planche, repos et marche animés dans art/sources/
//   node tools/sprite.ts --zones art/zones.gpl      écrit la palette des zones, à charger dans Pixelorama
//
// Les pièces ne sont pas dessinées en couleurs mais en zones (peau, cheveux, tenue, tenue2, métal, cuir,
// accent, yeux), chacune en quatre tons : clair, moyen, ombre, trait (trait intérieur). Chaque zone a sa teinte
// franche dans art/zones.gpl pour que le dessin reste lisible. La couleur réelle vient de la matière que
// l'unité donne à la zone, et les règles font le reste :
//   - une matière donne quatre couleurs de la palette du jeu, calculées depuis une couleur de base (rampe :
//     plus clair vers le jaune, plus sombre vers le bleu-violet) ou imposées ;
//   - contour extérieur d'un pixel, dans le ton « trait » de la zone qu'il borde (contour sélectif). Les pièces
//     laissent donc un pixel libre sur les bords ; un vide d'un pixel dans le sujet devient un trait ;
//   - repos sur 3 images : le torse et la tête descendent d'un pixel, puis le torse remonte avant la tête
//     (voir REPOS). La tête, le torse et les jambes sont séparés par les lignes `cou` et `taille`, la jambe
//     gauche de la droite par la colonne `milieu` ;
//   - marche sur 4 images, de face et de dos (une jambe levée, le corps monté d'un pixel, puis l'autre) et de
//     côté (jambes écartées, puis jointes avec le corps monté d'un pixel). Voir MARCHE_FACE et MARCHE_COTE.
//
// Trois vues : face, dos, côté (tourné vers la droite). Une pièce `<nom>.png` est vue de face ; ses variantes
// `<nom>.dos.png` et `<nom>.cote.png` servent pour les autres vues. Sans variante, la pièce de face sert
// partout (une arme, par exemple).
//
// La feuille fait 128×112 (pour des pièces de 16×16). Première ligne, 16 px de haut : le repos, 3 images de
// 16×16. Puis trois lignes de 32 px : la marche vers le bas, vers le haut et vers la droite, 4 images de 32×32
// chacune (la gauche est le miroir de la droite). Dans une image de marche, le personnage est en bas au centre :
// le reste laisse la place au mouvement.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMatcher, parseGpl, toOklab } from './palette.ts';
import type { Matcher, Rgb } from './palette.ts';
import { composite, upscale } from './pixelize.ts';
import { createImage, decodePng, encodeApng, encodePng } from './png.ts';
import type { Image } from './png.ts';

export const ZONES = ['peau', 'cheveux', 'tenue', 'tenue2', 'metal', 'cuir', 'accent', 'yeux'] as const;
export type Zone = (typeof ZONES)[number];
export const TONES = ['clair', 'moyen', 'ombre', 'trait'] as const;

// Format texte (tests, brouillons) : par zone, une lettre par ton (clair, moyen, ombre, trait) ; « . » est vide.
const LETTERS: Record<Zone, string> = {
  peau: 'PpqQ',
  cheveux: 'HhiI',
  tenue: 'TtuU',
  tenue2: 'VvwW',
  metal: 'MmnN',
  cuir: 'CcdD',
  accent: 'AabB',
  yeux: 'EefF',
};

// Couleurs des zones dans les pièces : une teinte franche par zone, du clair au trait.
const ZONE_COLORS: Record<Zone, readonly [Rgb, Rgb, Rgb, Rgb]> = {
  peau: [[255, 192, 224], [255, 128, 192], [192, 64, 128], [96, 16, 64]],
  cheveux: [[255, 255, 128], [224, 224, 0], [160, 160, 0], [80, 80, 0]],
  tenue: [[160, 192, 255], [64, 128, 255], [32, 64, 192], [16, 32, 96]],
  tenue2: [[160, 255, 160], [64, 224, 64], [32, 160, 32], [16, 80, 16]],
  metal: [[192, 255, 255], [64, 224, 224], [32, 160, 160], [16, 80, 80]],
  cuir: [[255, 208, 160], [255, 144, 64], [192, 96, 16], [96, 48, 8]],
  accent: [[224, 176, 255], [176, 96, 255], [112, 32, 192], [56, 12, 96]],
  yeux: [[255, 160, 160], [255, 48, 48], [176, 16, 16], [80, 8, 8]],
};

// Une case vaut -1 (vide) ou zone × 4 + ton.
export interface Layer {
  width: number;
  height: number;
  cells: Int16Array;
}
export const EMPTY = -1;
export const cell = (zone: Zone, tone: number): number => ZONES.indexOf(zone) * 4 + tone;
export const zoneOf = (value: number): Zone => ZONES[Math.floor(value / 4)] ?? 'peau';

function createLayer(width: number, height: number): Layer {
  return { width, height, cells: new Int16Array(width * height).fill(EMPTY) };
}

export function layerFromText(rows: readonly string[]): Layer {
  const layer = createLayer(rows[0]?.length ?? 0, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== layer.width) throw new Error(`ligne ${y + 1} : ${row.length} cases au lieu de ${layer.width}`);
    [...row].forEach((char, x) => {
      if (char === '.') return;
      const zone = ZONES.find((z) => LETTERS[z].includes(char));
      if (zone === undefined) throw new Error(`ligne ${y + 1}, colonne ${x + 1} : lettre « ${char} » inconnue`);
      layer.cells[y * layer.width + x] = cell(zone, LETTERS[zone].indexOf(char));
    });
  });
  return layer;
}

export function layerToText(layer: Layer): string[] {
  const rows: string[] = [];
  for (let y = 0; y < layer.height; y++) {
    let row = '';
    for (let x = 0; x < layer.width; x++) {
      const value = layer.cells[y * layer.width + x] ?? EMPTY;
      row += value === EMPTY ? '.' : (LETTERS[zoneOf(value)][value % 4] ?? '?');
    }
    rows.push(row);
  }
  return rows;
}

const colorKey = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
const ZONE_BY_COLOR = new Map(
  ZONES.flatMap((zone) => ZONE_COLORS[zone].map((color, tone) => [colorKey(...color), cell(zone, tone)] as const)),
);

// Lit une pièce dessinée avec la palette des zones. Toute autre couleur est une erreur : elle n'aurait pas de sens.
export function layerFromImage(image: Image, name: string): Layer {
  const layer = createLayer(image.width, image.height);
  for (let index = 0; index < image.width * image.height; index++) {
    const at = index * 4;
    if ((image.data[at + 3] ?? 0) < 128) continue;
    const value = ZONE_BY_COLOR.get(colorKey(image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0));
    if (value === undefined) {
      const hex = [...image.data.subarray(at, at + 3)].map((v) => v.toString(16).padStart(2, '0')).join('');
      throw new Error(`${name} : pixel (${index % image.width}, ${Math.floor(index / image.width)}) de couleur #${hex}, absente de la palette des zones`);
    }
    layer.cells[index] = value;
  }
  return layer;
}

export function layerToImage(layer: Layer): Image {
  const image = createImage(layer.width, layer.height);
  layer.cells.forEach((value, index) => {
    if (value !== EMPTY) image.data.set([...ZONE_COLORS[zoneOf(value)][value % 4]!, 255], index * 4);
  });
  return image;
}

export function zonesGpl(): string {
  const rows = ZONES.flatMap((zone) =>
    ZONE_COLORS[zone].map(([r, g, b], tone) => `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${zone} ${TONES[tone]}`),
  );
  return ['GIMP Palette', 'Name: zones des gabarits (tools/sprite.ts)', 'Columns: 4', '#', ...rows, ''].join('\n');
}

// --- Matières : quatre couleurs de la palette du jeu par zone ---

export type Ramp = readonly [Rgb, Rgb, Rgb, Rgb];

// Rampe calculée depuis une couleur de base : le ton moyen est la couleur de palette la plus proche ; le clair
// est plus lumineux et tire vers le jaune, l'ombre plus sombre et tire vers le bleu-violet (décalage de teinte,
// plus vivant qu'un simple assombrissement) ; le trait est bien plus sombre et moins saturé. Chaque ton est pris
// dans la palette, strictement plus sombre que le précédent.
export function buildRamp(base: Rgb, matcher: Matcher): Ramp {
  const labs = matcher.colors.map(toOklab);
  const weight = matcher.colorWeight ** 2;
  const pick = ([l, a, b]: readonly number[], accept: (lightness: number) => boolean, fallback: number): number => {
    let best = fallback;
    let bestDistance = Infinity;
    labs.forEach(([l2, a2, b2], index) => {
      if (!accept(l2)) return;
      const d = (l2 - (l ?? 0)) ** 2 + weight * ((a2 - (a ?? 0)) ** 2 + (b2 - (b ?? 0)) ** 2);
      if (d < bestDistance) {
        bestDistance = d;
        best = index;
      }
    });
    return best;
  };
  const lightnessOf = (index: number): number => labs[index]?.[0] ?? 0;
  const middle = matcher.nearest(base);
  const [l, a, b] = labs[middle] ?? [0, 0, 0];
  const light = pick([l + 0.12, a - 0.005, b + 0.02], (l2) => l2 > l + 0.04, middle);
  const shade = pick([l - 0.12, a + 0.01, b - 0.03], (l2) => l2 < l - 0.04, middle);
  // Le trait reste sombre même pour une matière claire : c'est lui qui détache le sujet du terrain.
  const line = pick([Math.max(0.2, Math.min(l - 0.32, 0.4)), a * 0.6 + 0.01, b * 0.6 - 0.03], (l2) => l2 < lightnessOf(shade) - 0.03, shade);
  const color = (index: number): Rgb => matcher.colors[index] ?? [0, 0, 0];
  return [color(light), color(middle), color(shade), color(line)];
}

// Une matière s'écrit « #rrggbb » (couleur de base, rampe calculée) ou en liste de quatre couleurs (rampe
// imposée, ramenée sur la palette).
export type MaterialSpec = string | readonly string[];

export function parseHex(text: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(text);
  if (match === null) throw new Error(`couleur « ${text} » : #rrggbb attendu`);
  return [parseInt(match[1] ?? '0', 16), parseInt(match[2] ?? '0', 16), parseInt(match[3] ?? '0', 16)];
}

export function resolveMaterial(spec: MaterialSpec, matcher: Matcher): Ramp {
  if (typeof spec === 'string') return buildRamp(parseHex(spec), matcher);
  if (spec.length !== 4) throw new Error(`rampe imposée : 4 couleurs attendues (clair, moyen, ombre, trait), reçu ${spec.length}`);
  const [light, middle, shade, line] = spec.map((text) => matcher.colors[matcher.nearest(parseHex(text))] ?? [0, 0, 0]);
  return [light!, middle!, shade!, line!];
}

// --- Composition et images de repos ---

export type Group = 'tete' | 'torse' | 'jambeG' | 'jambeD';
export interface Lines {
  cou: number; // première ligne du torse
  taille: number; // première ligne des jambes (sous les hanches)
  milieu: number; // première colonne de la jambe droite (à l'écran)
}
export interface Piece {
  layer: Layer;
  suit?: Group; // la pièce bouge d'un bloc avec ce groupe (une arme suit la main) ; sinon, pixel par pixel
}
export type Move = readonly [dx: number, dy: number];
export type Offsets = Partial<Record<Group, Move>>;

const DOWN: Move = [0, 1];
const UP: Move = [0, -1];

// Repos : le torse et la tête descendent d'un pixel, puis le torse remonte avant la tête (léger retard de la
// tête, qui donne de la souplesse). Le jeu passe de l'une à l'autre en boucle.
export const REPOS: readonly Offsets[] = [{}, { tete: DOWN, torse: DOWN }, { tete: DOWN }];

// Marche de face ou de dos : appui, passage (pied gauche levé, le corps monte d'un pixel), appui, passage
// (pied droit levé).
export const MARCHE_FACE: readonly Offsets[] = [
  {},
  { tete: UP, torse: UP, jambeG: [0, -2], jambeD: UP },
  {},
  { tete: UP, torse: UP, jambeG: UP, jambeD: [0, -2] },
];

// Marche de côté (tourné vers la droite) : jambes écartées (celle de derrière recule, celle de devant avance),
// puis jointes, le corps monté d'un pixel.
const STRIDE: Offsets = { jambeG: [-1, 0], jambeD: [1, 0] };
const PASSING: Offsets = { tete: UP, torse: UP, jambeG: UP, jambeD: UP };
export const MARCHE_COTE: readonly Offsets[] = [STRIDE, PASSING, STRIDE, PASSING];

export type View = 'face' | 'dos' | 'cote';
export const MARCHES: readonly { direction: string; view: View; frames: readonly Offsets[] }[] = [
  { direction: 'bas', view: 'face', frames: MARCHE_FACE },
  { direction: 'haut', view: 'dos', frames: MARCHE_FACE },
  { direction: 'droite', view: 'cote', frames: MARCHE_COTE },
];

const groupOf = (x: number, y: number, lines: Lines): Group =>
  y < lines.cou ? 'tete' : y < lines.taille ? 'torse' : x < lines.milieu ? 'jambeG' : 'jambeD';

// Où poser les pièces : dans une image de `width`×`height`, coin haut gauche des pièces en (`x`, `y`).
export interface Placement {
  width: number;
  height: number;
  x: number;
  y: number;
}

// Empile les pièces dans l'ordre (la suivante couvre la précédente), chaque pixel décalé selon son groupe.
// Dans une pièce, on part du bas : un groupe qui monte ou descend recouvre le haut du groupe d'en dessous
// (le torse tasse les hanches, le menton rentre dans le col) au lieu de disparaître derrière.
export function composeFrame(pieces: readonly Piece[], lines: Lines, offsets: Offsets = {}, placement?: Placement): Layer {
  const first = pieces[0]?.layer;
  const { width, height, x: originX, y: originY } = placement ?? { width: first?.width ?? 0, height: first?.height ?? 0, x: 0, y: 0 };
  const out = createLayer(width, height);
  for (const { layer, suit } of pieces) {
    for (let y = layer.height - 1; y >= 0; y--) {
      for (let x = 0; x < layer.width; x++) {
        const value = layer.cells[y * layer.width + x] ?? EMPTY;
        if (value === EMPTY) continue;
        const [dx, dy] = offsets[suit ?? groupOf(x, y, lines)] ?? [0, 0];
        const toX = originX + x + dx;
        const toY = originY + y + dy;
        if (toX >= 0 && toY >= 0 && toX < width && toY < height) out.cells[toY * width + toX] = value;
      }
    }
  }
  return out;
}

const NEIGHBOURS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

// Couleurs réelles, puis contour extérieur : chaque case vide qui touche le sujet par un côté prend le ton
// « trait » de la zone qu'elle touche le plus (à égalité, le plus sombre).
export function render(layer: Layer, ramps: ReadonlyMap<Zone, Ramp>): Image {
  const image = createImage(layer.width, layer.height);
  const rampOf = (zone: Zone): Ramp => {
    const ramp = ramps.get(zone);
    if (ramp === undefined) throw new Error(`pas de matière pour la zone ${zone}`);
    return ramp;
  };
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= layer.width || y >= layer.height ? EMPTY : (layer.cells[y * layer.width + x] ?? EMPTY);
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const value = at(x, y);
      if (value !== EMPTY) {
        image.data.set([...rampOf(zoneOf(value))[value % 4]!, 255], (y * layer.width + x) * 4);
        continue;
      }
      const counts = new Map<Zone, number>();
      for (const [dx, dy] of NEIGHBOURS) {
        const near = at(x + dx, y + dy);
        if (near !== EMPTY) counts.set(zoneOf(near), (counts.get(zoneOf(near)) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      const lineOf = (zone: Zone): Rgb => rampOf(zone)[3];
      const [zone] = [...counts].reduce((best, entry) =>
        entry[1] > best[1] || (entry[1] === best[1] && toOklab(lineOf(entry[0]))[0] < toOklab(lineOf(best[0]))[0]) ? entry : best,
      );
      image.data.set([...lineOf(zone), 255], (y * layer.width + x) * 4);
    }
  }
  return image;
}

// Les cases occupées sur le bord de l'image : le contour n'y aura pas de place.
export function touchesEdge(layer: Layer): boolean {
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const edge = x === 0 || y === 0 || x === layer.width - 1 || y === layer.height - 1;
      if (edge && layer.cells[y * layer.width + x] !== EMPTY) return true;
    }
  }
  return false;
}

// --- Description des unités (art/unites.json) ---

export interface UnitSpec {
  pieces: readonly (string | { nom: string; suit?: Group })[];
  couleurs: Readonly<Record<string, string>>; // zone → nom de matière
}
export interface Config {
  taille: number; // côté d'une image, 16
  lignes: Lines;
  materiaux: Readonly<Record<string, MaterialSpec>>;
  defaut: Readonly<Record<string, string>>; // matières des zones que l'unité ne précise pas
  unites: Readonly<Record<string, UnitSpec>>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Emplacement de chaque image dans la feuille, pour des pièces de `size` px (voir l'en-tête du fichier).
export function sheetLayout(size: number): { width: number; height: number; repos: Rect[]; marche: Record<string, Rect[]> } {
  const walk = size * 2;
  const marche: Record<string, Rect[]> = {};
  MARCHES.forEach(({ direction, frames }, row) => {
    marche[direction] = frames.map((_, index) => ({ x: index * walk, y: size + row * walk, width: walk, height: walk }));
  });
  return {
    width: walk * 4,
    height: size + MARCHES.length * walk,
    repos: REPOS.map((_, index) => ({ x: index * size, y: 0, width: size, height: size })),
    marche,
  };
}

function paste(target: Image, source: Image, x: number, y: number): void {
  for (let row = 0; row < source.height; row++) {
    target.data.set(source.data.subarray(row * source.width * 4, (row + 1) * source.width * 4), ((y + row) * target.width + x) * 4);
  }
}

export function cut(source: Image, rect: Rect): Image {
  const out = createImage(rect.width, rect.height);
  for (let row = 0; row < rect.height; row++) {
    const from = ((rect.y + row) * source.width + rect.x) * 4;
    out.data.set(source.data.subarray(from, from + rect.width * 4), row * rect.width * 4);
  }
  return out;
}

// Feuille de l'unité (voir l'en-tête). `loadPiece` lit une pièce d'après son nom et la vue ; il renvoie
// undefined si la pièce n'a pas de variante pour cette vue (on prend alors celle de face).
export function buildSheet(
  name: string,
  config: Config,
  loadPiece: (name: string, view: View) => Layer | undefined,
  matcher: Matcher,
): Image {
  const spec = config.unites[name];
  if (spec === undefined) throw new Error(`unité « ${name} » absente de la description`);
  const piecesFor = (view: View): Piece[] =>
    spec.pieces.map((entry) => {
      const { nom, suit } = typeof entry === 'string' ? { nom: entry, suit: undefined } : entry;
      const layer = (view === 'face' ? undefined : loadPiece(nom, view)) ?? loadPiece(nom, 'face');
      if (layer === undefined) throw new Error(`${name} : pièce ${nom} introuvable`);
      if (layer.width !== config.taille || layer.height !== config.taille) {
        throw new Error(`${name} : la pièce ${nom} fait ${layer.width}×${layer.height} au lieu de ${config.taille}×${config.taille}`);
      }
      return suit === undefined ? { layer } : { layer, suit };
    });

  const ramps = new Map<Zone, Ramp>();
  for (const zone of ZONES) {
    const material = spec.couleurs[zone] ?? config.defaut[zone];
    if (material === undefined) continue;
    const materialSpec = config.materiaux[material];
    if (materialSpec === undefined) throw new Error(`${name} : matière « ${material} » (zone ${zone}) absente de « materiaux »`);
    ramps.set(zone, resolveMaterial(materialSpec, matcher));
  }

  const size = config.taille;
  const layout = sheetLayout(size);
  const sheet = createImage(layout.width, layout.height);
  const front = piecesFor('face');
  REPOS.forEach((offsets, index) => {
    const layer = composeFrame(front, config.lignes, offsets);
    if (touchesEdge(layer)) console.warn(`${name}, repos ${index + 1} : le sujet touche le bord, le contour y manque`);
    const rect = layout.repos[index]!;
    paste(sheet, render(layer, ramps), rect.x, rect.y);
  });
  // Marche : le personnage en bas au centre de l'image de 32×32.
  for (const { direction, view, frames } of MARCHES) {
    const pieces = piecesFor(view);
    frames.forEach((offsets, index) => {
      const rect = layout.marche[direction]![index]!;
      const placement = { width: rect.width, height: rect.height, x: Math.floor((rect.width - size) / 2), y: rect.height - size };
      paste(sheet, render(composeFrame(pieces, config.lignes, offsets, placement), ramps), rect.x, rect.y);
    });
  }
  return sheet;
}

export function mirror(image: Image): Image {
  const out = createImage(image.width, image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * image.width + image.width - 1 - x) * 4);
    }
  }
  return out;
}

// --- Aperçus (art/sources/, non versionnés) ---

// Sol d'herbe de la taille voulue, en répétant une tuile.
function groundOf(tile: Image, width: number, height: number): Image {
  const out = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = ((y % tile.height) * tile.width + (x % tile.width)) * 4;
      out.data.set(tile.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
}

// Une rangée d'images posées sur l'herbe, séparées d'un pixel, agrandie.
function row(frames: readonly Image[], tile: Image, factor: number): Image {
  const first = frames[0] ?? createImage(1, 1);
  const strip = createImage(frames.length * (first.width + 1) - 1, first.height);
  frames.forEach((frame, index) => paste(strip, composite(frame, groundOf(tile, frame.width, frame.height)), index * (first.width + 1), 0));
  return upscale(strip, factor);
}

// Trois aperçus : la planche (toute la feuille sur l'herbe, fixe), le repos et la marche (animés, APNG). La
// marche montre les quatre directions côte à côte, la gauche en miroir de la droite.
export function previews(sheet: Image, size: number, tile: Image, factor: number): { planche: Image; repos: Image[]; marche: Image[] } {
  const layout = sheetLayout(size);
  const repos = layout.repos.map((rect) => row([cut(sheet, rect)], tile, factor));
  const directions = MARCHES.map(({ direction }) => layout.marche[direction] ?? []);
  const marche = MARCHE_FACE.map((_, index) => {
    const frames = directions.map((rects) => cut(sheet, rects[index]!));
    return row([...frames, mirror(frames[frames.length - 1]!)], tile, factor);
  });
  return { planche: upscale(composite(sheet, groundOf(tile, sheet.width, sheet.height)), factor), repos, marche };
}

// Durées des aperçus animés, en millisecondes (le jeu aura les siennes).
export const PREVIEW_DELAYS = { repos: [500, 150, 250], marche: [150, 150, 150, 150] };

function main(args: string[]): void {
  const option = (key: string): string | undefined => {
    const at = args.indexOf(`--${key}`);
    return at === -1 ? undefined : args[at + 1];
  };
  const zones = option('zones');
  if (zones !== undefined) {
    writeFileSync(zones, zonesGpl());
    console.log(`${zones} : ${ZONES.length} zones × ${TONES.length} tons`);
    return;
  }
  const config = JSON.parse(readFileSync('art/unites.json', 'utf8')) as Config;
  const matcher = createMatcher(parseGpl(readFileSync('art/palette.gpl', 'utf8')), 3);
  const loadPiece = (name: string, view: View): Layer | undefined => {
    const file = view === 'face' ? `${name}.png` : `${name}.${view}.png`;
    const path = join('art/gabarits', file);
    return existsSync(path) ? layerFromImage(decodePng(readFileSync(path)), file) : undefined;
  };
  const factor = option('apercu');
  const values = new Set([factor]);
  const names = args.filter((arg) => !arg.startsWith('--') && !values.has(arg));
  for (const name of names.length > 0 ? names : Object.keys(config.unites)) {
    const sheet = buildSheet(name, config, loadPiece, matcher);
    const target = `src/sprites/unit_${name}.png`;
    writeFileSync(target, encodePng(sheet));
    console.log(`${target} : ${sheet.width}×${sheet.height}, repos sur ${REPOS.length} images, marche sur ${MARCHE_FACE.length} images`);
    if (factor !== undefined) {
      const tile = decodePng(readFileSync('src/sprites/tile_plain_1.png'));
      const { planche, repos, marche } = previews(sheet, config.taille, tile, Number(factor));
      mkdirSync('art/sources', { recursive: true });
      writeFileSync(`art/sources/unit_${name}.planche.png`, encodePng(planche));
      writeFileSync(`art/sources/unit_${name}.repos.png`, encodeApng(repos, PREVIEW_DELAYS.repos));
      writeFileSync(`art/sources/unit_${name}.marche.png`, encodeApng(marche, PREVIEW_DELAYS.marche));
      console.log(`aperçus : art/sources/unit_${name}.planche.png, .repos.png et .marche.png (animés)`);
    }
  }
}

if (import.meta.main) main(process.argv.slice(2));
