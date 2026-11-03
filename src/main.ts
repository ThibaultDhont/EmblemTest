import { applyEvent } from './core/combat.ts';
import type { CombatEvent } from './core/combat.ts';
import { cancel, confirm, createUiState, finishAction, setCursor } from './core/selection.ts';
import { createChapter1 } from './data/chapter1.ts';
import { detectLanguage, setLanguage, t } from './i18n/index.ts';
import type { Action } from './input/actions.ts';
import { attachMouse } from './input/mouse.ts';
import { createRenderer } from './render/renderer.ts';
import type { Effects } from './render/renderer.ts';

const COMBAT_STEP_MS = 600;

const language = detectLanguage();
setLanguage(language);
document.documentElement.lang = language;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (canvas === null) throw new Error('Canvas #game introuvable');

const state = createChapter1();
const ui = createUiState();
const fx: Effects = { flashId: null, popup: null };
const renderer = createRenderer(canvas);

function showEvent(event: CombatEvent): void {
  applyEvent(state, event);
  fx.flashId = null;
  fx.popup = null;
  if (event.type !== 'strike') return;

  const target = state.units.find((unit) => unit.id === event.targetId);
  if (target === undefined) return;
  fx.flashId = event.hit ? event.targetId : null;
  fx.popup = {
    pos: target.pos,
    text: event.hit ? `${event.damage}${event.crit ? '!' : ''}` : t('combat.miss'),
    color: event.crit ? '#ffd24d' : event.hit ? '#ffffff' : '#a0a8c0',
  };
}

// Joue les événements d'un combat un par un ; l'interface reste verrouillée (mode 'busy') jusqu'à la fin.
function playCombat(events: CombatEvent[]): void {
  const queue = [...events];
  const step = (): void => {
    const event = queue.shift();
    if (event === undefined) {
      fx.flashId = null;
      fx.popup = null;
      finishAction(state, ui);
    } else {
      showEvent(event);
      setTimeout(step, COMBAT_STEP_MS);
    }
    renderer.draw(state, ui, fx);
  };
  step();
}

// Tour par tour : on ne redessine qu'après une action ou un événement de combat.
function dispatch(action: Action): void {
  switch (action.type) {
    case 'setCursor':
      setCursor(state, ui, action.pos);
      break;
    case 'confirm': {
      const events = confirm(state, ui, Math.random);
      if (events.length > 0) playCombat(events);
      break;
    }
    case 'cancel':
      cancel(state, ui);
      break;
  }
  renderer.draw(state, ui, fx);
}

attachMouse(canvas, dispatch);
renderer.draw(state, ui, fx);
