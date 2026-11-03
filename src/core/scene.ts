import type { ScriptEvent, Side, Trigger } from './script.ts';
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

// Curseur de lecture d'un événement : la présentation demande les répliques une à une.
export interface SceneRunner {
  event: ScriptEvent;
  index: number;
  cast: Portrait[];
}

export function startScene(event: ScriptEvent): SceneRunner {
  return { event, index: 0, cast: [] };
}

// Applique les commandes jusqu'à la prochaine réplique, qu'elle renvoie. Null en fin d'événement.
export function nextLine(runner: SceneRunner): Line | null {
  let command = runner.event.commands[runner.index];
  while (command !== undefined) {
    runner.index += 1;
    if (command.op === 'say') return { speaker: command.speaker, key: command.key, cast: [...runner.cast] };
    if (command.op === 'show') show(runner, command.who, command.side);
    else hide(runner, command.who);
    command = runner.event.commands[runner.index];
  }
  return null;
}

function hide(runner: SceneRunner, who: string): void {
  runner.cast = runner.cast.filter((portrait) => portrait.who !== who);
}

// Un personnage déjà à l'écran change de côté ; au-delà de 3 portraits sur un côté, le plus ancien part.
function show(runner: SceneRunner, who: string, side: Side): void {
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
