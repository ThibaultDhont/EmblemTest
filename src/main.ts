import { planEnemyAction } from './core/ai.ts';
import { applyEvent, resolveCombat } from './core/combat.ts';
import type { CombatEvent } from './core/combat.ts';
import { NARRATION, nextLine, startScene, takeEvents } from './core/scene.ts';
import type { Line, SceneRunner } from './core/scene.ts';
import type { ScriptEvent } from './core/script.ts';
import { cancel, confirm, createUiState, finishAction, finishMove, resetUi, setCursor } from './core/selection.ts';
import type { Playback } from './core/selection.ts';
import { endEnemyPhase } from './core/turn.ts';
import type { Pos, Unit } from './core/types.ts';
import { CHAPTER1_EVENTS, createChapter1 } from './data/chapter1.ts';
import { detectLanguage, setLanguage, storyText, t } from './i18n/index.ts';
import type { Action } from './input/actions.ts';
import { attachMouse } from './input/mouse.ts';
import { createRenderer } from './render/renderer.ts';
import type { Effects } from './render/renderer.ts';

const MOVE_STEP_MS = 90;
const COMBAT_STEP_MS = 600;
const ENEMY_PAUSE_MS = 350;
const TEXT_STEP_MS = 25;

// Scène de dialogue en cours : les événements restant à jouer et le texte en train de s'écrire.
interface ActiveScene {
  queue: ScriptEvent[];
  runner: SceneRunner | null;
  timer: number | undefined;
  done: () => void;
}

const language = detectLanguage();
setLanguage(language);
document.documentElement.lang = language;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (canvas === null) throw new Error('Canvas #game introuvable');

const state = createChapter1();
const ui = createUiState();
const fx: Effects = { flashId: null, popup: null, dialogue: null, showOutcome: false };
const renderer = createRenderer(canvas);
let enemyPhaseRunning = false;
let endHandled = false;
let scene: ActiveScene | null = null;

const draw = (): void => renderer.draw(state, ui, fx);

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

// Joue les événements d'un combat un par un, puis appelle `done`.
function playEvents(events: CombatEvent[], done: () => void): void {
  const queue = [...events];
  const step = (): void => {
    const event = queue.shift();
    if (event === undefined) {
      fx.flashId = null;
      fx.popup = null;
      done();
      return;
    }
    showEvent(event);
    draw();
    setTimeout(step, COMBAT_STEP_MS);
  };
  step();
}

// Fait avancer l'unité case par case le long de `path`, puis appelle `done`.
function playMove(unit: Unit, path: Pos[], done: () => void): void {
  const queue = [...path];
  const step = (): void => {
    const pos = queue.shift();
    if (pos === undefined) {
      done();
      return;
    }
    unit.pos = pos;
    draw();
    setTimeout(step, MOVE_STEP_MS);
  };
  step();
}

// Affiche une réplique, dont le texte s'écrit lettre par lettre.
function startLine(active: ActiveScene, line: Line): void {
  const text = storyText(line.key);
  const view = {
    speaker: line.speaker,
    name: line.speaker === NARRATION ? '' : storyText(`char.${line.speaker}`),
    text,
    revealed: 0,
    cast: line.cast,
  };
  fx.dialogue = view;
  const type = (): void => {
    view.revealed += 1;
    draw();
    active.timer = view.revealed < text.length ? window.setTimeout(type, TEXT_STEP_MS) : undefined;
  };
  active.timer = window.setTimeout(type, TEXT_STEP_MS);
  draw();
}

function endScene(active: ActiveScene): void {
  fx.dialogue = null;
  scene = null;
  draw();
  active.done();
}

// Passe à la réplique suivante, d'un événement ou du suivant ; termine la scène s'il n'en reste plus.
function stepScene(active: ActiveScene): void {
  for (;;) {
    if (active.runner === null) {
      const event = active.queue.shift();
      if (event === undefined) {
        endScene(active);
        return;
      }
      active.runner = startScene(event);
    }
    const line = nextLine(active.runner);
    if (line === null) {
      active.runner = null;
      continue;
    }
    startLine(active, line);
    return;
  }
}

// Un clic affiche d'abord toute la réplique, puis passe à la suivante.
function advanceScene(): void {
  const view = fx.dialogue;
  if (scene === null || view === null) return;
  if (view.revealed < view.text.length) {
    window.clearTimeout(scene.timer);
    scene.timer = undefined;
    view.revealed = view.text.length;
    draw();
  } else {
    stepScene(scene);
  }
}

function playScenes(events: ScriptEvent[], done: () => void): void {
  if (events.length === 0) {
    done();
    return;
  }
  scene = { queue: [...events], runner: null, timer: undefined, done };
  stepScene(scene);
}

// Quand la partie est gagnée ou perdue, les scènes de fin passent avant l'écran de résultat.
function settleOutcome(): void {
  if (state.outcome === 'playing' || endHandled) return;
  endHandled = true;
  const trigger = state.outcome === 'victory' ? 'chapitre.victoire' : 'chapitre.defaite';
  playScenes(takeEvents(CHAPTER1_EVENTS, state, trigger), () => {
    fx.showOutcome = true;
    draw();
  });
}

// Phase ennemie : chaque ennemi joue à son tour (déplacement, puis attaque éventuelle).
function runEnemyPhase(): void {
  if (enemyPhaseRunning) return;
  enemyPhaseRunning = true;
  const queue = state.units.filter((unit) => unit.team === 'enemy').map((unit) => unit.id);

  const next = (): void => {
    const id = queue.shift();
    if (state.outcome !== 'playing') {
      enemyPhaseRunning = false;
      draw();
      settleOutcome();
      return;
    }
    if (id === undefined) {
      endEnemyPhase(state);
      resetUi(ui);
      enemyPhaseRunning = false;
      draw();
      return;
    }
    const unit = state.units.find((other) => other.id === id);
    if (unit === undefined) {
      next(); // tué par une riposte pendant la phase
      return;
    }

    const action = planEnemyAction(state, unit);
    playMove(unit, action.path, () => {
      const target = state.units.find((other) => other.id === action.targetId);
      if (target === undefined) {
        unit.acted = true;
        setTimeout(next, ENEMY_PAUSE_MS);
        return;
      }
      playEvents(resolveCombat(state, unit, target, Math.random), () => {
        unit.acted = true;
        draw();
        setTimeout(next, ENEMY_PAUSE_MS);
      });
    });
  };
  next();
}

// Lance la phase ennemie dès que le joueur a fini la sienne.
function advance(): void {
  if (state.outcome === 'playing' && state.phase === 'enemy') runEnemyPhase();
}

function play(playback: Playback | null): void {
  if (playback?.type === 'move') {
    const unit = state.units.find((other) => other.id === playback.unitId);
    if (unit === undefined) return;
    playMove(unit, playback.path, () => {
      finishMove(state, ui);
      draw();
    });
  } else if (playback?.type === 'combat') {
    playEvents(playback.events, () => {
      finishAction(state, ui);
      draw();
      settleOutcome();
      advance();
    });
  }
}

// Tour par tour : on ne redessine qu'après une action ou une étape de lecture.
function dispatch(action: Action): void {
  if (scene !== null) {
    if (action.type === 'confirm') advanceScene(); // pendant une scène, seul le clic de validation compte
    return;
  }
  switch (action.type) {
    case 'setCursor':
      setCursor(state, ui, action.pos);
      break;
    case 'confirm':
      if (state.outcome !== 'playing') {
        if (fx.showOutcome) location.reload(); // partie terminée : un clic relance le chapitre
        return;
      }
      play(confirm(state, ui, Math.random));
      break;
    case 'cancel':
      cancel(state, ui);
      break;
  }
  draw();
  advance();
}

attachMouse(canvas, dispatch);
draw();
playScenes(takeEvents(CHAPTER1_EVENTS, state, 'chapitre.debut'), draw);
