// Réglages du joueur, enregistrés dans le navigateur (voir storage.ts). Rien ici ne touche au DOM.
export const TEXT_SPEEDS = ['slow', 'normal', 'fast', 'instant'] as const;
export const ANIMATION_SPEEDS = ['normal', 'fast', 'veryFast'] as const;
export const LANGUAGES = ['fr', 'en'] as const; // mêmes codes que les dictionnaires de i18n/

export type TextSpeed = (typeof TEXT_SPEEDS)[number];
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];
export type Language = (typeof LANGUAGES)[number];

export interface Settings {
  textSpeed: TextSpeed;
  animationSpeed: AnimationSpeed;
  language: Language;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = { textSpeed: 'normal', animationSpeed: 'normal', language: 'fr' };

const CHOICES: Record<SettingKey, readonly string[]> = {
  textSpeed: TEXT_SPEEDS,
  animationSpeed: ANIMATION_SPEEDS,
  language: LANGUAGES,
};

const TEXT_STEP_MS: Record<TextSpeed, number> = { slow: 50, normal: 25, fast: 10, instant: 0 };
const ANIMATION_FACTOR: Record<AnimationSpeed, number> = { normal: 1, fast: 0.5, veryFast: 0.2 };

// Délai entre deux lettres d'un dialogue ; 0 = tout le texte d'un coup.
export function textStepMs(settings: Settings): number {
  return TEXT_STEP_MS[settings.textSpeed];
}

// Durée d'une étape d'animation (déplacement, coup, pause) une fois la vitesse choisie appliquée.
export function animationMs(settings: Settings, ms: number): number {
  return Math.round(ms * ANIMATION_FACTOR[settings.animationSpeed]);
}

// Passe un réglage à sa valeur suivante, en revenant à la première après la dernière.
export function cycleSetting(settings: Settings, key: SettingKey): Settings {
  const values = CHOICES[key];
  const next = values[(values.indexOf(settings[key]) + 1) % values.length];
  return { ...settings, [key]: next ?? settings[key] };
}

function pick<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

// Lit des réglages venus du stockage, donc à ne pas croire : tout champ absent ou inconnu retombe sur `defaults`.
export function parseSettings(raw: unknown, defaults: Settings = DEFAULT_SETTINGS): Settings {
  const data: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {};
  return {
    textSpeed: pick(TEXT_SPEEDS, data['textSpeed'], defaults.textSpeed),
    animationSpeed: pick(ANIMATION_SPEEDS, data['animationSpeed'], defaults.animationSpeed),
    language: pick(LANGUAGES, data['language'], defaults.language),
  };
}
