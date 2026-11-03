export interface Pos {
  readonly x: number;
  readonly y: number;
}

export type Team = 'player' | 'enemy';
export type TerrainId = 'plain' | 'forest' | 'mountain' | 'wall';
export type ClassId = 'swordsman' | 'lancer' | 'archer' | 'fighter';
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow';
export type WeaponId = 'ironSword' | 'ironLance' | 'ironAxe' | 'ironBow';

export interface Stats {
  maxHp: number;
  str: number; // Force
  skl: number; // Technique
  spd: number; // Vitesse
  lck: number; // Chance
  def: number; // Défense
}

export interface Unit {
  id: string;
  team: Team;
  classId: ClassId;
  pos: Pos;
  stats: Stats;
  hp: number;
  weaponId: WeaponId;
  acted: boolean; // a déjà agi pendant le tour en cours
}

// État de partie : données pures, sérialisables avec JSON.stringify, sans lien avec le DOM.
export interface GameState {
  width: number;
  height: number;
  tiles: TerrainId[]; // ligne par ligne : index = y * width + x
  units: Unit[];
  turn: number;
}
