import { stateFromRows } from '../core/grid.ts';
import type { GameState } from '../core/types.ts';

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

export function createChapter1(): GameState {
  return stateFromRows(MAP, [
    { id: 'p1', team: 'player', classId: 'swordsman', pos: { x: 3, y: 9 } },
    { id: 'p2', team: 'player', classId: 'lancer', pos: { x: 4, y: 10 } },
    { id: 'p3', team: 'player', classId: 'archer', pos: { x: 5, y: 9 } },
    { id: 'e1', team: 'enemy', classId: 'swordsman', pos: { x: 16, y: 6 } },
    { id: 'e2', team: 'enemy', classId: 'lancer', pos: { x: 9, y: 9 } },
    { id: 'e3', team: 'enemy', classId: 'archer', pos: { x: 18, y: 3 } },
  ]);
}
