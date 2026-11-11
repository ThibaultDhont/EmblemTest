import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNamedFile, parseTileFile, pickVariant } from './variants.ts';

test('un nom de tuile donne le terrain et le numéro de variante', () => {
  assert.deepEqual(parseTileFile('tile_plain_1.png'), { terrain: 'plain', variant: 1 });
  assert.deepEqual(parseTileFile('../sprites/tile_forest_12.png'), { terrain: 'forest', variant: 12 });
  assert.deepEqual(parseTileFile('/src/sprites/tile_wall_3.png'), { terrain: 'wall', variant: 3 });
});

test('les autres fichiers sont ignorés', () => {
  assert.equal(parseTileFile('tile_lava_1.png'), undefined); // terrain inconnu
  assert.equal(parseTileFile('unit_plain_1.png'), undefined);
  assert.equal(parseTileFile('xtile_plain_1.png'), undefined);
  assert.equal(parseTileFile('tile_plain_.png'), undefined);
  assert.equal(parseTileFile('tile_plain_1.png.bak'), undefined);
  assert.equal(parseTileFile('tile_plain_(Calque 1) _0001.png'), undefined);
});

test('un sprite d\'unité ou un portrait donne son identifiant', () => {
  assert.deepEqual(parseNamedFile('../sprites/unit_anna.png'), { kind: 'unit', id: 'anna' });
  assert.deepEqual(parseNamedFile('unit_swordsman.png'), { kind: 'unit', id: 'swordsman' });
  assert.deepEqual(parseNamedFile('/src/sprites/portrait_marc.png'), { kind: 'portrait', id: 'marc' });
  assert.equal(parseNamedFile('tile_plain_1.png'), undefined);
  assert.equal(parseNamedFile('unit_.png'), undefined);
  assert.equal(parseNamedFile('portrait_anna.apercu.png'), undefined);
  assert.equal(parseNamedFile('xunit_anna.png'), undefined);
});

test('la variante d\'une case est stable et reste dans les bornes', () => {
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 32; x++) {
      const variant = pickVariant(x, y, 3);
      assert.equal(variant, pickVariant(x, y, 3));
      assert.ok(Number.isInteger(variant) && variant >= 0 && variant < 3);
    }
  }
});

test('avec une seule variante, c\'est toujours la première', () => {
  assert.equal(pickVariant(5, 7, 1), 0);
  assert.equal(pickVariant(5, 7, 0), 0);
});

test('les variantes sont réparties sans motif répétitif', () => {
  const counts = [0, 0, 0];
  let sameAsRight = 0;
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 32; x++) {
      const variant = pickVariant(x, y, 3);
      counts[variant] = (counts[variant] ?? 0) + 1;
      if (variant === pickVariant(x + 1, y, 3)) sameAsRight++;
    }
  }
  for (const count of counts) assert.ok(count > 640 * 0.2, `répartition déséquilibrée : ${counts.join(', ')}`);
  assert.ok(sameAsRight < 640 * 0.5, `trop de voisins identiques : ${sameAsRight}`);
});
