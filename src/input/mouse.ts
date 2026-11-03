import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import { edgeDirection } from '../core/camera.ts';
import type { Pos } from '../core/types.ts';
import type { ActionHandler } from './actions.ts';

const EDGE_SCROLL_MS = 150; // délai entre deux tuiles de défilement quand le pointeur reste au bord

export function attachMouse(canvas: HTMLCanvasElement, dispatch: ActionHandler): void {
  let hovered: Pos | null = null;
  let edgeTimer: number | undefined;

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

  const hover = (event: PointerEvent): void => {
    const pos = tileAt(event);
    if (hovered?.x === pos.x && hovered.y === pos.y) return;
    hovered = pos;
    dispatch({ type: 'pointer', pos });
    if (event.pointerType === 'mouse') scrollAtEdge(pos);
  };

  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerleave', () => {
    hovered = null;
    scrollAtEdge(null);
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      hover(event);
      dispatch({ type: 'confirm' });
    } else if (event.button === 2) {
      dispatch({ type: 'cancel' });
    }
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
