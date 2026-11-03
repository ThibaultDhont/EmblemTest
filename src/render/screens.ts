import { SCREEN_WIDTH, TILE_SIZE } from '../config.ts';
import { OPTION_ROWS, TITLE_BUTTONS, inZone, optionRowAt, titleButtonAt } from '../core/screens.ts';
import type { Zone } from '../core/screens.ts';
import type { Settings } from '../core/settings.ts';
import type { Pos } from '../core/types.ts';
import { t } from '../i18n/index.ts';
import { drawBox } from './panels.ts';

// Ce que le rendu doit savoir d'un écran : lequel, et où est le pointeur pour la surbrillance.
export type ScreenView =
  | { kind: 'title'; pointer: Pos }
  | { kind: 'options'; pointer: Pos; settings: Settings };

const LANGUAGE_NAMES = { fr: 'Français', en: 'English' } as const; // chacun dans sa propre langue

// Zone de plusieurs tuiles, avec sa surbrillance quand le pointeur est dessus.
function drawZone(ctx: CanvasRenderingContext2D, zone: Zone, hovered: boolean): void {
  const x = zone.x * TILE_SIZE;
  const y = zone.y * TILE_SIZE;
  const width = zone.width * TILE_SIZE;
  const height = zone.height * TILE_SIZE;
  drawBox(ctx, x, y, width, height);
  if (hovered) {
    ctx.fillStyle = '#2d3f8f';
    ctx.fillRect(x, y, width, height);
  }
}

function drawHeading(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.fillText(text, SCREEN_WIDTH / 2, y);
}

function drawCentered(ctx: CanvasRenderingContext2D, zone: Zone, text: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, (zone.x + zone.width / 2) * TILE_SIZE, (zone.y + zone.height / 2) * TILE_SIZE);
}

function drawTitle(ctx: CanvasRenderingContext2D, view: Extract<ScreenView, { kind: 'title' }>): void {
  drawHeading(ctx, t('title.name'), 3 * TILE_SIZE, 16, '#ffe14d');
  const hovered = titleButtonAt(view.pointer);
  drawZone(ctx, TITLE_BUTTONS.new, hovered === 'new');
  drawCentered(ctx, TITLE_BUTTONS.new, t('title.new'));
  drawZone(ctx, TITLE_BUTTONS.options, hovered === 'options');
  drawCentered(ctx, TITLE_BUTTONS.options, t('title.options'));
}

function valueLabel(key: 'textSpeed' | 'animationSpeed' | 'language', settings: Settings): string {
  switch (key) {
    case 'textSpeed':
      return t(`options.textSpeed.${settings.textSpeed}`);
    case 'animationSpeed':
      return t(`options.animationSpeed.${settings.animationSpeed}`);
    case 'language':
      return LANGUAGE_NAMES[settings.language];
  }
}

function drawOptions(ctx: CanvasRenderingContext2D, view: Extract<ScreenView, { kind: 'options' }>): void {
  drawHeading(ctx, t('options.title'), 2 * TILE_SIZE, 12, '#ffe14d');
  const hovered = optionRowAt(view.pointer);
  for (const key of ['textSpeed', 'animationSpeed', 'language'] as const) {
    const zone = OPTION_ROWS[key];
    drawZone(ctx, zone, hovered === key);
    const middle = (zone.y + zone.height / 2) * TILE_SIZE;
    ctx.textBaseline = 'middle';
    ctx.font = '8px monospace';
    ctx.fillStyle = '#c8cce0';
    ctx.textAlign = 'left';
    ctx.fillText(t(`options.${key}`), zone.x * TILE_SIZE + 8, middle);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(`< ${valueLabel(key, view.settings)} >`, (zone.x + zone.width) * TILE_SIZE - 8, middle);
  }
  drawZone(ctx, OPTION_ROWS.back, inZone(OPTION_ROWS.back, view.pointer));
  drawCentered(ctx, OPTION_ROWS.back, t('options.back'));
}

export function drawScreen(ctx: CanvasRenderingContext2D, view: ScreenView): void {
  if (view.kind === 'title') drawTitle(ctx, view);
  else drawOptions(ctx, view);
}
