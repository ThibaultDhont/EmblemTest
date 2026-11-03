import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import { edgeDirection } from '../core/camera.ts';
import type { Pos } from '../core/types.ts';
import type { ActionHandler } from './actions.ts';
import { isTap, moveGesture, startGesture } from './gesture.ts';
import type { Gesture } from './gesture.ts';

const EDGE_SCROLL_MS = 150; // délai entre deux tuiles de défilement quand le pointeur reste au bord

// Souris : le pointeur suit la case survolée, le clic valide, le clic droit annule, le bord de l'écran et la molette
// font défiler. Doigt et stylet : poser place le curseur, lever sans avoir bougé valide, glisser fait défiler la carte.
export function attachPointer(canvas: HTMLCanvasElement, dispatch: ActionHandler): void {
  let hovered: Pos | null = null;
  let edgeTimer: number | undefined;
  let touch: { id: number; gesture: Gesture } | null = null; // le doigt qui joue, les autres sont ignorés

  const tileAt = (event: PointerEvent): Pos => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * VIEW_COLS);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * VIEW_ROWS);
    return { x: Math.min(VIEW_COLS - 1, Math.max(0, x)), y: Math.min(VIEW_ROWS - 1, Math.max(0, y)) };
  };

  // Tant que le pointeur reste sur la rangée de bord, la caméra avance d'une tuile à intervalle régulier.
  const scrollAtEdge = (pos: Pos | null): void => {
    window.clearInterval(edgeTimer);
    edgeTimer = undefined;
    const direction = pos === null ? { x: 0, y: 0 } : edgeDirection(pos);
    if (direction.x === 0 && direction.y === 0) return;
    edgeTimer = window.setInterval(() => dispatch({ type: 'pan', dx: direction.x, dy: direction.y }), EDGE_SCROLL_MS);
  };

  const place = (pos: Pos): void => {
    hovered = pos;
    dispatch({ type: 'pointer', pos });
  };

  const hover = (event: PointerEvent): void => {
    const pos = tileAt(event);
    if (hovered?.x === pos.x && hovered.y === pos.y) return;
    place(pos);
    scrollAtEdge(pos);
  };

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      hover(event);
    } else if (touch?.id === event.pointerId) {
      const tilePx = canvas.getBoundingClientRect().width / VIEW_COLS;
      const shift = moveGesture(touch.gesture, event.clientX, event.clientY, tilePx);
      if (shift.x !== 0 || shift.y !== 0) dispatch({ type: 'drag', dx: shift.x, dy: shift.y });
    }
  });
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    scrollAtEdge(null);
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') {
      if (event.button === 0) {
        hover(event);
        dispatch({ type: 'confirm' });
      } else if (event.button === 2) {
        dispatch({ type: 'cancel' });
      }
    } else if (touch === null && event.isPrimary) {
      touch = { id: event.pointerId, gesture: startGesture(event.clientX, event.clientY) };
      place(tileAt(event));
    }
  });
  canvas.addEventListener('pointerup', (event) => {
    if (touch?.id !== event.pointerId) return;
    const tap = isTap(touch.gesture);
    touch = null;
    if (tap) dispatch({ type: 'confirm' });
  });
  canvas.addEventListener('pointercancel', (event) => {
    if (touch?.id === event.pointerId) touch = null;
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      dispatch({ type: 'scroll', lines: Math.sign(event.deltaY) * 3, columns: Math.sign(event.deltaX) * 3 });
    },
    { passive: false },
  );
}
