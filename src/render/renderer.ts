import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../config.ts';
import { tilesInRange } from '../core/combat.ts';
import { posOf } from '../core/grid.ts';
import type { UiState } from '../core/selection.ts';
import type { ClassId, GameState, Pos, TerrainId, Team, Unit } from '../core/types.ts';
import { drawForecast, drawHud, drawInfoPanel, drawMenu } from './panels.ts';

// Effets ponctuels pendant la lecture d'un combat.
export interface Effects {
  flashId: string | null; // unité qui clignote en blanc
  popup: { pos: Pos; text: string; color: string } | null; // dégâts affichés au-dessus d'une case
}

export interface Renderer {
  draw(state: GameState, ui: UiState, fx: Effects): void;
}

// Placeholders : rectangles pleins uniquement, pour rester nets une fois agrandis.
const TEAM_COLOR: Record<Team, string> = { player: '#2b59c3', enemy: '#c33b2b' };
const CLASS_MARK: Record<ClassId, string> = {
  swordsman: '#f5f5f5',
  lancer: '#f2d04b',
  archer: '#8fe08f',
  fighter: '#e08a3c',
};

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Contexte canvas 2D indisponible');

  // Agrandit le canvas par un multiple entier de pixels écran, pour garder des pixels réguliers.
  const fit = (): void => {
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.max(
      1,
      Math.floor(Math.min((window.innerWidth * ratio) / SCREEN_WIDTH, (window.innerHeight * ratio) / SCREEN_HEIGHT)),
    );
    canvas.style.width = `${(SCREEN_WIDTH * scale) / ratio}px`;
    canvas.style.height = `${(SCREEN_HEIGHT * scale) / ratio}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  return {
    draw(state, ui, fx) {
      for (let index = 0; index < state.tiles.length; index++) {
        const pos = posOf(state, index);
        drawTerrain(ctx, state.tiles[index] ?? 'plain', pos.x * TILE_SIZE, pos.y * TILE_SIZE);
      }

      drawOverlay(ctx, state, ui.reachable.keys(), 'rgba(80, 160, 255, 0.5)');
      const selected = state.units.find((unit) => unit.id === ui.selectedId);
      if (ui.mode === 'target' && selected !== undefined) {
        drawOverlay(ctx, state, tilesInRange(state, selected), 'rgba(230, 50, 50, 0.55)');
      }

      for (const unit of state.units) drawUnit(ctx, unit, fx.flashId === unit.id);
      drawCursor(ctx, ui);
      drawPopup(ctx, fx);

      drawHud(ctx, state);
      if (ui.mode === 'idle' || ui.mode === 'move') drawInfoPanel(ctx, state, ui);
      if (ui.menu !== null) drawMenu(ctx, ui, ui.menu);
      if (ui.mode === 'target') drawForecast(ctx, state, ui);
    },
  };
}

function drawTerrain(ctx: CanvasRenderingContext2D, terrain: TerrainId, x: number, y: number): void {
  switch (terrain) {
    case 'plain':
      ctx.fillStyle = '#7fbf5a';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#74b350';
      ctx.fillRect(x + 3, y + 4, 1, 1);
      ctx.fillRect(x + 10, y + 11, 1, 1);
      break;
    case 'forest':
      ctx.fillStyle = '#4f9a47';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#2f6b34';
      ctx.fillRect(x + 2, y + 3, 6, 6);
      ctx.fillRect(x + 9, y + 7, 5, 5);
      break;
    case 'mountain':
      ctx.fillStyle = '#8d8a7a';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#5b5648';
      ctx.fillRect(x + 7, y + 3, 2, 2);
      ctx.fillRect(x + 5, y + 5, 6, 2);
      ctx.fillRect(x + 3, y + 7, 10, 3);
      ctx.fillRect(x + 1, y + 10, 14, 4);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(x + 7, y + 3, 2, 1);
      break;
    case 'wall':
      ctx.fillStyle = '#4a4f5c';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#2e323c';
      ctx.fillRect(x, y + 5, TILE_SIZE, 1);
      ctx.fillRect(x, y + 10, TILE_SIZE, 1);
      ctx.fillRect(x + 8, y, 1, 5);
      ctx.fillRect(x + 4, y + 6, 1, 4);
      ctx.fillRect(x + 12, y + 6, 1, 4);
      ctx.fillRect(x + 8, y + 11, 1, 5);
      break;
  }
  // Quadrillage discret pour repérer les cases.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState, indices: Iterable<number>, color: string): void {
  ctx.fillStyle = color;
  for (const index of indices) {
    const pos = posOf(state, index);
    ctx.fillRect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, flashing: boolean): void {
  const x = unit.pos.x * TILE_SIZE;
  const y = unit.pos.y * TILE_SIZE;
  ctx.fillStyle = '#101010';
  ctx.fillRect(x + 1, y + 1, 14, 11);
  ctx.fillStyle = TEAM_COLOR[unit.team];
  ctx.fillRect(x + 2, y + 2, 12, 9);
  ctx.fillStyle = CLASS_MARK[unit.classId];
  ctx.fillRect(x + 6, y + 4, 4, 4);
  if (unit.acted) {
    ctx.fillStyle = 'rgba(90, 90, 90, 0.65)';
    ctx.fillRect(x + 2, y + 2, 12, 9);
  }

  // Barre de PV : verte, puis jaune sous 50 %, rouge sous 25 %.
  const ratio = unit.hp / unit.stats.maxHp;
  ctx.fillStyle = '#101010';
  ctx.fillRect(x + 1, y + 12, 14, 3);
  ctx.fillStyle = ratio > 0.5 ? '#4cd04c' : ratio > 0.25 ? '#e0c030' : '#e04040';
  ctx.fillRect(x + 2, y + 13, Math.max(unit.hp > 0 ? 1 : 0, Math.round(12 * ratio)), 1);

  if (flashing) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, ui: UiState): void {
  const x = ui.cursor.x * TILE_SIZE;
  const y = ui.cursor.y * TILE_SIZE;
  ctx.fillStyle = '#ffe14d';
  ctx.fillRect(x, y, TILE_SIZE, 1);
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
  ctx.fillRect(x, y, 1, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
}

// Dégâts au-dessus de la case (en dessous sur la première ligne, faute de place).
function drawPopup(ctx: CanvasRenderingContext2D, fx: Effects): void {
  if (fx.popup === null) return;
  const x = fx.popup.pos.x * TILE_SIZE + TILE_SIZE / 2;
  const top = fx.popup.pos.y * TILE_SIZE;
  const y = top >= TILE_SIZE ? top : top + TILE_SIZE + 10;
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#101010';
  ctx.strokeText(fx.popup.text, x, y);
  ctx.fillStyle = fx.popup.color;
  ctx.fillText(fx.popup.text, x, y);
}
