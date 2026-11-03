import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE, VIEW_COLS } from '../config.ts';
import { forecast } from '../core/combat.ts';
import type { Combatant } from '../core/combat.ts';
import { terrainAt, unitAt } from '../core/grid.ts';
import { MENU_WIDTH, menuItemAt } from '../core/selection.ts';
import type { Menu, UiState } from '../core/selection.ts';
import type { GameState, Objective } from '../core/types.ts';
import { CLASSES } from '../data/classes.ts';
import { TERRAINS } from '../data/terrains.ts';
import { storyText, t } from '../i18n/index.ts';

// Le texte est antialiasé : une police bitmap viendra avec les vrais assets.
export function setText(ctx: CanvasRenderingContext2D): void {
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
}

export function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = '#141a33';
  ctx.fillRect(x, y, width, height);
}

function textWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
  return Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line).width)));
}

// Encadré d'infos (terrain, unité) placé dans le coin opposé au curseur, comme sur GBA.
export function drawInfoPanel(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState): void {
  const terrainId = terrainAt(state, ui.cursor);
  const terrain = TERRAINS[terrainId];
  const lines = [t(`terrain.${terrainId}`)];
  if (terrain.defBonus > 0 || terrain.avoidBonus > 0) {
    lines.push(t('panel.terrainBonus', { def: terrain.defBonus, avoid: terrain.avoidBonus }));
  }
  const unit = unitAt(state, ui.cursor);
  if (unit !== undefined) {
    lines.push(t('panel.unit', { class: t(`class.${unit.classId}`), mov: CLASSES[unit.classId].mov }));
    if (unit.role !== undefined) lines.push(t(`role.${unit.role}`));
    lines.push(t('panel.hp', { hp: unit.hp, max: unit.stats.maxHp, weapon: t(`weapon.${unit.weaponId}`) }));
  }

  setText(ctx);
  const width = textWidth(ctx, lines) + 8;
  const height = lines.length * 10 + 4;
  const x = ui.cursor.x - ui.camera.x < VIEW_COLS / 2 ? SCREEN_WIDTH - width - 4 : 4;
  const y = 4;
  drawBox(ctx, x, y, width, height);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, row) => ctx.fillText(line, x + 4, y + 2 + row * 10));
}

// Une entrée = une tuile de haut, pour que la souris puisse la viser case par case.
export function drawMenu(ctx: CanvasRenderingContext2D, ui: UiState, menu: Menu): void {
  const x = (menu.x - ui.camera.x) * TILE_SIZE;
  const y = (menu.y - ui.camera.y) * TILE_SIZE;
  const width = MENU_WIDTH * TILE_SIZE;
  drawBox(ctx, x, y, width, menu.items.length * TILE_SIZE);
  setText(ctx);
  menu.items.forEach((item, row) => {
    const rowY = y + row * TILE_SIZE;
    if (menuItemAt(menu, ui.cursor) === item) {
      ctx.fillStyle = '#2d3f8f';
      ctx.fillRect(x, rowY, width, TILE_SIZE);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t(`menu.${item}`), x + 6, rowY + 4);
  });
}

const damageText = (c: Combatant): string => (c.strikes === 0 ? '--' : c.strikes === 1 ? `${c.damage}` : `${c.damage}×2`);
const hitText = (c: Combatant): string => (c.strikes === 0 ? '--' : `${Math.round(c.chance)}`);
const critText = (c: Combatant): string => (c.strikes === 0 ? '--' : `${c.crit}`);

const LABEL_WIDTH = 40;
const COLUMN_WIDTH = 52;

// Prévision du combat : l'attaquant (unité sélectionnée) à gauche, la cible à droite.
export function drawForecast(ctx: CanvasRenderingContext2D, state: GameState, ui: UiState): void {
  const attacker = state.units.find((unit) => unit.id === ui.selectedId);
  const defender = unitAt(state, ui.cursor);
  if (attacker === undefined || defender === undefined || !ui.targets.includes(defender.id)) return;

  const plan = forecast(state, attacker, defender);
  const rows: Array<[string, string, string]> = [
    ['', t(`class.${attacker.classId}`), t(`class.${defender.classId}`)],
    [t('forecast.hp'), `${attacker.hp}/${attacker.stats.maxHp}`, `${defender.hp}/${defender.stats.maxHp}`],
    [t('forecast.damage'), damageText(plan.attacker), damageText(plan.defender)],
    [t('forecast.hit'), hitText(plan.attacker), hitText(plan.defender)],
    [t('forecast.crit'), critText(plan.attacker), critText(plan.defender)],
  ];

  const width = 4 + LABEL_WIDTH + 2 * COLUMN_WIDTH;
  const height = rows.length * 10 + 4;
  const x = ui.cursor.x - ui.camera.x < VIEW_COLS / 2 ? SCREEN_WIDTH - width - 4 : 4;
  const y = SCREEN_HEIGHT - height - 4;
  drawBox(ctx, x, y, width, height);
  setText(ctx);
  rows.forEach(([label, left, right], row) => {
    const textY = y + 2 + row * 10;
    ctx.fillStyle = '#c8cce0';
    ctx.fillText(label, x + 4, textY);
    ctx.fillStyle = row === 0 ? '#8fb8ff' : '#ffffff';
    ctx.fillText(left, x + 4 + LABEL_WIDTH, textY);
    ctx.fillStyle = row === 0 ? '#ff9a8f' : '#ffffff';
    ctx.fillText(right, x + 4 + LABEL_WIDTH + COLUMN_WIDTH, textY);
  });
}

export function objectiveText(objective: Objective): string {
  switch (objective.type) {
    case 'boss':
      return t('objective.boss');
    case 'rout':
      return t('objective.rout');
    case 'survive':
      return t('objective.survive', { turns: objective.turns });
    case 'reach':
      return t('objective.reach');
    case 'escort':
      return t('objective.escort', { name: storyText(`char.${objective.unit}`) });
  }
}

// Le tour et l'objectif en cours, en bas à gauche.
export function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const lines = [
    t(state.phase === 'enemy' ? 'hud.enemyPhase' : 'hud.turn', { turn: state.turn }),
    t('hud.objective', { text: objectiveText(state.objective) }),
  ];
  setText(ctx);
  const height = lines.length * 10 + 4;
  const top = SCREEN_HEIGHT - height - 4;
  drawBox(ctx, 4, top, textWidth(ctx, lines) + 8, height);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, row) => ctx.fillText(line, 8, top + 2 + row * 10));
}

// Bande au milieu de l'écran qui annonce l'objectif, au début du chapitre ou quand il change.
export interface Banner {
  title: string;
  text: string;
}

export function drawBanner(ctx: CanvasRenderingContext2D, banner: Banner): void {
  const top = 96;
  const height = 52;
  ctx.fillStyle = 'rgba(10, 14, 30, 0.88)';
  ctx.fillRect(0, top, SCREEN_WIDTH, height);
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(0, top, SCREEN_WIDTH, 1);
  ctx.fillRect(0, top + height - 1, SCREEN_WIDTH, 1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '8px monospace';
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(banner.title, SCREEN_WIDTH / 2, top + 16);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(banner.text, SCREEN_WIDTH / 2, top + 34);
}

// Écran de fin de partie : voile sombre, titre et invitation à rejouer.
export function drawOutcome(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.outcome === 'playing') return;
  ctx.fillStyle = 'rgba(10, 14, 30, 0.65)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = state.outcome === 'victory' ? '#ffd24d' : '#ff6a5f';
  ctx.fillText(t(`outcome.${state.outcome}`), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 8);
  ctx.font = '8px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(t('outcome.retry'), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 12);
}
