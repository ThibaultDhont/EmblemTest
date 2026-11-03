import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHOICE_BOX,
  DIALOGUE_BUTTONS,
  HISTORY_BOX,
  choiceOptionAt,
  choose,
  dialogueButtonAt,
  historyButtonAt,
  holds,
  nextStep,
  skipRest,
  startDialogue,
  takeEvents,
} from './dialogue.ts';
import type { DialogueRunner } from './dialogue.ts';
import { stateFromRows } from './grid.ts';
import { parseScript } from './script.ts';
import type { Condition } from './script.ts';
import { makeUnit } from './test-helpers.ts';
import type { GameState } from './types.ts';

const SCRIPT = `
@event intro quand chapitre.debut
  @montre anna gauche
  @montre marc droite
  anna: a.1
  marc: a.2
  @cache marc
  anna: a.3

@event fin quand chapitre.victoire
  anna: b.1
`;

const emptyState = () => stateFromRows(['..'], []);

// Prochaine réplique ; la plupart des tests n'ont pas de choix, qui ferait échouer celui-ci.
function nextLine(runner: DialogueRunner, state: GameState) {
  const step = nextStep(runner, state);
  if (step === null) return null;
  if (step.type === 'choice') assert.fail('un choix était inattendu');
  return step.line;
}

function start(id: string, text = SCRIPT, state: GameState = emptyState()) {
  const event = parseScript(text).find((candidate) => candidate.id === id);
  assert.ok(event !== undefined);
  return { runner: startDialogue(event), state };
}

// Les clés des répliques jouées, dans l'ordre.
function keysOf(text: string, state: GameState): string[] {
  const { runner } = start('a', text, state);
  const keys: string[] = [];
  for (let line = nextLine(runner, state); line !== null; line = nextLine(runner, state)) keys.push(line.key);
  return keys;
}

test("les répliques arrivent dans l'ordre, avec les portraits visibles à ce moment", () => {
  const { runner, state } = start('intro');
  const both = [
    { who: 'anna', side: 'gauche' },
    { who: 'marc', side: 'droite' },
  ];
  assert.deepEqual(nextLine(runner, state), { speaker: 'anna', key: 'a.1', cast: both });
  assert.deepEqual(nextLine(runner, state), { speaker: 'marc', key: 'a.2', cast: both });
  assert.deepEqual(nextLine(runner, state), { speaker: 'anna', key: 'a.3', cast: [{ who: 'anna', side: 'gauche' }] });
  assert.equal(nextLine(runner, state), null);
  assert.equal(nextLine(runner, state), null);
});

test("la liste de portraits d'une réplique n'est pas modifiée par la suite", () => {
  const { runner, state } = start('intro');
  const first = nextLine(runner, state);
  nextLine(runner, state);
  nextLine(runner, state);
  assert.equal(first?.cast.length, 2);
});

test('montrer à nouveau un personnage le déplace de côté', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       @montre anna gauche
       @montre anna droite
       anna: x.1`,
  );
  assert.deepEqual(nextLine(runner, state)?.cast, [{ who: 'anna', side: 'droite' }]);
});

test('au-delà de 3 portraits sur un côté, le plus ancien disparaît', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       @montre p1 gauche
       @montre p2 gauche
       @montre p3 gauche
       @montre p4 gauche
       @montre q1 droite
       p4: x.1`,
  );
  assert.deepEqual(
    nextLine(runner, state)?.cast.map((portrait) => portrait.who),
    ['p2', 'p3', 'p4', 'q1'],
  );
});

test("un événement vide n'a aucune réplique", () => {
  const { runner, state } = start('a', '@event a quand chapitre.debut\n  @montre anna gauche');
  assert.equal(nextLine(runner, state), null);
});

test('takeEvents rend les événements du déclencheur, une seule fois', () => {
  const state = emptyState();
  const events = parseScript(SCRIPT);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut').map((event) => event.id), ['intro']);
  assert.deepEqual(state.fired, ['intro']);
  assert.deepEqual(takeEvents(events, state, 'chapitre.debut'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.defaite'), []);
  assert.deepEqual(takeEvents(events, state, 'chapitre.victoire').map((event) => event.id), ['fin']);
});

test('takeEvents distingue les déclencheurs à paramètre', () => {
  const state = emptyState();
  const events = parseScript(`
    @event t2 quand tour.joueur(2)
      anna: x.1
    @event t3 quand tour.joueur(3)
      anna: x.2
    @event m quand mort(brutus)
      anna: x.3
  `);
  assert.deepEqual(takeEvents(events, state, 'tour.joueur(3)').map((event) => event.id), ['t3']);
  assert.deepEqual(takeEvents(events, state, 'tour.ennemi(3)'), []);
  assert.deepEqual(takeEvents(events, state, 'mort(brutus)').map((event) => event.id), ['m']);
});

test('holds évalue vivant, mort, drapeau, tour et non', () => {
  const state = stateFromRows(['..'], [makeUnit({ id: 'anna' })]);
  state.turn = 3;
  state.flags.push('route-b');
  const check = (condition: Condition) => holds(condition, state);

  assert.equal(check({ type: 'alive', unit: 'anna' }), true);
  assert.equal(check({ type: 'alive', unit: 'marc' }), false);
  assert.equal(check({ type: 'dead', unit: 'marc' }), true);
  assert.equal(check({ type: 'dead', unit: 'anna' }), false);
  assert.equal(check({ type: 'flag', name: 'route-b' }), true);
  assert.equal(check({ type: 'flag', name: 'autre' }), false);
  assert.equal(check({ type: 'not', condition: { type: 'dead', unit: 'marc' } }), false);
  for (const [op, value, expected] of [
    ['==', 3, true],
    ['>=', 3, true],
    ['>=', 4, false],
    ['<=', 2, false],
    ['>', 2, true],
    ['<', 3, false],
  ] as const) {
    assert.equal(check({ type: 'turn', op, value }), expected, `tour ${op} ${value}`);
  }
});

test('@si choisit la branche selon l\'état de la partie', () => {
  const script = `
    @event a quand chapitre.debut
      @si vivant(anna)
        anna: x.vivante
      @sinon
        anna: x.morte
      @fin
      anna: x.apres`;
  assert.deepEqual(keysOf(script, stateFromRows(['..'], [makeUnit({ id: 'anna' })])), ['x.vivante', 'x.apres']);
  assert.deepEqual(keysOf(script, emptyState()), ['x.morte', 'x.apres']);
});

test('un @si sans @sinon ne dit rien quand la condition est fausse', () => {
  const script = `
    @event a quand chapitre.debut
      @si tour >= 5
        anna: x.tard
      @fin
      anna: x.toujours`;
  assert.deepEqual(keysOf(script, emptyState()), ['x.toujours']);
});

test('les blocs @si imbriqués se lisent de l\'intérieur vers l\'extérieur', () => {
  const script = `
    @event a quand chapitre.debut
      @si drapeau(a)
        @si non drapeau(b)
          anna: x.a-sans-b
        @sinon
          anna: x.a-et-b
        @fin
        anna: x.a
      @fin
      anna: x.fin`;
  const withFlags = (...flags: string[]) => {
    const state = emptyState();
    state.flags.push(...flags);
    return state;
  };
  assert.deepEqual(keysOf(script, withFlags()), ['x.fin']);
  assert.deepEqual(keysOf(script, withFlags('a')), ['x.a-sans-b', 'x.a', 'x.fin']);
  assert.deepEqual(keysOf(script, withFlags('a', 'b')), ['x.a-et-b', 'x.a', 'x.fin']);
});

test("le curseur de lecture connaît l'événement qu'il joue", () => {
  assert.equal(start('intro').runner.eventId, 'intro');
});

test('skipRest applique les commandes restantes et renvoie les répliques sautées', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       anna: x.1
       @drapeau vu
       anna: x.2
       @si drapeau(vu)
         anna: x.3
       @fin`,
  );
  assert.equal(nextLine(runner, state)?.key, 'x.1'); // déjà affichée
  assert.deepEqual(skipRest(runner, state).map((line) => line.key), ['x.2', 'x.3']);
  assert.deepEqual(state.flags, ['vu']);
  assert.equal(nextLine(runner, state), null);
  assert.deepEqual(skipRest(runner, state), []);
});

test('dialogueButtonAt repère les trois boutons de la première ligne', () => {
  for (const name of ['auto', 'history', 'skip'] as const) {
    const { x, width } = DIALOGUE_BUTTONS[name];
    assert.equal(dialogueButtonAt({ x, y: 0 }), name);
    assert.equal(dialogueButtonAt({ x: x + width - 1, y: 0 }), name);
  }
  assert.equal(dialogueButtonAt({ x: DIALOGUE_BUTTONS.auto.x - 1, y: 0 }), undefined);
  assert.equal(dialogueButtonAt({ x: DIALOGUE_BUTTONS.auto.x, y: 1 }), undefined);
});

test("les boutons ne se chevauchent pas et tiennent dans l'écran", () => {
  const spans = Object.values(DIALOGUE_BUTTONS).sort((a, b) => a.x - b.x);
  spans.forEach((span, index) => {
    const next = spans[index + 1];
    if (next !== undefined) assert.ok(span.x + span.width <= next.x);
  });
  const last = spans.at(-1);
  assert.ok(last !== undefined && last.x + last.width <= 24);
});

test("historyButtonAt repère les deux flèches, dans la fenêtre de l'historique", () => {
  const right = HISTORY_BOX.x + HISTORY_BOX.width - 1;
  assert.equal(historyButtonAt({ x: right, y: HISTORY_BOX.y }), 'up');
  assert.equal(historyButtonAt({ x: right, y: HISTORY_BOX.y + HISTORY_BOX.height - 1 }), 'down');
  assert.equal(historyButtonAt({ x: right - 1, y: HISTORY_BOX.y }), undefined);
  assert.equal(historyButtonAt({ x: right, y: HISTORY_BOX.y + 1 }), undefined);
});

const CHOICE_SCRIPT = `
  @event a quand chapitre.debut
    @montre anna gauche
    anna: x.question
    @choix
      @option x.oui
        @drapeau oui
        anna: x.reponse-oui
      @option x.non
        anna: x.reponse-non
    @fin
    anna: x.apres`;

// Ce que la lecture rend jusqu'à la fin ou jusqu'à un choix : « choix » pour un choix, sinon la clé de la réplique.
function drain(runner: DialogueRunner, state: GameState): string[] {
  const seen: string[] = [];
  for (let step = nextStep(runner, state); step !== null; step = nextStep(runner, state)) {
    seen.push(step.type === 'line' ? step.line.key : 'choix');
    if (step.type === 'choice') break;
  }
  return seen;
}

test('un @choix devient une étape, redemandée tant que le joueur n\'a pas répondu', () => {
  const { runner, state } = start('a', CHOICE_SCRIPT);
  assert.equal(nextStep(runner, state)?.type, 'line'); // la question
  const step = nextStep(runner, state);
  assert.deepEqual(step, {
    type: 'choice',
    choice: { options: ['x.oui', 'x.non'], cast: [{ who: 'anna', side: 'gauche' }] },
  });
  assert.deepEqual(nextStep(runner, state), step);
  assert.deepEqual(nextStep(runner, state), step);
});

test('choose continue dans l\'option choisie, puis après le bloc', () => {
  const { runner, state } = start('a', CHOICE_SCRIPT);
  assert.deepEqual(drain(runner, state), ['x.question', 'choix']);
  assert.equal(choose(runner, 0), 'x.oui');
  assert.deepEqual(drain(runner, state), ['x.reponse-oui', 'x.apres']);
  assert.deepEqual(state.flags, ['oui']);
});

test('l\'autre option ne pose pas le drapeau de la première', () => {
  const { runner, state } = start('a', CHOICE_SCRIPT);
  drain(runner, state);
  assert.equal(choose(runner, 1), 'x.non');
  assert.deepEqual(drain(runner, state), ['x.reponse-non', 'x.apres']);
  assert.deepEqual(state.flags, []);
});

test('choose refuse un indice invalide ou l\'absence de choix, sans rien changer', () => {
  const { runner, state } = start('a', CHOICE_SCRIPT);
  assert.equal(choose(runner, 0), undefined); // pas encore de choix
  drain(runner, state);
  assert.equal(choose(runner, 2), undefined);
  assert.equal(choose(runner, -1), undefined);
  assert.equal(nextStep(runner, state)?.type, 'choice'); // toujours en attente
  assert.deepEqual(state.flags, []);
});

test('un choix peut contenir un @si et un autre @choix', () => {
  const { runner, state } = start(
    'a',
    `@event a quand chapitre.debut
       @choix
         @option x.a
           @si drapeau(ok)
             anna: x.a-ok
           @sinon
             anna: x.a-ko
           @fin
           @choix
             @option x.b
               anna: x.b-reponse
           @fin
       @fin`,
  );
  assert.deepEqual(drain(runner, state), ['choix']);
  choose(runner, 0);
  assert.deepEqual(drain(runner, state), ['x.a-ko', 'choix']);
  assert.equal(choose(runner, 0), 'x.b');
  assert.deepEqual(drain(runner, state), ['x.b-reponse']);
});

test('skipRest s\'arrête au choix et ne choisit jamais à la place du joueur', () => {
  const { runner, state } = start('a', CHOICE_SCRIPT);
  assert.deepEqual(skipRest(runner, state).map((line) => line.key), ['x.question']);
  assert.deepEqual(state.flags, []);
  assert.equal(nextStep(runner, state)?.type, 'choice');

  choose(runner, 0);
  assert.deepEqual(skipRest(runner, state).map((line) => line.key), ['x.reponse-oui', 'x.apres']);
  assert.deepEqual(state.flags, ['oui']);
});

test('choiceOptionAt repère les options, de deux tuiles de haut chacune', () => {
  const { x, y, width, rowHeight } = CHOICE_BOX;
  assert.equal(choiceOptionAt({ x, y }, 2), 0);
  assert.equal(choiceOptionAt({ x: x + width - 1, y: y + rowHeight - 1 }, 2), 0);
  assert.equal(choiceOptionAt({ x, y: y + rowHeight }, 2), 1);
  assert.equal(choiceOptionAt({ x, y: y + 2 * rowHeight }, 2), undefined);
  assert.equal(choiceOptionAt({ x: x - 1, y }, 2), undefined);
  assert.equal(choiceOptionAt({ x: x + width, y }, 2), undefined);
  assert.equal(choiceOptionAt({ x, y: y - 1 }, 2), undefined);
});

test('quatre options tiennent dans l\'écran', () => {
  assert.ok(CHOICE_BOX.y + 4 * CHOICE_BOX.rowHeight <= 16);
});

// Une carte de 10×2 avec Anna, un mercenaire ennemi et un renfort en réserve.
function stagedState() {
  return stateFromRows(
    ['..........', '..........'],
    [
      makeUnit({ id: 'anna', pos: { x: 0, y: 0 } }),
      makeUnit({ id: 'rik', team: 'enemy', ai: 'guard', pos: { x: 5, y: 0 } }),
    ],
    [makeUnit({ id: 'e4', team: 'enemy', pos: { x: 9, y: 1 } })],
  );
}

const staged = (commands: string) => `@event a quand chapitre.debut\n  ${commands}\n  anna: x.fin`;

test('@apparait fait venir une unité de la réserve et rend une étape d\'apparition', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@apparait e4 8 1'), state);
  assert.deepEqual(nextStep(runner, state), { type: 'spawn', unitId: 'e4' });
  assert.deepEqual(state.reserve, []);
  assert.deepEqual(state.units.find((unit) => unit.id === 'e4')?.pos, { x: 8, y: 1 });
  assert.equal(nextStep(runner, state)?.type, 'line');
});

test('@apparait choisit la case libre la plus proche et ignore une unité inconnue ou déjà arrivée', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@apparait e4 0 0\n  @apparait e4 5 1\n  @apparait fantome 3 1'), state);
  assert.equal(nextStep(runner, state)?.type, 'spawn');
  assert.deepEqual(state.units.find((unit) => unit.id === 'e4')?.pos, { x: 1, y: 0 }); // (0,0) est pris par Anna
  assert.equal(nextStep(runner, state)?.type, 'line'); // les deux autres n'ont rien à montrer
  assert.equal(state.units.length, 3);
});

test('@deplace rend le chemin sans déplacer l\'unité, et finit sur la case libre la plus proche', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@deplace anna 5 0'), state); // (5,0) est occupée par Rik
  const step = nextStep(runner, state);
  assert.equal(step?.type, 'move');
  if (step?.type !== 'move') return;
  assert.deepEqual(step.path.at(-1), { x: 4, y: 0 });
  assert.equal(step.path.length, 4);
  assert.deepEqual(state.units[0]?.pos, { x: 0, y: 0 }); // la présentation anime, l'état ne bouge pas encore
});

test('@deplace sans effet : unité inconnue ou déjà sur la case', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@deplace fantome 3 1\n  @deplace anna 0 0'), state);
  assert.equal(nextStep(runner, state)?.type, 'line');
});

test('@recrute fait passer un ennemi dans le camp du joueur, et rien d\'autre', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@recrute rik\n  @recrute anna\n  @recrute fantome'), state);
  assert.deepEqual(nextStep(runner, state), { type: 'recruit', unitId: 'rik' });
  const rik = state.units.find((unit) => unit.id === 'rik');
  assert.equal(rik?.team, 'player');
  assert.equal(rik?.ai, undefined);
  assert.equal(nextStep(runner, state)?.type, 'line'); // Anna est déjà au joueur, l'autre n'existe pas
});

test('une unité en réserve n\'est ni vivante ni morte, avant d\'arriver', () => {
  const state = stagedState();
  assert.equal(holds({ type: 'alive', unit: 'e4' }, state), false);
  assert.equal(holds({ type: 'dead', unit: 'e4' }, state), false);
  assert.equal(holds({ type: 'dead', unit: 'fantome' }, state), true);

  const { runner } = start('a', staged('@apparait e4 8 1'), state);
  nextStep(runner, state);
  assert.equal(holds({ type: 'alive', unit: 'e4' }, state), true);
  assert.equal(holds({ type: 'dead', unit: 'e4' }, state), false);
});

test('skipRest applique d\'un coup apparitions, déplacements et recrutements', () => {
  const state = stagedState();
  const { runner } = start('a', staged('@apparait e4 8 1\n  @deplace e4 6 1\n  @deplace anna 3 0\n  @recrute rik'), state);
  assert.deepEqual(skipRest(runner, state).map((line) => line.key), ['x.fin']);
  const at = (id: string) => state.units.find((unit) => unit.id === id);
  assert.deepEqual(at('e4')?.pos, { x: 6, y: 1 });
  assert.deepEqual(at('anna')?.pos, { x: 3, y: 0 });
  assert.equal(at('rik')?.team, 'player');
  assert.deepEqual(state.reserve, []);
});

test('@drapeau et @efface modifient l\'état et sont lus par les @si qui suivent', () => {
  const script = `
    @event a quand chapitre.debut
      @drapeau vu
      @si drapeau(vu)
        anna: x.1
      @fin
      @efface vu
      @si drapeau(vu)
        anna: x.2
      @fin`;
  const state = emptyState();
  assert.deepEqual(keysOf(script, state), ['x.1']);
  assert.deepEqual(state.flags, []);

  const flagged = emptyState();
  keysOf('@event a quand chapitre.debut\n  @drapeau route-b\n  @drapeau route-b', flagged);
  assert.deepEqual(flagged.flags, ['route-b']); // poser deux fois ne duplique pas
});
