import { TERRAINS } from '../data/terrains.ts';
import { forecast } from './combat.ts';
import { posOf, terrainAt, tileIndex } from './grid.ts';
import { costField, pathTo, reachableTiles } from './movement.ts';
import type { GameState, Pos, Unit } from './types.ts';

export interface EnemyAction {
  path: Pos[]; // cases à parcourir, vide si l'unité reste sur place
  targetId: string | null; // unité à attaquer une fois arrivée
}

// Une attaque possible : depuis quelle case, contre qui, et ce qu'on en attend.
interface Option {
  destination: Pos;
  cost: number;
  targetId: string;
  kill: boolean;
  dealt: number; // dégâts attendus infligés
  taken: number; // dégâts attendus subis en riposte
  defense: number; // intérêt défensif du terrain d'où l'on attaque
}

function attackOptions(state: GameState, unit: Unit, destinations: Map<number, number>): Option[] {
  const foes = state.units.filter((other) => other.team !== unit.team);
  const options: Option[] = [];
  for (const [index, cost] of destinations) {
    const destination = posOf(state, index);
    const attacker = { ...unit, pos: destination };
    const terrain = TERRAINS[terrainAt(state, destination)];
    for (const foe of foes) {
      const plan = forecast(state, attacker, foe);
      if (plan.attacker.strikes === 0) continue; // hors de portée depuis cette case
      options.push({
        destination,
        cost,
        targetId: foe.id,
        kill: plan.attacker.damage * plan.attacker.strikes >= foe.hp,
        dealt: Math.min(foe.hp, (plan.attacker.damage * plan.attacker.strikes * plan.attacker.chance) / 100),
        taken: (plan.defender.damage * plan.defender.strikes * plan.defender.chance) / 100,
        defense: terrain.defBonus + terrain.avoidBonus / 10,
      });
    }
  }
  return options;
}

// Ordre de préférence : coup fatal, dégâts infligés, peu de riposte, bon terrain, trajet court.
function isBetter(a: Option, b: Option): boolean {
  const keys = (o: Option): number[] => [o.kill ? 1 : 0, o.dealt, -o.taken, o.defense, -o.cost];
  const left = keys(a);
  const right = keys(b);
  for (let i = 0; i < left.length; i++) {
    const gap = (left[i] ?? 0) - (right[i] ?? 0);
    if (Math.abs(gap) > 1e-9) return gap > 0;
  }
  return false;
}

// Avance vers le joueur le plus proche (selon le coût du terrain), le plus loin possible ce tour-ci.
function approach(state: GameState, unit: Unit, destinations: Map<number, number>): Pos[] {
  let nearest: Map<number, number> | undefined;
  let nearestCost = Infinity;
  for (const foe of state.units.filter((other) => other.team !== unit.team)) {
    const field = costField(state, foe.pos);
    const cost = field.get(tileIndex(state, unit.pos)) ?? Infinity;
    if (cost < nearestCost) {
      nearest = field;
      nearestCost = cost;
    }
  }
  if (nearest === undefined) return [];

  let destination = unit.pos;
  let bestCost = nearestCost;
  for (const index of destinations.keys()) {
    const cost = nearest.get(index) ?? Infinity;
    if (cost < bestCost) {
      bestCost = cost;
      destination = posOf(state, index);
    }
  }
  return pathTo(state, unit, destination);
}

export function planEnemyAction(state: GameState, unit: Unit): EnemyAction {
  const profile = unit.ai ?? 'charge';
  const destinations =
    profile === 'stationary' ? new Map([[tileIndex(state, unit.pos), 0]]) : reachableTiles(state, unit);

  let best: Option | undefined;
  for (const option of attackOptions(state, unit, destinations)) {
    if (best === undefined || isBetter(option, best)) best = option;
  }
  if (best !== undefined) return { path: pathTo(state, unit, best.destination), targetId: best.targetId };
  if (profile !== 'charge') return { path: [], targetId: null };
  return { path: approach(state, unit, destinations), targetId: null };
}
