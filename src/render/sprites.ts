import { TILE_SIZE } from '../config.ts';
import type { TerrainId } from '../core/types.ts';
import { parseTileFile, pickVariant } from './variants.ts';

// Les PNG de src/sprites/ : déposer tile_<terrain>_<n>.png remplace l'aplat provisoire de ce terrain.
const FILES = import.meta.glob<string>('../sprites/*.png', { eager: true, query: '?url', import: 'default' });

export interface Sprites {
  // Tuile dessinée d'un terrain pour une case de la carte, ou rien tant que ce terrain n'a pas de PNG.
  terrain(terrain: TerrainId, x: number, y: number): HTMLImageElement | undefined;
}

// Une image qui ne charge pas n'empêche pas le jeu de démarrer : le terrain garde son aplat provisoire.
function loadImage(url: string, name: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.width !== TILE_SIZE || image.height !== TILE_SIZE) {
        console.warn(`${name} fait ${image.width}×${image.height}, une tuile fait ${TILE_SIZE}×${TILE_SIZE}`);
      }
      resolve(image);
    };
    image.onerror = () => {
      console.warn(`${name} : image impossible à charger`);
      resolve(undefined);
    };
    image.src = url;
  });
}

export async function loadSprites(): Promise<Sprites> {
  const tiles = Object.entries(FILES)
    .flatMap(([path, url]) => {
      const tile = parseTileFile(path);
      return tile === undefined ? [] : [{ ...tile, url, name: path.slice(path.lastIndexOf('/') + 1) }];
    })
    .sort((a, b) => a.variant - b.variant);
  const images = await Promise.all(tiles.map((tile) => loadImage(tile.url, tile.name)));

  const byTerrain = new Map<TerrainId, HTMLImageElement[]>();
  tiles.forEach((tile, index) => {
    const image = images[index];
    if (image === undefined) return;
    byTerrain.set(tile.terrain, [...(byTerrain.get(tile.terrain) ?? []), image]);
  });

  return {
    terrain(terrain, x, y) {
      const variants = byTerrain.get(terrain);
      return variants?.[pickVariant(x, y, variants.length)];
    },
  };
}
