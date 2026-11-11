import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMatcher, parseGpl, toOklab } from './palette.ts';
import type { Rgb } from './palette.ts';
import { decodePng, encodeApng } from './png.ts';
import {
  MARCHE_COTE,
  MARCHE_FACE,
  REPOS,
  buildRamp,
  buildSheet,
  composeFrame,
  layerFromImage,
  layerFromText,
  layerToImage,
  layerToText,
  mirror,
  render,
  resolveMaterial,
  sheetLayout,
  touchesEdge,
} from './sprite.ts';
import type { Config, Ramp, Zone } from './sprite.ts';

const palette = parseGpl(readFileSync('art/palette.gpl', 'utf8'));
const matcher = createMatcher(palette, 3);
const inPalette = (color: Rgb): boolean => palette.some((c) => c.every((v, i) => v === color[i]));

// Rampes repérables : chaque ton a sa propre valeur de rouge (clair 4, moyen 3, ombre 2, trait 1), la zone
// est dans le vert.
const RAMPS = new Map<Zone, Ramp>([
  ['cheveux', [[4, 10, 0], [3, 10, 0], [2, 10, 0], [1, 10, 0]]],
  ['peau', [[4, 20, 0], [3, 20, 0], [2, 20, 0], [1, 20, 0]]],
  ['metal', [[4, 30, 0], [3, 30, 0], [2, 30, 0], [1, 30, 0]]],
]);
function pixels(rows: string[]): string[] {
  const image = render(layerFromText(rows), RAMPS);
  const names: Record<number, string> = { 10: 'h', 20: 'p', 30: 'm' };
  const out: string[] = [];
  for (let y = 0; y < image.height; y++) {
    let row = '';
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * 4;
      row += (image.data[at + 3] ?? 0) < 128 ? '.' : `${names[image.data[at + 1] ?? 0] ?? '?'}${image.data[at] ?? 0}`;
    }
    out.push(row);
  }
  return out;
}

test('une pièce se lit en texte comme en image, dans la palette des zones', () => {
  const rows = ['.Hh.', 'PpqQ', 'MmnN', 'Ee..'];
  assert.deepEqual(layerToText(layerFromImage(layerToImage(layerFromText(rows)), 'test')), rows);
});

test('une couleur hors de la palette des zones est refusée avec sa position', () => {
  const image = layerToImage(layerFromText(['..', '.h']));
  image.data.set([1, 2, 3, 255], 0);
  assert.throws(() => layerFromImage(image, 'cheveux.png'), /cheveux\.png : pixel \(0, 0\) de couleur #010203/);
  assert.throws(() => layerFromText(['.Z']), /colonne 2 : lettre « Z » inconnue/);
});

test('une rampe calculée prend quatre couleurs de la palette, de la plus claire à la plus sombre', () => {
  for (const base of [[216, 90, 54], [123, 162, 74], [239, 162, 132], [164, 154, 148], [40, 87, 120]] as Rgb[]) {
    const ramp = buildRamp(base, matcher);
    assert.ok(ramp.every(inPalette), `rampe de ${base.join(',')} hors palette`);
    const lightness = ramp.map((color) => toOklab(color)[0]);
    for (let i = 1; i < 4; i++) assert.ok(lightness[i]! < lightness[i - 1]!, `rampe de ${base.join(',')} : ton ${i + 1} pas plus sombre`);
  }
});

test('une rampe imposée est ramenée sur la palette, dans l’ordre donné', () => {
  assert.deepEqual(resolveMaterial(['#f7f3f7', '#a49a94', '#525152', '#102122'], matcher), [
    [247, 243, 247],
    [164, 154, 148],
    [82, 81, 82],
    [16, 21, 34],
  ]);
  assert.throws(() => resolveMaterial(['#ffffff'], matcher), /4 couleurs attendues/);
});

test('le contour reprend le trait de la zone bordée, la plus présente autour (à égalité, la plus sombre)', () => {
  assert.deepEqual(pixels(['...', '.h.', '...']), ['.h1.', 'h1h3h1', '.h1.']);
});

test('le contour suit la zone majoritaire autour de la case vide', () => {
  // La case vide du milieu touche trois cheveux et une peau : trait des cheveux. Les tons dessinés restent.
  const out = pixels(['.....', '..h..', '.h.p.', '..h..', '.....']);
  assert.equal(out[2], 'h1h3h1p3p1');
});

test('les pièces s’empilent dans l’ordre : la suivante couvre la précédente', () => {
  const lines = { cou: 1, taille: 2, milieu: 1 };
  const under = { layer: layerFromText(['ppp', 'ppp', 'ppp']) };
  const over = { layer: layerFromText(['.h.', '...', '...']) };
  assert.deepEqual(layerToText(composeFrame([under, over], lines)), ['php', 'ppp', 'ppp']);
  assert.deepEqual(layerToText(composeFrame([over, under], lines)), ['ppp', 'ppp', 'ppp']);
});

test('au repos, tête et torse descendent d’un pixel, les jambes restent, une arme suit son groupe d’un bloc', () => {
  const lines = { cou: 2, taille: 4, milieu: 2 };
  const body = { layer: layerFromText(['.h..', '.p..', '.t..', '.t..', '.v..', '.v..', '....']) };
  const sword = { layer: layerFromText(['...m', '...m', '...m', '...m', '...m', '....', '....']), suit: 'torse' as const };
  assert.deepEqual(layerToText(composeFrame([body, sword], lines, REPOS[1])), [
    '....',
    '.h.m',
    '.p.m',
    '.t.m',
    '.t.m',
    '.v.m',
    '....',
  ]);
  // Le torse est remonté, la tête pas encore : elle recouvre le haut du torse.
  assert.deepEqual(layerToText(composeFrame([body], lines, REPOS[2])), ['....', '.h..', '.p..', '.t..', '.v..', '.v..', '....']);
});

test('marche de face : au passage, le corps monte d’un pixel et un pied se lève d’un pixel de plus', () => {
  const lines = { cou: 1, taille: 2, milieu: 2 };
  const body = { layer: layerFromText(['.hh.', '.tt.', '.vv.', '.cc.']) };
  const placement = { width: 4, height: 6, x: 0, y: 2 };
  assert.deepEqual(layerToText(composeFrame([body], lines, MARCHE_FACE[0], placement)), ['....', '....', '.hh.', '.tt.', '.vv.', '.cc.']);
  // Pied gauche levé : la botte gauche passe au-dessus de la droite.
  assert.deepEqual(layerToText(composeFrame([body], lines, MARCHE_FACE[1], placement)), ['....', '.hh.', '.tt.', '.cv.', '..c.', '....']);
  assert.deepEqual(layerToText(composeFrame([body], lines, MARCHE_FACE[3], placement)), ['....', '.hh.', '.tt.', '.vc.', '.c..', '....']);
});

test('marche de côté : jambes écartées, puis jointes avec le corps monté d’un pixel', () => {
  const lines = { cou: 2, taille: 3, milieu: 3 };
  const body = { layer: layerFromText(['......', '..h...', '..t...', '..vv..']) };
  assert.deepEqual(layerToText(composeFrame([body], lines, MARCHE_COTE[0])), ['......', '..h...', '..t...', '.v..v.']);
  assert.deepEqual(layerToText(composeFrame([body], lines, MARCHE_COTE[1])), ['..h...', '..t...', '..vv..', '......']);
});

test('la feuille : repos en 16×16 sur la première ligne, puis la marche en 32×32 vers le bas, le haut et la droite', () => {
  const layout = sheetLayout(16);
  assert.equal(layout.width, 128);
  assert.equal(layout.height, 112);
  assert.deepEqual(layout.repos[2], { x: 32, y: 0, width: 16, height: 16 });
  assert.deepEqual(layout.marche.bas?.[0], { x: 0, y: 16, width: 32, height: 32 });
  assert.deepEqual(layout.marche.droite?.[3], { x: 96, y: 80, width: 32, height: 32 });
});

test('le miroir retourne l’image de gauche à droite', () => {
  const image = layerToImage(layerFromText(['h.', 'pm']));
  assert.deepEqual(layerToText(layerFromImage(mirror(image), 'test')), ['.h', 'mp']);
});

test('l’aperçu animé est un APNG : les lecteurs ordinaires y voient la première image', () => {
  const frames = [layerToImage(layerFromText(['h'])), layerToImage(layerFromText(['p']))];
  const bytes = encodeApng(frames, [100, 200]);
  assert.deepEqual(layerToText(layerFromImage(decodePng(bytes), 'test')), ['h']);
  const text = Buffer.from(bytes).toString('latin1');
  assert.ok(text.includes('acTL') && text.includes('fdAT'));
  const control = text.indexOf('acTL') + 4;
  assert.equal(new DataView(bytes.buffer, bytes.byteOffset).getUint32(control), 2);
});

test('un sujet qui touche le bord est signalé', () => {
  assert.equal(touchesEdge(layerFromText(['...', '.h.', '...'])), false);
  assert.equal(touchesEdge(layerFromText(['...', '..h', '...'])), true);
});

test('la feuille de l’unité : repos en haut, marche dessous, pièce de face faute de variante', () => {
  const config: Config = {
    taille: 6,
    lignes: { cou: 2, taille: 4, milieu: 3 },
    materiaux: { roux: '#d85a36', acier: ['#f7f3f7', '#a49a94', '#525152', '#102122'] },
    defaut: { metal: 'acier' },
    unites: { anna: { pieces: ['corps'], couleurs: { cheveux: 'roux' } }, bob: { pieces: ['corps'], couleurs: { cheveux: 'bleu' } } },
  };
  const views: string[] = [];
  const load = (_name: string, view: string): ReturnType<typeof layerFromText> | undefined => {
    views.push(view);
    return view === 'face' ? layerFromText(['......', '.h....', '.m....', '......', '......', '......']) : undefined;
  };
  const sheet = buildSheet('anna', config, load, matcher);
  assert.equal(sheet.width, 48);
  assert.equal(sheet.height, 6 + 3 * 12);
  assert.ok(views.includes('dos') && views.includes('cote'));
  const alpha = (x: number, y: number): number => sheet.data[(y * sheet.width + x) * 4 + 3] ?? 0;
  assert.equal(alpha(1, 0), 255); // repos 1 : le contour au-dessus de la tête…
  assert.equal(alpha(6 + 1, 0), 0); // … repos 2 : la tête est descendue d'un pixel, son contour aussi
  assert.equal(alpha(6 + 1, 1), 255);
  // Marche vers le bas, image 1 (en y = 6) : la pièce est posée en bas au centre, en (3, 6) de l'image.
  assert.equal(alpha(3 + 1, 6 + 6 + 1), 255); // la tête
  assert.equal(alpha(3 + 1, 6 + 6), 255); // son contour
  assert.equal(alpha(3 + 1, 6 + 5), 0);
  assert.throws(() => buildSheet('bob', config, load, matcher), /matière « bleu »/);
});
