import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows } from './grid.ts';
import { makeUnit } from './test-helpers.ts';
import { endTurn } from './turn.ts';

test('endTurn passe au tour suivant et rend la main aux unités', () => {
  const state = stateFromRows(['..'], [
    makeUnit({ id: 'a', acted: true }),
    makeUnit({ id: 'b', team: 'enemy', pos: { x: 1, y: 0 }, acted: true }),
  ]);
  endTurn(state);
  assert.equal(state.turn, 2);
  assert.ok(state.units.every((unit) => !unit.acted));
});
