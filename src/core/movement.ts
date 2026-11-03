import { CLASSES } from '../data/classes.ts';
import { TERRAINS } from '../data/terrains.ts';
import { inBounds, posOf, terrainAt, tileIndex, unitAt } from './grid.ts';
import type { GameState, Unit } from './types.ts';

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// Cases où `unit` peut s'arrêter, avec le coût de mouvement dépensé (index de case -> coût).
// Les alliés se traversent sans qu'on puisse s'y arrêter ; les ennemis bloquent le passage.
export function reachableTiles(state: GameState, unit: Unit): Map<number, number> {
  const mov = CLASSES[unit.classId].mov;
  const start = tileIndex(state, unit.pos);
  const costs = new Map<number, number>([[start, 0]]);
  const costOf = (index: number): number => costs.get(index) ?? Infinity;

  // Dijkstra : on dépile toujours la case la moins chère.
  const open = [start];
  const next = (): number | undefined => {
    open.sort((a, b) => costOf(b) - costOf(a));
    return open.pop();
  };
  for (let current = next(); current !== undefined; current = next()) {
    const from = posOf(state, current);
    for (const direction of DIRECTIONS) {
      const to = { x: from.x + direction.x, y: from.y + direction.y };
      if (!inBounds(state, to)) continue;
      const occupant = unitAt(state, to);
      if (occupant !== undefined && occupant.team !== unit.team) continue;

      const cost = costOf(current) + TERRAINS[terrainAt(state, to)].moveCost;
      const index = tileIndex(state, to);
      if (cost > mov || cost >= costOf(index)) continue;
      costs.set(index, cost);
      open.push(index);
    }
  }

  const destinations = new Map<number, number>();
  for (const [index, cost] of costs) {
    const occupant = unitAt(state, posOf(state, index));
    if (occupant === undefined || occupant === unit) destinations.set(index, cost);
  }
  return destinations;
}
