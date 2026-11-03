export type Side = 'gauche' | 'droite';

// Quand un événement se déclenche. `tour.joueur(N)` : début de la phase joueur du tour N ;
// `tour.ennemi(N)` : début de la phase ennemie ; `mort(id)` : l'unité `id` vient de tomber.
export type Trigger =
  | 'chapitre.debut'
  | 'chapitre.victoire'
  | 'chapitre.defaite'
  | `tour.joueur(${number})`
  | `tour.ennemi(${number})`
  | `mort(${string})`;

export type ComparisonOp = '==' | '>=' | '<=' | '>' | '<';

export type Condition =
  | { type: 'alive'; unit: string } // vivant(id)
  | { type: 'dead'; unit: string } // mort(id) : l'unité n'est plus sur la carte
  | { type: 'flag'; name: string } // drapeau(nom)
  | { type: 'turn'; op: ComparisonOp; value: number } // tour >= 3
  | { type: 'not'; condition: Condition }; // non <condition>

export type Command =
  | { op: 'say'; speaker: string; key: string } // réplique : `perso: clé`
  | { op: 'show'; who: string; side: Side } // @montre perso gauche|droite
  | { op: 'hide'; who: string } // @cache perso
  | { op: 'flag'; name: string; value: boolean } // @drapeau nom (vrai), @efface nom (faux)
  | { op: 'if'; condition: Condition; then: Command[]; otherwise: Command[] }; // @si … @sinon … @fin

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

const NAME = '[a-z][a-z0-9-]*';
const NAME_ONLY = new RegExp(`^${NAME}$`);
const TRIGGER = new RegExp(
  `^(chapitre\\.(debut|victoire|defaite)|tour\\.(joueur|ennemi)\\([1-9][0-9]*\\)|mort\\(${NAME}\\))$`,
);
const TEST = new RegExp(`^(vivant|mort|drapeau)\\((${NAME})\\)$`);
const SAY = /^([a-z][a-z0-9-]*)\s*:\s*([A-Za-z0-9][\w.-]*)$/;
const SIDES: readonly string[] = ['gauche', 'droite'];
const OPERATORS: readonly string[] = ['==', '>=', '<=', '>', '<'];

const isTrigger = (value: string): value is Trigger => TRIGGER.test(value);
const isSide = (value: string): value is Side => SIDES.includes(value);
const isOperator = (value: string): value is ComparisonOp => OPERATORS.includes(value);

type IfCommand = Extract<Command, { op: 'if' }>;

// Un bloc @si ouvert, en attente de son @fin.
interface Block {
  command: IfCommand;
  line: number;
  inElse: boolean;
}

// Lit un script texte : des blocs `@event <nom> quand <déclencheur>` contenant des répliques
// (`perso: clé`) et des commandes (`@montre`, `@cache`, `@drapeau`, `@efface`, `@si`/`@sinon`/`@fin`).
// Les lignes vides et celles qui commencent par `#` sont ignorées.
export function parseScript(text: string): ScriptEvent[] {
  const events: ScriptEvent[] = [];
  let current: ScriptEvent | undefined;
  let blocks: Block[] = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = (lines[index] ?? '').trim();
    if (line === '' || line.startsWith('#')) continue;
    const words = line.split(/\s+/);

    if (words[0] === '@event') {
      assertClosed(blocks);
      const [, id, keyword, trigger] = words;
      if (words.length !== 4 || id === undefined || keyword !== 'quand' || trigger === undefined || !isTrigger(trigger)) {
        throw new ScriptError(
          lineNumber,
          'syntaxe attendue « @event <nom> quand <déclencheur> », avec un déclencheur parmi : ' +
            'chapitre.debut, chapitre.victoire, chapitre.defaite, tour.joueur(N), tour.ennemi(N), mort(id)',
        );
      }
      if (events.some((event) => event.id === id)) throw new ScriptError(lineNumber, `l'événement « ${id} » existe déjà`);
      current = { id, trigger, commands: [] };
      events.push(current);
      blocks = [];
      continue;
    }

    if (current === undefined) throw new ScriptError(lineNumber, 'cette ligne doit se trouver dans un bloc @event');
    const command = parseCommand(line, words, lineNumber, blocks);
    if (command === null) continue;

    const top = blocks.at(-1);
    const target = top === undefined ? current.commands : top.inElse ? top.command.otherwise : top.command.then;
    target.push(command);
    if (command.op === 'if') blocks.push({ command, line: lineNumber, inElse: false });
  }
  assertClosed(blocks);
  return events;
}

function assertClosed(blocks: Block[]): void {
  const open = blocks[0];
  if (open !== undefined) throw new ScriptError(open.line, "ce bloc @si n'est jamais fermé (@fin manquant)");
}

// Renvoie la commande à ajouter, ou null pour @sinon et @fin qui ne font que modifier les blocs ouverts.
function parseCommand(line: string, words: string[], lineNumber: number, blocks: Block[]): Command | null {
  const [name, who, side] = words;

  switch (name) {
    case '@montre':
      if (words.length !== 3 || who === undefined || side === undefined || !isSide(side)) {
        throw new ScriptError(lineNumber, 'syntaxe attendue « @montre <perso> gauche|droite »');
      }
      return { op: 'show', who, side };
    case '@cache':
      if (words.length !== 2 || who === undefined) throw new ScriptError(lineNumber, 'syntaxe attendue « @cache <perso> »');
      return { op: 'hide', who };
    case '@drapeau':
    case '@efface':
      if (words.length !== 2 || who === undefined || !NAME_ONLY.test(who)) {
        throw new ScriptError(lineNumber, `syntaxe attendue « ${name} <nom> » (minuscules, chiffres et tirets)`);
      }
      return { op: 'flag', name: who, value: name === '@drapeau' };
    case '@si':
      return { op: 'if', condition: parseCondition(words.slice(1), lineNumber), then: [], otherwise: [] };
    case '@sinon': {
      const top = blocks.at(-1);
      if (top === undefined) throw new ScriptError(lineNumber, '@sinon en dehors d\'un bloc @si');
      if (top.inElse) throw new ScriptError(lineNumber, 'ce bloc @si a déjà un @sinon');
      top.inElse = true;
      return null;
    }
    case '@fin':
      if (blocks.pop() === undefined) throw new ScriptError(lineNumber, '@fin sans @si correspondant');
      return null;
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

// vivant(id), mort(id), drapeau(nom) ou `tour <op> N`, éventuellement précédés de `non`.
function parseCondition(words: string[], lineNumber: number): Condition {
  const [first, operator, value] = words;
  if (first === 'non') return { type: 'not', condition: parseCondition(words.slice(1), lineNumber) };

  if (first === 'tour' && words.length === 3 && operator !== undefined && isOperator(operator) && value !== undefined && /^\d+$/.test(value)) {
    return { type: 'turn', op: operator, value: Number(value) };
  }

  const match = words.length === 1 && first !== undefined ? TEST.exec(first) : null;
  const kind = match?.[1];
  const name = match?.[2];
  if (kind === undefined || name === undefined) {
    throw new ScriptError(
      lineNumber,
      'condition invalide, attendu vivant(id), mort(id), drapeau(nom) ou « tour >= N » (opérateurs : == >= <= > <), avec « non » possible devant',
    );
  }
  if (kind === 'vivant') return { type: 'alive', unit: name };
  if (kind === 'mort') return { type: 'dead', unit: name };
  return { type: 'flag', name };
}
