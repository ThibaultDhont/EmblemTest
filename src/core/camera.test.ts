import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import { EDGE_MARGIN, centerOn, clampCamera, edgeDirection, panBy, revealRect, revealTile, toMapTile } from './camera.ts';

const BIG = { width: 40, height: 30 };

test('la caméra reste dans la carte', () => {
  assert.deepEqual(clampCamera(BIG, { x: -3, y: -1 }), { x: 0, y: 0 });
  assert.deepEqual(clampCamera(BIG, { x: 99, y: 99 }), { x: BIG.width - VIEW_COLS, y: BIG.height - VIEW_ROWS });
  assert.deepEqual(clampCamera(BIG, { x: 5, y: 7 }), { x: 5, y: 7 });
});

test('une carte plus petite que la vue est centrée, quelle que soit la caméra demandée', () => {
  const small = { width: VIEW_COLS - 4, height: VIEW_ROWS - 3 };
  assert.deepEqual(clampCamera(small, { x: 0, y: 0 }), { x: -2, y: -1 });
  assert.deepEqual(clampCamera(small, { x: 8, y: 8 }), { x: -2, y: -1 });
  assert.deepEqual(clampCamera({ width: VIEW_COLS, height: VIEW_ROWS }, { x: 5, y: 5 }), { x: 0, y: 0 });
});

test('centerOn place la case au milieu de la vue, sans sortir de la carte', () => {
  assert.deepEqual(centerOn(BIG, { x: 20, y: 15 }), { x: 20 - VIEW_COLS / 2, y: 15 - VIEW_ROWS / 2 });
  assert.deepEqual(centerOn(BIG, { x: 1, y: 1 }), { x: 0, y: 0 });
  assert.deepEqual(centerOn(BIG, { x: 39, y: 29 }), { x: BIG.width - VIEW_COLS, y: BIG.height - VIEW_ROWS });
});

test('panBy avance d\'une tuile et s\'arrête aux limites', () => {
  assert.deepEqual(panBy(BIG, { x: 4, y: 4 }, 1, -1), { x: 5, y: 3 });
  assert.deepEqual(panBy(BIG, { x: 0, y: 0 }, -1, -1), { x: 0, y: 0 });
  assert.deepEqual(panBy(BIG, { x: BIG.width - VIEW_COLS, y: 0 }, 1, 0), { x: BIG.width - VIEW_COLS, y: 0 });
});

test('revealTile : rien ne bouge tant que la case reste à distance du bord', () => {
  const camera = { x: 10, y: 10 };
  assert.deepEqual(revealTile(BIG, camera, { x: 10 + EDGE_MARGIN, y: 10 + EDGE_MARGIN }), camera);
  assert.deepEqual(revealTile(BIG, camera, { x: 10 + VIEW_COLS - 1 - EDGE_MARGIN, y: 10 + VIEW_ROWS - 1 - EDGE_MARGIN }), camera);
});

test('revealTile : décale du minimum quand la case approche ou dépasse le bord', () => {
  const camera = { x: 10, y: 10 };
  assert.deepEqual(revealTile(BIG, camera, { x: 10 + VIEW_COLS - EDGE_MARGIN, y: 12 }), { x: 11, y: 10 }); // à droite
  assert.deepEqual(revealTile(BIG, camera, { x: 10 + VIEW_COLS + 3, y: 12 }), { x: 37 - (VIEW_COLS - 1 - EDGE_MARGIN), y: 10 }); // loin à droite : la case finit à 2 tuiles du bord
  assert.deepEqual(revealTile(BIG, camera, { x: 14, y: 10 + 1 }), { x: 10, y: 9 }); // en haut
  assert.deepEqual(revealTile(BIG, camera, { x: 8, y: 20 }), { x: 6, y: 10 }); // à gauche
});

test('revealTile : borné à la carte', () => {
  assert.deepEqual(revealTile(BIG, { x: 0, y: 0 }, { x: 0, y: 0 }), { x: 0, y: 0 });
  const far = revealTile(BIG, { x: 0, y: 0 }, { x: 39, y: 29 });
  assert.deepEqual(far, { x: BIG.width - VIEW_COLS, y: BIG.height - VIEW_ROWS });
});

test('revealRect : une zone entière est ramenée dans la vue, son début d\'abord si elle est trop grande', () => {
  const menu = { x: 30, y: 12, width: 5, height: 3 };
  assert.deepEqual(revealRect(BIG, { x: 0, y: 0 }, menu, 1), { x: 36 - VIEW_COLS, y: 0 });
  assert.deepEqual(revealRect(BIG, { x: 16, y: 0 }, menu, 1), { x: 16, y: 0 }); // déjà visible
  const huge = { x: 5, y: 5, width: 100, height: 100 };
  assert.deepEqual(revealRect({ width: 200, height: 200 }, { x: 50, y: 50 }, huge, 0), { x: 5, y: 5 });
});

test('toMapTile ajoute la caméra à la case de l\'écran', () => {
  assert.deepEqual(toMapTile({ x: 8, y: 2 }, { x: 3, y: 5 }), { x: 11, y: 7 });
  assert.deepEqual(toMapTile({ x: -2, y: -1 }, { x: 2, y: 1 }), { x: 0, y: 0 });
});

test('edgeDirection : défilement seulement sur la rangée de bord', () => {
  assert.deepEqual(edgeDirection({ x: 5, y: 5 }), { x: 0, y: 0 });
  assert.deepEqual(edgeDirection({ x: 0, y: 5 }), { x: -1, y: 0 });
  assert.deepEqual(edgeDirection({ x: VIEW_COLS - 1, y: 5 }), { x: 1, y: 0 });
  assert.deepEqual(edgeDirection({ x: 5, y: 0 }), { x: 0, y: -1 });
  assert.deepEqual(edgeDirection({ x: 5, y: VIEW_ROWS - 1 }), { x: 0, y: 1 });
  assert.deepEqual(edgeDirection({ x: 0, y: VIEW_ROWS - 1 }), { x: -1, y: 1 });
});
