import enMessages from './en.json';
import frMessages from './fr.json';

export type MessageKey = keyof typeof frMessages;
type Messages = Record<MessageKey, string>;

// `satisfies` fait échouer la compilation si une langue a des clés en moins.
const dictionaries = { fr: frMessages, en: enMessages } satisfies Record<string, Messages>;
export type Language = keyof typeof dictionaries;

let current: Language = 'fr';

export function setLanguage(language: Language): void {
  current = language;
}

function isLanguage(code: string): code is Language {
  return Object.hasOwn(dictionaries, code);
}

// Paramètre d'URL `?lang=en` d'abord, puis langues du navigateur, français par défaut.
export function detectLanguage(): Language {
  const candidates = [new URLSearchParams(location.search).get('lang'), ...navigator.languages];
  for (const candidate of candidates) {
    const code = candidate?.slice(0, 2).toLowerCase();
    if (code !== undefined && isLanguage(code)) return code;
  }
  return 'fr';
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return dictionaries[current][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    String(params[name] ?? match),
  );
}
