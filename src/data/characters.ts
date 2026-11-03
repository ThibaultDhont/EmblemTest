// Portraits provisoires : un aplat de couleur et une initiale. Les noms sont dans story.fr.json (char.<id>).
export interface CharacterDef {
  color: string;
  initial: string;
}

export const CHARACTERS: Record<string, CharacterDef> = {
  anna: { color: '#c9503f', initial: 'A' },
  marc: { color: '#3f6fc9', initial: 'M' },
  lise: { color: '#3fa05a', initial: 'L' },
  brutus: { color: '#7a4fa0', initial: 'B' },
};
