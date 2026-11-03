import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freeTileNear, stateFromRows, tileIndex } from './grid.ts';
import { costField, pathTo, reachableTiles, scriptedPath } from './movement.ts';
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

test('pathTo renvoie le chemin case par case, départ exclu', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.....'], [mover]);
  assert.deepEqual(pathTo(state, mover, { x: 3, y: 0 }), [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
});

test('pathTo contourne un mur', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.#.', '...'], [mover]);
  assert.deepEqual(pathTo(state, mover, { x: 2, y: 0 }), [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }]);
});

test("pathTo est vide si l'unité reste sur place ou si la case est hors de portée", () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['.......'], [mover]);
  assert.deepEqual(pathTo(state, mover, { x: 0, y: 0 }), []);
  assert.deepEqual(pathTo(state, mover, { x: 6, y: 0 }), []);
});

test('costField : coût du terrain pour rejoindre le but, sans traverser les murs', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const state = stateFromRows(['..f.', '###.'], [mover]);
  const field = costField(state, { x: 0, y: 0 });
  assert.equal(field.get(tileIndex(state, { x: 0, y: 0 })), 0);
  assert.equal(field.get(tileIndex(state, { x: 1, y: 0 })), 1);
  assert.equal(field.get(tileIndex(state, { x: 3, y: 0 })), 4); // entre en forêt (2), plaine (1), but (1)
  assert.equal(field.get(tileIndex(state, { x: 3, y: 1 })), 5);
});

test('scriptedPath ignore le mouvement, le terrain et les unités', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0); // mouvement 5
  const far = stateFromRows(['..........'], [mover]);
  const path = scriptedPath(far, { x: 0, y: 0 }, { x: 9, y: 0 });
  assert.equal(path.length, 9);
  assert.deepEqual(path[0], { x: 1, y: 0 });
  assert.deepEqual(path.at(-1), { x: 9, y: 0 });

  const rough = stateFromRows(['.mm.'], [mover, unit('e', 'enemy', 'lancer', 1, 0)]);
  assert.equal(scriptedPath(rough, { x: 0, y: 0 }, { x: 3, y: 0 }).length, 3);
});

test('scriptedPath contourne les murs et renvoie [] si rien ne mène à la case', () => {
  const mover = unit('a', 'player', 'swordsman', 0, 0);
  const around = stateFromRows(['.#.', '...'], [mover]);
  assert.deepEqual(scriptedPath(around, { x: 0, y: 0 }, { x: 2, y: 0 }), [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 0 },
  ]);

  const enclosed = stateFromRows(['.#.'], [mover]);
  assert.deepEqual(scriptedPath(enclosed, { x: 0, y: 0 }, { x: 2, y: 0 }), []);
  assert.deepEqual(scriptedPath(around, { x: 0, y: 0 }, { x: 0, y: 0 }), []);
});

test('freeTileNear : la case demandée si elle est libre, sinon la plus proche', () => {
  const blocker = unit('b', 'enemy', 'lancer', 1, 1);
  const state = stateFromRows(['...', '...', '...'], [blocker]);
  assert.deepEqual(freeTileNear(state, { x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(freeTileNear(state, { x: 1, y: 1 }), { x: 1, y: 0 });
  assert.deepEqual(freeTileNear(state, { x: 1, y: 1 }, blocker), { x: 1, y: 1 });
});

test('freeTileNear évite les murs, ramène une position hors carte et rend undefined si tout est pris', () => {
  const state = stateFromRows(['#..', '...'], []);
  assert.deepEqual(freeTileNear(state, { x: 0, y: 0 }), { x: 1, y: 0 });
  assert.deepEqual(freeTileNear(state, { x: 9, y: 0 }), { x: 2, y: 0 });

  const full = stateFromRows(['#.'], [unit('a', 'player', 'swordsman', 1, 0)]);
  assert.equal(freeTileNear(full, { x: 0, y: 0 }), undefined);
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
