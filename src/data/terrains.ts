import type { TerrainId } from '../core/types.ts';

export interface TerrainDef {
  moveCost: number; // Infinity = infranchissable
}

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  plain: { moveCost: 1 },
  forest: { moveCost: 2 },
  mountain: { moveCost: 3 },
  wall: { moveCost: Infinity },
};
