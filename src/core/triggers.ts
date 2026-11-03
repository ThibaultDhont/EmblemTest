import { distance } from './grid.ts';
import type { ScriptEvent, Trigger } from './script.ts';
import type { GameState, Pos, Unit } from './types.ts';

// Les déclencheurs d'actions du joueur, construits de façon typée plutôt qu'avec des chaînes écrites à la main.

export const selectionTrigger = (unitId: string): Trigger => `selection(${unitId})`;

// Le joueur confirme une attaque contre `targetId` : le dialogue se joue avant le combat.
export const attackTrigger = (targetId: string): Trigger => `attaque(${targetId})`;

// Une unité du joueur vient de s'arrêter sur `pos` : le déclencheur de la case, puis celui propre à l'unité.
export const arrivalTriggers = (unit: Pick<Unit, 'id'>, pos: Pos): Trigger[] => [
  `case(${pos.x},${pos.y})`,
  `case(${unit.id},${pos.x},${pos.y})`,
];

// `unitId` choisit « Parler » à côté de `partnerId`.
export const talkTrigger = (unitId: string, partnerId: string): Trigger => `parler(${unitId},${partnerId})`;

// Les unités voisines (à une case) à qui `unit` peut parler : un événement `parler(unit, voisine)` existe
// dans le script et n'a pas encore été joué. Alliée ou ennemie, la voisine n'a pas d'autre condition.
export function talkPartners(state: GameState, unit: Unit, events: ScriptEvent[]): Unit[] {
  return state.units.filter(
    (other) =>
      other !== unit &&
      distance(unit.pos, other.pos) === 1 &&
      events.some((event) => event.trigger === talkTrigger(unit.id, other.id) && !state.fired.includes(event.id)),
  );
}
