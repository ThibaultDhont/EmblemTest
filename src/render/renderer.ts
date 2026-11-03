import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE, VIEW_COLS } from '../config.ts';
import { posOf, terrainAt, unitAt } from '../core/grid.ts';
import type { UiState } from '../core/selection.ts';
import type { ClassId, GameState, TerrainId, Team } from '../core/types.ts';
import { CLASSES } from '../data/classes.ts';
import { t } from '../i18n/index.ts';

export interface Renderer {
  draw(state: GameState, ui: UiState): void;
}

// Placeholders : rectangles pleins uniquement, pour rester nets une fois agrandis.
const TEAM_COLOR: Record<Team, string> = { player: '#2b59c3', enemy: '#c33b2b' };
const CLASS_MARK: Record<ClassId, string> = {
  swordsman: '#f5f5f5',
  lancer: '#f2d04b',
  archer: '#8fe08f',
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
    draw(state, ui) {
      for (let index = 0; index < state.tiles.length; index++) {
        const pos = posOf(state, index);
        drawTerrain(ctx, state.tiles[index] ?? 'plain', pos.x * TILE_SIZE, pos.y * TILE_SIZE);
      }

      ctx.fillStyle = 'rgba(80, 160, 255, 0.5)';
      for (const index of ui.reachable.keys()) {
        const pos = posOf(state, index);
        ctx.fillRect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }

      for (const unit of state.units) {
        const x = unit.pos.x * TILE_SIZE;
        const y = unit.pos.y * TILE_SIZE;
        ctx.fillStyle = '#101010';
        ctx.fillRect(x + 1, y + 1, 14, 14);
        ctx.fillStyle = TEAM_COLOR[unit.team];
        ctx.fillRect(x + 2, y + 2, 12, 12);
        ctx.fillStyle = CLASS_MARK[unit.classId];
        ctx.fillRect(x + 6, y + 6, 4, 4);
      }

      drawCursor(ctx, ui);
      drawPanel(ctx, state, ui);
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

function drawCursor(ctx: CanvasRenderingContext2D, ui: UiState): void {
  const x = ui.cursor.x * TILE_SIZE;
  const y = ui.cursor.y * TILE_SIZE;
  ctx.fillStyle = '#ffe14d';
  ctx.fillRect(x, y, TILE_SIZE, 1);
  ctx.fillRect(x, y + TILE_SIZE - 1, TILE_SIZE, 1);
  ctx.fillRect(x, y, 1, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
}

// Encadré d'infos placé dans le coin opposé au curseur, comme sur GBA.
// Le texte est antialiasé : une police bitmap viendra avec les vrais assets.
function drawPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState): void {
  const lines = [t(`terrain.${terrainAt(state, ui.cursor)}`)];
  const unit = unitAt(state, ui.cursor);
  if (unit !== undefined) {
    lines.push(t('panel.unit', { class: t(`class.${unit.classId}`), mov: CLASSES[unit.classId].mov }));
  }

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  const width = Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line).width))) + 8;
  const height = lines.length * 10 + 4;
  const x = ui.cursor.x < VIEW_COLS / 2 ? SCREEN_WIDTH - width - 4 : 4;
  const y = 4;

  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = '#141a33';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, row) => ctx.fillText(line, x + 4, y + 2 + row * 10));
}
