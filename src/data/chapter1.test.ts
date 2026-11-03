import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NARRATION } from '../core/dialogue.ts';
import { inBounds, terrainAt } from '../core/grid.ts';
import { parseScript } from '../core/script.ts';
import type { Command, Condition } from '../core/script.ts';
import { CHARACTERS } from './characters.ts';
import { createChapter1 } from './chapter1.ts';

const events = parseScript(readFileSync(new URL('./chapter1.script', import.meta.url), 'utf8'));
const story: Record<string, string> = JSON.parse(
  readFileSync(new URL('../i18n/story.fr.json', import.meta.url), 'utf8'),
);

// Toutes les commandes d'un événement, branches @si et options de @choix comprises.
function flatten(commands: Command[]): Command[] {
  return commands.flatMap((command) => {
    if (command.op === 'if') return [command, ...flatten(command.then), ...flatten(command.otherwise)];
    if (command.op === 'choice') return [command, ...command.options.flatMap((option) => flatten(option.commands))];
    return [command];
  });
}

function unitsIn(condition: Condition): string[] {
  switch (condition.type) {
    case 'alive':
    case 'dead':
      return [condition.unit];
    case 'not':
      return unitsIn(condition.condition);
    default:
      return [];
  }
}

function flagsIn(condition: Condition): string[] {
  if (condition.type === 'flag') return [condition.name];
  return condition.type === 'not' ? flagsIn(condition.condition) : [];
}

const commands = events.flatMap((event) => flatten(event.commands));
const conditions = commands.flatMap((command) => (command.op === 'if' ? [command.condition] : []));
const sayKeys = commands.flatMap((command) => (command.op === 'say' ? [command.key] : []));
const optionKeys = commands.flatMap((command) => (command.op === 'choice' ? command.options.map((option) => option.key) : []));

test('toutes les clés des dialogues du chapitre 1 existent dans le fichier de textes', () => {
  assert.deepEqual([...sayKeys, ...optionKeys].filter((key) => story[key] === undefined), []);
});

test('tous les personnages des dialogues sont définis, avec leur nom', () => {
  const names = commands
    .flatMap((command) => {
      if (command.op === 'say') return [command.speaker];
      return command.op === 'show' || command.op === 'hide' ? [command.who] : [];
    })
    .filter((who) => who !== NARRATION);
  for (const who of new Set(names)) {
    assert.ok(CHARACTERS[who] !== undefined, `personnage inconnu : ${who}`);
    assert.ok(story[`char.${who}`] !== undefined, `nom manquant : char.${who}`);
  }
});

test('chaque réplique tient dans la boîte de dialogue (4 lignes)', () => {
  const tooLong = sayKeys.filter((key) => (story[key] ?? '').length > 250);
  assert.deepEqual(tooLong, []);
});

test("chaque libellé d'option tient sur une ligne du panneau de choix", () => {
  const tooLong = optionKeys.filter((key) => (story[key] ?? '').length > 50);
  assert.deepEqual(tooLong, []);
});

test('les commandes de mise en scène visent des unités du chapitre et des cases praticables', () => {
  const chapter = createChapter1();
  const known = new Set([...chapter.units, ...chapter.reserve].map((unit) => unit.id));
  const reserve = new Set(chapter.reserve.map((unit) => unit.id));
  for (const command of commands) {
    if (command.op !== 'spawn' && command.op !== 'move' && command.op !== 'recruit') continue;
    assert.ok(known.has(command.unit), `unité inconnue : ${command.unit}`);
    if (command.op === 'spawn') assert.ok(reserve.has(command.unit), `${command.unit} n'est pas dans la réserve`);
    if (command.op === 'recruit') continue;
    const pos = { x: command.x, y: command.y };
    assert.ok(inBounds(chapter, pos), `case hors de la carte : ${pos.x},${pos.y}`);
    assert.notEqual(terrainAt(chapter, pos), 'wall', `case dans un mur : ${pos.x},${pos.y}`);
  }
});

test('chaque unité de réserve est appelée par un @apparait', () => {
  const spawned = new Set(commands.flatMap((command) => (command.op === 'spawn' ? [command.unit] : [])));
  const forgotten = createChapter1().reserve.filter((unit) => !spawned.has(unit.id));
  assert.deepEqual(forgotten.map((unit) => unit.id), []);
});

test('les unités citées par les déclencheurs et les conditions existent dans le chapitre', () => {
  const chapter = createChapter1();
  const ids = new Set([...chapter.units, ...chapter.reserve].map((unit) => unit.id));
  const cited = [
    ...events.flatMap((event) => (event.trigger.startsWith('mort(') ? [event.trigger.slice(5, -1)] : [])),
    ...conditions.flatMap(unitsIn),
  ];
  assert.deepEqual(cited.filter((id) => !ids.has(id)), []);
});

test('tout drapeau lu par un @si est posé quelque part dans le script', () => {
  const set = new Set(commands.flatMap((command) => (command.op === 'flag' && command.value ? [command.name] : [])));
  assert.deepEqual(conditions.flatMap(flagsIn).filter((name) => !set.has(name)), []);
});
