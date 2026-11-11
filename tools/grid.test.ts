import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectPeriod, edgeProfiles, gridCuts, sampleGrid } from './grid.ts';
import { createMatcher } from './palette.ts';
import type { Rgb } from './palette.ts';
import { createImage } from './png.ts';
import type { Image } from './png.ts';

const PALETTE: Rgb[] = [
  [200, 40, 40],
  [40, 160, 60],
  [30, 40, 120],
  [250, 250, 250],
];
const matcher = createMatcher(PALETTE);

// Petit dessin de 12×10 vrais pixels, deux voisins n'ayant jamais la même couleur.
function native(): Image {
  const image = createImage(12, 10);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 12; x++) image.data.set([...(PALETTE[(x + 2 * y) % 4] ?? [0, 0, 0]), 255], (y * 12 + x) * 4);
  }
  return image;
}

const bounds = (sizes: number[]): number[] => sizes.reduce((cuts, size) => [...cuts, (cuts[cuts.length - 1] ?? 0) + size], [0]);

// Le même dessin « façon IA » : chaque pixel devient un carré de 7 à 9 px, irrégulier comme ceux du modèle.
const WIDTHS = Array.from({ length: 12 }, (_, i) => [7, 8, 9, 8][i % 4] ?? 8);
const HEIGHTS = Array.from({ length: 10 }, (_, i) => [8, 7, 9, 8][i % 4] ?? 8);
function blownUp(): Image {
  const small = native();
  const columns = bounds(WIDTHS);
  const rows = bounds(HEIGHTS);
  const image = createImage(columns[columns.length - 1] ?? 0, rows[rows.length - 1] ?? 0);
  for (let y = 0; y < image.height; y++) {
    const cy = rows.findIndex((top, i) => y >= top && y < (rows[i + 1] ?? Infinity));
    for (let x = 0; x < image.width; x++) {
      const cx = columns.findIndex((left, i) => x >= left && x < (columns[i + 1] ?? Infinity));
      const from = (cy * small.width + cx) * 4;
      image.data.set(small.data.subarray(from, from + 4), (y * image.width + x) * 4);
    }
  }
  return image;
}

test('la taille moyenne des gros pixels est retrouvée malgré leur irrégularité', () => {
  const { columns, rows } = edgeProfiles(blownUp());
  assert.ok(Math.abs(detectPeriod([columns]) - 8) < 0.6, `colonnes : ${detectPeriod([columns])}`);
  assert.ok(Math.abs(detectPeriod([rows]) - 8) < 0.6, `lignes : ${detectPeriod([rows])}`);
  assert.ok(Math.abs(detectPeriod([columns, rows]) - 8) < 0.6, 'les deux sens ensemble : une seule taille');
});

test('les coupes suivent les vrais bords, pas une grille fixe', () => {
  const { columns, rows } = edgeProfiles(blownUp());
  assert.deepEqual(gridCuts(columns, detectPeriod([columns])), bounds(WIDTHS));
  assert.deepEqual(gridCuts(rows, detectPeriod([rows])), bounds(HEIGHTS));
});

test('chaque case redevient un pixel : on retrouve le dessin d’origine à l’identique', () => {
  const image = blownUp();
  const { columns, rows } = edgeProfiles(image);
  const result = sampleGrid(image, gridCuts(columns, detectPeriod([columns])), gridCuts(rows, detectPeriod([rows])), matcher);
  assert.deepEqual(result, native());
});

test('une image unie n’a pas de grille', () => {
  const flat = createImage(64, 64);
  flat.data.fill(200);
  assert.ok(Number.isNaN(detectPeriod([edgeProfiles(flat).columns])));
});

test('avec plus de poids sur la teinte, un roux reste roux plutôt que de virer au rose', () => {
  // Rose (même clarté, autre teinte) contre rouille (un peu plus sombre, même teinte).
  const roux: Rgb = [181, 86, 73];
  const choices: Rgb[] = [
    [198, 97, 107], // rose
    [160, 70, 40], // rouille
  ];
  assert.equal(createMatcher(choices, 1).nearest(roux), 0);
  assert.equal(createMatcher(choices, 2).nearest(roux), 1);
});
