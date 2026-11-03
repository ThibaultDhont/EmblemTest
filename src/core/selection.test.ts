import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvent } from './combat.ts';
import { stateFromRows, tileIndex } from './grid.ts';
import { MENU_WIDTH, cancel, confirm, createUiState, finishAction, setCursor } from './selection.ts';
import type { MenuItem, UiState } from './selection.ts';
import { makeUnit } from './test-helpers.ts';
import type { GameState } from './types.ts';

const rng = () => 0.5;

function setup() {
  const state = stateFromRows(['........', '........', '........'], [
    makeUnit({ id: 'p1', pos: { x: 0, y: 0 } }),
    makeUnit({ id: 'p2', classId: 'lancer', weaponId: 'ironLance', pos: { x: 0, y: 2 } }),
    makeUnit({ id: 'e1', team: 'enemy', classId: 'archer', weaponId: 'ironBow', pos: { x: 3, y: 0 } }),
  ]);
  return { state, ui: createUiState(), p1: state.units[0]!, p2: state.units[1]! };
}

function click(state: GameState, ui: UiState, x: number, y: number) {
  setCursor(state, ui, { x, y });
  return confirm(state, ui, rng);
}

function clickItem(state: GameState, ui: UiState, item: MenuItem) {
  const menu = ui.menu;
  assert.ok(menu !== null, 'aucun menu ouvert');
  const row = menu.items.indexOf(item);
  assert.ok(row >= 0, `entrée ${item} absente du menu`);
  return click(state, ui, menu.x, menu.y + row);
}

test('idle : confirmer sur une unité du joueur la sélectionne', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  assert.equal(ui.mode, 'move');
  assert.equal(ui.selectedId, 'p1');
  assert.ok(ui.reachable.has(tileIndex(state, { x: 0, y: 0 })));
  assert.ok(ui.reachable.has(tileIndex(state, { x: 3, y: 1 })));
});

test("idle : un ennemi ou une unité qui a déjà agi ne se sélectionne pas", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 3, 0);
  assert.equal(ui.mode, 'idle');
  p1.acted = true;
  click(state, ui, 0, 0);
  assert.equal(ui.mode, 'idle');
});

test('idle : une case vide ouvre le menu système', () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);
  assert.equal(ui.mode, 'system');
  assert.deepEqual(ui.menu?.items, ['endTurn']);
});

test("move : une case atteignable déplace l'unité et ouvre le menu", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 0, 1);
  assert.deepEqual(p1.pos, { x: 0, y: 1 });
  assert.equal(ui.mode, 'menu');
  assert.deepEqual(ui.menu?.items, ['wait']); // personne à portée
});

test("menu : Attaquer n'apparaît que si un ennemi est à portée", () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0); // adjacent à l'archer en (3, 0)
  assert.deepEqual(ui.menu?.items, ['attack', 'wait']);
});

test("menu : s'ouvre du côté qui ne cache pas l'ennemi", () => {
  const state = stateFromRows(['............'], [
    makeUnit({ id: 'p1', pos: { x: 6, y: 0 } }),
    makeUnit({ id: 'e1', team: 'enemy', pos: { x: 7, y: 0 } }),
  ]);
  const ui = createUiState();
  click(state, ui, 6, 0);
  click(state, ui, 6, 0); // reste sur place, ennemi adjacent à droite
  assert.equal(ui.menu?.x, 1); // à gauche : colonnes 1 à 5
  assert.ok((ui.menu?.x ?? 0) + MENU_WIDTH <= 6);
});

test("menu : Attendre termine l'action de l'unité", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 0, 1);
  clickItem(state, ui, 'wait');
  assert.equal(p1.acted, true);
  assert.equal(ui.mode, 'idle');
  assert.equal(state.turn, 1);
});

test("menu : annuler remet l'unité à sa place", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0);
  cancel(state, ui);
  assert.deepEqual(p1.pos, { x: 0, y: 0 });
  assert.equal(ui.mode, 'move');
  assert.equal(ui.selectedId, 'p1');
});

test('attaque : le ciblage liste les ennemis, confirmer lance le combat', () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  assert.equal(ui.mode, 'target');
  assert.deepEqual(ui.targets, ['e1']);

  const events = click(state, ui, 3, 0);
  assert.equal(ui.mode, 'busy');
  assert.equal(events[0]?.type, 'strike');
  for (const event of events) applyEvent(state, event);
  assert.equal(state.units.find((unit) => unit.id === 'e1')?.hp, 12);

  finishAction(state, ui);
  assert.equal(p1.acted, true);
  assert.equal(ui.mode, 'idle');
});

test('attaque : annuler au ciblage revient au menu', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  cancel(state, ui);
  assert.equal(ui.mode, 'menu');
  assert.deepEqual(ui.menu?.items, ['attack', 'wait']);
});

test('attaque : cliquer hors cible ne lance rien', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  assert.deepEqual(click(state, ui, 5, 2), []);
  assert.equal(ui.mode, 'target');
});

test('busy : confirmer et annuler sont ignorés pendant la lecture du combat', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  click(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  click(state, ui, 3, 0);
  cancel(state, ui);
  assert.equal(ui.mode, 'busy');
  assert.deepEqual(click(state, ui, 3, 0), []);
});

test('tour : quand toutes les unités du joueur ont agi, le tour suivant commence', () => {
  const { state, ui } = setup();
  for (const [x, y] of [[0, 0], [0, 2]] as const) {
    click(state, ui, x, y);
    click(state, ui, x, y); // reste sur place
    clickItem(state, ui, 'wait');
  }
  assert.equal(state.turn, 2);
  assert.ok(state.units.every((unit) => !unit.acted));
});

test('système : Fin de tour passe au tour suivant', () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);
  clickItem(state, ui, 'endTurn');
  assert.equal(state.turn, 2);
  assert.equal(ui.mode, 'idle');
});

test('système : annuler ferme le menu', () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);
  cancel(state, ui);
  assert.equal(ui.mode, 'idle');
  assert.equal(ui.menu, null);
  assert.equal(state.turn, 1);
});

test('le curseur ignore une position hors de la carte', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 2, y: 1 });
  setCursor(state, ui, { x: 99, y: 99 });
  assert.deepEqual(ui.cursor, { x: 2, y: 1 });
});
