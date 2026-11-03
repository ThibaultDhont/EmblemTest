import type { TerrainId } from '../core/types.ts';

export interface TerrainDef {
  moveCost: number; // Infinity = infranchissable
  defBonus: number;
  avoidBonus: number;
}

export const TERRAINS: Record<TerrainId, TerrainDef> = {
  plain: { moveCost: 1, defBonus: 0, avoidBonus: 0 },
  forest: { moveCost: 2, defBonus: 1, avoidBonus: 20 },
  mountain: { moveCost: 3, defBonus: 2, avoidBonus: 30 },
  wall: { moveCost: Infinity, defBonus: 0, avoidBonus: 0 },
};
