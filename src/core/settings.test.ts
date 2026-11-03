import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ANIMATION_SPEEDS, DEFAULT_SETTINGS, TEXT_SPEEDS, animationMs, cycleSetting, parseSettings, textStepMs } from './settings.ts';
import type { Settings } from './settings.ts';

test('un réglage passe à la valeur suivante puis revient au début', () => {
  let settings: Settings = DEFAULT_SETTINGS;
  const seen: string[] = [];
  for (let i = 0; i < TEXT_SPEEDS.length; i++) {
    seen.push(settings.textSpeed);
    settings = cycleSetting(settings, 'textSpeed');
  }
  assert.deepEqual(seen, ['normal', 'fast', 'instant', 'slow']); // de la valeur par défaut, dans l'ordre de la liste
  assert.equal(settings.textSpeed, DEFAULT_SETTINGS.textSpeed); // un tour complet revient au départ
});

test("cycleSetting ne change que le réglage demandé et ne modifie pas l'original", () => {
  const next = cycleSetting(DEFAULT_SETTINGS, 'language');
  assert.equal(next.language, 'en');
  assert.equal(next.textSpeed, DEFAULT_SETTINGS.textSpeed);
  assert.equal(next.animationSpeed, DEFAULT_SETTINGS.animationSpeed);
  assert.equal(DEFAULT_SETTINGS.language, 'fr');
});

test('parseSettings garde les valeurs valides', () => {
  const raw = { textSpeed: 'instant', animationSpeed: 'veryFast', language: 'en' };
  assert.deepEqual(parseSettings(raw), raw);
});

test('parseSettings remplace champ par champ ce qui est absent ou inconnu', () => {
  assert.deepEqual(parseSettings({ textSpeed: 'fast', animationSpeed: 'warp', language: 42 }), {
    textSpeed: 'fast',
    animationSpeed: DEFAULT_SETTINGS.animationSpeed,
    language: DEFAULT_SETTINGS.language,
  });
});

test("parseSettings accepte n'importe quoi à la place d'un objet", () => {
  for (const raw of [null, undefined, 'texte', 12, true, []]) {
    assert.deepEqual(parseSettings(raw), DEFAULT_SETTINGS);
  }
});

test('parseSettings retombe sur les valeurs par défaut données', () => {
  const defaults: Settings = { textSpeed: 'slow', animationSpeed: 'fast', language: 'en' };
  assert.deepEqual(parseSettings({}, defaults), defaults);
  assert.equal(parseSettings({ language: 'fr' }, defaults).language, 'fr');
});

test('la vitesse du texte : plus rapide veut dire un délai plus court, instantané vaut 0', () => {
  const steps = TEXT_SPEEDS.map((textSpeed) => textStepMs({ ...DEFAULT_SETTINGS, textSpeed }));
  assert.deepEqual(steps, [50, 25, 10, 0]);
});

test("la vitesse des animations met les durées à l'échelle", () => {
  const durations = ANIMATION_SPEEDS.map((animationSpeed) => animationMs({ ...DEFAULT_SETTINGS, animationSpeed }, 600));
  assert.deepEqual(durations, [600, 300, 120]);
});
