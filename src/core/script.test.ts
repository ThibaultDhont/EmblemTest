import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScript } from './script.ts';

test('un script avec répliques et portraits devient une liste d\'événements', () => {
  const events = parseScript(`
    # intro du chapitre
    @event intro quand chapitre.debut
      @montre anna gauche
      anna: ch1.intro.1
      @cache anna

    @event fin quand chapitre.victoire
      marc: ch1.fin.1
  `);
  assert.deepEqual(events, [
    {
      id: 'intro',
      trigger: 'chapitre.debut',
      commands: [
        { op: 'show', who: 'anna', side: 'gauche' },
        { op: 'say', speaker: 'anna', key: 'ch1.intro.1' },
        { op: 'hide', who: 'anna' },
      ],
    },
    { id: 'fin', trigger: 'chapitre.victoire', commands: [{ op: 'say', speaker: 'marc', key: 'ch1.fin.1' }] },
  ]);
});

test('les fins de ligne Windows et les espaces autour des deux-points sont acceptés', () => {
  const events = parseScript('@event a quand chapitre.defaite\r\n  anna : ch1.a\r\n');
  assert.deepEqual(events[0]?.commands, [{ op: 'say', speaker: 'anna', key: 'ch1.a' }]);
});

test("un script vide ou fait de commentaires ne contient aucun événement", () => {
  assert.deepEqual(parseScript(''), []);
  assert.deepEqual(parseScript('# rien\n\n'), []);
});

test("une erreur indique le numéro de ligne", () => {
  assert.throws(() => parseScript('@event a quand chapitre.debut\n  @inconnu x'), /Ligne 2 : commande inconnue/);
  assert.throws(() => parseScript('anna: ch1.a'), /Ligne 1 : .*@event/);
  assert.throws(() => parseScript('@event a quand jamais'), /Ligne 1 : .*déclencheur/);
  assert.throws(() => parseScript('@event a\n'), /Ligne 1 : syntaxe attendue/);
});

test('syntaxes invalides des répliques et des portraits', () => {
  const inEvent = (line: string) => `@event a quand chapitre.debut\n  ${line}`;
  assert.throws(() => parseScript(inEvent('anna dit bonjour')), /Ligne 2 : réplique invalide/);
  assert.throws(() => parseScript(inEvent('@montre anna milieu')), /Ligne 2 : .*@montre/);
  assert.throws(() => parseScript(inEvent('@montre anna')), /Ligne 2 : .*@montre/);
  assert.throws(() => parseScript(inEvent('@cache')), /Ligne 2 : .*@cache/);
});

test('deux événements ne peuvent pas porter le même nom', () => {
  assert.throws(
    () => parseScript('@event a quand chapitre.debut\n@event a quand chapitre.victoire'),
    /Ligne 2 : l'événement « a » existe déjà/,
  );
});
