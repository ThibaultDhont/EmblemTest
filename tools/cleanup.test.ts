import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addOutline, limitColors, pad, removeSpeckles } from './cleanup.ts';
import { createMatcher } from './palette.ts';
import type { Rgb } from './palette.ts';
import { downscale } from './pixelize.ts';
import { createImage } from './png.ts';
import type { Image } from './png.ts';

// Une lettre par couleur, « . » transparent. La palette a deux rouges et deux verts (clair, sombre),
// un noir et une couleur de peau.
const COLORS: Record<string, Rgb> = {
  r: [200, 40, 40],
  R: [90, 20, 20],
  g: [40, 160, 60],
  G: [20, 70, 30],
  n: [10, 10, 10],
  p: [230, 190, 160],
};
const matcher = createMatcher(Object.values(COLORS), 3);

function draw(rows: string[]): Image {
  const image = createImage(rows[0]?.length ?? 0, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      const color = COLORS[char];
      if (color !== undefined) image.data.set([...color, 255], (y * image.width + x) * 4);
    }),
  );
  return image;
}
function read(image: Image): string[] {
  const rows: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = '';
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4;
      const pixel = [...image.data.subarray(at, at + 4)];
      const name = Object.entries(COLORS).find(([, c]) => c.every((v, i) => v === pixel[i]))?.[0];
      row += (pixel[3] ?? 0) < 128 ? '.' : (name ?? '?');
    }
    rows.push(row);
  }
  return rows;
}

test('un pixel clair isolé prend la couleur de ses voisins, un point sombre (un œil) reste', () => {
  assert.deepEqual(read(removeSpeckles(draw(['GGG', 'GpG', 'GGG']))), ['GGG', 'GGG', 'GGG']);
  assert.deepEqual(read(removeSpeckles(draw(['ppp', 'pnp', 'ppp']))), ['ppp', 'pnp', 'ppp']);
});

test('un pixel au bord du sujet n’est pas un pixel isolé', () => {
  assert.deepEqual(read(removeSpeckles(draw(['...', 'GpG', 'GGG']))), ['...', 'GpG', 'GGG']);
  assert.deepEqual(read(removeSpeckles(draw(['gp', 'gg']))), ['gp', 'gg']);
});

test('au-delà du nombre de couleurs permis, les plus rares se fondent dans les plus proches', () => {
  // r ×5, g ×3, R ×1 : avec 2 couleurs, le rouge sombre rejoint le rouge, pas le vert.
  assert.deepEqual(read(limitColors(draw(['rrrrr', 'gggR.']), 2, matcher)), ['rrrrr', 'gggr.']);
  assert.deepEqual(read(limitColors(draw(['rg']), 5, matcher)), ['rg']);
});

test('le contour sombre entoure le sujet par les côtés, pas par les coins', () => {
  assert.deepEqual(read(addOutline(draw(['...', '.r.', '...']), 'sombre', matcher)), ['.n.', 'nrn', '.n.']);
});

test('le contour teinté reprend la couleur voisine, assombrie', () => {
  assert.deepEqual(read(addOutline(draw(['...', '.r.', '...']), 'teinte', matcher)), ['.R.', 'RrR', '.R.']);
  assert.deepEqual(read(addOutline(draw(['...', '.g.', '...']), 'teinte', matcher)), ['.G.', 'GgG', '.G.']);
});

test('la marge transparente fait de la place au contour', () => {
  assert.deepEqual(read(pad(draw(['rg']), 1)), ['....', '.rg.', '....']);
});

test('un détail sombre assez grand l’emporte sur la couleur majoritaire de sa zone', () => {
  // Zone de 5×5 : 19 pixels de peau, 6 de noir (24 %).
  const zone = draw(['ppppp', 'pnnnp', 'pnnnp', 'ppppp', 'ppppp']);
  assert.deepEqual(read(downscale(zone, 1, 1, matcher, 'vote')), ['p']);
  assert.deepEqual(read(downscale(zone, 1, 1, matcher, 'vote', 0.2)), ['n']);
  assert.deepEqual(read(downscale(zone, 1, 1, matcher, 'vote', 0.3)), ['p']); // 24 % < 30 %
});
