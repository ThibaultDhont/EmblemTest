import type { Objective } from './types.ts';

export type Side = 'gauche' | 'droite';

// Quand un événement se déclenche. `tour.joueur(N)` : début de la phase joueur du tour N ;
// `tour.ennemi(N)` : début de la phase ennemie ; `mort(id)` : l'unité `id` vient de tomber.
// Actions du joueur : `selection(id)` : il sélectionne cette unité ; `attaque(id)` : il attaque cette unité
// (avant le combat) ; `case(x,y)` : l'une de ses unités s'arrête sur cette case après un déplacement ;
// `case(id,x,y)` : la même chose pour cette unité seulement.
export type Trigger =
  | 'chapitre.debut'
  | 'chapitre.victoire'
  | 'chapitre.defaite'
  | `tour.joueur(${number})`
  | `tour.ennemi(${number})`
  | `mort(${string})`
  | `selection(${string})`
  | `attaque(${string})`
  | `case(${number},${number})`
  | `case(${string},${number},${number})`;

export type ComparisonOp = '==' | '>=' | '<=' | '>' | '<';

export type Condition =
  | { type: 'alive'; unit: string } // vivant(id)
  | { type: 'dead'; unit: string } // mort(id) : l'unité n'est plus sur la carte
  | { type: 'flag'; name: string } // drapeau(nom)
  | { type: 'turn'; op: ComparisonOp; value: number } // tour >= 3
  | { type: 'not'; condition: Condition }; // non <condition>

// Une réponse proposée au joueur : le libellé (clé de traduction) et ce qui se passe si elle est choisie.
export interface ChoiceOption {
  key: string;
  commands: Command[];
}

export type Command =
  | { op: 'say'; speaker: string; key: string } // réplique : `perso: clé`
  | { op: 'show'; who: string; side: Side } // @montre perso gauche|droite
  | { op: 'hide'; who: string } // @cache perso
  | { op: 'flag'; name: string; value: boolean } // @drapeau nom (vrai), @efface nom (faux)
  | { op: 'if'; condition: Condition; then: Command[]; otherwise: Command[] } // @si … @sinon … @fin
  | { op: 'choice'; options: ChoiceOption[] } // @choix, puis des @option … @fin
  | { op: 'spawn'; unit: string; x: number; y: number } // @apparait id x y : une unité de la réserve arrive
  | { op: 'move'; unit: string; x: number; y: number } // @deplace id x y : déplacement de mise en scène
  | { op: 'recruit'; unit: string } // @recrute id : une unité ennemie passe dans le camp du joueur
  | { op: 'objective'; objective: Objective }; // @objectif boss | deroute | survie N

export type ChoiceCommand = Extract<Command, { op: 'choice' }>;

export interface ScriptEvent {
  id: string;
  trigger: Trigger;
  commands: Command[];
}

export const MAX_CHOICES = 4;

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
  '^(' +
    [
      'chapitre\\.(debut|victoire|defaite)',
      'tour\\.(joueur|ennemi)\\([1-9][0-9]*\\)',
      `(mort|selection|attaque)\\(${NAME}\\)`,
      'case\\([0-9]+,[0-9]+\\)',
      `case\\(${NAME},[0-9]+,[0-9]+\\)`,
    ].join('|') +
    ')$',
);
const TEST = new RegExp(`^(vivant|mort|drapeau)\\((${NAME})\\)$`);
const SAY = /^([a-z][a-z0-9-]*)\s*:\s*([A-Za-z0-9][\w.-]*)$/;
const KEY = /^[A-Za-z0-9][\w.-]*$/;
const INTEGER = /^\d+$/;
const SIDES: readonly string[] = ['gauche', 'droite'];
const OPERATORS: readonly string[] = ['==', '>=', '<=', '>', '<'];

const isTrigger = (value: string): value is Trigger => TRIGGER.test(value);
const isSide = (value: string): value is Side => SIDES.includes(value);
const isOperator = (value: string): value is ComparisonOp => OPERATORS.includes(value);

type IfCommand = Extract<Command, { op: 'if' }>;

// Un bloc ouvert (@si ou @choix), en attente de son @fin.
type Block =
  | { kind: 'if'; command: IfCommand; line: number; inElse: boolean }
  | { kind: 'choice'; command: ChoiceCommand; line: number };

// Lit un script texte : des blocs `@event <nom> quand <déclencheur>` contenant des répliques
// (`perso: clé`) et des commandes (`@montre`, `@cache`, `@drapeau`, `@efface`, `@si`/`@sinon`/`@fin`,
// `@choix`/`@option`/`@fin`). Les lignes vides et celles qui commencent par `#` sont ignorées.
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
            'chapitre.debut, chapitre.victoire, chapitre.defaite, tour.joueur(N), tour.ennemi(N), mort(id), ' +
            'selection(id), attaque(id), case(x,y), case(id,x,y)',
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

    targetOf(current, blocks.at(-1), lineNumber).push(command);
    if (command.op === 'if') blocks.push({ kind: 'if', command, line: lineNumber, inElse: false });
    if (command.op === 'choice') blocks.push({ kind: 'choice', command, line: lineNumber });
  }
  assertClosed(blocks);
  return events;
}

// La liste de commandes qui reçoit la ligne en cours : l'événement, une branche de @si, ou l'@option ouverte.
function targetOf(event: ScriptEvent, top: Block | undefined, lineNumber: number): Command[] {
  if (top === undefined) return event.commands;
  if (top.kind === 'if') return top.inElse ? top.command.otherwise : top.command.then;
  const option = top.command.options.at(-1);
  if (option === undefined) throw new ScriptError(lineNumber, 'dans un @choix, chaque ligne doit se trouver sous une @option');
  return option.commands;
}

function assertClosed(blocks: Block[]): void {
  const open = blocks[0];
  if (open !== undefined) {
    throw new ScriptError(open.line, `ce bloc ${open.kind === 'if' ? '@si' : '@choix'} n'est jamais fermé (@fin manquant)`);
  }
}

// Renvoie la commande à ajouter, ou null pour @sinon, @option et @fin qui ne font que modifier les blocs ouverts.
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
    case '@apparait':
    case '@deplace': {
      const x = words[2];
      const y = words[3];
      if (words.length !== 4 || who === undefined || !NAME_ONLY.test(who) || x === undefined || y === undefined || !INTEGER.test(x) || !INTEGER.test(y)) {
        throw new ScriptError(lineNumber, `syntaxe attendue « ${name} <unité> <x> <y> » (cases de la carte, à partir de 0)`);
      }
      return { op: name === '@apparait' ? 'spawn' : 'move', unit: who, x: Number(x), y: Number(y) };
    }
    case '@recrute':
      if (words.length !== 2 || who === undefined || !NAME_ONLY.test(who)) {
        throw new ScriptError(lineNumber, 'syntaxe attendue « @recrute <unité> »');
      }
      return { op: 'recruit', unit: who };
    case '@objectif':
      return { op: 'objective', objective: parseObjective(words.slice(1), lineNumber) };
    case '@si':
      return { op: 'if', condition: parseCondition(words.slice(1), lineNumber), then: [], otherwise: [] };
    case '@sinon': {
      const top = blocks.at(-1);
      if (top === undefined || top.kind !== 'if') throw new ScriptError(lineNumber, "@sinon en dehors d'un bloc @si");
      if (top.inElse) throw new ScriptError(lineNumber, 'ce bloc @si a déjà un @sinon');
      top.inElse = true;
      return null;
    }
    case '@choix':
      if (words.length !== 1) throw new ScriptError(lineNumber, 'syntaxe attendue « @choix » seul sur sa ligne');
      return { op: 'choice', options: [] };
    case '@option': {
      const top = blocks.at(-1);
      if (top === undefined || top.kind !== 'choice') throw new ScriptError(lineNumber, "@option en dehors d'un bloc @choix");
      if (words.length !== 2 || who === undefined || !KEY.test(who)) {
        throw new ScriptError(lineNumber, 'syntaxe attendue « @option <clé> » (la clé du libellé)');
      }
      if (top.command.options.length >= MAX_CHOICES) {
        throw new ScriptError(lineNumber, `un @choix propose au plus ${MAX_CHOICES} options`);
      }
      top.command.options.push({ key: who, commands: [] });
      return null;
    }
    case '@fin': {
      const closed = blocks.pop();
      if (closed === undefined) throw new ScriptError(lineNumber, '@fin sans @si ni @choix correspondant');
      if (closed.kind === 'choice' && closed.command.options.length === 0) {
        throw new ScriptError(closed.line, "ce bloc @choix n'a aucune @option");
      }
      return null;
    }
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

// boss, deroute (vaincre tous les ennemis) ou `survie N` (tenir jusqu'à la fin du tour N, N ≥ 1).
function parseObjective(words: string[], lineNumber: number): Objective {
  const [kind, turns] = words;
  if (words.length === 1 && kind === 'boss') return { type: 'boss' };
  if (words.length === 1 && kind === 'deroute') return { type: 'rout' };
  if (words.length === 2 && kind === 'survie' && turns !== undefined && /^[1-9]\d*$/.test(turns)) {
    return { type: 'survive', turns: Number(turns) };
  }
  throw new ScriptError(lineNumber, 'syntaxe attendue « @objectif boss », « @objectif deroute » ou « @objectif survie <N> » (N ≥ 1)');
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
