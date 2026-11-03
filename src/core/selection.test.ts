import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stateFromRows, tileIndex } from './grid.ts';
import { cancel, confirm, createUiState, setCursor } from './selection.ts';

function setup() {
  const state = stateFromRows(
    ['......', '......'],
    [
      { id: 'p1', team: 'player', classId: 'swordsman', pos: { x: 0, y: 0 } },
      { id: 'p2', team: 'player', classId: 'lancer', pos: { x: 1, y: 1 } },
      { id: 'e1', team: 'enemy', classId: 'archer', pos: { x: 5, y: 1 } },
    ],
  );
  return { state, ui: createUiState() };
}

test('confirmer sur une unité du joueur la sélectionne et calcule sa zone', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 0, y: 0 });
  confirm(state, ui);
  assert.equal(ui.selectedId, 'p1');
  assert.ok(ui.reachable.has(tileIndex(state, { x: 0, y: 0 })));
  assert.ok(ui.reachable.has(tileIndex(state, { x: 3, y: 1 })));
});

test('confirmer sur un ennemi ne sélectionne rien', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 5, y: 1 });
  confirm(state, ui);
  assert.equal(ui.selectedId, null);
});

test('confirmer sur une case atteignable déplace l\'unité et termine la sélection', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 0, y: 0 });
  confirm(state, ui);
  setCursor(state, ui, { x: 2, y: 0 });
  confirm(state, ui);
  assert.deepEqual(state.units[0]?.pos, { x: 2, y: 0 });
  assert.equal(ui.selectedId, null);
  assert.equal(ui.reachable.size, 0);
});

test('confirmer sur une case inatteignable ne déplace rien', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 0, y: 0 });
  confirm(state, ui);
  setCursor(state, ui, { x: 5, y: 1 }); // occupée par un ennemi
  confirm(state, ui);
  assert.deepEqual(state.units[0]?.pos, { x: 0, y: 0 });
  assert.equal(ui.selectedId, 'p1');
});

test('annuler efface la sélection', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 0, y: 0 });
  confirm(state, ui);
  cancel(ui);
  assert.equal(ui.selectedId, null);
  assert.equal(ui.reachable.size, 0);
});

test('confirmer sur une autre unité alliée change la sélection', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 0, y: 0 });
  confirm(state, ui);
  setCursor(state, ui, { x: 1, y: 1 });
  confirm(state, ui);
  assert.equal(ui.selectedId, 'p2');
});

test('le curseur ignore une position hors de la carte', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 2, y: 1 });
  setCursor(state, ui, { x: 9, y: 9 });
  assert.deepEqual(ui.cursor, { x: 2, y: 1 });
});
