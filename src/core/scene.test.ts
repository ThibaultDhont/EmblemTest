import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextLine, startScene, takeEvents } from './scene.ts';
import { parseScript } from './script.ts';
import { stateFromRows } from './grid.ts';

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

function sceneOf(id: string, text = SCRIPT) {
  const event = parseScript(text).find((candidate) => candidate.id === id);
  assert.ok(event !== undefined);
  return startScene(event);
}

test('les répliques arrivent dans l\'ordre, avec les portraits visibles à ce moment', () => {
  const runner = sceneOf('intro');
  const both = [
    { who: 'anna', side: 'gauche' },
    { who: 'marc', side: 'droite' },
  ];
  assert.deepEqual(nextLine(runner), { speaker: 'anna', key: 'a.1', cast: both });
  assert.deepEqual(nextLine(runner), { speaker: 'marc', key: 'a.2', cast: both });
  assert.deepEqual(nextLine(runner), { speaker: 'anna', key: 'a.3', cast: [{ who: 'anna', side: 'gauche' }] });
  assert.equal(nextLine(runner), null);
  assert.equal(nextLine(runner), null);
});

test('la liste de portraits d\'une réplique n\'est pas modifiée par la suite', () => {
  const runner = sceneOf('intro');
  const first = nextLine(runner);
  nextLine(runner);
  nextLine(runner);
  assert.equal(first?.cast.length, 2);
});

test('montrer à nouveau un personnage le déplace de côté', () => {
  const runner = sceneOf(
    'a',
    `@event a quand chapitre.debut
       @montre anna gauche
       @montre anna droite
       anna: x.1`,
  );
  assert.deepEqual(nextLine(runner)?.cast, [{ who: 'anna', side: 'droite' }]);
});

test('au-delà de 3 portraits sur un côté, le plus ancien disparaît', () => {
  const runner = sceneOf(
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
    nextLine(runner)?.cast.map((portrait) => portrait.who),
    ['p2', 'p3', 'p4', 'q1'],
  );
});

test('un événement vide n\'a aucune réplique', () => {
  const runner = sceneOf('a', '@event a quand chapitre.debut\n  @montre anna gauche');
  assert.equal(nextLine(runner), null);
});

test('takeEvents rend les événements du déclencheur, une seule fois', () => {
  const state = stateFromRows(['..'], []);
  const events = parseScript(SCRIPT);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut').map((event) => event.id), ['intro']);
  assert.deepEqual(state.fired, ['intro']);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.defaite'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.victoire').map((event) => event.id), ['fin']);
});
