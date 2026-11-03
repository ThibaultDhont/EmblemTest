import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import type { Pos } from '../core/types.ts';
import type { ActionHandler } from './actions.ts';

export function attachMouse(canvas: HTMLCanvasElement, dispatch: ActionHandler): void {
  let hovered: Pos | null = null;

  const tileAt = (event: PointerEvent): Pos => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * VIEW_COLS);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * VIEW_ROWS);
    return { x: Math.min(VIEW_COLS - 1, Math.max(0, x)), y: Math.min(VIEW_ROWS - 1, Math.max(0, y)) };
  };

  const hover = (event: PointerEvent): void => {
    const pos = tileAt(event);
    if (hovered?.x === pos.x && hovered.y === pos.y) return;
    hovered = pos;
    dispatch({ type: 'setCursor', pos });
  };

  canvas.addEventListener('pointermove', hover);
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
      dispatch({ type: 'scroll', lines: Math.sign(event.deltaY) * 3 });
    },
    { passive: false },
  );
}
