import { SCREEN_WIDTH, TILE_SIZE } from '../config.ts';
import { SLOTS } from '../core/save.ts';
import type { Slot, SlotRead } from '../core/save.ts';
import {
  CONFIRM_BUTTONS,
  OPTION_ROWS,
  SLOT_ROWS,
  TITLE_BUTTONS,
  canPickSlot,
  confirmButtonAt,
  inZone,
  optionRowAt,
  slotRowAt,
  titleButtonAt,
} from '../core/screens.ts';
import type { SlotsMode, Zone } from '../core/screens.ts';
import type { Settings } from '../core/settings.ts';
import type { Pos } from '../core/types.ts';
import { t } from '../i18n/index.ts';
import { drawBox } from './panels.ts';

// Ce que le rendu doit savoir d'un écran : lequel, et où est le pointeur pour la surbrillance.
export type ScreenView =
  | { kind: 'title'; pointer: Pos; canContinue: boolean }
  | { kind: 'options'; pointer: Pos; settings: Settings }
  | { kind: 'slots'; pointer: Pos; mode: SlotsMode; reads: Record<Slot, SlotRead>; notice: string | null }
  | { kind: 'confirm'; pointer: Pos; lines: string[] }; // le titre de la question, puis son détail

const LANGUAGE_NAMES = { fr: 'Français', en: 'English' } as const; // chacun dans sa propre langue
const DIM = '#6c7088'; // texte d'une zone qui ne répond pas
const SAVED_AT = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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

function drawCentered(ctx: CanvasRenderingContext2D, zone: Zone, text: string, color = '#ffffff'): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '8px monospace';
  ctx.fillStyle = color;
  ctx.fillText(text, (zone.x + zone.width / 2) * TILE_SIZE, (zone.y + zone.height / 2) * TILE_SIZE);
}

function drawTitle(ctx: CanvasRenderingContext2D, view: Extract<ScreenView, { kind: 'title' }>): void {
  drawHeading(ctx, t('title.name'), 3 * TILE_SIZE, 16, '#ffe14d');
  const hovered = titleButtonAt(view.pointer);
  drawZone(ctx, TITLE_BUTTONS.new, hovered === 'new');
  drawCentered(ctx, TITLE_BUTTONS.new, t('title.new'));
  drawZone(ctx, TITLE_BUTTONS.continue, hovered === 'continue' && view.canContinue);
  drawCentered(ctx, TITLE_BUTTONS.continue, t('title.continue'), view.canContinue ? '#ffffff' : DIM);
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

function slotName(slot: Slot): string {
  return slot === 'auto' ? t('slots.auto') : t('slots.manual', { n: slot.slice(-1) });
}

function slotDetail(read: SlotRead): string {
  switch (read.kind) {
    case 'empty':
      return t('slots.empty');
    case 'broken':
      return t('slots.broken');
    case 'ok': {
      const { chapter, state, savedAt } = read.save;
      return `${t(`chapter.${chapter}`)} · ${t('slots.turn', { turn: state.turn })} · ${SAVED_AT.format(savedAt)}`;
    }
  }
}

function drawSlots(ctx: CanvasRenderingContext2D, view: Extract<ScreenView, { kind: 'slots' }>): void {
  drawHeading(ctx, t(view.mode === 'load' ? 'slots.load' : 'slots.save'), TILE_SIZE / 2, 12, '#ffe14d');
  const hovered = slotRowAt(view.pointer);
  for (const slot of SLOTS) {
    const zone = SLOT_ROWS[slot];
    const read = view.reads[slot];
    const enabled = canPickSlot(view.mode, slot, read);
    drawZone(ctx, zone, hovered === slot && enabled);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '8px monospace';
    ctx.fillStyle = enabled ? '#ffffff' : DIM;
    ctx.fillText(slotName(slot), zone.x * TILE_SIZE + 8, zone.y * TILE_SIZE + 10);
    ctx.fillStyle = enabled ? '#c8cce0' : DIM;
    ctx.fillText(slotDetail(read), zone.x * TILE_SIZE + 8, zone.y * TILE_SIZE + 22);
  }
  drawZone(ctx, SLOT_ROWS.back, hovered === 'back');
  drawCentered(ctx, SLOT_ROWS.back, t('ui.back'));
  if (view.notice !== null) drawHeading(ctx, view.notice, 12.5 * TILE_SIZE, 8, '#ff9a8f');
}

function drawConfirm(ctx: CanvasRenderingContext2D, view: Extract<ScreenView, { kind: 'confirm' }>): void {
  drawBox(ctx, 3 * TILE_SIZE, 4 * TILE_SIZE, 18 * TILE_SIZE, 4 * TILE_SIZE);
  drawHeading(ctx, view.lines[0] ?? '', 5.5 * TILE_SIZE, 10, '#ffffff');
  drawHeading(ctx, view.lines[1] ?? '', 7 * TILE_SIZE, 8, '#c8cce0');
  const hovered = confirmButtonAt(view.pointer);
  drawZone(ctx, CONFIRM_BUTTONS.yes, hovered === 'yes');
  drawCentered(ctx, CONFIRM_BUTTONS.yes, t('confirm.yes'));
  drawZone(ctx, CONFIRM_BUTTONS.no, hovered === 'no');
  drawCentered(ctx, CONFIRM_BUTTONS.no, t('confirm.no'));
}

export function drawScreen(ctx: CanvasRenderingContext2D, view: ScreenView): void {
  switch (view.kind) {
    case 'title':
      return drawTitle(ctx, view);
    case 'options':
      return drawOptions(ctx, view);
    case 'slots':
      return drawSlots(ctx, view);
    case 'confirm':
      return drawConfirm(ctx, view);
  }
}
