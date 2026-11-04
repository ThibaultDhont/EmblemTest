import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChapter1 } from '../data/chapter1.ts';
import { SAVE_VERSION, SLOTS, createSave, parseSave, readSave } from './save.ts';
import type { LogEntry } from './save.ts';
import type { GameState, Objective } from './types.ts';

const LOG: LogEntry[] = [
  { eventId: 'intro', speaker: 'anna', key: 'ch1.intro.1' },
  { eventId: 'intro', speaker: 'narration', key: 'ch1.tuto.selection' },
];

// Le texte tel qu'il serait enregistré, puis relu.
function roundTrip(state: GameState, log = LOG) {
  return readSave(JSON.stringify(createSave('chapter1', state, log, 1_700_000_000_000)));
}

// Une sauvegarde valable sous forme de données brutes, à abîmer ensuite.
function raw(): Record<string, any> {
  return JSON.parse(JSON.stringify(createSave('chapter1', createChapter1(), LOG, 1)));
}

test('les emplacements sont un automatique et trois manuels', () => {
  assert.deepEqual([...SLOTS], ['auto', 'manual1', 'manual2', 'manual3']);
});

test('aller-retour : le chapitre 1 neuf revient identique, historique et date compris', () => {
  const state = createChapter1();
  const read = roundTrip(state);
  assert.equal(read.kind, 'ok');
  if (read.kind !== 'ok') return;
  assert.deepEqual(read.save.state, state);
  assert.deepEqual(read.save.log, LOG);
  assert.equal(read.save.savedAt, 1_700_000_000_000);
  assert.equal(read.save.chapter, 'chapter1');
  assert.equal(read.save.version, SAVE_VERSION);
});

test("aller-retour : une partie avancée (tour, unités qui ont agi, déplacées, blessées, drapeaux) revient identique", () => {
  const state = createChapter1();
  state.turn = 3;
  state.fired.push('intro', 'tuto-selection');
  state.flags.push('prudent');
  const anna = state.units.find((unit) => unit.id === 'anna')!;
  anna.pos = { x: 5, y: 7 };
  anna.hp = 4;
  anna.acted = true;
  state.units = state.units.filter((unit) => unit.id !== 'lise'); // une unité tombée
  const read = roundTrip(state);
  assert.equal(read.kind, 'ok');
  if (read.kind === 'ok') assert.deepEqual(read.save.state, state);
});

test('aller-retour : chaque forme d\'objectif', () => {
  const objectives: Objective[] = [
    { type: 'boss' },
    { type: 'rout' },
    { type: 'survive', turns: 4 },
    { type: 'reach', x: 1, y: 14 },
    { type: 'escort', unit: 'marc', x: 1, y: 14 },
  ];
  for (const objective of objectives) {
    const state = createChapter1();
    state.objective = objective;
    const read = roundTrip(state);
    assert.equal(read.kind, 'ok');
    if (read.kind === 'ok') assert.deepEqual(read.save.state.objective, objective);
  }
});

test("créer une sauvegarde ne partage rien avec la partie en cours", () => {
  const state = createChapter1();
  const save = createSave('chapter1', state, LOG);
  state.units[0]!.hp = 1;
  state.flags.push('x');
  assert.notEqual(save.state.units[0]!.hp, 1);
  assert.deepEqual(save.state.flags, []);
});

test('un emplacement sans texte est vide, un texte qui n\'est pas du JSON est illisible', () => {
  assert.deepEqual(readSave(null), { kind: 'empty' });
  assert.deepEqual(readSave(''), { kind: 'broken' });
  assert.deepEqual(readSave('{pas du json'), { kind: 'broken' });
  assert.deepEqual(readSave('null'), { kind: 'broken' });
  assert.deepEqual(readSave('[]'), { kind: 'broken' });
  assert.deepEqual(readSave('42'), { kind: 'broken' });
});

// Chaque abîmage est appliqué à une sauvegarde valable, qui doit alors être refusée.
const CORRUPTIONS: Array<[string, (save: Record<string, any>) => void]> = [
  ['une autre version', (save) => (save.version = SAVE_VERSION + 1)],
  ['un chapitre inconnu', (save) => (save.chapter = 'chapter99')],
  ['sans date', (save) => delete save.savedAt],
  ['une date qui n\'est pas un nombre', (save) => (save.savedAt = 'hier')],
  ['une carte de largeur nulle', (save) => (save.state.width = 0)],
  ['une carte démesurée', (save) => (save.state.width = 100_000)],
  ['des tuiles en nombre incohérent', (save) => save.state.tiles.pop()],
  ['une tuile inconnue', (save) => (save.state.tiles[0] = 'lave')],
  ['une unité de classe inconnue', (save) => (save.state.units[0].classId = 'dragon')],
  ['une unité d\'arme inconnue', (save) => (save.state.units[0].weaponId = 'excalibur')],
  ['une unité hors de la carte', (save) => (save.state.units[0].pos = { x: 99, y: 0 })],
  ['une unité sans position', (save) => delete save.state.units[0].pos],
  ['une unité plus vivante que son maximum', (save) => (save.state.units[0].hp = save.state.units[0].stats.maxHp + 1)],
  ['une unité à zéro PV', (save) => (save.state.units[0].hp = 0)],
  ['une unité d\'un camp inconnu', (save) => (save.state.units[0].team = 'neutre')],
  ['une unité à l\'IA inconnue', (save) => (save.state.units[3].ai = 'kamikaze')],
  ['une unité au rôle inconnu', (save) => (save.state.units[0].role = 'roi')],
  ['une unité qui n\'a pas son indicateur d\'action', (save) => delete save.state.units[0].acted],
  ['deux unités du même nom', (save) => (save.state.reserve[0].id = save.state.units[0].id)],
  ['aucune unité du joueur', (save) => (save.state.units = save.state.units.filter((unit: any) => unit.team !== 'player'))],
  ['des unités qui ne sont pas une liste', (save) => (save.state.units = {})],
  ['le tour 0', (save) => (save.state.turn = 0)],
  ['la phase ennemie', (save) => (save.state.phase = 'enemy')],
  ['une partie terminée', (save) => (save.state.outcome = 'victory')],
  ['un objectif inconnu', (save) => (save.state.objective = { type: 'danser' })],
  ['un objectif d\'atteinte hors de la carte', (save) => (save.state.objective = { type: 'reach', x: 99, y: 0 })],
  ['un objectif de survie sans durée', (save) => (save.state.objective = { type: 'survive' })],
  ['des drapeaux qui ne sont pas du texte', (save) => (save.state.flags = [1, 2])],
  ['des événements joués absents', (save) => delete save.state.fired],
  ['un historique qui n\'est pas une liste', (save) => (save.log = 'bonjour')],
  ['une réplique d\'historique incomplète', (save) => (save.log = [{ eventId: 'intro' }])],
  ['un historique démesuré', (save) => (save.log = Array.from({ length: 1_001 }, () => ({ eventId: 'a', speaker: 'b', key: 'c' })))],
];

for (const [name, corrupt] of CORRUPTIONS) {
  test(`une sauvegarde avec ${name} est illisible`, () => {
    const save = raw();
    corrupt(save);
    assert.equal(parseSave(save), undefined);
    assert.deepEqual(readSave(JSON.stringify(save)), { kind: 'broken' });
  });
}

test('la sauvegarde de contrôle n\'est pas déjà abîmée, et les champs inconnus sont ignorés', () => {
  const save = raw();
  save.extra = 'ignoré';
  save.state.units[0].surprise = true;
  const parsed = parseSave(save);
  assert.ok(parsed !== undefined);
  assert.equal('extra' in parsed, false);
  assert.equal('surprise' in parsed.state.units[0]!, false);
});
