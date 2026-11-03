import { stateFromRows } from '../core/grid.ts';
import type { ClassId, GameState, Pos, Stats, Team, Unit, WeaponId } from '../core/types.ts';

// . plaine   f forêt   m montagne   # mur
const MAP = [
  'mmmm..........ff........',
  'mmm...........fff.......',
  'mm.......ff...ff........',
  'm........ff.............',
  '........................',
  '....####....mm....ffff..',
  '....#..#....mmm....ff...',
  '....#..#.....m..........',
  '....##.#................',
  '........................',
  '..ff....................',
  '.fff.........mm.........',
  '..ff........mmm.....ff..',
  '............mm.......fff',
  '.............m..........',
  '........................',
];

// Ordre des stats : PV, Force, Technique, Vitesse, Chance, Défense.
const stats = (maxHp: number, str: number, skl: number, spd: number, lck: number, def: number): Stats => ({
  maxHp,
  str,
  skl,
  spd,
  lck,
  def,
});

function unit(
  id: string,
  team: Team,
  classId: ClassId,
  weaponId: WeaponId,
  pos: Pos,
  unitStats: Stats,
  extras: Pick<Unit, 'role' | 'ai'> = {},
): Unit {
  return { id, team, classId, weaponId, pos, stats: unitStats, hp: unitStats.maxHp, acted: false, ...extras };
}

export function createChapter1(): GameState {
  return stateFromRows(MAP, [
    unit('p1', 'player', 'swordsman', 'ironSword', { x: 3, y: 9 }, stats(20, 6, 9, 11, 5, 3), { role: 'lord' }),
    unit('p2', 'player', 'lancer', 'ironLance', { x: 4, y: 10 }, stats(22, 7, 5, 6, 3, 6)),
    unit('p3', 'player', 'archer', 'ironBow', { x: 5, y: 9 }, stats(18, 5, 7, 7, 4, 2)),
    unit('e1', 'enemy', 'fighter', 'ironAxe', { x: 16, y: 6 }, stats(24, 6, 3, 5, 1, 3), { ai: 'charge' }),
    unit('e2', 'enemy', 'lancer', 'ironLance', { x: 9, y: 9 }, stats(20, 6, 4, 5, 2, 4), { ai: 'guard' }),
    unit('e3', 'enemy', 'archer', 'ironBow', { x: 18, y: 3 }, stats(16, 5, 5, 6, 2, 2), { ai: 'guard' }),
    unit('e4', 'enemy', 'fighter', 'ironAxe', { x: 20, y: 6 }, stats(26, 7, 5, 6, 2, 4), { ai: 'stationary', role: 'boss' }),
  ]);
}
