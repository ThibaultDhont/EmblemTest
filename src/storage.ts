import { SLOTS, readSave } from './core/save.ts';
import type { Save, Slot, SlotRead } from './core/save.ts';
import { parseSettings } from './core/settings.ts';
import type { Settings } from './core/settings.ts';

const SETTINGS_KEY = 'tactics.settings';
const SLOT_KEYS: Record<Slot, string> = {
  auto: 'tactics.save.auto',
  manual1: 'tactics.save.1',
  manual2: 'tactics.save.2',
  manual3: 'tactics.save.3',
};

// Le navigateur peut refuser le stockage (navigation privée, données bloquées) : le jeu doit fonctionner sans.
export function loadSettings(defaults: Settings): Settings {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    return parseSettings(text === null ? null : JSON.parse(text), defaults);
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Sans stockage, le réglage dure jusqu'au rechargement de la page.
  }
}

// Sans stockage, tous les emplacements paraissent vides.
export function readSlot(slot: Slot): SlotRead {
  try {
    return readSave(localStorage.getItem(SLOT_KEYS[slot]));
  } catch {
    return { kind: 'empty' };
  }
}

export function readSlots(): Record<Slot, SlotRead> {
  return Object.fromEntries(SLOTS.map((slot) => [slot, readSlot(slot)])) as Record<Slot, SlotRead>;
}

// Faux quand le navigateur refuse d'écrire (stockage plein ou interdit) : l'appelant le dit au joueur.
export function writeSlot(slot: Slot, save: Save): boolean {
  try {
    localStorage.setItem(SLOT_KEYS[slot], JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
