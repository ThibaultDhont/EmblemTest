import { resolveCombat, targetsInRange } from './combat.ts';
import type { CombatEvent, Rng } from './combat.ts';
import { inBounds, tileIndex, unitAt } from './grid.ts';
import { reachableTiles } from './movement.ts';
import { endTurn } from './turn.ts';
import type { GameState, Pos, Unit } from './types.ts';

export const MENU_WIDTH = 5; // en tuiles ; chaque entrée occupe une tuile de haut

export type MenuItem = 'attack' | 'wait' | 'endTurn';

export interface Menu {
  items: MenuItem[];
  x: number; // coin haut gauche, en tuiles
  y: number;
}

// idle : rien de sélectionné · move : unité choisie, zone bleue · menu : Attaquer / Attendre
// target : choix de la cible · busy : combat en cours de lecture · system : menu Fin de tour
export type Mode = 'idle' | 'move' | 'menu' | 'target' | 'busy' | 'system';

// État de l'interface, hors GameState.
export interface UiState {
  cursor: Pos;
  mode: Mode;
  selectedId: string | null;
  origin: Pos | null; // position de l'unité avant son déplacement, pour annuler
  reachable: Map<number, number>; // zone de déplacement, vide hors du mode 'move'
  menu: Menu | null;
  targets: string[]; // ids des ennemis attaquables, en mode 'target'
}

export function createUiState(): UiState {
  return { cursor: { x: 0, y: 0 }, mode: 'idle', selectedId: null, origin: null, reachable: new Map(), menu: null, targets: [] };
}

export function menuItemAt(menu: Menu, pos: Pos): MenuItem | undefined {
  if (pos.x < menu.x || pos.x >= menu.x + MENU_WIDTH) return undefined;
  return menu.items[pos.y - menu.y];
}

export function setCursor(state: GameState, ui: UiState, pos: Pos): void {
  if (inBounds(state, pos)) ui.cursor = pos;
}

// Renvoie les événements d'un combat à jouer (liste vide dans tous les autres cas).
export function confirm(state: GameState, ui: UiState, rng: Rng): CombatEvent[] {
  switch (ui.mode) {
    case 'idle':
      confirmIdle(state, ui);
      break;
    case 'move':
      confirmMove(state, ui);
      break;
    case 'menu':
      confirmMenu(state, ui);
      break;
    case 'target':
      return confirmTarget(state, ui, rng);
    case 'system':
      confirmSystem(state, ui);
      break;
    case 'busy':
      break;
  }
  return [];
}

export function cancel(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  switch (ui.mode) {
    case 'move':
    case 'system':
      reset(ui);
      break;
    case 'menu':
      if (unit !== undefined && ui.origin !== null) {
        unit.pos = ui.origin;
        select(state, ui, unit);
      }
      break;
    case 'target':
      if (unit !== undefined) openActionMenu(state, ui, unit);
      break;
    case 'idle':
    case 'busy':
      break;
  }
}

// Termine l'action de l'unité sélectionnée (si elle a survécu) ; le tour finit quand tout le monde a agi.
export function finishAction(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  if (unit !== undefined) unit.acted = true;
  reset(ui);
  if (state.units.filter((other) => other.team === 'player').every((other) => other.acted)) endTurn(state);
}

function selectedUnit(state: GameState, ui: UiState): Unit | undefined {
  return state.units.find((unit) => unit.id === ui.selectedId);
}

function clickedItem(ui: UiState): MenuItem | undefined {
  return ui.menu === null ? undefined : menuItemAt(ui.menu, ui.cursor);
}

function reset(ui: UiState): void {
  ui.mode = 'idle';
  ui.selectedId = null;
  ui.origin = null;
  ui.reachable = new Map();
  ui.menu = null;
  ui.targets = [];
}

function select(state: GameState, ui: UiState, unit: Unit): void {
  reset(ui);
  ui.mode = 'move';
  ui.selectedId = unit.id;
  ui.origin = unit.pos;
  ui.reachable = reachableTiles(state, unit);
}

// Place le menu à droite ou à gauche de `around`, du côté qui cache le moins d'ennemis (droite en cas d'égalité).
function openMenu(state: GameState, ui: UiState, items: MenuItem[], around: Pos): void {
  const y = Math.max(0, Math.min(around.y, state.height - items.length));
  const hiddenEnemies = (x: number): number =>
    state.units.filter(
      (unit) =>
        unit.team === 'enemy' &&
        unit.pos.x >= x &&
        unit.pos.x < x + MENU_WIDTH &&
        unit.pos.y >= y &&
        unit.pos.y < y + items.length,
    ).length;
  const candidates = [around.x + 1, around.x - MENU_WIDTH].filter((x) => x >= 0 && x + MENU_WIDTH <= state.width);
  const x = candidates.reduce((best, candidate) => (hiddenEnemies(candidate) < hiddenEnemies(best) ? candidate : best), candidates[0] ?? 0);
  ui.menu = { items, x, y };
}

function openActionMenu(state: GameState, ui: UiState, unit: Unit): void {
  ui.mode = 'menu';
  ui.targets = [];
  const canAttack = targetsInRange(state, unit).length > 0;
  openMenu(state, ui, canAttack ? ['attack', 'wait'] : ['wait'], unit.pos);
}

function confirmIdle(state: GameState, ui: UiState): void {
  const target = unitAt(state, ui.cursor);
  if (target === undefined) {
    ui.mode = 'system';
    openMenu(state, ui, ['endTurn'], ui.cursor);
  } else if (target.team === 'player' && !target.acted) {
    select(state, ui, target);
  }
}

function confirmMove(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  if (unit === undefined) return;
  if (ui.reachable.has(tileIndex(state, ui.cursor))) {
    unit.pos = ui.cursor;
    ui.reachable = new Map();
    openActionMenu(state, ui, unit);
    return;
  }
  const target = unitAt(state, ui.cursor);
  if (target?.team === 'player' && !target.acted) select(state, ui, target);
}

function confirmMenu(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  const item = clickedItem(ui);
  if (unit === undefined) return;
  if (item === 'wait') {
    finishAction(state, ui);
  } else if (item === 'attack') {
    ui.mode = 'target';
    ui.menu = null;
    ui.targets = targetsInRange(state, unit).map((target) => target.id);
  }
}

function confirmTarget(state: GameState, ui: UiState, rng: Rng): CombatEvent[] {
  const unit = selectedUnit(state, ui);
  const target = unitAt(state, ui.cursor);
  if (unit === undefined || target === undefined || !ui.targets.includes(target.id)) return [];
  const events = resolveCombat(state, unit, target, rng);
  if (events.length > 0) ui.mode = 'busy';
  return events;
}

function confirmSystem(state: GameState, ui: UiState): void {
  if (clickedItem(ui) === 'endTurn') endTurn(state);
  reset(ui);
}
