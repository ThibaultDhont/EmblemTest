import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import { OPTION_ROWS, TITLE_BUTTONS, inZone, optionRowAt, titleButtonAt } from './screens.ts';
import type { Zone } from './screens.ts';

function overlap(a: Zone, b: Zone): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const [name, zones] of [['titre', TITLE_BUTTONS], ['options', OPTION_ROWS]] as const) {
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
