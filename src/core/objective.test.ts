import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows } from './grid.ts';
import { updateOutcome } from './objective.ts';
import { makeUnit } from './test-helpers.ts';
import type { Objective, Unit } from './types.ts';

function setup(objective: Objective, units: Unit[], reserve: Unit[] = []) {
  const state = stateFromRows(['....'], units, reserve);
  state.objective = objective;
  return state;
}

const lord = () => makeUnit({ id: 'anna', role: 'lord' });
const boss = (id: string, x: number) => makeUnit({ id, team: 'enemy', role: 'boss', pos: { x, y: 0 } });
const foe = (id: string, x: number) => makeUnit({ id, team: 'enemy', pos: { x, y: 0 } });

test('boss : la chute du dernier boss fait gagner', () => {
  const fallen = boss('brutus', 3);
  const state = setup({ type: 'boss' }, [lord()]);
  updateOutcome(state, fallen);
  assert.equal(state.outcome, 'victory');
});

test("boss : rien tant qu'un autre boss reste, sur la carte ou en réserve, ni pour une autre unité", () => {
  const fallen = boss('brutus', 3);

  const onMap = setup({ type: 'boss' }, [lord(), boss('second', 2)]);
  updateOutcome(onMap, fallen);
  assert.equal(onMap.outcome, 'playing');

  const inReserve = setup({ type: 'boss' }, [lord()], [boss('renfort', 3)]);
  updateOutcome(inReserve, fallen);
  assert.equal(inReserve.outcome, 'playing');

  const other = setup({ type: 'boss' }, [lord()]);
  updateOutcome(other, foe('e1', 2));
  assert.equal(other.outcome, 'playing');
  updateOutcome(other);
  assert.equal(other.outcome, 'playing');
});

test("déroute : il faut qu'il ne reste aucun ennemi, réserve comprise", () => {
  const remaining = setup({ type: 'rout' }, [lord(), foe('e1', 2)]);
  updateOutcome(remaining, foe('e2', 3));
  assert.equal(remaining.outcome, 'playing');

  const expected = setup({ type: 'rout' }, [lord()], [foe('renfort', 3)]);
  updateOutcome(expected);
  assert.equal(expected.outcome, 'playing');

  const cleared = setup({ type: 'rout' }, [lord()]);
  updateOutcome(cleared, foe('e1', 2));
  assert.equal(cleared.outcome, 'victory');
});

test('survie : victoire quand le tour dépasse N, pas avant', () => {
  const state = setup({ type: 'survive', turns: 3 }, [lord(), foe('e1', 2)]);
  for (const turn of [1, 2, 3]) {
    state.turn = turn;
    updateOutcome(state);
    assert.equal(state.outcome, 'playing', `tour ${turn}`);
  }
  state.turn = 4;
  updateOutcome(state);
  assert.equal(state.outcome, 'victory');
});

test('une issue déjà décidée ne change plus', () => {
  const state = setup({ type: 'rout' }, [lord()]);
  state.outcome = 'defeat';
  updateOutcome(state);
  assert.equal(state.outcome, 'defeat');
});
