import { TILE_SIZE } from '../config.ts';
import type { TerrainId, Unit } from '../core/types.ts';
import { parseNamedFile, parseTileFile, pickVariant } from './variants.ts';

// Les PNG de src/sprites/, trouvés par leur nom :
// - tile_<terrain>_<n>.png remplace l'aplat provisoire de ce terrain (16×16) ;
// - unit_<id>.png dessine une unité, par son id ou par sa classe (image de 16×16 en haut à gauche de la feuille) ;
// - portrait_<personnage>.png remplace le portrait provisoire du dialogue (64×64, tourné vers la droite).
const FILES = import.meta.glob<string>('../sprites/*.png', { eager: true, query: '?url', import: 'default' });

export const PORTRAIT_SIZE = 64;

// Une image et ses versions assombries, préparées au chargement : on ne peut pas assombrir d'un simple voile
// une image à fond transparent sans assombrir aussi ce qu'il y a derrière.
export interface SpriteImage {
  normal: CanvasImageSource;
  dimmed: CanvasImageSource; // unité qui a déjà agi (grisée), personnage qui ne parle pas
}

export interface Sprites {
  // Tuile dessinée d'un terrain pour une case de la carte, ou rien tant que ce terrain n'a pas de PNG.
  terrain(terrain: TerrainId, x: number, y: number): HTMLImageElement | undefined;
  unit(unit: Unit): SpriteImage | undefined;
  portrait(who: string): SpriteImage | undefined;
}

// Une image qui ne charge pas n'empêche pas le jeu de démarrer : le dessin provisoire reste.
function loadImage(url: string, name: string, fits: (width: number, height: number) => boolean, expected: string) {
  return new Promise<HTMLImageElement | undefined>((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (!fits(image.width, image.height)) console.warn(`${name} fait ${image.width}×${image.height}, attendu : ${expected}`);
      resolve(image);
    };
    image.onerror = () => {
      console.warn(`${name} : image impossible à charger`);
      resolve(undefined);
    };
    image.src = url;
  });
}

// Copie de l'image dont chaque pixel opaque est transformé par `tone` (la transparence est gardée).
function retone(image: HTMLImageElement, tone: (r: number, g: number, b: number) => [number, number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return image;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = tone(pixels.data[i] ?? 0, pixels.data[i + 1] ?? 0, pixels.data[i + 2] ?? 0);
    pixels.data.set([r, g, b], i);
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

// Unité qui a agi : niveaux de gris un peu sombres, comme le voile gris des aplats.
const grayed = (r: number, g: number, b: number): [number, number, number] => {
  const luma = Math.round((0.3 * r + 0.59 * g + 0.11 * b) * 0.75);
  return [luma, luma, luma];
};
// Personnage qui ne parle pas : même teinte bleu nuit que le voile des portraits provisoires.
const shaded = (r: number, g: number, b: number): [number, number, number] => [
  Math.round(r * 0.45 + 10 * 0.55),
  Math.round(g * 0.45 + 14 * 0.55),
  Math.round(b * 0.45 + 30 * 0.55),
];

export async function loadSprites(): Promise<Sprites> {
  const files = Object.entries(FILES).map(([path, url]) => ({ path, url, name: path.slice(path.lastIndexOf('/') + 1) }));

  const tiles = files
    .flatMap((file) => {
      const tile = parseTileFile(file.path);
      return tile === undefined ? [] : [{ ...file, ...tile }];
    })
    .sort((a, b) => a.variant - b.variant);
  const named = files.flatMap((file) => {
    const parsed = parseNamedFile(file.path);
    return parsed === undefined ? [] : [{ ...file, ...parsed }];
  });

  const isTile = (width: number, height: number): boolean => width === TILE_SIZE && height === TILE_SIZE;
  const isSheet = (width: number, height: number): boolean =>
    width >= TILE_SIZE && height >= TILE_SIZE && width % TILE_SIZE === 0 && height % TILE_SIZE === 0;
  const isPortrait = (width: number, height: number): boolean => width === PORTRAIT_SIZE && height === PORTRAIT_SIZE;

  const [tileImages, namedImages] = await Promise.all([
    Promise.all(tiles.map((tile) => loadImage(tile.url, tile.name, isTile, `${TILE_SIZE}×${TILE_SIZE}`))),
    Promise.all(
      named.map((file) =>
        file.kind === 'unit'
          ? loadImage(file.url, file.name, isSheet, `un multiple de ${TILE_SIZE}×${TILE_SIZE}`)
          : loadImage(file.url, file.name, isPortrait, `${PORTRAIT_SIZE}×${PORTRAIT_SIZE}`),
      ),
    ),
  ]);

  const byTerrain = new Map<TerrainId, HTMLImageElement[]>();
  tiles.forEach((tile, index) => {
    const image = tileImages[index];
    if (image === undefined) return;
    byTerrain.set(tile.terrain, [...(byTerrain.get(tile.terrain) ?? []), image]);
  });

  const units = new Map<string, SpriteImage>();
  const portraits = new Map<string, SpriteImage>();
  named.forEach((file, index) => {
    const image = namedImages[index];
    if (image === undefined) return;
    if (file.kind === 'unit') units.set(file.id, { normal: image, dimmed: retone(image, grayed) });
    else portraits.set(file.id, { normal: image, dimmed: retone(image, shaded) });
  });

  return {
    terrain(terrain, x, y) {
      const variants = byTerrain.get(terrain);
      return variants?.[pickVariant(x, y, variants.length)];
    },
    unit(unit) {
      return units.get(unit.id) ?? units.get(unit.classId);
    },
    portrait(who) {
      return portraits.get(who);
    },
  };
}
