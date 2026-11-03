import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planEnemyAction } from './ai.ts';
import { stateFromRows } from './grid.ts';
import { makeUnit, TEST_STATS } from './test-helpers.ts';
import type { AiProfile, Unit } from './types.ts';

function enemy(ai: AiProfile, x: number, y: number, overrides: Partial<Unit> = {}): Unit {
  return makeUnit({ id: 'e', team: 'enemy', ai, pos: { x, y }, ...overrides });
}

function player(id: string, x: number, y: number, overrides: Partial<Unit> = {}): Unit {
  return makeUnit({ id, pos: { x, y }, ...overrides });
}

test('charge : un coup fatal passe avant les plus gros dégâts', () => {
  const hunter = enemy('charge', 3, 0);
  const state = stateFromRows(['..........'], [
    hunter,
    player('weak', 0, 0, { hp: 5 }), // 8 dégâts : mort certaine
    player('strong', 6, 0), // 8 dégâts aussi, mais 20 PV
  ]);
  const action = planEnemyAction(state, hunter);
  assert.equal(action.targetId, 'weak');
  assert.deepEqual(action.path, [{ x: 2, y: 0 }, { x: 1, y: 0 }]);
});

test('charge : sans coup fatal, il vise la cible la plus abîmée par ses coups', () => {
  const hunter = enemy('charge', 3, 0);
  const state = stateFromRows(['........'], [
    hunter,
    player('tank', 0, 0, { stats: { ...TEST_STATS, def: 6 } }), // 4 dégâts
    player('soft', 6, 0), // 8 dégâts
  ]);
  assert.equal(planEnemyAction(state, hunter).targetId, 'soft');
});

test('charge : un archer tire à 2 cases, jamais au contact', () => {
  const archer = enemy('charge', 0, 0, { weaponId: 'ironBow', classId: 'archer' });
  const state = stateFromRows(['.........'], [archer, player('p', 3, 0)]);
  const action = planEnemyAction(state, archer);
  assert.equal(action.targetId, 'p');
  assert.deepEqual(action.path.at(-1), { x: 1, y: 0 });
});

test("charge : à dégâts égaux, il attaque depuis la forêt", () => {
  const hunter = enemy('charge', 0, 1);
  const state = stateFromRows(['..f..', '.....', '.....'], [hunter, player('p', 2, 1)]);
  assert.deepEqual(planEnemyAction(state, hunter).path.at(-1), { x: 2, y: 0 });
});

test('charge : personne à portée, il avance en contournant les murs', () => {
  const walker = enemy('charge', 3, 0, { classId: 'lancer', weaponId: 'ironLance' }); // mouvement 4
  const state = stateFromRows(['....#...', '....#...', '....#...', '........'], [walker, player('p', 6, 0)]);
  const action = planEnemyAction(state, walker);
  assert.equal(action.targetId, null);
  assert.deepEqual(action.path.at(-1), { x: 4, y: 3 }); // vers l'ouverture, pas collé au mur
});

test("guard : il reste en place tant que personne n'est à sa portée", () => {
  const guard = enemy('guard', 0, 0);
  const state = stateFromRows(['..........'], [guard, player('p', 9, 0)]);
  assert.deepEqual(planEnemyAction(state, guard), { path: [], targetId: null });
});

test("guard : il attaque quelqu'un qui entre dans sa zone d'action", () => {
  const guard = enemy('guard', 0, 0);
  const state = stateFromRows(['..........'], [guard, player('p', 5, 0)]);
  const action = planEnemyAction(state, guard);
  assert.equal(action.targetId, 'p');
  assert.deepEqual(action.path.at(-1), { x: 4, y: 0 });
});

test("stationary : il ne bouge pas, même pour une cible qu'il pourrait atteindre", () => {
  const boss = enemy('stationary', 0, 0);
  const state = stateFromRows(['.....'], [boss, player('p', 3, 0)]);
  assert.deepEqual(planEnemyAction(state, boss), { path: [], targetId: null });
});

test('stationary : il attaque ce qui est à portée de sa case', () => {
  const boss = enemy('stationary', 0, 0);
  const state = stateFromRows(['.....'], [boss, player('p', 1, 0)]);
  assert.deepEqual(planEnemyAction(state, boss), { path: [], targetId: 'p' });
});
