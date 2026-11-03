import assert from 'node:assert/strict';
import { test } from 'node:test';
import { takeEvents } from './dialogue.ts';
import { stateFromRows } from './grid.ts';
import { parseScript } from './script.ts';
import { makeUnit } from './test-helpers.ts';
import { arrivalTriggers, attackTrigger, selectionTrigger, talkPartners, talkTrigger } from './triggers.ts';

test('les déclencheurs construits ont la forme attendue par le script', () => {
  assert.equal(selectionTrigger('anna'), 'selection(anna)');
  assert.equal(attackTrigger('e2'), 'attaque(e2)');
  assert.deepEqual(arrivalTriggers({ id: 'marc' }, { x: 6, y: 7 }), ['case(6,7)', 'case(marc,6,7)']);
});

test('talkTrigger a la forme attendue par le script', () => {
  assert.equal(talkTrigger('anna', 'gus'), 'parler(anna,gus)');
});

test("talkPartners : voisins directs seulement, avec un événement non joué, dans le sens de l'unité", () => {
  const events = parseScript(`
    @event a quand parler(anna,marc)
      anna: x.1
    @event b quand parler(anna,diagonal)
      anna: x.2
    @event c quand parler(anna,loin)
      anna: x.3
    @event d quand parler(marc,anna)
      anna: x.4
    @event e quand parler(anna,sans-evenement-ici)
      anna: x.5
  `);
  const anna = makeUnit({ id: 'anna', pos: { x: 1, y: 1 } });
  const state = stateFromRows(['........', '........', '........'], [
    anna,
    makeUnit({ id: 'marc', pos: { x: 1, y: 2 } }), // voisin direct
    makeUnit({ id: 'diagonal', team: 'enemy', pos: { x: 2, y: 2 } }), // en diagonale : trop loin
    makeUnit({ id: 'loin', pos: { x: 6, y: 0 } }),
    makeUnit({ id: 'voisin-muet', pos: { x: 0, y: 1 } }), // voisin, mais aucun événement
  ]);
  const ids = (unit = anna) => talkPartners(state, unit, events).map((partner) => partner.id);

  assert.deepEqual(ids(), ['marc']);
  assert.deepEqual(ids(state.units[1]), ['anna']); // le sens inverse a son propre événement (d)

  state.fired.push('a');
  assert.deepEqual(ids(), []); // la conversation a déjà eu lieu
});

test('ils retrouvent les événements du script correspondants, une seule fois', () => {
  const events = parseScript(`
    @event a quand selection(anna)
      anna: x.1
    @event b quand attaque(e2)
      anna: x.2
    @event c quand case(6,7)
      anna: x.3
    @event d quand case(marc,6,7)
      anna: x.4
  `);
  const state = stateFromRows(['..'], []);
  const ids = (triggers: ReturnType<typeof arrivalTriggers>) =>
    triggers.flatMap((trigger) => takeEvents(events, state, trigger).map((event) => event.id));

  assert.deepEqual(ids([selectionTrigger('anna')]), ['a']);
  assert.deepEqual(ids([selectionTrigger('marc')]), []);
  assert.deepEqual(ids([attackTrigger('e2')]), ['b']);
  assert.deepEqual(ids(arrivalTriggers({ id: 'anna' }, { x: 6, y: 7 })), ['c']); // pas d'événement propre à Anna
  assert.deepEqual(ids(arrivalTriggers({ id: 'marc' }, { x: 6, y: 7 })), ['d']); // « c » est déjà joué
  assert.deepEqual(ids([selectionTrigger('anna')]), []); // une seule fois
});
