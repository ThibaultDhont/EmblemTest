import { planEnemyAction } from './core/ai.ts';
import { centerOn, panBy, revealRect, revealTile, toMapTile } from './core/camera.ts';
import { applyEvent, resolveCombat } from './core/combat.ts';
import type { CombatEvent } from './core/combat.ts';
import {
  CHOICE,
  NARRATION,
  choiceOptionAt,
  choose,
  dialogueButtonAt,
  historyButtonAt,
  nextStep,
  skipRest,
  startDialogue,
  takeEvents,
} from './core/dialogue.ts';
import type { Choice, DialogueRunner, Line, StageStep } from './core/dialogue.ts';
import type { ScriptEvent, Trigger } from './core/script.ts';
import { SLOTS, createSave } from './core/save.ts';
import type { LogEntry, Slot, SlotRead } from './core/save.ts';
import { canPickSlot, confirmButtonAt, optionRowAt, slotRowAt, titleButtonAt } from './core/screens.ts';
import type { SlotsMode } from './core/screens.ts';
import { DEFAULT_SETTINGS, animationMs, cycleSetting, textStepMs } from './core/settings.ts';
import type { SettingKey } from './core/settings.ts';
import { updateOutcome } from './core/objective.ts';
import {
  MENU_WIDTH,
  backButtonAt,
  canCancel,
  cancel,
  confirm,
  createUiState,
  finishAction,
  finishMove,
  resetUi,
  setCursor,
} from './core/selection.ts';
import type { Playback } from './core/selection.ts';
import { arrivalTriggers, attackTrigger, selectionTrigger, talkTrigger } from './core/triggers.ts';
import { endEnemyPhase } from './core/turn.ts';
import type { GameState, Pos, Unit } from './core/types.ts';
import { CHAPTER1_EVENTS } from './data/chapter1.events.ts';
import { createChapter1 } from './data/chapter1.ts';
import { detectLanguage, setLanguage, storyText, t } from './i18n/index.ts';
import type { MessageKey } from './i18n/index.ts';
import type { Action } from './input/actions.ts';
import { attachPointer } from './input/pointer.ts';
import type { DialogueView } from './render/dialogue.ts';
import { objectiveText } from './render/panels.ts';
import { createRenderer } from './render/renderer.ts';
import type { Effects } from './render/renderer.ts';
import { loadSettings, readSlots, saveSettings, writeSlot } from './storage.ts';

const MOVE_STEP_MS = 90;
const COMBAT_STEP_MS = 600;
const ENEMY_PAUSE_MS = 350;
const STAGE_BEAT_MS = 500; // éclair et pause quand une unité apparaît ou change de camp
const BANNER_MS = 2200; // durée de la bannière d'objectif
const AUTO_DELAY_MS = 3000; // mode Auto : délai entre la fin de l'affichage d'une réplique et la suivante
const SKIP_CONFIRM_MS = 3000; // « Passer » : temps laissé pour confirmer
const HISTORY_LIMIT = 300;
const HISTORY_PAGE = 9; // lignes parcourues par un clic sur une flèche de l'historique

// Dialogue en cours : les événements restant à jouer, le texte en train de s'écrire et les minuteries associées.
interface ActiveDialogue {
  queue: ScriptEvent[];
  runner: DialogueRunner | null;
  timer: number | undefined; // écriture progressive
  autoTimer: number | undefined; // passage automatique à la réplique suivante
  skipTimer: number | undefined; // fin de la demande de confirmation de « Passer »
  busy: boolean; // mise en scène en cours : le dialogue ne réagit à rien
  done: () => void;
}

// Réglages du joueur : le choix enregistré d'abord, puis ?lang= et le navigateur pour la langue.
let settings = loadSettings({ ...DEFAULT_SETTINGS, language: detectLanguage() });

function applyLanguage(): void {
  setLanguage(settings.language);
  document.documentElement.lang = settings.language;
}
applyLanguage();

// Durée d'une étape d'animation, selon la vitesse choisie dans les options.
const animation = (ms: number): number => animationMs(settings, ms);

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (canvas === null) throw new Error('Canvas #game introuvable');

const state = createChapter1();
const ui = createUiState(CHAPTER1_EVENTS);
const fx: Effects = {
  flashId: null,
  popup: null,
  dialogue: null,
  choice: null,
  history: null,
  showOutcome: false,
  staging: false,
  banner: null,
};
const renderer = createRenderer(canvas);
let enemyPhaseRunning = false;
let endHandled = false;
let dialogue: ActiveDialogue | null = null;
let autoMode = false; // gardé pendant la session, pas entre deux chargements de la page

// Écran affiché : le titre au chargement, la partie, ou un écran ouvert depuis l'un ou l'autre (options, emplacements
// de sauvegarde, confirmation).
let scene: 'title' | 'options' | 'slots' | 'confirm' | 'game' = 'title';
let optionsFrom: 'title' | 'game' = 'title';
let slotsMode: SlotsMode = 'load';
let slotsFrom: 'title' | 'game' = 'title';
let slotsNotice: string | null = null; // message d'échec affiché sur l'écran des emplacements
let slotReads: Record<Slot, SlotRead> = readSlots(); // relus à l'ouverture de l'écran des emplacements et du titre
let confirmLines: string[] = [];
let confirmYes: () => void = () => {};
let confirmBack: 'slots' | 'game' = 'game';
const log: LogEntry[] = [];
const pendingDeaths: string[] = []; // unités tombées dont le dialogue de mort n'a pas encore été joué

const canContinue = (): boolean => SLOTS.some((slot) => slotReads[slot].kind === 'ok');

const draw = (): void => {
  if (scene === 'game') renderer.draw(state, ui, fx);
  else if (scene === 'title') renderer.drawScreen({ kind: 'title', pointer: ui.pointer, canContinue: canContinue() });
  else if (scene === 'options') renderer.drawScreen({ kind: 'options', pointer: ui.pointer, settings });
  else if (scene === 'slots') {
    renderer.drawScreen({ kind: 'slots', pointer: ui.pointer, mode: slotsMode, reads: slotReads, notice: slotsNotice });
  } else renderer.drawScreen({ kind: 'confirm', pointer: ui.pointer, lines: confirmLines });
};

// La case de la carte visée suit le pointeur : elle change avec lui, et aussi quand la caméra bouge sous lui.
function pointTo(pos: Pos): void {
  ui.pointer = pos;
  setCursor(state, ui, toMapTile(ui.camera, pos));
}

function moveCamera(camera: Pos): boolean {
  if (camera.x === ui.camera.x && camera.y === ui.camera.y) return false;
  ui.camera = camera;
  setCursor(state, ui, toMapTile(camera, ui.pointer));
  return true;
}

// La caméra suit l'action : elle ne bouge que lorsque la case approche du bord de la vue.
function follow(pos: Pos): void {
  moveCamera(revealTile(state, ui.camera, pos));
}

// Un menu qui vient de s'ouvrir doit tenir entièrement dans la vue, avec l'unité qui est à côté.
function revealMenu(): void {
  const menu = ui.menu;
  if (menu === null) return;
  moveCamera(revealRect(state, ui.camera, { x: menu.x, y: menu.y, width: MENU_WIDTH, height: menu.items.length }, 1));
}

// Défilement voulu par le joueur (molette, bord de l'écran) : seulement quand c'est à lui de jouer.
const canPan = (): boolean => state.phase === 'player' && state.outcome === 'playing' && ui.mode !== 'busy';

function panCamera(dx: number, dy: number): boolean {
  return canPan() && moveCamera(panBy(state, ui.camera, dx, dy));
}

// Un pointeur posé au bord pour un dialogue (le bouton « Passer » est sur la rangée du haut) ou resté là pendant la
// phase ennemie ne doit pas faire défiler la carte à la reprise : le défilement du bord ne repart qu'après un
// mouvement du pointeur pendant que la carte est jouable.
let edgeArmed = true;

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
    setTimeout(step, animation(COMBAT_STEP_MS));
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
    follow(pos);
    draw();
    setTimeout(step, animation(MOVE_STEP_MS));
  };
  step();
}

function remember(eventId: string, line: Line): void {
  log.push({ eventId, speaker: line.speaker, key: line.key });
  if (log.length > HISTORY_LIMIT) log.shift();
}

function clearTimers(active: ActiveDialogue): void {
  window.clearTimeout(active.timer);
  window.clearTimeout(active.autoTimer);
  window.clearTimeout(active.skipTimer);
  active.timer = undefined;
  active.autoTimer = undefined;
  active.skipTimer = undefined;
}

// En mode Auto, la réplique entièrement affichée passe à la suivante après un délai. Rien tant que
// l'historique est ouvert.
function scheduleAuto(active: ActiveDialogue): void {
  window.clearTimeout(active.autoTimer);
  active.autoTimer = undefined;
  const view = fx.dialogue;
  if (!autoMode || fx.history !== null || fx.choice !== null || view === null || view.revealed < view.text.length) return;
  active.autoTimer = window.setTimeout(() => {
    active.autoTimer = undefined;
    if (dialogue === active) stepDialogue(active);
  }, AUTO_DELAY_MS);
}

function nameOf(speaker: string): string {
  if (speaker === NARRATION) return '';
  return speaker === CHOICE ? t('dialogue.choice') : storyText(`char.${speaker}`);
}

function lineView(line: Line, revealed: number): DialogueView {
  return {
    speaker: line.speaker,
    name: nameOf(line.speaker),
    text: storyText(line.key),
    revealed,
    cast: line.cast,
    auto: autoMode,
    skipPending: false,
  };
}

// Affiche une réplique, dont le texte s'écrit lettre par lettre.
function startLine(active: ActiveDialogue, line: Line, eventId: string): void {
  remember(eventId, line);
  const view = lineView(line, 0);
  const text = view.text;
  fx.dialogue = view;
  const stepMs = textStepMs(settings); // 0 : tout le texte d'un coup
  const type = (): void => {
    view.revealed = stepMs === 0 ? text.length : view.revealed + 1;
    draw();
    if (view.revealed < text.length) {
      active.timer = window.setTimeout(type, stepMs);
    } else {
      active.timer = undefined;
      scheduleAuto(active);
    }
  };
  active.timer = window.setTimeout(type, stepMs);
  draw();
}

function endDialogue(active: ActiveDialogue): void {
  fx.dialogue = null;
  fx.choice = null;
  fx.history = null;
  dialogue = null;
  draw();
  active.done();
}

// Annonce l'objectif en cours dans une bannière, puis appelle `done`.
function showBanner(titleKey: 'objective.title' | 'objective.new', done: () => void): void {
  fx.banner = { title: t(titleKey), text: objectiveText(state.objective) };
  draw();
  window.setTimeout(() => {
    fx.banner = null;
    draw();
    done();
  }, BANNER_MS);
}

// Mise en scène : le dialogue s'efface le temps de montrer l'action sur la carte, puis reprend.
// Un déplacement est animé case par case ; une apparition ou un recrutement s'accompagne d'un éclair.
function playStage(active: ActiveDialogue, step: StageStep): void {
  active.busy = true;
  fx.dialogue = null;
  fx.staging = true;
  draw();
  const finish = (): void => {
    fx.flashId = null;
    fx.staging = false;
    active.busy = false;
    stepDialogue(active);
  };
  if (step.type === 'move') {
    const unit = state.units.find((other) => other.id === step.unitId);
    if (unit === undefined) finish();
    else playMove(unit, step.path, finish);
  } else if (step.type === 'objective') {
    showBanner('objective.new', finish);
  } else {
    const unit = state.units.find((other) => other.id === step.unitId);
    if (unit !== undefined) follow(unit.pos);
    fx.flashId = step.unitId;
    draw();
    window.setTimeout(finish, animation(STAGE_BEAT_MS));
  }
}

// Propose les réponses au joueur. La boîte de dialogue reste dessous (vide si le choix ouvre l'événement).
function startChoice(choice: Choice): void {
  if (fx.dialogue === null) {
    fx.dialogue = { speaker: NARRATION, name: '', text: '', revealed: 0, cast: choice.cast, auto: autoMode, skipPending: false };
  } else {
    fx.dialogue.cast = choice.cast;
  }
  fx.choice = { options: choice.options.map((key) => storyText(key)) };
  draw();
}

// Le joueur a répondu : son choix entre dans l'historique et la lecture continue dans l'option choisie.
function pick(active: ActiveDialogue, index: number): void {
  const runner = active.runner;
  if (runner === null) return;
  const key = choose(runner, index);
  if (key === undefined) return;
  remember(runner.eventId, { speaker: CHOICE, key, cast: [] });
  fx.choice = null;
  stepDialogue(active);
}

// Passe à la réplique suivante, d'un événement ou du suivant ; termine si plus rien ne reste.
function stepDialogue(active: ActiveDialogue): void {
  clearTimers(active);
  for (;;) {
    if (active.runner === null) {
      const event = active.queue.shift();
      if (event === undefined) {
        endDialogue(active);
        return;
      }
      active.runner = startDialogue(event);
    }
    const step = nextStep(active.runner, state);
    if (step === null) {
      active.runner = null;
      continue;
    }
    if (step.type === 'line') startLine(active, step.line, active.runner.eventId);
    else if (step.type === 'choice') startChoice(step.choice);
    else playStage(active, step);
    return;
  }
}

// Un clic affiche d'abord toute la réplique, puis passe à la suivante.
function advanceDialogue(active: ActiveDialogue): void {
  const view = fx.dialogue;
  if (view === null || fx.choice !== null) return;
  if (view.revealed < view.text.length) {
    window.clearTimeout(active.timer);
    active.timer = undefined;
    view.revealed = view.text.length;
    draw();
    scheduleAuto(active);
  } else {
    stepDialogue(active);
  }
}

function cancelSkip(active: ActiveDialogue): void {
  window.clearTimeout(active.skipTimer);
  active.skipTimer = undefined;
  if (fx.dialogue !== null) fx.dialogue.skipPending = false;
}

// Premier clic : demande confirmation. Second clic : saute le reste de l'événement en cours (ses drapeaux
// sont appliqués, ses répliques entrent dans l'historique) jusqu'au prochain choix, qui s'affiche alors ;
// sans choix, passe à l'événement suivant s'il y en a un.
function askSkip(active: ActiveDialogue): void {
  const view = fx.dialogue;
  if (view === null || fx.choice !== null) return;
  if (!view.skipPending) {
    view.skipPending = true;
    active.skipTimer = window.setTimeout(() => {
      active.skipTimer = undefined;
      view.skipPending = false;
      draw();
    }, SKIP_CONFIRM_MS);
    draw();
    return;
  }

  const runner = active.runner;
  if (runner !== null) {
    const skipped = skipRest(runner, state);
    for (const line of skipped) remember(runner.eventId, line);
    const last = skipped.at(-1);
    if (last !== undefined) fx.dialogue = lineView(last, storyText(last.key).length);
  }
  stepDialogue(active);
}

function toggleAuto(active: ActiveDialogue): void {
  autoMode = !autoMode;
  if (fx.dialogue !== null) fx.dialogue.auto = autoMode;
  scheduleAuto(active);
  draw();
}

function openHistory(active: ActiveDialogue): void {
  window.clearTimeout(active.autoTimer);
  active.autoTimer = undefined;
  fx.history = {
    entries: log.map((entry) => ({
      eventId: entry.eventId,
      name: nameOf(entry.speaker),
      text: storyText(entry.key),
    })),
    offset: 0,
  };
  draw();
}

function closeHistory(active: ActiveDialogue): void {
  fx.history = null;
  scheduleAuto(active);
  draw();
}

// Pendant un dialogue, la carte est inaccessible : seuls le texte, ses trois boutons, l'historique et, le cas
// échéant, les réponses d'un choix réagissent. Un choix n'avance que par une réponse.
function handleDialogueAction(active: ActiveDialogue, action: Action): void {
  if (action.type === 'pan' || action.type === 'pointer') edgeArmed = false;
  if (active.busy) return;
  const history = fx.history;
  if (history !== null) {
    if (action.type === 'pointer') pointTo(action.pos);
    else if (action.type === 'scroll') history.offset -= action.lines;
    else if (action.type === 'cancel') closeHistory(active);
    else if (action.type === 'confirm') {
      const arrow = historyButtonAt(ui.pointer);
      if (arrow === 'up') history.offset += HISTORY_PAGE;
      else if (arrow === 'down') history.offset -= HISTORY_PAGE;
      else closeHistory(active);
    }
    draw();
    return;
  }

  const choice = fx.choice;
  if (choice !== null) {
    if (action.type === 'pointer') {
      pointTo(action.pos);
    } else if (action.type === 'cancel') {
      openHistory(active);
    } else if (action.type === 'confirm') {
      const index = choiceOptionAt(ui.pointer, choice.options.length);
      if (index !== undefined) pick(active, index);
      else if (dialogueButtonAt(ui.pointer) === 'history') openHistory(active);
    }
    draw();
    return;
  }

  switch (action.type) {
    case 'pointer':
      pointTo(action.pos);
      draw();
      break;
    case 'confirm': {
      const button = dialogueButtonAt(ui.pointer);
      if (button !== 'skip') cancelSkip(active);
      if (button === 'auto') toggleAuto(active);
      else if (button === 'history') openHistory(active);
      else if (button === 'skip') askSkip(active);
      else advanceDialogue(active);
      break;
    }
    case 'cancel':
      cancelSkip(active);
      openHistory(active);
      break;
    case 'scroll':
    case 'pan':
    case 'drag':
      break;
  }
}

function playDialogues(events: ScriptEvent[], done: () => void): void {
  if (events.length === 0) {
    done();
    return;
  }
  dialogue = {
    queue: [...events],
    runner: null,
    timer: undefined,
    autoTimer: undefined,
    skipTimer: undefined,
    busy: false,
    done,
  };
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
      if (state.outcome !== 'playing') settleOutcome(); // objectif de survie atteint
      else playTriggers([`tour.joueur(${state.turn})`], startOfTurn);
      return;
    }
    const unit = state.units.find((other) => other.id === id);
    if (unit === undefined) {
      next(); // tué par une riposte pendant la phase
      return;
    }

    const action = planEnemyAction(state, unit);
    // Un ennemi qui attaque sans bouger est suivi aussi ; un ennemi qui ne fait rien ne déplace pas la caméra.
    if (action.path.length === 0 && action.targetId !== undefined) follow(unit.pos);
    playMove(unit, action.path, () => {
      const target = state.units.find((other) => other.id === action.targetId);
      if (target === undefined) {
        unit.acted = true;
        setTimeout(next, animation(ENEMY_PAUSE_MS));
        return;
      }
      playEvents(resolveCombat(state, unit, target, Math.random), () => {
        unit.acted = true;
        draw();
        playDeaths(() => setTimeout(next, animation(ENEMY_PAUSE_MS)));
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
    // Arrivée : les dialogues de la case se jouent après l'animation, avant que le menu d'actions s'ouvre.
    playMove(unit, playback.path, () => {
      playTriggers(arrivalTriggers(unit, unit.pos), () => {
        updateOutcome(state); // atteindre ou escorter : l'arrivée peut suffire à gagner
        if (state.outcome !== 'playing') {
          resetUi(ui);
          draw();
          settleOutcome();
          return;
        }
        finishMove(state, ui);
        revealMenu();
        draw();
      });
    });
  } else if (playback?.type === 'combat') {
    const fight = (): void =>
      playEvents(playback.events, () => {
        finishAction(state, ui);
        draw();
        playDeaths(() => {
          settleOutcome();
          advance();
        });
      });
    // Le premier coup est celui de l'attaquant : son dialogue passe avant que le combat ne se joue.
    const first = playback.events[0];
    if (first?.type === 'strike') playTriggers([attackTrigger(first.targetId)], fight);
    else fight();
  } else if (playback?.type === 'talk') {
    // La conversation termine l'action de l'unité, comme une attaque.
    playTriggers([talkTrigger(playback.unitId, playback.partnerId)], () => {
      finishAction(state, ui);
      draw();
      settleOutcome();
      advance();
    });
  } else if (playback?.type === 'options') {
    openOptions('game');
  } else if (playback?.type === 'save') {
    openSlots('save', 'game');
  } else if (playback?.type === 'title') {
    askConfirm('confirm.title', 'confirm.titleDetail', goToTitle, 'game');
  }
}

// Repart d'un état de partie neuf ou chargé : tout ce que la partie précédente a laissé dans l'interface disparaît.
function resetGame(fresh: GameState, history: LogEntry[]): void {
  Object.assign(state, fresh);
  resetUi(ui);
  ui.cursor = { x: 0, y: 0 };
  const lord = state.units.find((unit) => unit.role === 'lord');
  ui.camera = centerOn(state, lord?.pos ?? { x: 0, y: 0 });
  Object.assign(fx, { flashId: null, popup: null, dialogue: null, choice: null, history: null, showOutcome: false, staging: false, banner: null });
  log.splice(0, log.length, ...history);
  pendingDeaths.length = 0;
  endHandled = false;
  enemyPhaseRunning = false;
  dialogue = null;
}

const makeSave = () => createSave('chapter1', state, log);

// La partie en cours, dans l'emplacement automatique, à chaque début de tour du joueur : fermer l'onglet par mégarde
// fait perdre au plus ce tour. Jamais une fois la partie gagnée ou perdue : « Continuer » reprend alors le dernier tour.
function autosave(): void {
  if (state.outcome === 'playing' && state.phase === 'player') writeSlot('auto', makeSave());
}

// Le tour du joueur commence, dialogues de début de tour joués.
function startOfTurn(): void {
  draw();
  autosave();
}

function openOptions(from: 'title' | 'game'): void {
  optionsFrom = from;
  scene = 'options';
}

function closeOptions(): void {
  scene = optionsFrom;
  if (scene === 'game') pointTo(ui.pointer); // le curseur de la carte reprend la case sous le pointeur
}

function changeSetting(key: SettingKey): void {
  settings = cycleSetting(settings, key);
  saveSettings(settings);
  if (key === 'language') applyLanguage();
}

function openSlots(mode: SlotsMode, from: 'title' | 'game'): void {
  slotsMode = mode;
  slotsFrom = from;
  slotsNotice = null;
  slotReads = readSlots();
  scene = 'slots';
}

function closeSlots(): void {
  scene = slotsFrom;
  if (scene === 'game') pointTo(ui.pointer);
}

function goToTitle(): void {
  slotReads = readSlots();
  scene = 'title';
}

function saveToSlot(slot: Slot): void {
  slotsNotice = writeSlot(slot, makeSave()) ? null : t('slots.failed');
  slotReads = readSlots();
}

function loadSlot(slot: Slot): void {
  const read = slotReads[slot];
  if (read.kind !== 'ok') return;
  resetGame(structuredClone(read.save.state), structuredClone(read.save.log));
  scene = 'game';
}

// Demande « sûr ? » avant une action qu'on ne défait pas ; Non, ou annuler, revient à `back`.
function askConfirm(title: MessageKey, detail: MessageKey, yes: () => void, back: 'slots' | 'game'): void {
  confirmLines = [t(title), t(detail)];
  confirmYes = yes;
  confirmBack = back;
  scene = 'confirm';
}

function leaveConfirm(): void {
  scene = confirmBack;
  if (scene === 'game') pointTo(ui.pointer);
}

function startChapter(): void {
  resetGame(createChapter1(), []);
  scene = 'game';
  draw();
  playTriggers(['chapitre.debut'], () => playTriggers(['tour.joueur(1)'], () => showBanner('objective.title', startOfTurn)));
}

function confirmOnScreen(): void {
  if (scene === 'title') {
    const button = titleButtonAt(ui.pointer);
    if (button === 'new') startChapter();
    else if (button === 'continue' && canContinue()) openSlots('load', 'title');
    else if (button === 'options') openOptions('title');
  } else if (scene === 'options') {
    const row = optionRowAt(ui.pointer);
    if (row === 'back') closeOptions();
    else if (row !== undefined) changeSetting(row);
  } else if (scene === 'slots') {
    const row = slotRowAt(ui.pointer);
    if (row === 'back') {
      closeSlots();
    } else if (row !== undefined && canPickSlot(slotsMode, row, slotReads[row])) {
      if (slotsMode === 'load') loadSlot(row);
      else if (slotReads[row].kind === 'empty') saveToSlot(row);
      else askConfirm('confirm.overwrite', 'confirm.overwriteDetail', () => saveToSlot(row), 'slots');
    }
  } else {
    const button = confirmButtonAt(ui.pointer);
    if (button === 'yes') {
      scene = confirmBack; // « Oui » peut ouvrir un autre écran : on quitte d'abord celui-ci
      confirmYes();
    } else if (button === 'no') {
      leaveConfirm();
    }
  }
}

// Écrans hors partie : seuls le pointeur, la validation et l'annulation y répondent.
function handleScreenAction(action: Action): void {
  switch (action.type) {
    case 'pointer':
      ui.pointer = action.pos;
      break;
    case 'confirm':
      confirmOnScreen();
      break;
    case 'cancel':
      if (scene === 'options') closeOptions();
      else if (scene === 'slots') closeSlots();
      else if (scene === 'confirm') leaveConfirm();
      break;
    case 'scroll':
    case 'pan':
    case 'drag':
      return;
  }
  draw();
}

// Tour par tour : on ne redessine qu'après une action ou une étape de lecture.
function dispatch(action: Action): void {
  if (scene !== 'game') {
    handleScreenAction(action);
    return;
  }
  if (dialogue !== null) {
    handleDialogueAction(dialogue, action);
    return;
  }
  switch (action.type) {
    case 'pointer':
      edgeArmed = true;
      pointTo(action.pos);
      break;
    case 'confirm':
      if (backButtonAt(ui.pointer) && canCancel(state, ui)) {
        cancel(state, ui);
        revealMenu();
        break;
      }
      if (state.outcome !== 'playing') {
        if (fx.showOutcome) location.reload(); // partie terminée : un clic relance le chapitre
        return;
      }
      {
        const selectedBefore = ui.selectedId;
        play(confirm(state, ui, Math.random));
        revealMenu();
        // Sélectionner une unité peut déclencher un dialogue ; la zone de déplacement reste affichée dessous.
        if (ui.selectedId !== null && ui.selectedId !== selectedBefore) playTriggers([selectionTrigger(ui.selectedId)], draw);
      }
      break;
    case 'cancel':
      cancel(state, ui);
      revealMenu();
      break;
    case 'scroll':
      if (!panCamera(Math.sign(action.columns), Math.sign(action.lines))) return;
      break;
    case 'pan':
      if (!canPan()) edgeArmed = false;
      if (!edgeArmed || !panCamera(action.dx, action.dy)) return;
      break;
    case 'drag':
      if (!panCamera(action.dx, action.dy)) return;
      break;
  }
  draw();
  advance();
}

attachPointer(canvas, dispatch);
draw();
