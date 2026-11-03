import { resolveCombat, targetsInRange } from './combat.ts';
import type { CombatEvent, Rng } from './combat.ts';
import { inBounds, tileIndex, unitAt } from './grid.ts';
import { pathTo, reachableTiles } from './movement.ts';
import type { ScriptEvent } from './script.ts';
import { talkPartners } from './triggers.ts';
import { endPlayerPhase } from './turn.ts';
import type { GameState, Pos, Unit } from './types.ts';

export const MENU_WIDTH = 5; // en tuiles ; chaque entrée occupe une tuile de haut

export type MenuItem = 'attack' | 'talk' | 'wait' | 'endTurn' | 'options';

export interface Menu {
  items: MenuItem[];
  x: number; // coin haut gauche, en tuiles
  y: number;
}

// idle : rien de sélectionné · move : unité choisie, zone bleue · menu : Attaquer / Parler / Attendre
// target : choix de la cible (ou de l'interlocuteur) · busy : déplacement, combat ou conversation en cours
// de lecture · system : menu Fin de tour
export type Mode = 'idle' | 'move' | 'menu' | 'target' | 'busy' | 'system';

// État de l'interface, hors GameState.
export interface UiState {
  cursor: Pos; // case de la carte visée
  pointer: Pos; // case de l'écran sous le pointeur : elle sert aux boutons et aux choix des dialogues
  camera: Pos; // case de la carte affichée en haut à gauche de la vue
  mode: Mode;
  selectedId: string | null;
  origin: Pos | null; // position de l'unité avant son déplacement, pour annuler
  reachable: Map<number, number>; // zone de déplacement, vide hors du mode 'move'
  menu: Menu | null;
  targets: string[]; // ids des cibles possibles, en mode 'target'
  targetKind: 'attack' | 'talk'; // ce qu'on choisit en mode 'target'
  events: ScriptEvent[]; // le script du chapitre, pour savoir quelles conversations existent
}

// Ce que l'interface doit jouer à l'écran. L'état n'est pas encore modifié : c'est la lecture qui
// le fait avancer (déplacement case par case, coup par coup), puis finishMove / finishAction conclut.
// `options` n'a rien à jouer : le joueur a choisi d'ouvrir l'écran des options.
export type Playback =
  | { type: 'move'; unitId: string; path: Pos[] }
  | { type: 'combat'; events: CombatEvent[] }
  | { type: 'talk'; unitId: string; partnerId: string }
  | { type: 'options' };

export function createUiState(events: ScriptEvent[] = []): UiState {
  return {
    cursor: { x: 0, y: 0 },
    pointer: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    mode: 'idle',
    selectedId: null,
    origin: null,
    reachable: new Map(),
    menu: null,
    targets: [],
    targetKind: 'attack',
    events,
  };
}

export function menuItemAt(menu: Menu, pos: Pos): MenuItem | undefined {
  if (pos.x < menu.x || pos.x >= menu.x + MENU_WIDTH) return undefined;
  return menu.items[pos.y - menu.y];
}

// Bouton « Retour » : une tuile de haut, en haut au centre de l'écran. Il remplace le clic droit.
export const BACK_BUTTON = { x: 10, y: 0, width: 4 }; // en tuiles de l'écran

export function backButtonAt(pos: Pos): boolean {
  return pos.y === BACK_BUTTON.y && pos.x >= BACK_BUTTON.x && pos.x < BACK_BUTTON.x + BACK_BUTTON.width;
}

export function setCursor(state: GameState, ui: UiState, pos: Pos): void {
  if (inBounds(state, pos)) ui.cursor = pos;
}

// Le joueur ne peut agir que pendant sa phase et tant que la partie n'est pas terminée.
function canPlay(state: GameState): boolean {
  return state.phase === 'player' && state.outcome === 'playing';
}

export function confirm(state: GameState, ui: UiState, rng: Rng): Playback | null {
  if (!canPlay(state)) return null;
  switch (ui.mode) {
    case 'idle':
      confirmIdle(state, ui);
      return null;
    case 'move':
      return confirmMove(state, ui);
    case 'menu':
      return confirmMenu(state, ui);
    case 'target':
      return confirmTarget(state, ui, rng);
    case 'system':
      return confirmSystem(state, ui);
    case 'busy':
      return null;
  }
}

// Vrai quand `cancel` a quelque chose à défaire : une unité choisie, un menu ou un ciblage ouvert.
export function canCancel(state: GameState, ui: UiState): boolean {
  return canPlay(state) && (ui.mode === 'move' || ui.mode === 'menu' || ui.mode === 'target' || ui.mode === 'system');
}

export function cancel(state: GameState, ui: UiState): void {
  if (!canPlay(state)) return;
  const unit = selectedUnit(state, ui);
  switch (ui.mode) {
    case 'move':
    case 'system':
      resetUi(ui);
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

// Appelé quand le déplacement a fini d'être joué : l'unité est arrivée, le menu s'ouvre.
export function finishMove(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  if (unit !== undefined) openActionMenu(state, ui, unit);
}

// Termine l'action de l'unité sélectionnée (si elle a survécu) ; la phase finit quand tout le monde a agi.
export function finishAction(state: GameState, ui: UiState): void {
  const unit = selectedUnit(state, ui);
  if (unit !== undefined) unit.acted = true;
  resetUi(ui);
  if (state.units.filter((other) => other.team === 'player').every((other) => other.acted)) endPlayerPhase(state);
}

export function resetUi(ui: UiState): void {
  ui.mode = 'idle';
  ui.selectedId = null;
  ui.origin = null;
  ui.reachable = new Map();
  ui.menu = null;
  ui.targets = [];
  ui.targetKind = 'attack';
}

function selectedUnit(state: GameState, ui: UiState): Unit | undefined {
  return state.units.find((unit) => unit.id === ui.selectedId);
}

function clickedItem(ui: UiState): MenuItem | undefined {
  return ui.menu === null ? undefined : menuItemAt(ui.menu, ui.cursor);
}

function select(state: GameState, ui: UiState, unit: Unit): void {
  resetUi(ui);
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
  ui.targetKind = 'attack';
  const items: MenuItem[] = [];
  if (targetsInRange(state, unit).length > 0) items.push('attack');
  if (talkPartners(state, unit, ui.events).length > 0) items.push('talk');
  items.push('wait');
  openMenu(state, ui, items, unit.pos);
}

function confirmIdle(state: GameState, ui: UiState): void {
  const target = unitAt(state, ui.cursor);
  if (target === undefined) {
    ui.mode = 'system';
    openMenu(state, ui, ['endTurn', 'options'], ui.cursor);
  } else if (target.team === 'player' && !target.acted) {
    select(state, ui, target);
  }
}

function confirmMove(state: GameState, ui: UiState): Playback | null {
  const unit = selectedUnit(state, ui);
  if (unit === undefined) return null;
  if (ui.reachable.has(tileIndex(state, ui.cursor))) {
    const path = pathTo(state, unit, ui.cursor);
    ui.reachable = new Map();
    if (path.length === 0) {
      openActionMenu(state, ui, unit); // l'unité reste sur place : rien à jouer
      return null;
    }
    ui.mode = 'busy';
    return { type: 'move', unitId: unit.id, path };
  }
  const target = unitAt(state, ui.cursor);
  if (target?.team === 'player' && !target.acted) select(state, ui, target);
  return null;
}

function confirmMenu(state: GameState, ui: UiState): Playback | null {
  const unit = selectedUnit(state, ui);
  const item = clickedItem(ui);
  if (unit === undefined) return null;
  if (item === 'wait') {
    finishAction(state, ui);
  } else if (item === 'attack') {
    ui.mode = 'target';
    ui.menu = null;
    ui.targetKind = 'attack';
    ui.targets = targetsInRange(state, unit).map((target) => target.id);
  } else if (item === 'talk') {
    const partners = talkPartners(state, unit, ui.events);
    const only = partners.length === 1 ? partners[0] : undefined;
    if (only !== undefined) return startTalk(ui, unit, only); // un seul interlocuteur : pas besoin de le désigner
    ui.mode = 'target';
    ui.menu = null;
    ui.targetKind = 'talk';
    ui.targets = partners.map((partner) => partner.id);
  }
  return null;
}

function startTalk(ui: UiState, unit: Unit, partner: Unit): Playback {
  ui.mode = 'busy';
  ui.menu = null;
  return { type: 'talk', unitId: unit.id, partnerId: partner.id };
}

function confirmTarget(state: GameState, ui: UiState, rng: Rng): Playback | null {
  const unit = selectedUnit(state, ui);
  const target = unitAt(state, ui.cursor);
  if (unit === undefined || target === undefined || !ui.targets.includes(target.id)) return null;
  if (ui.targetKind === 'talk') return startTalk(ui, unit, target);
  const events = resolveCombat(state, unit, target, rng);
  if (events.length === 0) return null;
  ui.mode = 'busy';
  return { type: 'combat', events };
}

function confirmSystem(state: GameState, ui: UiState): Playback | null {
  const item = clickedItem(ui);
  resetUi(ui);
  if (item === 'endTurn') endPlayerPhase(state);
  return item === 'options' ? { type: 'options' } : null;
}
