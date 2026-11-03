export type Side = 'gauche' | 'droite';
export type Trigger = 'chapitre.debut' | 'chapitre.victoire' | 'chapitre.defaite';

export type Command =
  | { op: 'say'; speaker: string; key: string } // réplique : `perso: clé`
  | { op: 'show'; who: string; side: Side } // @montre perso gauche|droite
  | { op: 'hide'; who: string }; // @cache perso

export interface ScriptEvent {
  id: string;
  trigger: Trigger;
  commands: Command[];
}

export class ScriptError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Ligne ${line} : ${message}`);
    this.line = line;
  }
}

const TRIGGERS: readonly string[] = ['chapitre.debut', 'chapitre.victoire', 'chapitre.defaite'];
const SIDES: readonly string[] = ['gauche', 'droite'];
const SAY = /^([a-z][a-z0-9-]*)\s*:\s*([A-Za-z0-9][\w.-]*)$/;

const isTrigger = (value: string): value is Trigger => TRIGGERS.includes(value);
const isSide = (value: string): value is Side => SIDES.includes(value);

// Lit un script texte : des blocs `@event <nom> quand <déclencheur>` contenant des répliques
// (`perso: clé`) et des commandes (`@montre`, `@cache`). Les lignes vides et `#` sont ignorées.
export function parseScript(text: string): ScriptEvent[] {
  const events: ScriptEvent[] = [];
  let current: ScriptEvent | undefined;
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = (lines[index] ?? '').trim();
    if (line === '' || line.startsWith('#')) continue;
    const words = line.split(/\s+/);

    if (words[0] === '@event') {
      const [, id, keyword, trigger] = words;
      if (words.length !== 4 || id === undefined || keyword !== 'quand' || trigger === undefined || !isTrigger(trigger)) {
        throw new ScriptError(
          lineNumber,
          `syntaxe attendue « @event <nom> quand <déclencheur> », avec un déclencheur parmi : ${TRIGGERS.join(', ')}`,
        );
      }
      if (events.some((event) => event.id === id)) throw new ScriptError(lineNumber, `l'événement « ${id} » existe déjà`);
      current = { id, trigger, commands: [] };
      events.push(current);
      continue;
    }

    if (current === undefined) throw new ScriptError(lineNumber, "cette ligne doit se trouver dans un bloc @event");
    current.commands.push(parseCommand(line, words, lineNumber));
  }
  return events;
}

function parseCommand(line: string, words: string[], lineNumber: number): Command {
  const [name, who, side] = words;

  if (name === '@montre') {
    if (words.length !== 3 || who === undefined || side === undefined || !isSide(side)) {
      throw new ScriptError(lineNumber, 'syntaxe attendue « @montre <perso> gauche|droite »');
    }
    return { op: 'show', who, side };
  }
  if (name === '@cache') {
    if (words.length !== 2 || who === undefined) throw new ScriptError(lineNumber, 'syntaxe attendue « @cache <perso> »');
    return { op: 'hide', who };
  }
  if (name?.startsWith('@')) throw new ScriptError(lineNumber, `commande inconnue : ${name}`);

  const match = SAY.exec(line);
  const speaker = match?.[1];
  const key = match?.[2];
  if (speaker === undefined || key === undefined) {
    throw new ScriptError(lineNumber, 'réplique invalide, attendu « perso: clé » (par exemple « anna: ch1.intro.1 »)');
  }
  return { op: 'say', speaker, key };
}
