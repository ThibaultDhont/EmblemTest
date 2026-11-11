import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMatcher, parseAse, parseGpl } from './palette.ts';
import type { Rgb } from './palette.ts';
import { composite, crop, downscale, removeBackground, subjectFrame, upscale } from './pixelize.ts';
import { createImage, decodePng, encodePng } from './png.ts';
import type { Image } from './png.ts';

// Image de test décrite par des lettres : chaque lettre est une couleur, « . » est transparent.
// La palette de test est r, g, b, w, k ; « d » (presque noir) n'en fait pas partie.
const PALETTE: Record<string, Rgb> = {
  r: [200, 40, 40],
  g: [40, 160, 60],
  b: [30, 40, 120],
  w: [250, 250, 250],
  k: [128, 128, 128],
};
const COLORS: Record<string, Rgb> = { ...PALETTE, d: [6, 6, 6] };
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
      row += pixel[3] === 0 ? '.' : (name ?? '?');
    }
    rows.push(row);
  }
  return rows;
}

const matcher = createMatcher(Object.values(PALETTE));

test('le PNG écrit se relit à l’identique', () => {
  const image = draw(['rg.', 'bw.', '..r']);
  assert.deepEqual(decodePng(encodePng(image)), image);
});

test('les tuiles du jeu se lisent', () => {
  const tile = decodePng(readFileSync('src/sprites/tile_plain_1.png'));
  assert.equal(tile.width, 16);
  assert.equal(tile.height, 16);
});

test('la palette .gpl ignore en-tête, noms de couleurs et commentaires', () => {
  const text = 'GIMP Palette\nName: test\nColumns: 2\n# commentaire\n255   0   0\tRouge\n  0 128 255\n';
  assert.deepEqual(parseGpl(text), [
    [255, 0, 0],
    [0, 128, 255],
  ]);
  assert.throws(() => parseGpl('pas une palette'));
});

test('la palette .ase est lue, avec ou sans zéro final dans les noms, groupes ignorés', () => {
  const blocks: number[][] = [];
  const name = (text: string, terminated: boolean): number[] => {
    const units = [...text].map((c) => c.charCodeAt(0)).concat(terminated ? [0] : []);
    return [units.length >> 8, units.length & 255, ...units.flatMap((u) => [u >> 8, u & 255])];
  };
  const float = (value: number): number[] => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setFloat32(0, value);
    return [...bytes];
  };
  const block = (type: number, body: number[]): void => {
    blocks.push([type >> 8, type & 255, 0, 0, body.length >> 8, body.length & 255, ...body]);
  };
  block(0xc001, name('groupe', true));
  block(0x0001, [...name('rouge', false), ...[82, 71, 66, 32], ...float(1), ...float(0), ...float(0), 0, 2]);
  block(0x0001, [...name('gris', true), ...[71, 114, 97, 121], ...float(0.5), 0, 2]);
  block(0xc002, []);
  const bytes = Uint8Array.from([65, 83, 69, 70, 0, 1, 0, 0, 0, 0, 0, blocks.length, ...blocks.flat()]);
  assert.deepEqual(parseAse(bytes), [
    [255, 0, 0],
    [128, 128, 128],
  ]);
  assert.throws(() => parseAse(Uint8Array.from([1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0])));
});

test('la palette du dépôt a 64 couleurs', () => {
  assert.equal(parseGpl(readFileSync('art/palette.gpl', 'utf8')).length, 64);
});

test('une couleur proche est ramenée sur la palette', () => {
  assert.equal(matcher.nearest([210, 50, 35]), 0); // presque r
  assert.equal(matcher.nearest([240, 245, 255]), 3); // presque w
});

test('la réduction garde la couleur majoritaire de chaque zone, sans mélange', () => {
  // Deux pixels sur trois de rouge en haut à gauche : la zone reste rouge, pas un brun moyen.
  const source = draw(['rrgg', 'rggg', 'bbww', 'bbwr']);
  assert.deepEqual(read(downscale(source, 2, 2, matcher)), ['rg', 'bw']);
});

test('en mode moyenne, une zone prend sa couleur moyenne ramenée sur la palette', () => {
  // Moitié blanc, moitié presque noir : la moyenne est le gris k ; au vote, le blanc (arrivé premier) gagne.
  const source = draw(['wd', 'dw']);
  assert.deepEqual(read(downscale(source, 1, 1, matcher, 'moyenne')), ['k']);
  assert.deepEqual(read(downscale(source, 1, 1, matcher, 'vote')), ['w']);
});

test('une zone surtout transparente devient transparente', () => {
  const source = draw(['r...', '..g.', 'rrr.', 'rr..']);
  assert.deepEqual(read(downscale(source, 2, 2, matcher)), ['..', 'r.']);
});

test('le fond uni qui touche les bords disparaît, pas la même couleur enfermée dans le sujet', () => {
  const source = draw(['wwwww', 'wrrrw', 'wrwrw', 'wrrrw', 'wwwww']);
  assert.deepEqual(read(removeBackground(source, 0.05)), ['.....', '.rrr.', '.rwr.', '.rrr.', '.....']);
});

test('le cadre automatique entoure le sujet, aux proportions demandées et centré', () => {
  const image = draw(['......', '..rr..', '..rr..', '..rr..', '......']);
  assert.deepEqual(subjectFrame(image, 1, 0), { x: 2, y: 1, width: 3, height: 3 }); // 2×3 élargi en carré (demi-pixel arrondi à droite)
  assert.deepEqual(subjectFrame(image, 2 / 3, 0), { x: 2, y: 1, width: 2, height: 3 });
  assert.deepEqual(subjectFrame(draw(['..', '..']), 1, 0), { x: 0, y: 0, width: 2, height: 2 }); // rien d'opaque
});

test('recadrage, superposition et agrandissement', () => {
  assert.deepEqual(read(crop(draw(['rgb', 'wrg', 'bwr']), { x: 1, y: 1, width: 2, height: 2 })), ['rg', 'wr']);
  assert.deepEqual(read(crop(draw(['rg']), { x: -1, y: 0, width: 2, height: 1 })), ['.r']); // hors source : transparent
  assert.deepEqual(read(composite(draw(['r.', '.b']), draw(['gg', 'gg']))), ['rg', 'gb']);
  assert.deepEqual(read(upscale(draw(['rg']), 2)), ['rrgg', 'rrgg']);
});
