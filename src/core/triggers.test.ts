import assert from 'node:assert/strict';
import { test } from 'node:test';
import { takeEvents } from './dialogue.ts';
import { stateFromRows } from './grid.ts';
import { parseScript } from './script.ts';
import { arrivalTriggers, attackTrigger, selectionTrigger } from './triggers.ts';

test('les déclencheurs construits ont la forme attendue par le script', () => {
  assert.equal(selectionTrigger('anna'), 'selection(anna)');
  assert.equal(attackTrigger('e2'), 'attaque(e2)');
  assert.deepEqual(arrivalTriggers({ id: 'marc' }, { x: 6, y: 7 }), ['case(6,7)', 'case(marc,6,7)']);
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
