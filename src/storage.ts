import { parseSettings } from './core/settings.ts';
import type { Settings } from './core/settings.ts';

const SETTINGS_KEY = 'tactics.settings';

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
