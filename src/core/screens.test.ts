import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import { CONFIRM_BUTTONS, OPTION_ROWS, SLOT_ROWS, TITLE_BUTTONS, canPickSlot, confirmButtonAt, inZone, optionRowAt, slotRowAt, titleButtonAt } from './screens.ts';
import { createSave } from './save.ts';
import type { SlotRead } from './save.ts';
import { createChapter1 } from '../data/chapter1.ts';
import type { Zone } from './screens.ts';

function overlap(a: Zone, b: Zone): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const [name, zones] of [
  ['titre', TITLE_BUTTONS],
  ['options', OPTION_ROWS],
  ['emplacements', SLOT_ROWS],
  ['confirmation', CONFIRM_BUTTONS],
] as const) {
  const list: Zone[] = Object.values(zones);

  test(`écran ${name} : chaque zone tient dans l'écran`, () => {
    for (const zone of list) {
      assert.ok(zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= VIEW_COLS && zone.y + zone.height <= VIEW_ROWS);
    }
  });

  test(`écran ${name} : aucune zone n'en recouvre une autre`, () => {
    list.forEach((zone, index) => {
      for (const other of list.slice(index + 1)) assert.equal(overlap(zone, other), false);
    });
  });
}

test('inZone : les bords haut et gauche sont dedans, les bords bas et droit dehors', () => {
  const zone = { x: 2, y: 3, width: 4, height: 2 };
  assert.equal(inZone(zone, { x: 2, y: 3 }), true);
  assert.equal(inZone(zone, { x: 5, y: 4 }), true);
  assert.equal(inZone(zone, { x: 6, y: 4 }), false);
  assert.equal(inZone(zone, { x: 5, y: 5 }), false);
  assert.equal(inZone(zone, { x: 1, y: 3 }), false);
});

test("titleButtonAt et optionRowAt trouvent la zone touchée, et rien entre les zones", () => {
  const { new: newGame, options } = TITLE_BUTTONS;
  assert.equal(titleButtonAt({ x: newGame.x, y: newGame.y + 1 }), 'new');
  assert.equal(titleButtonAt({ x: options.x + options.width - 1, y: options.y }), 'options');
  assert.equal(titleButtonAt({ x: 0, y: 0 }), undefined);
  assert.equal(titleButtonAt({ x: newGame.x, y: newGame.y + newGame.height }), undefined);

  assert.equal(optionRowAt({ x: 10, y: OPTION_ROWS.textSpeed.y }), 'textSpeed');
  assert.equal(optionRowAt({ x: 10, y: OPTION_ROWS.language.y + 1 }), 'language');
  assert.equal(optionRowAt({ x: OPTION_ROWS.back.x, y: OPTION_ROWS.back.y }), 'back');
  assert.equal(optionRowAt({ x: 10, y: OPTION_ROWS.textSpeed.y + OPTION_ROWS.textSpeed.height }), undefined);
});

test('slotRowAt et confirmButtonAt trouvent la zone touchée', () => {
  assert.equal(slotRowAt({ x: SLOT_ROWS.auto.x, y: SLOT_ROWS.auto.y }), 'auto');
  assert.equal(slotRowAt({ x: 10, y: SLOT_ROWS.manual2.y + 1 }), 'manual2');
  assert.equal(slotRowAt({ x: 10, y: SLOT_ROWS.manual3.y }), 'manual3');
  assert.equal(slotRowAt({ x: SLOT_ROWS.back.x, y: SLOT_ROWS.back.y }), 'back');
  assert.equal(slotRowAt({ x: 10, y: SLOT_ROWS.auto.y + SLOT_ROWS.auto.height }), undefined); // entre deux lignes
  assert.equal(confirmButtonAt({ x: CONFIRM_BUTTONS.yes.x, y: CONFIRM_BUTTONS.yes.y }), 'yes');
  assert.equal(confirmButtonAt({ x: CONFIRM_BUTTONS.no.x + 1, y: CONFIRM_BUTTONS.no.y + 1 }), 'no');
  assert.equal(confirmButtonAt({ x: 0, y: 0 }), undefined);
  assert.equal(titleButtonAt({ x: TITLE_BUTTONS.continue.x, y: TITLE_BUTTONS.continue.y }), 'continue');
});

test('canPickSlot : on charge ce qui est lisible, on enregistre sur un emplacement manuel quel que soit son contenu', () => {
  const ok: SlotRead = { kind: 'ok', save: createSave('chapter1', createChapter1(), []) };
  const empty: SlotRead = { kind: 'empty' };
  const broken: SlotRead = { kind: 'broken' };

  assert.equal(canPickSlot('load', 'manual1', ok), true);
  assert.equal(canPickSlot('load', 'auto', ok), true);
  assert.equal(canPickSlot('load', 'manual1', empty), false);
  assert.equal(canPickSlot('load', 'manual1', broken), false);

  for (const read of [ok, empty, broken]) assert.equal(canPickSlot('save', 'manual2', read), true);
  assert.equal(canPickSlot('save', 'auto', ok), false);
  assert.equal(canPickSlot('save', 'auto', empty), false);
});
