import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NARRATION } from '../core/scene.ts';
import { parseScript } from '../core/script.ts';
import { CHARACTERS } from './characters.ts';

const script = parseScript(readFileSync(new URL('./chapter1.scene', import.meta.url), 'utf8'));
const story: Record<string, string> = JSON.parse(
  readFileSync(new URL('../i18n/story.fr.json', import.meta.url), 'utf8'),
);

test('toutes les clés des scènes du chapitre 1 existent dans le fichier de textes', () => {
  const missing = script
    .flatMap((event) => event.commands)
    .flatMap((command) => (command.op === 'say' ? [command.key] : []))
    .filter((key) => story[key] === undefined);
  assert.deepEqual(missing, []);
});

test('tous les personnages des scènes sont définis, avec leur nom', () => {
  const names = script
    .flatMap((event) => event.commands)
    .map((command) => (command.op === 'say' ? command.speaker : command.who))
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
