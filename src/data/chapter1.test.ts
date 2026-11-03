import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NARRATION } from '../core/dialogue.ts';
import { parseScript } from '../core/script.ts';
import type { Command, Condition } from '../core/script.ts';
import { CHARACTERS } from './characters.ts';
import { createChapter1 } from './chapter1.ts';

const events = parseScript(readFileSync(new URL('./chapter1.script', import.meta.url), 'utf8'));
const story: Record<string, string> = JSON.parse(
  readFileSync(new URL('../i18n/story.fr.json', import.meta.url), 'utf8'),
);

// Toutes les commandes d'un événement, branches @si comprises.
function flatten(commands: Command[]): Command[] {
  return commands.flatMap((command) =>
    command.op === 'if' ? [command, ...flatten(command.then), ...flatten(command.otherwise)] : [command],
  );
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

test('toutes les clés des dialogues du chapitre 1 existent dans le fichier de textes', () => {
  const missing = commands
    .flatMap((command) => (command.op === 'say' ? [command.key] : []))
    .filter((key) => story[key] === undefined);
  assert.deepEqual(missing, []);
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
  const tooLong = Object.entries(story).filter(([key, text]) => !key.startsWith('char.') && text.length > 250);
  assert.deepEqual(tooLong, []);
});

test('les unités citées par les déclencheurs et les conditions existent dans le chapitre', () => {
  const ids = new Set(createChapter1().units.map((unit) => unit.id));
  const cited = [
    ...events.flatMap((event) => (event.trigger.startsWith('mort(') ? [event.trigger.slice(5, -1)] : [])),
    ...conditions.flatMap(unitsIn),
  ];
  assert.deepEqual(cited.filter((id) => !ids.has(id)), []);
});

test("tout drapeau lu par un @si est posé quelque part dans le script", () => {
  const set = new Set(commands.flatMap((command) => (command.op === 'flag' && command.value ? [command.name] : [])));
  assert.deepEqual(conditions.flatMap(flagsIn).filter((name) => !set.has(name)), []);
});
