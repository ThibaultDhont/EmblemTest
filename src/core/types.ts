export interface Pos {
  readonly x: number;
  readonly y: number;
}

export type Team = 'player' | 'enemy';
export type TerrainId = 'plain' | 'forest' | 'mountain' | 'wall';
export type ClassId = 'swordsman' | 'lancer' | 'archer';

export interface Unit {
  id: string;
  team: Team;
  classId: ClassId;
  pos: Pos;
}

// État de partie : données pures, sérialisables avec JSON.stringify, sans lien avec le DOM.
export interface GameState {
  width: number;
  height: number;
  tiles: TerrainId[]; // ligne par ligne : index = y * width + x
  units: Unit[];
}
