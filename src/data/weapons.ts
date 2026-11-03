import type { WeaponId, WeaponType } from '../core/types.ts';

export interface WeaponDef {
  type: WeaponType;
  might: number; // puissance
  hit: number; // précision
  crit: number;
  minRange: number;
  maxRange: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  ironSword: { type: 'sword', might: 5, hit: 100, crit: 0, minRange: 1, maxRange: 1 },
  ironLance: { type: 'lance', might: 7, hit: 80, crit: 0, minRange: 1, maxRange: 1 },
  ironAxe: { type: 'axe', might: 8, hit: 75, crit: 0, minRange: 1, maxRange: 1 },
  ironBow: { type: 'bow', might: 6, hit: 85, crit: 0, minRange: 2, maxRange: 2 },
};
