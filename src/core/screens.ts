import type { Pos } from './types.ts';

// Écrans titre et options : des zones rectangulaires, en tuiles de l'écran (24×16), de 2 tuiles de haut pour
// qu'un doigt les vise. Le dessin est dans render/screens.ts.
export interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TITLE_BUTTONS = {
  new: { x: 7, y: 8, width: 10, height: 2 },
  options: { x: 7, y: 11, width: 10, height: 2 },
} satisfies Record<string, Zone>;

// Les trois premières lignes changent un réglage (elles portent le nom de ce réglage) ; la dernière revient en arrière.
export const OPTION_ROWS = {
  textSpeed: { x: 3, y: 4, width: 18, height: 2 },
  animationSpeed: { x: 3, y: 7, width: 18, height: 2 },
  language: { x: 3, y: 10, width: 18, height: 2 },
  back: { x: 8, y: 13, width: 8, height: 2 },
} satisfies Record<string, Zone>;

export type TitleButton = keyof typeof TITLE_BUTTONS;
export type OptionRow = keyof typeof OPTION_ROWS;

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
