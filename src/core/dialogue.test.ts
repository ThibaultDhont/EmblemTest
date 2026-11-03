import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holds, nextLine, startDialogue, takeEvents } from './dialogue.ts';
import { stateFromRows } from './grid.ts';
import { parseScript } from './script.ts';
import type { Condition } from './script.ts';
import { makeUnit } from './test-helpers.ts';
import type { GameState } from './types.ts';

const SCRIPT = `
@event intro quand chapitre.debut
  @montre anna gauche
  @montre marc droite
  anna: a.1
  marc: a.2
  @cache marc
  anna: a.3

@event fin quand chapitre.victoire
  anna: b.1
`;

const emptyState = () => stateFromRows(['..'], []);

function start(id: string, text = SCRIPT, state: GameState = emptyState()) {
  const event = parseScript(text).find((candidate) => candidate.id === id);
  assert.ok(event !== undefined);
  return { runner: startDialogue(event), state };
}

// Les clés des répliques jouées, dans l'ordre.
function keysOf(text: string, state: GameState): string[] {
  const { runner } = start('a', text, state);
  const keys: string[] = [];
  for (let line = nextLine(runner, state); line !== null; line = nextLine(runner, state)) keys.push(line.key);
  return keys;
}

test("les répliques arrivent dans l'ordre, avec les portraits visibles à ce moment", () => {
  const { runner, state } = start('intro');
  const both = [
    { who: 'anna', side: 'gauche' },
    { who: 'marc', side: 'droite' },
  ];
  assert.deepEqual(nextLine(runner, state), { speaker: 'anna', key: 'a.1', cast: both });
  assert.deepEqual(nextLine(runner, state), { speaker: 'marc', key: 'a.2', cast: both });
  assert.deepEqual(nextLine(runner, state), { speaker: 'anna', key: 'a.3', cast: [{ who: 'anna', side: 'gauche' }] });
  assert.equal(nextLine(runner, state), null);
  assert.equal(nextLine(runner, state), null);
});

test("la liste de portraits d'une réplique n'est pas modifiée par la suite", () => {
  const { runner, state } = start('intro');
  const first = nextLine(runner, state);
  nextLine(runner, state);
  nextLine(runner, state);
  assert.equal(first?.cast.length, 2);
});

test('montrer à nouveau un personnage le déplace de côté', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       @montre anna gauche
       @montre anna droite
       anna: x.1`,
  );
  assert.deepEqual(nextLine(runner, state)?.cast, [{ who: 'anna', side: 'droite' }]);
});

test('au-delà de 3 portraits sur un côté, le plus ancien disparaît', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       @montre p1 gauche
       @montre p2 gauche
       @montre p3 gauche
       @montre p4 gauche
       @montre q1 droite
       p4: x.1`,
  );
  assert.deepEqual(
    nextLine(runner, state)?.cast.map((portrait) => portrait.who),
    ['p2', 'p3', 'p4', 'q1'],
  );
});

test("un événement vide n'a aucune réplique", () => {
  const { runner, state } = start('a', '@event a quand chapitre.debut\n  @montre anna gauche');
  assert.equal(nextLine(runner, state), null);
});

test('takeEvents rend les événements du déclencheur, une seule fois', () => {
  const state = emptyState();
  const events = parseScript(SCRIPT);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut').map((event) => event.id), ['intro']);
  assert.deepEqual(state.fired, ['intro']);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.defaite'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.victoire').map((event) => event.id), ['fin']);
});

test('takeEvents distingue les déclencheurs à paramètre', () => {
  const state = emptyState();
  const events = parseScript(`
    @event t2 quand tour.joueur(2)
      anna: x.1
    @event t3 quand tour.joueur(3)
      anna: x.2
    @event m quand mort(brutus)
      anna: x.3
  `);
  assert.deepEqual(takeEvents(events, state, 'tour.joueur(3)').map((event) => event.id), ['t3']);
  assert.deepEqual(takeEvents(events, state, 'tour.ennemi(3)'), []);
  assert.deepEqual(takeEvents(events, state, 'mort(brutus)').map((event) => event.id), ['m']);
});

test('holds évalue vivant, mort, drapeau, tour et non', () => {
  const state = stateFromRows(['..'], [makeUnit({ id: 'anna' })]);
  state.turn = 3;
  state.flags.push('route-b');
  const check = (condition: Condition) => holds(condition, state);

  assert.equal(check({ type: 'alive', unit: 'anna' }), true);
  assert.equal(check({ type: 'alive', unit: 'marc' }), false);
  assert.equal(check({ type: 'dead', unit: 'marc' }), true);
  assert.equal(check({ type: 'dead', unit: 'anna' }), false);
  assert.equal(check({ type: 'flag', name: 'route-b' }), true);
  assert.equal(check({ type: 'flag', name: 'autre' }), false);
  assert.equal(check({ type: 'not', condition: { type: 'dead', unit: 'marc' } }), false);
  for (const [op, value, expected] of [
    ['==', 3, true],
    ['>=', 3, true],
    ['>=', 4, false],
    ['<=', 2, false],
    ['>', 2, true],
    ['<', 3, false],
  ] as const) {
    assert.equal(check({ type: 'turn', op, value }), expected, `tour ${op} ${value}`);
  }
});

test('@si choisit la branche selon l\'état de la partie', () => {
  const script = `
    @event a quand chapitre.debut
      @si vivant(anna)
        anna: x.vivante
      @sinon
        anna: x.morte
      @fin
      anna: x.apres`;
  assert.deepEqual(keysOf(script, stateFromRows(['..'], [makeUnit({ id: 'anna' })])), ['x.vivante', 'x.apres']);
  assert.deepEqual(keysOf(script, emptyState()), ['x.morte', 'x.apres']);
});

test('un @si sans @sinon ne dit rien quand la condition est fausse', () => {
  const script = `
    @event a quand chapitre.debut
      @si tour >= 5
        anna: x.tard
      @fin
      anna: x.toujours`;
  assert.deepEqual(keysOf(script, emptyState()), ['x.toujours']);
});

test('les blocs @si imbriqués se lisent de l\'intérieur vers l\'extérieur', () => {
  const script = `
    @event a quand chapitre.debut
      @si drapeau(a)
        @si non drapeau(b)
          anna: x.a-sans-b
        @sinon
          anna: x.a-et-b
        @fin
        anna: x.a
      @fin
      anna: x.fin`;
  const withFlags = (...flags: string[]) => {
    const state = emptyState();
    state.flags.push(...flags);
    return state;
  };
  assert.deepEqual(keysOf(script, withFlags()), ['x.fin']);
  assert.deepEqual(keysOf(script, withFlags('a')), ['x.a-sans-b', 'x.a', 'x.fin']);
  assert.deepEqual(keysOf(script, withFlags('a', 'b')), ['x.a-et-b', 'x.a', 'x.fin']);
});

test('@drapeau et @efface modifient l\'état et sont lus par les @si qui suivent', () => {
  const script = `
    @event a quand chapitre.debut
      @drapeau vu
      @si drapeau(vu)
        anna: x.1
      @fin
      @efface vu
      @si drapeau(vu)
        anna: x.2
      @fin`;
  const state = emptyState();
  assert.deepEqual(keysOf(script, state), ['x.1']);
  assert.deepEqual(state.flags, []);

  const flagged = emptyState();
  keysOf('@event a quand chapitre.debut\n  @drapeau route-b\n  @drapeau route-b', flagged);
  assert.deepEqual(flagged.flags, ['route-b']); // poser deux fois ne duplique pas
});
