import { inBounds, tileIndex, unitAt } from './grid.ts';
import { reachableTiles } from './movement.ts';
import type { GameState, Pos } from './types.ts';

// État de l'interface, hors GameState : curseur, unité sélectionnée, zone atteignable.
export interface UiState {
  cursor: Pos;
  selectedId: string | null;
  reachable: Map<number, number>; // vide quand rien n'est sélectionné
}

export function createUiState(): UiState {
  return { cursor: { x: 0, y: 0 }, selectedId: null, reachable: new Map() };
}

export function setCursor(state: GameState, ui: UiState, pos: Pos): void {
  if (inBounds(state, pos)) ui.cursor = pos;
}

export function confirm(state: GameState, ui: UiState): void {
  const selected = state.units.find((unit) => unit.id === ui.selectedId);
  if (selected !== undefined && ui.reachable.has(tileIndex(state, ui.cursor))) {
    selected.pos = ui.cursor;
    cancel(ui);
    return;
  }

  const target = unitAt(state, ui.cursor);
  if (target?.team === 'player') {
    ui.selectedId = target.id;
    ui.reachable = reachableTiles(state, target);
  }
}

export function cancel(ui: UiState): void {
  ui.selectedId = null;
  ui.reachable = new Map();
}
