import { cancel, confirm, createUiState, setCursor } from './core/selection.ts';
import { createChapter1 } from './data/chapter1.ts';
import { detectLanguage, setLanguage } from './i18n/index.ts';
import type { Action } from './input/actions.ts';
import { attachMouse } from './input/mouse.ts';
import { createRenderer } from './render/renderer.ts';

const language = detectLanguage();
setLanguage(language);
document.documentElement.lang = language;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (canvas === null) throw new Error('Canvas #game introuvable');

const state = createChapter1();
const ui = createUiState();
const renderer = createRenderer(canvas);

// Tour par tour sans animation : on ne redessine qu'après une action.
function dispatch(action: Action): void {
  switch (action.type) {
    case 'setCursor':
      setCursor(state, ui, action.pos);
      break;
    case 'confirm':
      confirm(state, ui);
      break;
    case 'cancel':
      cancel(ui);
      break;
  }
  renderer.draw(state, ui);
}

attachMouse(canvas, dispatch);
renderer.draw(state, ui);
