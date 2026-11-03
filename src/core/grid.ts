import type { GameState, Pos, TerrainId, Unit } from './types.ts';

const LEGEND: Record<string, TerrainId> = {
  '.': 'plain',
  f: 'forest',
  m: 'mountain',
  '#': 'wall',
};

// Construit un état à partir d'une carte en texte (un caractère par tuile, voir LEGEND).
export function stateFromRows(rows: string[], units: Unit[]): GameState {
  const width = rows[0]?.length ?? 0;
  const tiles: TerrainId[] = [];
  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(`Ligne de carte de ${row.length} caractères, ${width} attendus : "${row}"`);
    }
    for (const char of row) {
      const terrain = LEGEND[char];
      if (terrain === undefined) throw new Error(`Caractère de carte inconnu : "${char}"`);
      tiles.push(terrain);
    }
  }
  return { width, height: rows.length, tiles, units, turn: 1, phase: 'player', outcome: 'playing' };
}

export function inBounds(state: GameState, pos: Pos): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.width && pos.y < state.height;
}

export function tileIndex(state: GameState, pos: Pos): number {
  return pos.y * state.width + pos.x;
}

export function distance(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function posOf(state: GameState, index: number): Pos {
  return { x: index % state.width, y: Math.floor(index / state.width) };
}

export function terrainAt(state: GameState, pos: Pos): TerrainId {
  const terrain = state.tiles[tileIndex(state, pos)];
  if (terrain === undefined) throw new Error(`Hors de la carte : ${pos.x},${pos.y}`);
  return terrain;
}

export function unitAt(state: GameState, pos: Pos): Unit | undefined {
  return state.units.find((unit) => unit.pos.x === pos.x && unit.pos.y === pos.y);
}
