import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvent } from './combat.ts';
import { stateFromRows, tileIndex } from './grid.ts';
import {
  BACK_BUTTON,
  MENU_WIDTH,
  backButtonAt,
  canCancel,
  cancel,
  confirm,
  createUiState,
  finishAction,
  finishMove,
  setCursor,
} from './selection.ts';
import type { MenuItem, Playback, UiState } from './selection.ts';
import { parseScript } from './script.ts';
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

function click(state: GameState, ui: UiState, x: number, y: number): Playback | null {
  setCursor(state, ui, { x, y });
  return confirm(state, ui, rng);
}

// Joue un Playback comme le fait main.ts, sans les délais.
function play(state: GameState, ui: UiState, playback: Playback | null): void {
  if (playback?.type === 'move') {
    const unit = state.units.find((other) => other.id === playback.unitId);
    assert.ok(unit !== undefined);
    unit.pos = playback.path.at(-1)!;
    finishMove(state, ui);
  } else if (playback?.type === 'combat') {
    for (const event of playback.events) applyEvent(state, event);
    finishAction(state, ui);
  }
}

// Clic puis lecture complète de ce qu'il déclenche.
function act(state: GameState, ui: UiState, x: number, y: number): void {
  play(state, ui, click(state, ui, x, y));
}

function clickItem(state: GameState, ui: UiState, item: MenuItem): Playback | null {
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
  assert.deepEqual(ui.menu?.items, ['endTurn', 'options']);
});

test("move : une case atteignable lance le déplacement, le menu s'ouvre à l'arrivée", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  const move = click(state, ui, 0, 1);
  assert.deepEqual(move, { type: 'move', unitId: 'p1', path: [{ x: 0, y: 1 }] });
  assert.equal(ui.mode, 'busy');
  assert.deepEqual(p1.pos, { x: 0, y: 0 }); // l'état n'avance que pendant la lecture

  play(state, ui, move);
  assert.deepEqual(p1.pos, { x: 0, y: 1 });
  assert.equal(ui.mode, 'menu');
  assert.deepEqual(ui.menu?.items, ['wait']); // personne à portée
});

test("move : rester sur place ouvre le menu sans rien à jouer", () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  assert.equal(click(state, ui, 0, 0), null);
  assert.equal(ui.mode, 'menu');
});

test("menu : Attaquer n'apparaît que si un ennemi est à portée", () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0); // adjacent à l'archer en (3, 0)
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
  act(state, ui, 0, 1);
  clickItem(state, ui, 'wait');
  assert.equal(p1.acted, true);
  assert.equal(ui.mode, 'idle');
  assert.equal(state.phase, 'player');
});

test("menu : annuler remet l'unité à sa place", () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  cancel(state, ui);
  assert.deepEqual(p1.pos, { x: 0, y: 0 });
  assert.equal(ui.mode, 'move');
  assert.equal(ui.selectedId, 'p1');
});

test('attaque : le ciblage liste les ennemis, confirmer lance le combat', () => {
  const { state, ui, p1 } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  assert.equal(ui.mode, 'target');
  assert.deepEqual(ui.targets, ['e1']);

  const combat = click(state, ui, 3, 0);
  assert.equal(combat?.type, 'combat');
  assert.equal(ui.mode, 'busy');

  play(state, ui, combat);
  assert.equal(state.units.find((unit) => unit.id === 'e1')?.hp, 12);
  assert.equal(p1.acted, true);
  assert.equal(ui.mode, 'idle');
});

test('attaque : annuler au ciblage revient au menu', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  cancel(state, ui);
  assert.equal(ui.mode, 'menu');
  assert.deepEqual(ui.menu?.items, ['attack', 'wait']);
});

test('attaque : cliquer hors cible ne lance rien', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  assert.equal(click(state, ui, 5, 2), null);
  assert.equal(ui.mode, 'target');
});

test('busy : confirmer et annuler sont ignorés pendant la lecture', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  click(state, ui, 3, 0);
  cancel(state, ui);
  assert.equal(ui.mode, 'busy');
  assert.equal(click(state, ui, 3, 0), null);
});

test('phase : quand toutes les unités du joueur ont agi, les ennemis jouent', () => {
  const { state, ui } = setup();
  for (const [x, y] of [[0, 0], [0, 2]] as const) {
    click(state, ui, x, y);
    click(state, ui, x, y); // reste sur place
    clickItem(state, ui, 'wait');
  }
  assert.equal(state.phase, 'enemy');
  assert.equal(state.turn, 1); // le tour ne change qu'à la fin de la phase ennemie
});

test('système : Fin de tour lance la phase ennemie', () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);
  clickItem(state, ui, 'endTurn');
  assert.equal(state.phase, 'enemy');
  assert.equal(ui.mode, 'idle');
});

test('système : annuler ferme le menu', () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);
  cancel(state, ui);
  assert.equal(ui.mode, 'idle');
  assert.equal(ui.menu, null);
  assert.equal(state.phase, 'player');
});

test('hors de la phase joueur ou après la fin de partie, rien ne répond', () => {
  const { state, ui } = setup();
  state.phase = 'enemy';
  assert.equal(click(state, ui, 0, 0), null);
  assert.equal(ui.mode, 'idle');

  state.phase = 'player';
  state.outcome = 'defeat';
  assert.equal(click(state, ui, 0, 0), null);
  assert.equal(ui.mode, 'idle');
});

const TALKS = `
  @event a quand parler(p1,p2)
    p1: x.1
  @event b quand parler(p1,e1)
    p1: x.2`;

// p1 en (1,1) avec deux voisins : p2 (alliée, dessous) et, si demandé, e1 (ennemi, à droite).
function talkSetup(withEnemy = true) {
  const state = stateFromRows(['........', '........', '........'], [
    makeUnit({ id: 'p1', pos: { x: 1, y: 1 } }),
    makeUnit({ id: 'p2', pos: { x: 1, y: 2 } }),
    ...(withEnemy ? [makeUnit({ id: 'e1', team: 'enemy', pos: { x: 2, y: 1 } })] : []),
  ]);
  const ui = createUiState(parseScript(TALKS));
  click(state, ui, 1, 1); // sélectionne p1
  click(state, ui, 1, 1); // reste sur place : le menu d'actions s'ouvre
  return { state, ui };
}

test('menu : Parler apparaît entre Attaquer et Attendre quand un interlocuteur est voisin', () => {
  const { ui } = talkSetup();
  assert.deepEqual(ui.menu?.items, ['attack', 'talk', 'wait']);
});

test("menu : pas de Parler sans voisin ayant un événement", () => {
  const state = stateFromRows(['........'], [
    makeUnit({ id: 'p1', pos: { x: 0, y: 0 } }),
    makeUnit({ id: 'p2', pos: { x: 4, y: 0 } }), // pas voisin
  ]);
  const ui = createUiState(parseScript(TALKS));
  click(state, ui, 0, 0);
  click(state, ui, 0, 0);
  assert.deepEqual(ui.menu?.items, ['wait']);
});

test("Parler avec plusieurs interlocuteurs : on désigne lequel, puis la conversation se lance", () => {
  const { state, ui } = talkSetup();
  assert.equal(clickItem(state, ui, 'talk'), null);
  assert.equal(ui.mode, 'target');
  assert.equal(ui.targetKind, 'talk');
  assert.deepEqual(ui.targets, ['p2', 'e1']);

  assert.equal(click(state, ui, 5, 2), null); // hors des interlocuteurs : rien
  assert.deepEqual(click(state, ui, 1, 2), { type: 'talk', unitId: 'p1', partnerId: 'p2' });
  assert.equal(ui.mode, 'busy');

  finishAction(state, ui);
  assert.equal(state.units[0]?.acted, true);
  assert.equal(ui.mode, 'idle');
});

test('Parler avec un seul interlocuteur : la conversation se lance tout de suite', () => {
  const { state, ui } = talkSetup(false);
  assert.deepEqual(ui.menu?.items, ['talk', 'wait']);
  assert.deepEqual(clickItem(state, ui, 'talk'), { type: 'talk', unitId: 'p1', partnerId: 'p2' });
  assert.equal(ui.mode, 'busy');
});

test("annuler le choix de l'interlocuteur revient au menu ; une conversation jouée ne se propose plus", () => {
  const { state, ui } = talkSetup();
  clickItem(state, ui, 'talk');
  cancel(state, ui);
  assert.equal(ui.mode, 'menu');
  assert.deepEqual(ui.menu?.items, ['attack', 'talk', 'wait']);

  state.fired.push('a', 'b');
  cancel(state, ui); // retour à la zone de déplacement
  click(state, ui, 1, 1);
  assert.deepEqual(ui.menu?.items, ['attack', 'wait']);
});

test('le curseur ignore une position hors de la carte', () => {
  const { state, ui } = setup();
  setCursor(state, ui, { x: 2, y: 1 });
  setCursor(state, ui, { x: 99, y: 99 });
  assert.deepEqual(ui.cursor, { x: 2, y: 1 });
});

test("canCancel : vrai seulement quand il y a quelque chose à défaire pendant la phase joueur", () => {
  const { state, ui } = setup();
  assert.equal(canCancel(state, ui), false); // idle

  click(state, ui, 0, 0);
  assert.equal(canCancel(state, ui), true); // move

  click(state, ui, 0, 0);
  assert.equal(ui.mode, 'menu');
  assert.equal(canCancel(state, ui), true);

  cancel(state, ui); // le menu se ferme, retour à la zone de déplacement
  assert.equal(ui.mode, 'move');
  cancel(state, ui);
  assert.equal(canCancel(state, ui), false); // retour à idle

  click(state, ui, 5, 2);
  assert.equal(ui.mode, 'system');
  assert.equal(canCancel(state, ui), true);

  state.phase = 'enemy';
  assert.equal(canCancel(state, ui), false);
  state.phase = 'player';
  state.outcome = 'victory';
  assert.equal(canCancel(state, ui), false);
});

test('canCancel : faux pendant la lecture, vrai au ciblage', () => {
  const { state, ui } = setup();
  click(state, ui, 0, 0);
  act(state, ui, 2, 0);
  clickItem(state, ui, 'attack');
  assert.equal(ui.mode, 'target');
  assert.equal(canCancel(state, ui), true);
  click(state, ui, 3, 0);
  assert.equal(ui.mode, 'busy');
  assert.equal(canCancel(state, ui), false);
});

test('backButtonAt : les quatre tuiles du bouton, sur la rangée du haut seulement', () => {
  const { x, y, width } = BACK_BUTTON;
  assert.equal(backButtonAt({ x, y }), true);
  assert.equal(backButtonAt({ x: x + width - 1, y }), true);
  assert.equal(backButtonAt({ x: x - 1, y }), false);
  assert.equal(backButtonAt({ x: x + width, y }), false);
  assert.equal(backButtonAt({ x, y: y + 1 }), false);
});

test("système : Options ferme le menu et demande l'écran des options, sans finir le tour", () => {
  const { state, ui } = setup();
  click(state, ui, 5, 2);

  assert.deepEqual(clickItem(state, ui, 'options'), { type: 'options' });
  assert.equal(ui.mode, 'idle');
  assert.equal(ui.menu, null);
  assert.equal(state.phase, 'player'); // le tour n'est pas fini
});
