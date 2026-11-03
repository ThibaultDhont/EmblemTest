import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvent, forecast, resolveCombat, targetsInRange, twoRollChance } from './combat.ts';
import { stateFromRows } from './grid.ts';
import { makeUnit, TEST_STATS } from './test-helpers.ts';
import type { Unit } from './types.ts';

const constant = (value: number) => () => value;

// Deux unités côte à côte (attaquant 'a' en 0,0, défenseur 'd' en 1,0), sauf indication contraire.
function duel(a: Partial<Unit> = {}, d: Partial<Unit> = {}, rows = ['....']) {
  const attacker = makeUnit({ id: 'a', pos: { x: 0, y: 0 }, ...a });
  const defender = makeUnit({ id: 'd', team: 'enemy', pos: { x: 1, y: 0 }, ...d });
  return { state: stateFromRows(rows, [attacker, defender]), attacker, defender };
}

test('dégâts = Force + puissance de l\'arme - Défense', () => {
  const { state, attacker, defender } = duel();
  const plan = forecast(state, attacker, defender);
  assert.equal(plan.attacker.damage, 8); // 5 + 5 - 2
  assert.equal(plan.attacker.hit, 100); // 100 + 5*2 - 5*2
});

test('triangle des armes : +1 dégât et +15 toucher à l\'avantage, l\'inverse au désavantage', () => {
  const neutral = duel({ weaponId: 'ironAxe' }, { weaponId: 'ironAxe' });
  const plain = forecast(neutral.state, neutral.attacker, neutral.defender);
  assert.equal(plain.attacker.damage, 11);
  assert.equal(plain.attacker.hit, 75);

  const advantage = duel({ weaponId: 'ironAxe' }, { weaponId: 'ironLance' });
  const won = forecast(advantage.state, advantage.attacker, advantage.defender);
  assert.equal(won.attacker.damage, 12);
  assert.equal(won.attacker.hit, 90);
  assert.equal(won.defender.damage, 9); // la lance subit le désavantage symétrique
  assert.equal(won.defender.hit, 65);

  const disadvantage = duel({ weaponId: 'ironAxe' }, { weaponId: 'ironSword' });
  const lost = forecast(disadvantage.state, disadvantage.attacker, disadvantage.defender);
  assert.equal(lost.attacker.damage, 10);
  assert.equal(lost.attacker.hit, 60);
});

test("l'arc est hors triangle", () => {
  const { state, attacker, defender } = duel({ weaponId: 'ironBow' }, { weaponId: 'ironSword', pos: { x: 2, y: 0 } }, ['...']);
  const plan = forecast(state, attacker, defender);
  assert.equal(plan.attacker.damage, 9); // 5 + 6 - 2, sans bonus
  assert.equal(plan.attacker.hit, 85); // 85 + 10 - 10
});

test('le terrain de la cible ajoute défense et esquive', () => {
  const { state, attacker, defender } = duel({}, {}, ['.f..']);
  const plan = forecast(state, attacker, defender);
  assert.equal(plan.attacker.damage, 7); // forêt : +1 défense
  assert.equal(plan.attacker.hit, 80); // forêt : +20 esquive
});

test('double attaque à partir de 4 points de Vitesse d\'écart', () => {
  const fast = duel({ stats: { ...TEST_STATS, spd: 9 } });
  assert.equal(forecast(fast.state, fast.attacker, fast.defender).attacker.strikes, 2);

  const almost = duel({ stats: { ...TEST_STATS, spd: 8 } });
  assert.equal(forecast(almost.state, almost.attacker, almost.defender).attacker.strikes, 1);

  const slow = duel({}, { stats: { ...TEST_STATS, spd: 9 } });
  const plan = forecast(slow.state, slow.attacker, slow.defender);
  assert.equal(plan.attacker.strikes, 1);
  assert.equal(plan.defender.strikes, 2);
});

test('portée : un archer attaque à 2 cases sans être contré, et ne riposte pas au corps à corps', () => {
  const ranged = duel({ weaponId: 'ironBow' }, { pos: { x: 2, y: 0 } }, ['...']);
  const shot = forecast(ranged.state, ranged.attacker, ranged.defender);
  assert.equal(shot.attacker.strikes, 1);
  assert.equal(shot.defender.strikes, 0);

  const melee = duel({}, { weaponId: 'ironBow' });
  const plan = forecast(melee.state, melee.attacker, melee.defender);
  assert.equal(plan.attacker.strikes, 1);
  assert.equal(plan.defender.strikes, 0);

  const tooClose = duel({ weaponId: 'ironBow' });
  assert.equal(forecast(tooClose.state, tooClose.attacker, tooClose.defender).attacker.strikes, 0);
});

test('critique = Technique/2 - Chance de la cible, borné à 0', () => {
  const sharp = duel({ stats: { ...TEST_STATS, skl: 12 } }, { stats: { ...TEST_STATS, lck: 2 } });
  assert.equal(forecast(sharp.state, sharp.attacker, sharp.defender).attacker.crit, 4);

  const lucky = duel({}, { stats: { ...TEST_STATS, lck: 10 } });
  assert.equal(forecast(lucky.state, lucky.attacker, lucky.defender).attacker.crit, 0);
});

test('twoRollChance correspond au dénombrement exact des deux tirages', () => {
  for (const hit of [0, 1, 10, 33, 50, 51, 75, 99, 100]) {
    let wins = 0;
    for (let first = 0; first < 100; first++) {
      for (let second = 0; second < 100; second++) {
        if ((first + second) / 2 < hit) wins++;
      }
    }
    assert.equal(twoRollChance(hit), wins / 100, `toucher ${hit}`);
  }
  assert.ok(twoRollChance(25) < 25);
  assert.ok(twoRollChance(90) > 90);
});

test('targetsInRange ne renvoie que les ennemis à portée', () => {
  const unit = makeUnit({ id: 'a', pos: { x: 0, y: 0 } });
  const state = stateFromRows(['....'], [
    unit,
    makeUnit({ id: 'near', team: 'enemy', pos: { x: 1, y: 0 } }),
    makeUnit({ id: 'far', team: 'enemy', pos: { x: 3, y: 0 } }),
    makeUnit({ id: 'ally', pos: { x: 0, y: 0 } }),
  ]);
  assert.deepEqual(targetsInRange(state, unit).map((target) => target.id), ['near']);
});

test('ordre des coups : attaquant, riposte, puis deuxième coup de celui qui double', () => {
  const { state, attacker, defender } = duel({ stats: { ...TEST_STATS, spd: 9 } });
  const events = resolveCombat(state, attacker, defender, constant(0.5));
  const summary = events.map((event) =>
    event.type === 'strike' ? `${event.attackerId}->${event.targetId}:${event.targetHp}` : `mort:${event.unitId}`,
  );
  assert.deepEqual(summary, ['a->d:12', 'd->a:12', 'a->d:4']);
});

test('un coup mortel termine le combat sans riposte', () => {
  const { state, attacker, defender } = duel({}, { hp: 5 });
  const events = resolveCombat(state, attacker, defender, constant(0.5));
  assert.deepEqual(events.map((event) => event.type), ['strike', 'death']);
  assert.equal(events[1]?.type === 'death' && events[1].unitId, 'd');
});

test('un critique triple les dégâts', () => {
  const { state, attacker, defender } = duel({}, { hp: 30 });
  const [first] = resolveCombat(state, attacker, defender, constant(0));
  assert.deepEqual(first, {
    type: 'strike', attackerId: 'a', targetId: 'd', hit: true, crit: true, damage: 24, targetHp: 6,
  });
});

test('un coup peut rater', () => {
  const { state, attacker, defender } = duel({ weaponId: 'ironAxe' }, { weaponId: 'ironSword' });
  const [first] = resolveCombat(state, attacker, defender, constant(0.99));
  assert.deepEqual(first, {
    type: 'strike', attackerId: 'a', targetId: 'd', hit: false, crit: false, damage: 0, targetHp: 20,
  });
});

test('pas de riposte hors de portée : un seul coup', () => {
  const { state, attacker, defender } = duel({ weaponId: 'ironBow' }, { pos: { x: 2, y: 0 } }, ['...']);
  const events = resolveCombat(state, attacker, defender, constant(0.5));
  assert.equal(events.length, 1);
});

test('la mort du seigneur fait perdre, celle du boss fait gagner, une autre mort ne change rien', () => {
  const lord = duel({ role: 'lord' });
  applyEvent(lord.state, { type: 'death', unitId: 'a' });
  assert.equal(lord.state.outcome, 'defeat');

  const boss = duel({}, { role: 'boss' });
  applyEvent(boss.state, { type: 'death', unitId: 'd' });
  assert.equal(boss.state.outcome, 'victory');

  const other = duel();
  applyEvent(other.state, { type: 'death', unitId: 'd' });
  assert.equal(other.state.outcome, 'playing');
});

test('applyEvent met à jour les PV et retire les morts', () => {
  const { state, attacker, defender } = duel();
  applyEvent(state, { type: 'strike', attackerId: 'a', targetId: 'd', hit: true, crit: false, damage: 8, targetHp: 12 });
  assert.equal(defender.hp, 12);
  applyEvent(state, { type: 'death', unitId: 'd' });
  assert.deepEqual(state.units.map((unit) => unit.id), [attacker.id]);
});
