import { TERRAINS } from '../data/terrains.ts';
import type { TerrainId } from '../core/types.ts';

const TILE_FILE = /(?:^|\/)tile_([a-z]+)_(\d+)\.png$/;

const isTerrain = (name: string): name is TerrainId => name in TERRAINS;

// Une tuile de terrain s'appelle tile_<terrain>_<n>.png, n à partir de 1 ; tout autre fichier est ignoré.
export function parseTileFile(path: string): { terrain: TerrainId; variant: number } | undefined {
  const match = TILE_FILE.exec(path);
  const terrain = match?.[1];
  const variant = match?.[2];
  if (terrain === undefined || variant === undefined || !isTerrain(terrain)) return undefined;
  return { terrain, variant: Number(variant) };
}

// Variante d'une case : toujours la même pour une position donnée, sans état ni hasard, et sans motif visible.
export function pickVariant(x: number, y: number, count: number): number {
  if (count <= 1) return 0;
  let hash = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d);
  hash ^= hash >>> 12;
  return (hash >>> 0) % count;
}
