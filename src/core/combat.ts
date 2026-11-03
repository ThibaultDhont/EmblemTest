import { TERRAINS } from '../data/terrains.ts';
import { WEAPONS } from '../data/weapons.ts';
import { distance, posOf, terrainAt } from './grid.ts';
import type { GameState, Unit, WeaponType } from './types.ts';

export type Rng = () => number; // renvoie un nombre dans [0, 1)

// Chiffres d'un combattant face à son adversaire.
export interface Combatant {
  damage: number; // dégâts par coup qui touche
  hit: number; // toucher nominal, de 0 à 100
  chance: number; // chances réelles de toucher, en % : le 2RN écarte le réel du nominal
  crit: number; // chances de critique, en %
  strikes: number; // 0 : adversaire hors de portée, ce combattant n'attaque pas
}

export interface Forecast {
  attacker: Combatant;
  defender: Combatant;
}

// Un combat se résout en événements, appliqués et affichés un par un.
export type CombatEvent =
  | {
      type: 'strike';
      attackerId: string;
      targetId: string;
      hit: boolean;
      crit: boolean;
      damage: number; // 0 si le coup rate
      targetHp: number; // PV de la cible après le coup
    }
  | { type: 'death'; unitId: string };

const CRIT_MULTIPLIER = 3;
const TRIANGLE_HIT = 15;
const DOUBLE_SPEED_GAP = 4;

// Triangle des armes : chaque clé bat sa valeur. L'arc est hors triangle.
const BEATS: Partial<Record<WeaponType, WeaponType>> = { sword: 'axe', axe: 'lance', lance: 'sword' };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function triangleBonus(mine: WeaponType, theirs: WeaponType): number {
  if (BEATS[mine] === theirs) return 1;
  if (BEATS[theirs] === mine) return -1;
  return 0;
}

function inRange(unit: Unit, gap: number): boolean {
  const weapon = WEAPONS[unit.weaponId];
  return gap >= weapon.minRange && gap <= weapon.maxRange;
}

// Probabilité (en %) que la moyenne de deux tirages entiers de 0 à 99 soit strictement
// inférieure à `hit` : c'est le 2RN de Fire Emblem, qui favorise les forts pourcentages.
export function twoRollChance(hit: number): number {
  const maxWinningSum = 2 * hit - 1;
  if (maxWinningSum < 0) return 0;
  if (maxWinningSum >= 198) return 100;
  const pairs =
    maxWinningSum <= 99
      ? ((maxWinningSum + 1) * (maxWinningSum + 2)) / 2
      : 10000 - ((198 - maxWinningSum) * (199 - maxWinningSum)) / 2;
  return pairs / 100;
}

function strikeCount(unit: Unit, foe: Unit, gap: number): number {
  if (!inRange(unit, gap)) return 0;
  return unit.stats.spd - foe.stats.spd >= DOUBLE_SPEED_GAP ? 2 : 1;
}

function combatant(state: GameState, unit: Unit, foe: Unit, strikes: number): Combatant {
  const weapon = WEAPONS[unit.weaponId];
  const bonus = triangleBonus(weapon.type, WEAPONS[foe.weaponId].type);
  const terrain = TERRAINS[terrainAt(state, foe.pos)];

  const damage = Math.max(0, unit.stats.str + weapon.might + bonus - (foe.stats.def + terrain.defBonus));
  const accuracy = weapon.hit + unit.stats.skl * 2 + Math.floor(unit.stats.lck / 2) + bonus * TRIANGLE_HIT;
  const avoid = foe.stats.spd * 2 + foe.stats.lck + terrain.avoidBonus;
  const hit = clamp(accuracy - avoid, 0, 100);
  const crit = clamp(weapon.crit + Math.floor(unit.stats.skl / 2) - foe.stats.lck, 0, 100);
  return { damage, hit, chance: twoRollChance(hit), crit, strikes };
}

export function forecast(state: GameState, attacker: Unit, defender: Unit): Forecast {
  const gap = distance(attacker.pos, defender.pos);
  return {
    attacker: combatant(state, attacker, defender, strikeCount(attacker, defender, gap)),
    defender: combatant(state, defender, attacker, strikeCount(defender, attacker, gap)),
  };
}

// Ennemis que `unit` peut attaquer depuis sa position actuelle.
export function targetsInRange(state: GameState, unit: Unit): Unit[] {
  return state.units.filter((other) => other.team !== unit.team && inRange(unit, distance(unit.pos, other.pos)));
}

// Index des cases à portée d'attaque de `unit` (la zone rouge).
export function tilesInRange(state: GameState, unit: Unit): number[] {
  const tiles: number[] = [];
  for (let index = 0; index < state.tiles.length; index++) {
    if (inRange(unit, distance(unit.pos, posOf(state, index)))) tiles.push(index);
  }
  return tiles;
}

// Calcule le combat sans toucher à l'état. Ordre des coups : attaquant, riposte, puis le
// deuxième coup de celui qui double. Un jet de critique n'est tiré que si le coup touche.
export function resolveCombat(state: GameState, attacker: Unit, defender: Unit, rng: Rng): CombatEvent[] {
  const plan = forecast(state, attacker, defender);
  if (plan.attacker.strikes === 0) return [];

  const order: Array<'attacker' | 'defender'> = ['attacker'];
  if (plan.defender.strikes >= 1) order.push('defender');
  if (plan.attacker.strikes >= 2) order.push('attacker');
  if (plan.defender.strikes >= 2) order.push('defender');

  const roll = (): number => Math.floor(rng() * 100);
  const hp = new Map([
    [attacker.id, attacker.hp],
    [defender.id, defender.hp],
  ]);
  const events: CombatEvent[] = [];

  for (const side of order) {
    const [from, to, stats] =
      side === 'attacker' ? [attacker, defender, plan.attacker] : [defender, attacker, plan.defender];
    const hit = (roll() + roll()) / 2 < stats.hit;
    const crit = hit && roll() < stats.crit;
    const damage = hit ? stats.damage * (crit ? CRIT_MULTIPLIER : 1) : 0;
    const targetHp = Math.max(0, (hp.get(to.id) ?? 0) - damage);
    hp.set(to.id, targetHp);
    events.push({ type: 'strike', attackerId: from.id, targetId: to.id, hit, crit, damage, targetHp });
    if (targetHp === 0) {
      events.push({ type: 'death', unitId: to.id });
      break;
    }
  }
  return events;
}

export function applyEvent(state: GameState, event: CombatEvent): void {
  if (event.type === 'strike') {
    const target = state.units.find((unit) => unit.id === event.targetId);
    if (target !== undefined) target.hp = event.targetHp;
  } else {
    state.units = state.units.filter((unit) => unit.id !== event.unitId);
  }
}
