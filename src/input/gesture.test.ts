import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TAP_SLOP_PX, isTap, moveGesture, startGesture } from './gesture.ts';

const TILE = 20;

test('un doigt qui reste dans la tolérance reste un toucher', () => {
  const gesture = startGesture(100, 100);
  assert.deepEqual(moveGesture(gesture, 100 + TAP_SLOP_PX, 100, TILE), { x: 0, y: 0 });
  assert.deepEqual(moveGesture(gesture, 97, 104, TILE), { x: 0, y: 0 });
  assert.equal(isTap(gesture), true);
});

test('au-delà de la tolérance, le geste devient un glissement', () => {
  const gesture = startGesture(100, 100);
  moveGesture(gesture, 100 + TAP_SLOP_PX + 1, 100, TILE);
  assert.equal(isTap(gesture), false);
});

test('la caméra avance en sens inverse du doigt, par tuiles entières', () => {
  const gesture = startGesture(100, 100);
  assert.deepEqual(moveGesture(gesture, 60, 100, TILE), { x: 2, y: 0 }); // 40 px vers la gauche : 2 tuiles
  assert.deepEqual(moveGesture(gesture, 50, 100, TILE), { x: 0, y: 0 }); // 10 px de plus : pas encore une tuile
  assert.deepEqual(moveGesture(gesture, 30, 100, TILE), { x: 1, y: 0 }); // le reste de la tuile s'ajoute
  assert.deepEqual(moveGesture(gesture, 80, 100, TILE), { x: -2, y: 0 }); // retour vers la droite
});

test('le glissement vertical est indépendant du horizontal', () => {
  const gesture = startGesture(100, 100);
  assert.deepEqual(moveGesture(gesture, 100, 140, TILE), { x: 0, y: -2 }); // doigt vers le bas : caméra vers le haut
  assert.deepEqual(moveGesture(gesture, 60, 140, TILE), { x: 2, y: 0 });
});

test('un glissement qui revient au point de départ ne redevient pas un toucher', () => {
  const gesture = startGesture(100, 100);
  moveGesture(gesture, 140, 100, TILE);
  moveGesture(gesture, 100, 100, TILE);
  assert.equal(isTap(gesture), false);
});
