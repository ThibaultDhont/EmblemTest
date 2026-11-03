import { planEnemyAction } from './core/ai.ts';
import { applyEvent, resolveCombat } from './core/combat.ts';
import type { CombatEvent } from './core/combat.ts';
import { NARRATION, nextLine, startDialogue, takeEvents } from './core/dialogue.ts';
import type { DialogueRunner, Line } from './core/dialogue.ts';
import type { ScriptEvent, Trigger } from './core/script.ts';
import { cancel, confirm, createUiState, finishAction, finishMove, resetUi, setCursor } from './core/selection.ts';
import type { Playback } from './core/selection.ts';
import { endEnemyPhase } from './core/turn.ts';
import type { Pos, Unit } from './core/types.ts';
import { CHAPTER1_EVENTS } from './data/chapter1.events.ts';
import { createChapter1 } from './data/chapter1.ts';
import { detectLanguage, setLanguage, storyText, t } from './i18n/index.ts';
import type { Action } from './input/actions.ts';
import { attachMouse } from './input/mouse.ts';
import { createRenderer } from './render/renderer.ts';
import type { Effects } from './render/renderer.ts';

const MOVE_STEP_MS = 90;
const COMBAT_STEP_MS = 600;
const ENEMY_PAUSE_MS = 350;
const TEXT_STEP_MS = 25;

// Dialogues en cours : les événements restant à jouer et le texte en train de s'écrire.
interface ActiveDialogue {
  queue: ScriptEvent[];
  runner: DialogueRunner | null;
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
let dialogue: ActiveDialogue | null = null;
const pendingDeaths: string[] = []; // unités tombées dont le dialogue de mort n'a pas encore été joué

const draw = (): void => renderer.draw(state, ui, fx);

function showEvent(event: CombatEvent): void {
  applyEvent(state, event);
  fx.flashId = null;
  fx.popup = null;
  if (event.type === 'death') {
    pendingDeaths.push(event.unitId);
    return;
  }

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
function startLine(active: ActiveDialogue, line: Line): void {
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

function endDialogue(active: ActiveDialogue): void {
  fx.dialogue = null;
  dialogue = null;
  draw();
  active.done();
}

// Passe à la réplique suivante, d'un événement ou du suivant ; termine si plus rien ne reste.
function stepDialogue(active: ActiveDialogue): void {
  for (;;) {
    if (active.runner === null) {
      const event = active.queue.shift();
      if (event === undefined) {
        endDialogue(active);
        return;
      }
      active.runner = startDialogue(event);
    }
    const line = nextLine(active.runner, state);
    if (line === null) {
      active.runner = null;
      continue;
    }
    startLine(active, line);
    return;
  }
}

// Un clic affiche d'abord toute la réplique, puis passe à la suivante.
function advanceDialogue(): void {
  const view = fx.dialogue;
  if (dialogue === null || view === null) return;
  if (view.revealed < view.text.length) {
    window.clearTimeout(dialogue.timer);
    dialogue.timer = undefined;
    view.revealed = view.text.length;
    draw();
  } else {
    stepDialogue(dialogue);
  }
}

function playDialogues(events: ScriptEvent[], done: () => void): void {
  if (events.length === 0) {
    done();
    return;
  }
  dialogue = { queue: [...events], runner: null, timer: undefined, done };
  stepDialogue(dialogue);
}

// Joue les événements du script qui répondent à ces déclencheurs, chacun une seule fois.
function playTriggers(triggers: Trigger[], done: () => void): void {
  playDialogues(
    triggers.flatMap((trigger) => takeEvents(CHAPTER1_EVENTS, state, trigger)),
    done,
  );
}

// Dialogues de mort des unités tombées pendant le combat qui vient de se jouer.
function playDeaths(done: () => void): void {
  playTriggers(
    pendingDeaths.splice(0).map((id): Trigger => `mort(${id})`),
    done,
  );
}

// Quand la partie est gagnée ou perdue, les dialogues de fin passent avant l'écran de résultat.
function settleOutcome(): void {
  if (state.outcome === 'playing' || endHandled) return;
  endHandled = true;
  playTriggers([state.outcome === 'victory' ? 'chapitre.victoire' : 'chapitre.defaite'], () => {
    fx.showOutcome = true;
    draw();
  });
}

// Phase ennemie : dialogue de début de phase, puis chaque ennemi joue à son tour (déplacement, puis attaque).
function runEnemyPhase(): void {
  if (enemyPhaseRunning) return;
  enemyPhaseRunning = true;
  playTriggers([`tour.ennemi(${state.turn})`], playEnemies);
}

function playEnemies(): void {
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
      playTriggers([`tour.joueur(${state.turn})`], draw);
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
        playDeaths(() => setTimeout(next, ENEMY_PAUSE_MS));
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
      playDeaths(() => {
        settleOutcome();
        advance();
      });
    });
  }
}

// Tour par tour : on ne redessine qu'après une action ou une étape de lecture.
function dispatch(action: Action): void {
  if (dialogue !== null) {
    if (action.type === 'confirm') advanceDialogue(); // pendant un dialogue, seul le clic de validation compte
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
playTriggers(['chapitre.debut'], () => playTriggers(['tour.joueur(1)'], draw));
