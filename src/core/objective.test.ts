import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows } from './grid.ts';
import { objectiveTarget, updateOutcome } from './objective.ts';
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

test('atteindre : une unité du joueur sur la case suffit, pas un ennemi ni une unité ailleurs', () => {
  const goal: Objective = { type: 'reach', x: 3, y: 0 };

  const enemyThere = setup(goal, [lord(), foe('e1', 3)]);
  updateOutcome(enemyThere);
  assert.equal(enemyThere.outcome, 'playing');

  const elsewhere = setup(goal, [makeUnit({ id: 'anna', role: 'lord', pos: { x: 2, y: 0 } })]);
  updateOutcome(elsewhere);
  assert.equal(elsewhere.outcome, 'playing');

  const arrived = setup(goal, [makeUnit({ id: 'anna', role: 'lord', pos: { x: 3, y: 0 } })]);
  updateOutcome(arrived);
  assert.equal(arrived.outcome, 'victory');
});

test("escorte : seule l'unité désignée gagne en arrivant", () => {
  const goal: Objective = { type: 'escort', unit: 'marc', x: 3, y: 0 };

  const other = setup(goal, [makeUnit({ id: 'anna', role: 'lord', pos: { x: 3, y: 0 } }), makeUnit({ id: 'marc', pos: { x: 1, y: 0 } })]);
  updateOutcome(other);
  assert.equal(other.outcome, 'playing');

  const escorted = setup(goal, [lord(), makeUnit({ id: 'marc', pos: { x: 3, y: 0 } })]);
  updateOutcome(escorted);
  assert.equal(escorted.outcome, 'victory');
});

test('objectiveTarget donne la case visée, et rien pour les autres objectifs', () => {
  assert.deepEqual(objectiveTarget({ type: 'reach', x: 1, y: 14 }), { x: 1, y: 14 });
  assert.deepEqual(objectiveTarget({ type: 'escort', unit: 'marc', x: 2, y: 3 }), { x: 2, y: 3 });
  assert.equal(objectiveTarget({ type: 'boss' }), undefined);
  assert.equal(objectiveTarget({ type: 'rout' }), undefined);
  assert.equal(objectiveTarget({ type: 'survive', turns: 3 }), undefined);
});

test('une issue déjà décidée ne change plus', () => {
  const state = setup({ type: 'rout' }, [lord()]);
  state.outcome = 'defeat';
  updateOutcome(state);
  assert.equal(state.outcome, 'defeat');
});
