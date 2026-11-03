import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows } from './grid.ts';
import { makeUnit } from './test-helpers.ts';
import { endEnemyPhase, endPlayerPhase } from './turn.ts';

function setup() {
  return stateFromRows(['..'], [
    makeUnit({ id: 'p', acted: true }),
    makeUnit({ id: 'e', team: 'enemy', pos: { x: 1, y: 0 }, acted: true }),
  ]);
}

test('endPlayerPhase donne la main aux ennemis sans changer de tour', () => {
  const state = setup();
  endPlayerPhase(state);
  assert.equal(state.phase, 'enemy');
  assert.equal(state.turn, 1);
  assert.equal(state.units.find((unit) => unit.id === 'e')?.acted, false);
});

test('endEnemyPhase atteint un objectif de survie, pas avant', () => {
  const state = setup();
  state.objective = { type: 'survive', turns: 2 };
  endEnemyPhase(state); // le tour 2 commence : il faut encore tenir sa phase ennemie
  assert.equal(state.outcome, 'playing');
  endEnemyPhase(state); // le tour 3 commence : le tour 2 est tenu jusqu'au bout
  assert.equal(state.outcome, 'victory');
});

test('endEnemyPhase ouvre le tour suivant et rend la main à tout le monde', () => {
  const state = setup();
  endPlayerPhase(state);
  endEnemyPhase(state);
  assert.equal(state.phase, 'player');
  assert.equal(state.turn, 2);
  assert.ok(state.units.every((unit) => !unit.acted));
});
