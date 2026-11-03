import type { Trigger } from './script.ts';
import type { Pos, Unit } from './types.ts';

// Les déclencheurs d'actions du joueur, construits de façon typée plutôt qu'avec des chaînes écrites à la main.

export const selectionTrigger = (unitId: string): Trigger => `selection(${unitId})`;

// Le joueur confirme une attaque contre `targetId` : le dialogue se joue avant le combat.
export const attackTrigger = (targetId: string): Trigger => `attaque(${targetId})`;

// Une unité du joueur vient de s'arrêter sur `pos` : le déclencheur de la case, puis celui propre à l'unité.
export const arrivalTriggers = (unit: Pick<Unit, 'id'>, pos: Pos): Trigger[] => [
  `case(${pos.x},${pos.y})`,
  `case(${unit.id},${pos.x},${pos.y})`,
];
