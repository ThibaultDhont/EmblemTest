import { CLASSES } from '../data/classes.ts';
import { TERRAINS } from '../data/terrains.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { GameState, Objective, Pos, Stats, Unit } from './types.ts';

// Sauvegarde de partie. Rien ici ne touche au DOM : le stockage est dans storage.ts. Une sauvegarde vient du
// navigateur, donc d'un endroit où n'importe qui peut écrire : elle est relue avec une validation complète.
export const SAVE_VERSION = 1;
export const SLOTS = ['auto', 'manual1', 'manual2', 'manual3'] as const;
export const CHAPTERS = ['chapter1'] as const; // les chapitres que cette version du jeu connaît

export type Slot = (typeof SLOTS)[number];
export type ChapterId = (typeof CHAPTERS)[number];

// Une réplique déjà vue, gardée pour l'historique (le texte est traduit à l'affichage).
export interface LogEntry {
  eventId: string;
  speaker: string;
  key: string;
}

// On ne sauvegarde qu'au repos, pendant le tour du joueur : pas de mode de l'interface ni de caméra à garder.
export interface Save {
  version: number;
  chapter: ChapterId;
  savedAt: number; // millisecondes depuis 1970
  state: GameState;
  log: LogEntry[];
}

export type SlotRead = { kind: 'empty' } | { kind: 'broken' } | { kind: 'ok'; save: Save };

export function createSave(chapter: ChapterId, state: GameState, log: LogEntry[], savedAt = Date.now()): Save {
  return { version: SAVE_VERSION, chapter, savedAt, state: structuredClone(state), log: log.map((entry) => ({ ...entry })) };
}

// Lit le texte d'un emplacement : vide s'il n'y a rien, illisible si ce n'est pas une sauvegarde valable.
export function readSave(text: string | null): SlotRead {
  if (text === null) return { kind: 'empty' };
  try {
    const save = parseSave(JSON.parse(text));
    return save === undefined ? { kind: 'broken' } : { kind: 'ok', save };
  } catch {
    return { kind: 'broken' };
  }
}

type Data = Record<string, unknown>;

const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isInteger(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
const isKey = (table: object, value: unknown): value is string => isText(value) && Object.hasOwn(table, value);

const MAX_CELLS = 10_000; // une carte plus grande serait une erreur ou un abus, pas un chapitre
const MAX_LOG = 1_000;

function parsePos(width: number, height: number, x: unknown, y: unknown): Pos | undefined {
  return isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < width && y < height ? { x, y } : undefined;
}

function parseStats(raw: unknown): Stats | undefined {
  if (!isData(raw)) return undefined;
  const { maxHp, str, skl, spd, lck, def } = raw;
  if (!isNumber(maxHp) || !isNumber(str) || !isNumber(skl) || !isNumber(spd) || !isNumber(lck) || !isNumber(def)) return undefined;
  return maxHp >= 1 ? { maxHp, str, skl, spd, lck, def } : undefined;
}

function parseUnit(raw: unknown, width: number, height: number): Unit | undefined {
  if (!isData(raw)) return undefined;
  const { id, team, classId, pos, stats, hp, weaponId, acted, role, ai } = raw;
  const where = isData(pos) ? parsePos(width, height, pos['x'], pos['y']) : undefined;
  const unitStats = parseStats(stats);
  if (!isText(id) || id === '' || (team !== 'player' && team !== 'enemy')) return undefined;
  if (!isKey(CLASSES, classId) || !isKey(WEAPONS, weaponId) || typeof acted !== 'boolean') return undefined;
  if (where === undefined || unitStats === undefined || !isNumber(hp) || hp < 1 || hp > unitStats.maxHp) return undefined;
  if (role !== undefined && role !== 'lord' && role !== 'boss') return undefined;
  if (ai !== undefined && ai !== 'charge' && ai !== 'guard' && ai !== 'stationary') return undefined;
  return {
    id,
    team,
    classId: classId as Unit['classId'],
    pos: where,
    stats: unitStats,
    hp,
    weaponId: weaponId as Unit['weaponId'],
    acted,
    ...(role === undefined ? {} : { role }),
    ...(ai === undefined ? {} : { ai }),
  };
}

function parseUnits(raw: unknown, width: number, height: number): Unit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const units = raw.map((entry) => parseUnit(entry, width, height));
  return units.every((unit) => unit !== undefined) ? units : undefined;
}

function parseObjective(raw: unknown, width: number, height: number): Objective | undefined {
  if (!isData(raw)) return undefined;
  switch (raw['type']) {
    case 'boss':
      return { type: 'boss' };
    case 'rout':
      return { type: 'rout' };
    case 'survive': {
      const turns = raw['turns'];
      return isInt(turns) && turns >= 1 ? { type: 'survive', turns } : undefined;
    }
    case 'reach': {
      const pos = parsePos(width, height, raw['x'], raw['y']);
      return pos === undefined ? undefined : { type: 'reach', x: pos.x, y: pos.y };
    }
    case 'escort': {
      const pos = parsePos(width, height, raw['x'], raw['y']);
      const unit = raw['unit'];
      return pos === undefined || !isText(unit) ? undefined : { type: 'escort', unit, x: pos.x, y: pos.y };
    }
    default:
      return undefined;
  }
}

// Seul l'état d'un joueur au repos est sauvegardé : sa phase, une partie en cours. Le reste serait une corruption.
function parseState(raw: unknown): GameState | undefined {
  if (!isData(raw)) return undefined;
  const { width, height, tiles, turn, phase, outcome, fired, flags } = raw;
  if (!isInt(width) || !isInt(height) || width < 1 || height < 1 || width * height > MAX_CELLS) return undefined;
  if (!Array.isArray(tiles) || tiles.length !== width * height || !tiles.every((tile) => isKey(TERRAINS, tile))) return undefined;
  if (!isInt(turn) || turn < 1 || phase !== 'player' || outcome !== 'playing') return undefined;
  if (!isTexts(fired) || !isTexts(flags)) return undefined;

  const units = parseUnits(raw['units'], width, height);
  const reserve = parseUnits(raw['reserve'], width, height);
  const objective = parseObjective(raw['objective'], width, height);
  if (units === undefined || reserve === undefined || objective === undefined) return undefined;

  const ids = [...units, ...reserve].map((unit) => unit.id);
  if (new Set(ids).size !== ids.length || !units.some((unit) => unit.team === 'player')) return undefined;
  return { width, height, tiles: tiles as GameState['tiles'], units, turn, phase, outcome, objective, fired: [...fired], flags: [...flags], reserve };
}

function parseLog(raw: unknown): LogEntry[] | undefined {
  if (!Array.isArray(raw) || raw.length > MAX_LOG) return undefined;
  const entries = raw.map((entry): LogEntry | undefined =>
    isData(entry) && isText(entry['eventId']) && isText(entry['speaker']) && isText(entry['key'])
      ? { eventId: entry['eventId'], speaker: entry['speaker'], key: entry['key'] }
      : undefined,
  );
  return entries.every((entry) => entry !== undefined) ? entries : undefined;
}

// Une sauvegarde valable ou rien : jamais une demi-sauvegarde. Les champs inconnus sont ignorés.
export function parseSave(raw: unknown): Save | undefined {
  if (!isData(raw) || raw['version'] !== SAVE_VERSION) return undefined;
  const chapter = CHAPTERS.find((id) => id === raw['chapter']);
  const state = parseState(raw['state']);
  const log = parseLog(raw['log']);
  const savedAt = raw['savedAt'];
  if (chapter === undefined || state === undefined || log === undefined || !isNumber(savedAt)) return undefined;
  return { version: SAVE_VERSION, chapter, savedAt, state, log };
}
