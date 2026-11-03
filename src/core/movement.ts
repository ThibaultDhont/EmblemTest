import { CLASSES } from '../data/classes.ts';
import { TERRAINS } from '../data/terrains.ts';
import { inBounds, posOf, terrainAt, tileIndex, unitAt } from './grid.ts';
import type { GameState, Pos, Unit } from './types.ts';

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// File d'attente de Dijkstra : dépile toujours la case la moins chère.
function popCheapest(open: number[], costOf: (index: number) => number): number | undefined {
  open.sort((a, b) => costOf(b) - costOf(a));
  return open.pop();
}

interface Exploration {
  costs: Map<number, number>; // coût pour atteindre chaque case, traversées comprises
  previous: Map<number, number>; // case d'où l'on vient, pour reconstituer le chemin
}

// Les alliés se traversent ; les ennemis bloquent le passage.
function explore(state: GameState, unit: Unit): Exploration {
  const mov = CLASSES[unit.classId].mov;
  const start = tileIndex(state, unit.pos);
  const costs = new Map<number, number>([[start, 0]]);
  const previous = new Map<number, number>();
  const costOf = (index: number): number => costs.get(index) ?? Infinity;

  const open = [start];
  for (let current = popCheapest(open, costOf); current !== undefined; current = popCheapest(open, costOf)) {
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
      previous.set(index, current);
      open.push(index);
    }
  }
  return { costs, previous };
}

// Cases où `unit` peut s'arrêter, avec le coût de mouvement dépensé (index de case -> coût).
// On ne s'arrête jamais sur une case occupée par une autre unité.
export function reachableTiles(state: GameState, unit: Unit): Map<number, number> {
  const destinations = new Map<number, number>();
  for (const [index, cost] of explore(state, unit).costs) {
    const occupant = unitAt(state, posOf(state, index));
    if (occupant === undefined || occupant === unit) destinations.set(index, cost);
  }
  return destinations;
}

// Chemin le moins coûteux vers `destination`, case de départ exclue.
// Vide si l'unité reste sur place ou si la case n'est pas atteignable.
export function pathTo(state: GameState, unit: Unit, destination: Pos): Pos[] {
  const { costs, previous } = explore(state, unit);
  const start = tileIndex(state, unit.pos);
  const path: Pos[] = [];
  if (!costs.has(tileIndex(state, destination))) return path;
  let index: number | undefined = tileIndex(state, destination);
  while (index !== undefined && index !== start) {
    path.push(posOf(state, index));
    index = previous.get(index);
  }
  return path.reverse();
}

// Chemin de mise en scène entre deux cases, le plus court en nombre de pas : on ne tient compte ni du
// mouvement de l'unité, ni du coût du terrain, ni des autres unités ; seuls les murs barrent la route.
// Départ exclu ; vide si les deux cases sont les mêmes ou si l'arrivée est inaccessible.
export function scriptedPath(state: GameState, from: Pos, to: Pos): Pos[] {
  const start = tileIndex(state, from);
  const goal = tileIndex(state, to);
  const previous = new Map<number, number>([[start, start]]);
  const queue = [start];
  for (let current = queue.shift(); current !== undefined && current !== goal; current = queue.shift()) {
    const here = posOf(state, current);
    for (const direction of DIRECTIONS) {
      const next = { x: here.x + direction.x, y: here.y + direction.y };
      if (!inBounds(state, next) || TERRAINS[terrainAt(state, next)].moveCost === Infinity) continue;
      const index = tileIndex(state, next);
      if (previous.has(index)) continue;
      previous.set(index, current);
      queue.push(index);
    }
  }

  const path: Pos[] = [];
  if (goal === start || !previous.has(goal)) return path;
  for (let index = goal; index !== start; index = previous.get(index) ?? start) path.push(posOf(state, index));
  return path.reverse();
}

// Coût minimal pour rejoindre `goal` depuis chaque case, d'après le seul terrain (unités ignorées).
// Sert à choisir dans quelle direction avancer quand personne n'est à portée.
export function costField(state: GameState, goal: Pos): Map<number, number> {
  const start = tileIndex(state, goal);
  const costs = new Map<number, number>([[start, 0]]);
  const costOf = (index: number): number => costs.get(index) ?? Infinity;

  const open = [start];
  for (let current = popCheapest(open, costOf); current !== undefined; current = popCheapest(open, costOf)) {
    const from = posOf(state, current);
    const enterCost = TERRAINS[terrainAt(state, from)].moveCost; // coût d'entrer sur `from` depuis un voisin
    for (const direction of DIRECTIONS) {
      const to = { x: from.x + direction.x, y: from.y + direction.y };
      if (!inBounds(state, to)) continue;
      const cost = costOf(current) + enterCost;
      const index = tileIndex(state, to);
      if (cost >= costOf(index)) continue;
      costs.set(index, cost);
      open.push(index);
    }
  }
  return costs;
}
