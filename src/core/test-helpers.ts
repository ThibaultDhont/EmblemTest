import type { Stats, Unit } from './types.ts';

// Utilitaires partagés par les tests de core/ (vérifiés par tsc, absents du jeu livré).
export const TEST_STATS: Stats = { maxHp: 20, str: 5, skl: 5, spd: 5, lck: 0, def: 2 };

export function makeUnit(overrides: Partial<Unit> & Pick<Unit, 'id'>): Unit {
  return {
    team: 'player',
    classId: 'swordsman',
    pos: { x: 0, y: 0 },
    stats: { ...TEST_STATS },
    hp: TEST_STATS.maxHp,
    weaponId: 'ironSword',
    acted: false,
    ...overrides,
  };
}
