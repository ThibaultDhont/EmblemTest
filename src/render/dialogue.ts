import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config.ts';
import type { Portrait } from '../core/scene.ts';
import { CHARACTERS } from '../data/characters.ts';
import { drawBox, setText } from './panels.ts';

// Ce qu'il faut afficher d'une réplique à un instant donné.
export interface DialogueView {
  speaker: string;
  name: string; // vide pour la narration
  text: string; // réplique complète, déjà traduite
  revealed: number; // nombre de caractères déjà affichés
  cast: Portrait[]; // portraits à l'écran, par côté dans l'ordre d'arrivée
}

const BOX = { x: 8, y: SCREEN_HEIGHT - 72, width: SCREEN_WIDTH - 16, height: 64 };
const PORTRAIT = { width: 56, height: 64, gap: 4 };
const LINE_HEIGHT = 11;
const MAX_LINES = 4;

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

export function drawDialogue(ctx: CanvasRenderingContext2D, view: DialogueView): void {
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
}
