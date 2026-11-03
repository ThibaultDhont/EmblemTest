import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScript } from './script.ts';

const inEvent = (...lines: string[]) => `@event a quand chapitre.debut\n${lines.map((line) => `  ${line}`).join('\n')}`;

test("un script avec répliques et portraits devient une liste d'événements", () => {
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

test('un script vide ou fait de commentaires ne contient aucun événement', () => {
  assert.deepEqual(parseScript(''), []);
  assert.deepEqual(parseScript('# rien\n\n'), []);
});

test('les déclencheurs de tour et de mort prennent un paramètre', () => {
  const events = parseScript(`
    @event a quand tour.joueur(3)
      anna: x.1
    @event b quand tour.ennemi(2)
      anna: x.2
    @event c quand mort(brutus)
      anna: x.3
  `);
  assert.deepEqual(
    events.map((event) => event.trigger),
    ['tour.joueur(3)', 'tour.ennemi(2)', 'mort(brutus)'],
  );
});

test('un déclencheur mal formé est refusé', () => {
  for (const trigger of ['jamais', 'tour.joueur(0)', 'tour.joueur(x)', 'tour.joueur', 'mort()', 'mort(Brutus)', 'tour.autre(1)']) {
    assert.throws(() => parseScript(`@event a quand ${trigger}`), /Ligne 1 : .*déclencheur/, trigger);
  }
});

test('les drapeaux se posent avec @drapeau et s\'effacent avec @efface', () => {
  const events = parseScript(inEvent('@drapeau route-b', '@efface route-a'));
  assert.deepEqual(events[0]?.commands, [
    { op: 'flag', name: 'route-b', value: true },
    { op: 'flag', name: 'route-a', value: false },
  ]);
});

test('toutes les formes de condition sont reconnues', () => {
  const conditionOf = (condition: string) => {
    const command = parseScript(inEvent(`@si ${condition}`, '@fin'))[0]?.commands[0];
    return command?.op === 'if' ? command.condition : undefined;
  };
  assert.deepEqual(conditionOf('vivant(anna)'), { type: 'alive', unit: 'anna' });
  assert.deepEqual(conditionOf('mort(e2)'), { type: 'dead', unit: 'e2' });
  assert.deepEqual(conditionOf('drapeau(route-b)'), { type: 'flag', name: 'route-b' });
  assert.deepEqual(conditionOf('tour >= 3'), { type: 'turn', op: '>=', value: 3 });
  assert.deepEqual(conditionOf('tour == 1'), { type: 'turn', op: '==', value: 1 });
  assert.deepEqual(conditionOf('non vivant(marc)'), { type: 'not', condition: { type: 'alive', unit: 'marc' } });
  assert.deepEqual(conditionOf('non non drapeau(x)'), {
    type: 'not',
    condition: { type: 'not', condition: { type: 'flag', name: 'x' } },
  });
});

test('un bloc @si garde ses deux branches et peut être imbriqué', () => {
  const [event] = parseScript(
    inEvent(
      '@si vivant(anna)',
      '  anna: x.1',
      '  @si non drapeau(vu)',
      '    anna: x.2',
      '  @fin',
      '@sinon',
      '  marc: x.3',
      '@fin',
      'marc: x.4',
    ),
  );
  assert.deepEqual(event?.commands, [
    {
      op: 'if',
      condition: { type: 'alive', unit: 'anna' },
      then: [
        { op: 'say', speaker: 'anna', key: 'x.1' },
        {
          op: 'if',
          condition: { type: 'not', condition: { type: 'flag', name: 'vu' } },
          then: [{ op: 'say', speaker: 'anna', key: 'x.2' }],
          otherwise: [],
        },
      ],
      otherwise: [{ op: 'say', speaker: 'marc', key: 'x.3' }],
    },
    { op: 'say', speaker: 'marc', key: 'x.4' },
  ]);
});

test('une erreur indique le numéro de ligne', () => {
  assert.throws(() => parseScript(inEvent('@inconnu x')), /Ligne 2 : commande inconnue/);
  assert.throws(() => parseScript('anna: ch1.a'), /Ligne 1 : .*@event/);
  assert.throws(() => parseScript('@event a\n'), /Ligne 1 : syntaxe attendue/);
});

test('syntaxes invalides des répliques et des portraits', () => {
  assert.throws(() => parseScript(inEvent('anna dit bonjour')), /Ligne 2 : réplique invalide/);
  assert.throws(() => parseScript(inEvent('@montre anna milieu')), /Ligne 2 : .*@montre/);
  assert.throws(() => parseScript(inEvent('@montre anna')), /Ligne 2 : .*@montre/);
  assert.throws(() => parseScript(inEvent('@cache')), /Ligne 2 : .*@cache/);
  assert.throws(() => parseScript(inEvent('@drapeau')), /Ligne 2 : .*@drapeau/);
  assert.throws(() => parseScript(inEvent('@efface Route')), /Ligne 2 : .*@efface/);
});

test('conditions invalides', () => {
  for (const condition of ['', 'non', 'inconnu(x)', 'vivant()', 'tour >> 3', 'tour >= x', 'vivant(a) et vivant(b)']) {
    assert.throws(() => parseScript(inEvent(`@si ${condition}`, '@fin')), /Ligne 2 : condition invalide/, condition);
  }
});

test('les blocs @si doivent être bien formés', () => {
  assert.throws(() => parseScript(inEvent('@sinon')), /Ligne 2 : @sinon en dehors/);
  assert.throws(() => parseScript(inEvent('@fin')), /Ligne 2 : @fin sans @si/);
  assert.throws(() => parseScript(inEvent('@si vivant(a)', '@sinon', '@sinon', '@fin')), /Ligne 4 : .*déjà un @sinon/);
  assert.throws(() => parseScript(inEvent('@si vivant(a)', 'anna: x.1')), /Ligne 2 : .*jamais fermé/);
  assert.throws(
    () => parseScript(`${inEvent('@si vivant(a)')}\n@event b quand chapitre.victoire`),
    /Ligne 2 : .*jamais fermé/,
  );
});

test('un @choix garde ses options, avec leurs commandes', () => {
  const [event] = parseScript(
    inEvent('@choix', '  @option x.oui', '    @drapeau oui', '    anna: x.1', '  @option x.non', '    anna: x.2', '@fin', 'anna: x.3'),
  );
  assert.deepEqual(event?.commands, [
    {
      op: 'choice',
      options: [
        {
          key: 'x.oui',
          commands: [
            { op: 'flag', name: 'oui', value: true },
            { op: 'say', speaker: 'anna', key: 'x.1' },
          ],
        },
        { key: 'x.non', commands: [{ op: 'say', speaker: 'anna', key: 'x.2' }] },
      ],
    },
    { op: 'say', speaker: 'anna', key: 'x.3' },
  ]);
});

test('un @choix peut contenir des @si et d\'autres @choix', () => {
  const [event] = parseScript(
    inEvent(
      '@choix',
      '  @option x.a',
      '    @si drapeau(ok)',
      '      anna: x.1',
      '    @fin',
      '    @choix',
      '      @option x.b',
      '        anna: x.2',
      '    @fin',
      '@fin',
    ),
  );
  const outer = event?.commands[0];
  assert.equal(outer?.op, 'choice');
  const commands = outer?.op === 'choice' ? (outer.options[0]?.commands ?? []) : [];
  assert.deepEqual(
    commands.map((command) => command.op),
    ['if', 'choice'],
  );
});

test('les @choix mal formés sont refusés', () => {
  assert.throws(() => parseScript(inEvent('@option x.a')), /Ligne 2 : @option en dehors/);
  assert.throws(() => parseScript(inEvent('@choix extra', '@fin')), /Ligne 2 : .*@choix/);
  assert.throws(() => parseScript(inEvent('@choix', '  anna: x.1', '  @option x.a', '@fin')), /Ligne 3 : .*sous une @option/);
  assert.throws(() => parseScript(inEvent('@choix', '@fin')), /Ligne 2 : .*aucune @option/);
  assert.throws(() => parseScript(inEvent('@choix', '@option')), /Ligne 3 : .*@option/);
  assert.throws(() => parseScript(inEvent('@choix', '@sinon')), /Ligne 3 : @sinon en dehors/);
  assert.throws(() => parseScript(inEvent('@choix', '@option x.a')), /Ligne 2 : .*@choix n'est jamais fermé/);
  assert.throws(
    () => parseScript(inEvent('@choix', '@option x.1', '@option x.2', '@option x.3', '@option x.4', '@option x.5', '@fin')),
    /Ligne 7 : .*au plus 4 options/,
  );
});

test('les commandes de mise en scène des unités sont reconnues', () => {
  const [event] = parseScript(inEvent('@apparait e4 23 8', '@deplace e4 21 9', '@recrute rik'));
  assert.deepEqual(event?.commands, [
    { op: 'spawn', unit: 'e4', x: 23, y: 8 },
    { op: 'move', unit: 'e4', x: 21, y: 9 },
    { op: 'recruit', unit: 'rik' },
  ]);
});

test('syntaxes invalides de la mise en scène des unités', () => {
  assert.throws(() => parseScript(inEvent('@apparait e4 23')), /Ligne 2 : .*@apparait/);
  assert.throws(() => parseScript(inEvent('@apparait E4 1 2')), /Ligne 2 : .*@apparait/);
  assert.throws(() => parseScript(inEvent('@deplace e4 x 2')), /Ligne 2 : .*@deplace/);
  assert.throws(() => parseScript(inEvent('@deplace e4 -1 2')), /Ligne 2 : .*@deplace/);
  assert.throws(() => parseScript(inEvent('@recrute')), /Ligne 2 : .*@recrute/);
  assert.throws(() => parseScript(inEvent('@recrute a b')), /Ligne 2 : .*@recrute/);
});

test('deux événements ne peuvent pas porter le même nom', () => {
  assert.throws(
    () => parseScript('@event a quand chapitre.debut\n@event a quand chapitre.victoire'),
    /Ligne 2 : l'événement « a » existe déjà/,
  );
});
