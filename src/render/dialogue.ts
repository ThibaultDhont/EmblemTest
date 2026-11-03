import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../config.ts';
import {
  CHOICE_BOX,
  DIALOGUE_BUTTONS,
  HISTORY_BOX,
  HISTORY_BUTTONS,
  choiceOptionAt,
  dialogueButtonAt,
} from '../core/dialogue.ts';
import type { Portrait } from '../core/dialogue.ts';
import type { Pos } from '../core/types.ts';
import { CHARACTERS } from '../data/characters.ts';
import { t } from '../i18n/index.ts';
import { drawBox, setText } from './panels.ts';

// Ce qu'il faut afficher d'une réplique à un instant donné.
export interface DialogueView {
  speaker: string;
  name: string; // vide pour la narration
  text: string; // réplique complète, déjà traduite
  revealed: number; // nombre de caractères déjà affichés
  cast: Portrait[]; // portraits à l'écran, par côté dans l'ordre d'arrivée
  auto: boolean; // mode Auto activé
  skipPending: boolean; // « Passer » attend sa confirmation
}

// Les réponses proposées au joueur, libellés déjà traduits.
export interface ChoiceView {
  options: string[];
}

// Une réplique déjà vue, traduite, pour la fenêtre d'historique.
export interface HistoryLine {
  eventId: string;
  name: string;
  text: string;
}

export interface HistoryView {
  entries: HistoryLine[];
  offset: number; // lignes remontées depuis la plus récente ; corrigé au dessin pour rester dans les bornes
}

const BOX = { x: 8, y: SCREEN_HEIGHT - 72, width: SCREEN_WIDTH - 16, height: 64 };
const PORTRAIT = { width: 56, height: 64, gap: 4 };
const LINE_HEIGHT = 11;
const MAX_LINES = 4;
const HISTORY_VISIBLE_LINES = Math.floor((HISTORY_BOX.height * TILE_SIZE - 16) / LINE_HEIGHT);

// Placeholders : un aplat de couleur et l'initiale du personnage.
function drawPortrait(ctx: CanvasRenderingContext2D, who: string, x: number, active: boolean): void {
  const y = BOX.y - PORTRAIT.height - 4;
  const character = CHARACTERS[who];
  ctx.fillStyle = active ? '#ffe14d' : '#e8e8f0';
  ctx.fillRect(x - 1, y - 1, PORTRAIT.width + 2, PORTRAIT.height + 2);
  ctx.fillStyle = character?.color ?? '#6b6f80';
  ctx.fillRect(x, y, PORTRAIT.width, PORTRAIT.height);

  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(character?.initial ?? '?', x + PORTRAIT.width / 2, y + PORTRAIT.height / 2);

  if (!active) {
    ctx.fillStyle = 'rgba(10, 14, 30, 0.55)';
    ctx.fillRect(x, y, PORTRAIT.width, PORTRAIT.height);
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (current === '' || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

// Auto, Historique et Passer : trois boutons d'une tuile de haut en haut à droite de l'écran.
function drawButtons(ctx: CanvasRenderingContext2D, view: DialogueView, cursor: Pos): void {
  const hovered = dialogueButtonAt(cursor);
  setText(ctx);
  for (const name of ['auto', 'history', 'skip'] as const) {
    const layout = DIALOGUE_BUTTONS[name];
    const x = layout.x * TILE_SIZE;
    drawBox(ctx, x + 2, 2, layout.width * TILE_SIZE - 4, TILE_SIZE - 4);
    if (hovered === name) {
      ctx.fillStyle = '#2d3f8f';
      ctx.fillRect(x + 2, 2, layout.width * TILE_SIZE - 4, TILE_SIZE - 4);
    }

    if (name === 'auto') {
      // Case à cocher en rectangles pleins, pour rester nette.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, 5, 6, 6);
      ctx.fillStyle = view.auto ? '#ffe14d' : '#141a33';
      ctx.fillRect(x + 7, 6, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t('dialogue.auto'), x + 16, 4);
    } else if (name === 'history') {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t('dialogue.history'), x + 6, 4);
    } else {
      ctx.fillStyle = view.skipPending ? '#ffe14d' : '#ffffff';
      ctx.fillText(t(view.skipPending ? 'dialogue.skipConfirm' : 'dialogue.skip'), x + 6, 4);
    }
  }
}

export function drawDialogue(ctx: CanvasRenderingContext2D, view: DialogueView, cursor: Pos): void {
  const left = view.cast.filter((portrait) => portrait.side === 'gauche');
  const right = view.cast.filter((portrait) => portrait.side === 'droite');
  const step = PORTRAIT.width + PORTRAIT.gap;
  left.forEach((portrait, index) => drawPortrait(ctx, portrait.who, BOX.x + index * step, portrait.who === view.speaker));
  right.forEach((portrait, index) =>
    drawPortrait(ctx, portrait.who, SCREEN_WIDTH - BOX.x - PORTRAIT.width - index * step, portrait.who === view.speaker),
  );

  drawBox(ctx, BOX.x, BOX.y, BOX.width, BOX.height);
  setText(ctx);

  if (view.name !== '') {
    const tagWidth = Math.ceil(ctx.measureText(view.name).width) + 12;
    drawBox(ctx, BOX.x + 8, BOX.y - 6, tagWidth, 12);
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(view.name, BOX.x + 14, BOX.y - 4);
  }

  // Le retour à la ligne se calcule sur le texte entier pour que les mots ne sautent pas pendant l'écriture.
  const lines = wrap(ctx, view.text, BOX.width - 16).slice(0, MAX_LINES);
  let remaining = view.revealed;
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, row) => {
    ctx.fillText(line.slice(0, Math.max(0, remaining)), BOX.x + 8, BOX.y + 10 + row * LINE_HEIGHT);
    remaining -= line.length + 1;
  });

  if (view.revealed >= view.text.length) {
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('▼', BOX.x + BOX.width - 14, BOX.y + BOX.height - 12);
  }

  drawButtons(ctx, view, cursor);
}

// Panneau de choix : le jeu s'assombrit (les boutons du dialogue sont redessinés par-dessus, pour rester
// lisibles et utilisables) et chaque option est un bouton de deux tuiles de haut.
export function drawChoice(ctx: CanvasRenderingContext2D, view: ChoiceView, dialogue: DialogueView, cursor: Pos): void {
  ctx.fillStyle = 'rgba(10, 14, 30, 0.6)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawButtons(ctx, dialogue, cursor);

  const hovered = choiceOptionAt(cursor, view.options.length);
  const x = CHOICE_BOX.x * TILE_SIZE;
  const width = CHOICE_BOX.width * TILE_SIZE;
  const height = CHOICE_BOX.rowHeight * TILE_SIZE;
  setText(ctx);
  view.options.forEach((option, index) => {
    const y = (CHOICE_BOX.y + index * CHOICE_BOX.rowHeight) * TILE_SIZE;
    drawBox(ctx, x + 2, y + 2, width - 4, height - 4);
    if (hovered === index) {
      ctx.fillStyle = '#2d3f8f';
      ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(option, x + 12, y + height / 2 - 4);
  });
}

function drawArrow(ctx: CanvasRenderingContext2D, tile: Pos, up: boolean): void {
  const centerX = tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = tile.y * TILE_SIZE + TILE_SIZE / 2;
  ctx.fillStyle = '#ffe14d';
  for (let row = 0; row < 3; row++) {
    const y = up ? centerY - 2 + row : centerY + 1 - row;
    ctx.fillRect(centerX - row, y, 1 + 2 * row, 1);
  }
}

// Fenêtre de l'historique : toutes les répliques déjà vues, la plus récente en bas.
// Le décalage de défilement est ramené dans les bornes ici, là où le retour à la ligne est connu.
export function drawHistory(ctx: CanvasRenderingContext2D, view: HistoryView): void {
  ctx.fillStyle = 'rgba(10, 14, 30, 0.7)';
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const x = HISTORY_BOX.x * TILE_SIZE;
  const y = HISTORY_BOX.y * TILE_SIZE;
  drawBox(ctx, x, y, HISTORY_BOX.width * TILE_SIZE, HISTORY_BOX.height * TILE_SIZE);
  setText(ctx);

  const maxWidth = (HISTORY_BOX.width - 1) * TILE_SIZE - 16;
  const rows: Array<{ text: string; isName: boolean }> = [];
  let previousEvent: string | null = null;
  for (const entry of view.entries) {
    if (previousEvent !== null && entry.eventId !== previousEvent) rows.push({ text: '', isName: false });
    previousEvent = entry.eventId;
    if (entry.name !== '') rows.push({ text: entry.name, isName: true });
    for (const line of wrap(ctx, entry.text, maxWidth)) rows.push({ text: line, isName: false });
  }

  view.offset = Math.min(Math.max(0, view.offset), Math.max(0, rows.length - HISTORY_VISIBLE_LINES));
  const end = rows.length - view.offset;
  const start = Math.max(0, end - HISTORY_VISIBLE_LINES);
  rows.slice(start, end).forEach((row, index) => {
    ctx.fillStyle = row.isName ? '#ffe14d' : '#ffffff';
    ctx.fillText(row.text, x + 8, y + 8 + index * LINE_HEIGHT);
  });

  drawArrow(ctx, HISTORY_BUTTONS.up, true);
  drawArrow(ctx, HISTORY_BUTTONS.down, false);
}
