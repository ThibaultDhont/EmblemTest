import type { Command, ComparisonOp, Condition, ScriptEvent, Side, Trigger } from './script.ts';
import type { GameState } from './types.ts';

export const NARRATION = 'narration'; // locuteur sans portrait ni nom
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

// Une liste de commandes en cours de lecture : l'événement lui-même, puis chaque branche @si entrée.
interface Frame {
  commands: Command[];
  index: number;
}

// Curseur de lecture d'un événement : la présentation demande les répliques une à une.
export interface DialogueRunner {
  frames: Frame[];
  cast: Portrait[];
}

export function startDialogue(event: ScriptEvent): DialogueRunner {
  return { frames: [{ commands: event.commands, index: 0 }], cast: [] };
}

// Applique les commandes jusqu'à la prochaine réplique, qu'elle renvoie. Null en fin d'événement.
// Les conditions sont évaluées au moment où l'on atteint le @si, avec l'état de partie d'alors.
export function nextLine(runner: DialogueRunner, state: GameState): Line | null {
  for (let frame = runner.frames.at(-1); frame !== undefined; frame = runner.frames.at(-1)) {
    const command = frame.commands[frame.index];
    if (command === undefined) {
      runner.frames.pop();
      continue;
    }
    frame.index += 1;
    switch (command.op) {
      case 'say':
        return { speaker: command.speaker, key: command.key, cast: [...runner.cast] };
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
    }
  }
  return null;
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

// Événements à jouer pour ce déclencheur, qui n'ont pas encore été joués. Ils sont marqués comme joués.
export function takeEvents(events: ScriptEvent[], state: GameState, trigger: Trigger): ScriptEvent[] {
  const due = events.filter((event) => event.trigger === trigger && !state.fired.includes(event.id));
  for (const event of due) state.fired.push(event.id);
  return due;
}
