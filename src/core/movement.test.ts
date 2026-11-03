import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows, tileIndex } from './grid.ts';
import { reachableTiles } from './movement.ts';
import { makeUnit } from './test-helpers.ts';
import type { ClassId, GameState, Team, Unit } from './types.ts';

function unit(id: string, team: Team, classId: ClassId, x: number, y: number): Unit {
  return makeUnit({ id, team, classId, pos: { x, y } });
}

// Coût d'arrivée sur la case (x, y), ou undefined si elle n'est pas atteignable.
function costAt(state: GameState, reach: Map<number, number>, x: number, y: number): number | undefined {
  return reach.get(tileIndex(state, { x, y }));
}

test('terrain plat : la portée est égale aux points de mouvement', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0); // mov 5
  const state = stateFromRows(['.........'], [mover]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 0, 0), 0);
  assert.equal(costAt(state, reach, 5, 0), 5);
  assert.equal(costAt(state, reach, 6, 0), undefined);
});

test('la forêt coûte 2 points', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.f.m..'], [mover]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 1, 0), 2);
  assert.equal(costAt(state, reach, 2, 0), 3);
  assert.equal(costAt(state, reach, 3, 0), undefined); // 3 + 3 = 6 > 5
});

test('la montagne coûte 3 points', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.m...'], [mover]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 1, 0), 3);
  assert.equal(costAt(state, reach, 3, 0), 5);
  assert.equal(costAt(state, reach, 4, 0), undefined);
});

test('un mur est infranchissable et on le contourne si possible', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.#.', '...'], [mover]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 1, 0), undefined);
  assert.equal(costAt(state, reach, 2, 0), 4); // (0,0) -> (0,1) -> (1,1) -> (2,1) -> (2,0)

  const blocked = stateFromRows(['..#..'], [mover]);
  assert.equal(costAt(blocked, reachableTiles(blocked, mover), 3, 0), undefined);
});

test('un ennemi bloque le passage', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.....'], [mover, unit('e', 'enemy', 'lancer', 2, 0)]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 1, 0), 1);
  assert.equal(costAt(state, reach, 2, 0), undefined);
  assert.equal(costAt(state, reach, 3, 0), undefined);
});

test("un allié se traverse mais on ne peut pas s'y arrêter", () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.....'], [mover, unit('b', 'player', 'archer', 1, 0)]);
  const reach = reachableTiles(state, mover);
  assert.equal(costAt(state, reach, 1, 0), undefined);
  assert.equal(costAt(state, reach, 2, 0), 2);
});
