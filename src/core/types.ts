export interface Pos {
  readonly x: number;
  readonly y: number;
}

export type Team = 'player' | 'enemy';
export type TerrainId = 'plain' | 'forest' | 'mountain' | 'wall';
export type ClassId = 'swordsman' | 'lancer' | 'archer' | 'fighter';
export type WeaponType = 'sword' | 'lance' | 'axe' | 'bow';
export type WeaponId = 'ironSword' | 'ironLance' | 'ironAxe' | 'ironBow';

// Seigneur : sa mort fait perdre. Boss : sa mort fait gagner.
export type Role = 'lord' | 'boss';

// charge : attaque ou avance vers le joueur · guard : attaque seulement ce qu'il peut atteindre,
// sans quitter son poste sinon · stationary : n'attaque que ce qui est à portée de sa case.
export type AiProfile = 'charge' | 'guard' | 'stationary';

export type Outcome = 'playing' | 'victory' | 'defeat';

// Ce qu'il faut accomplir pour gagner : vaincre le boss, vaincre tous les ennemis, tenir jusqu'à la fin de
// la phase ennemie du tour `turns`, faire arriver une unité du joueur sur une case (`reach`), ou y faire
// arriver une unité précise dont la mort fait perdre (`escort`). La mort du seigneur fait toujours perdre.
export type Objective =
  | { type: 'boss' }
  | { type: 'rout' }
  | { type: 'survive'; turns: number }
  | { type: 'reach'; x: number; y: number }
  | { type: 'escort'; unit: string; x: number; y: number };

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
  acted: boolean; // a déjà agi pendant la phase en cours
  role?: Role;
  ai?: AiProfile; // profil des unités ennemies, 'charge' par défaut
}

// État de partie : données pures, sérialisables avec JSON.stringify, sans lien avec le DOM.
export interface GameState {
  width: number;
  height: number;
  tiles: TerrainId[]; // ligne par ligne : index = y * width + x
  units: Unit[];
  turn: number;
  phase: Team; // camp qui joue
  outcome: Outcome;
  objective: Objective;
  fired: string[]; // identifiants des événements de script déjà joués
  flags: string[]; // drapeaux de récit actifs, posés et lus par les scripts
  reserve: Unit[]; // unités hors de la carte, que @apparait y fera arriver
}
