import type { ChoiceCommand, Command, ComparisonOp, Condition, ScriptEvent, Side, Trigger } from './script.ts';
import type { GameState, Pos } from './types.ts';

export const NARRATION = 'narration'; // locuteur sans portrait ni nom
export const CHOICE = 'choix'; // « locuteur » d'un choix du joueur, dans l'historique
const MAX_PER_SIDE = 3;

// Un portrait à l'écran. Sur chaque côté, ils s'alignent dans l'ordre d'arrivée.
export interface Portrait {
  who: string;
  side: Side;
}

export interface Line {
  speaker: string;
  key: string; // clé de traduction du texte
  cast: Portrait[]; // portraits visibles pendant cette réplique
}

// Les réponses proposées au joueur, par clé de traduction de leur libellé.
export interface Choice {
  options: string[];
  cast: Portrait[];
}

export type Step = { type: 'line'; line: Line } | { type: 'choice'; choice: Choice };

// Une liste de commandes en cours de lecture : l'événement lui-même, puis chaque branche @si ou @option entrée.
interface Frame {
  commands: Command[];
  index: number;
}

// Curseur de lecture d'un événement : la présentation demande les étapes une à une.
export interface DialogueRunner {
  eventId: string;
  frames: Frame[];
  cast: Portrait[];
  pending: ChoiceCommand | null; // choix posé au joueur, tant qu'il n'a pas répondu
}

export function startDialogue(event: ScriptEvent): DialogueRunner {
  return { eventId: event.id, frames: [{ commands: event.commands, index: 0 }], cast: [], pending: null };
}

// Applique les commandes jusqu'à la prochaine étape : une réplique, ou un choix à faire. Null en fin d'événement.
// Un choix en attente est redemandé tant que `choose` n'a pas été appelé. Les conditions sont évaluées au
// moment où l'on atteint le @si, avec l'état de partie d'alors.
export function nextStep(runner: DialogueRunner, state: GameState): Step | null {
  if (runner.pending !== null) return { type: 'choice', choice: choiceOf(runner, runner.pending) };

  for (let frame = runner.frames.at(-1); frame !== undefined; frame = runner.frames.at(-1)) {
    const command = frame.commands[frame.index];
    if (command === undefined) {
      runner.frames.pop();
      continue;
    }
    frame.index += 1;
    switch (command.op) {
      case 'say':
        return { type: 'line', line: { speaker: command.speaker, key: command.key, cast: [...runner.cast] } };
      case 'show':
        show(runner, command.who, command.side);
        break;
      case 'hide':
        hide(runner, command.who);
        break;
      case 'flag':
        setFlag(state, command.name, command.value);
        break;
      case 'if':
        runner.frames.push({ commands: holds(command.condition, state) ? command.then : command.otherwise, index: 0 });
        break;
      case 'choice':
        runner.pending = command;
        return { type: 'choice', choice: choiceOf(runner, command) };
    }
  }
  return null;
}

function choiceOf(runner: DialogueRunner, command: ChoiceCommand): Choice {
  return { options: command.options.map((option) => option.key), cast: [...runner.cast] };
}

// Enregistre la réponse du joueur : la lecture continue dans l'option choisie. Renvoie la clé de son
// libellé, ou undefined (rien ne change) s'il n'y a pas de choix en attente ou si l'indice est invalide.
export function choose(runner: DialogueRunner, index: number): string | undefined {
  const option = runner.pending?.options[index];
  if (option === undefined) return undefined;
  runner.pending = null;
  runner.frames.push({ commands: option.commands, index: 0 });
  return option.key;
}

// Passe le reste de l'événement sans l'afficher, jusqu'au prochain choix : les commandes (drapeaux,
// portraits) sont appliquées pour que la suite de la partie soit la même, mais on ne choisit jamais à la
// place du joueur. Renvoie les répliques sautées.
export function skipRest(runner: DialogueRunner, state: GameState): Line[] {
  const skipped: Line[] = [];
  for (let step = nextStep(runner, state); step?.type === 'line'; step = nextStep(runner, state)) skipped.push(step.line);
  return skipped;
}

export function holds(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    case 'alive':
      return state.units.some((unit) => unit.id === condition.unit);
    case 'dead':
      return !state.units.some((unit) => unit.id === condition.unit);
    case 'flag':
      return state.flags.includes(condition.name);
    case 'turn':
      return compare(state.turn, condition.op, condition.value);
    case 'not':
      return !holds(condition.condition, state);
  }
}

function compare(left: number, op: ComparisonOp, right: number): boolean {
  switch (op) {
    case '==':
      return left === right;
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '<':
      return left < right;
  }
}

function setFlag(state: GameState, name: string, value: boolean): void {
  const active = state.flags.includes(name);
  if (value && !active) state.flags.push(name);
  else if (!value && active) state.flags = state.flags.filter((flag) => flag !== name);
}

function hide(runner: DialogueRunner, who: string): void {
  runner.cast = runner.cast.filter((portrait) => portrait.who !== who);
}

// Un personnage déjà à l'écran change de côté ; au-delà de 3 portraits sur un côté, le plus ancien part.
function show(runner: DialogueRunner, who: string, side: Side): void {
  const others = runner.cast.filter((portrait) => portrait.who !== who);
  const sameSide = others.filter((portrait) => portrait.side === side);
  const dropped = sameSide.length >= MAX_PER_SIDE ? sameSide[0] : undefined;
  runner.cast = [...others.filter((portrait) => portrait !== dropped), { who, side }];
}

// Boutons affichés pendant un dialogue, sur la première ligne de tuiles : en tuiles, pour que la
// souris et le toucher les visent comme le reste du jeu.
export type DialogueButton = 'auto' | 'history' | 'skip';

export const DIALOGUE_BUTTONS: Record<DialogueButton, { x: number; width: number }> = {
  auto: { x: 14, width: 3 },
  history: { x: 17, width: 4 },
  skip: { x: 21, width: 3 },
};

export function dialogueButtonAt(pos: Pos): DialogueButton | undefined {
  if (pos.y !== 0) return undefined;
  const names: DialogueButton[] = ['auto', 'history', 'skip'];
  return names.find((name) => pos.x >= DIALOGUE_BUTTONS[name].x && pos.x < DIALOGUE_BUTTONS[name].x + DIALOGUE_BUTTONS[name].width);
}

// Panneau de choix (en tuiles) : chaque option occupe deux tuiles de haut, faciles à viser au toucher.
export const CHOICE_BOX = { x: 3, y: 6, width: 18, rowHeight: 2 };

// Indice de l'option sous la tuile `pos`, parmi `count` options, ou undefined.
export function choiceOptionAt(pos: Pos, count: number): number | undefined {
  const inside = pos.x >= CHOICE_BOX.x && pos.x < CHOICE_BOX.x + CHOICE_BOX.width && pos.y >= CHOICE_BOX.y;
  const row = Math.floor((pos.y - CHOICE_BOX.y) / CHOICE_BOX.rowHeight);
  return inside && row < count ? row : undefined;
}

// Fenêtre de l'historique (en tuiles) et ses deux flèches de défilement, dans ses coins droits.
export const HISTORY_BOX = { x: 1, y: 1, width: 22, height: 14 };
export type HistoryButton = 'up' | 'down';
export const HISTORY_BUTTONS: Record<HistoryButton, Pos> = {
  up: { x: HISTORY_BOX.x + HISTORY_BOX.width - 1, y: HISTORY_BOX.y },
  down: { x: HISTORY_BOX.x + HISTORY_BOX.width - 1, y: HISTORY_BOX.y + HISTORY_BOX.height - 1 },
};

export function historyButtonAt(pos: Pos): HistoryButton | undefined {
  const names: HistoryButton[] = ['up', 'down'];
  return names.find((name) => pos.x === HISTORY_BUTTONS[name].x && pos.y === HISTORY_BUTTONS[name].y);
}

// Événements à jouer pour ce déclencheur, qui n'ont pas encore été joués. Ils sont marqués comme joués.
export function takeEvents(events: ScriptEvent[], state: GameState, trigger: Trigger): ScriptEvent[] {
  const due = events.filter((event) => event.trigger === trigger && !state.fired.includes(event.id));
  for (const event of due) state.fired.push(event.id);
  return due;
}
