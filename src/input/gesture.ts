import type { Pos } from '../core/types.ts';

// Geste d'un doigt : un toucher qui ne bouge pas valide, un glissement fait défiler la carte.
export const TAP_SLOP_PX = 10; // écart toléré (en pixels de la page) avant que le toucher devienne un glissement

export interface Gesture {
  startX: number;
  startY: number;
  anchorX: number; // position du doigt au dernier décalage de la caméra
  anchorY: number;
  dragging: boolean;
}

export function startGesture(x: number, y: number): Gesture {
  return { startX: x, startY: y, anchorX: x, anchorY: y, dragging: false };
}

// Tuiles entières dont la caméra doit avancer pour suivre le doigt (la carte accompagne le doigt, donc la
// caméra va en sens inverse). Le reste d'une tuile est gardé pour le mouvement suivant.
export function moveGesture(gesture: Gesture, x: number, y: number, tilePx: number): Pos {
  if (!gesture.dragging) {
    if (Math.hypot(x - gesture.startX, y - gesture.startY) <= TAP_SLOP_PX) return { x: 0, y: 0 };
    gesture.dragging = true;
  }
  const dx = Math.trunc((gesture.anchorX - x) / tilePx) + 0; // + 0 : évite -0
  const dy = Math.trunc((gesture.anchorY - y) / tilePx) + 0;
  gesture.anchorX -= dx * tilePx;
  gesture.anchorY -= dy * tilePx;
  return { x: dx, y: dy };
}

// Un glissement reste un glissement, même si le doigt revient à son point de départ.
export function isTap(gesture: Gesture): boolean {
  return !gesture.dragging;
}
