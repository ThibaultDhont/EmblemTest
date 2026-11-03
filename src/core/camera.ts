import { VIEW_COLS, VIEW_ROWS } from '../config.ts';
import type { GameState, Pos } from './types.ts';

// La caméra est la tuile de la carte affichée en haut à gauche de la vue. Elle reste entière : le défilement
// se fait tuile par tuile. Une carte plus petite que la vue est centrée, d'où des valeurs négatives.
type MapSize = Pick<GameState, 'width' | 'height'>;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const EDGE_MARGIN = 2; // tuiles gardées entre une case suivie et le bord de la vue

function clampAxis(camera: number, mapLength: number, viewLength: number): number {
  if (mapLength <= viewLength) {
    const spare = viewLength - mapLength;
    return spare > 0 ? -Math.floor(spare / 2) : 0;
  }
  return Math.min(Math.max(camera, 0), mapLength - viewLength);
}

export function clampCamera(map: MapSize, camera: Pos): Pos {
  return { x: clampAxis(camera.x, map.width, VIEW_COLS), y: clampAxis(camera.y, map.height, VIEW_ROWS) };
}

export function centerOn(map: MapSize, pos: Pos): Pos {
  return clampCamera(map, { x: pos.x - Math.floor(VIEW_COLS / 2), y: pos.y - Math.floor(VIEW_ROWS / 2) });
}

export function panBy(map: MapSize, camera: Pos, dx: number, dy: number): Pos {
  return clampCamera(map, { x: camera.x + dx, y: camera.y + dy });
}

// Décale la caméra du minimum pour garder la zone dans la vue, à `margin` tuiles du bord. Si la zone est trop
// grande pour tenir, c'est son début qui reste visible.
function revealAxis(camera: number, start: number, length: number, viewLength: number, margin: number): number {
  const first = start - margin;
  const last = start + length + margin - viewLength;
  return Math.min(Math.max(camera, last), first);
}

export function revealRect(map: MapSize, camera: Pos, rect: Rect, margin: number): Pos {
  return clampCamera(map, {
    x: revealAxis(camera.x, rect.x, rect.width, VIEW_COLS, margin),
    y: revealAxis(camera.y, rect.y, rect.height, VIEW_ROWS, margin),
  });
}

export function revealTile(map: MapSize, camera: Pos, pos: Pos): Pos {
  return revealRect(map, camera, { x: pos.x, y: pos.y, width: 1, height: 1 }, EDGE_MARGIN);
}

// La case de la carte qui se trouve sous une case de l'écran.
export function toMapTile(camera: Pos, screen: Pos): Pos {
  return { x: screen.x + camera.x, y: screen.y + camera.y };
}

// Sens de défilement (-1, 0 ou 1 par axe) quand le pointeur est sur la rangée de bord de l'écran.
export function edgeDirection(screen: Pos): Pos {
  const axis = (value: number, length: number): number => (value <= 0 ? -1 : value >= length - 1 ? 1 : 0);
  return { x: axis(screen.x, VIEW_COLS), y: axis(screen.y, VIEW_ROWS) };
}
