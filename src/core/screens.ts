import type { Slot, SlotRead } from './save.ts';
import type { Pos } from './types.ts';

// Écrans titre, options, emplacements et confirmation : des zones rectangulaires, en tuiles de l'écran (24×16),
// de 2 tuiles de haut pour qu'un doigt les vise. Le dessin est dans render/screens.ts.
export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TITLE_BUTTONS = {
  new: { x: 7, y: 7, width: 10, height: 2 },
  continue: { x: 7, y: 10, width: 10, height: 2 },
  options: { x: 7, y: 13, width: 10, height: 2 },
} satisfies Record<string, Zone>;

// Les trois premières lignes changent un réglage (elles portent le nom de ce réglage) ; la dernière revient en arrière.
export const OPTION_ROWS = {
  textSpeed: { x: 3, y: 4, width: 18, height: 2 },
  animationSpeed: { x: 3, y: 7, width: 18, height: 2 },
  language: { x: 3, y: 10, width: 18, height: 2 },
  back: { x: 8, y: 13, width: 8, height: 2 },
} satisfies Record<string, Zone>;

// Un emplacement par ligne, du même nom que l'emplacement.
export const SLOT_ROWS = {
  auto: { x: 3, y: 1, width: 18, height: 2 },
  manual1: { x: 3, y: 4, width: 18, height: 2 },
  manual2: { x: 3, y: 7, width: 18, height: 2 },
  manual3: { x: 3, y: 10, width: 18, height: 2 },
  back: { x: 8, y: 13, width: 8, height: 2 },
} satisfies Record<Slot | 'back', Zone>;

export const CONFIRM_BUTTONS = {
  yes: { x: 5, y: 9, width: 6, height: 2 },
  no: { x: 13, y: 9, width: 6, height: 2 },
} satisfies Record<string, Zone>;

export type TitleButton = keyof typeof TITLE_BUTTONS;
export type OptionRow = keyof typeof OPTION_ROWS;
export type SlotRow = keyof typeof SLOT_ROWS;
export type ConfirmButton = keyof typeof CONFIRM_BUTTONS;
export type SlotsMode = 'load' | 'save';

export function inZone(zone: Zone, pos: Pos): boolean {
  return pos.x >= zone.x && pos.x < zone.x + zone.width && pos.y >= zone.y && pos.y < zone.y + zone.height;
}

function zoneAt<Name extends string>(zones: Record<Name, Zone>, pos: Pos): Name | undefined {
  return (Object.keys(zones) as Name[]).find((name) => inZone(zones[name], pos));
}

export function titleButtonAt(pos: Pos): TitleButton | undefined {
  return zoneAt(TITLE_BUTTONS, pos);
}

export function optionRowAt(pos: Pos): OptionRow | undefined {
  return zoneAt(OPTION_ROWS, pos);
}

export function slotRowAt(pos: Pos): SlotRow | undefined {
  return zoneAt(SLOT_ROWS, pos);
}

export function confirmButtonAt(pos: Pos): ConfirmButton | undefined {
  return zoneAt(CONFIRM_BUTTONS, pos);
}

// On charge ce qui est lisible ; on enregistre sur un emplacement manuel, vide, plein ou abîmé (jamais sur l'automatique,
// que le jeu écrit seul).
export function canPickSlot(mode: SlotsMode, slot: Slot, read: SlotRead): boolean {
  return mode === 'load' ? read.kind === 'ok' : slot !== 'auto';
}
