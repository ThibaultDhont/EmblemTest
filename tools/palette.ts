// Palette du jeu : lecture d'un fichier GIMP (.gpl, le format de Pixelorama et de Lospec) ou Adobe (.ase),
// et recherche de la couleur la plus proche, mesurée dans l'espace OKLab (plus fidèle à l'œil que l'écart en RGB).
//
//   node tools/palette.ts <palette.ase> art/palette.gpl "<nom>"   convertit une palette .ase en .gpl
import { readFileSync, writeFileSync } from 'node:fs';

export type Rgb = readonly [number, number, number];

export function parseGpl(text: string): Rgb[] {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== 'GIMP Palette') throw new Error('palette .gpl attendue (première ligne « GIMP Palette »)');
  const colors: Rgb[] = [];
  for (const line of lines.slice(1)) {
    const match = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/.exec(line);
    if (match === null) continue; // Name:, Columns:, commentaires et lignes vides
    colors.push([Number(match[1]), Number(match[2]), Number(match[3])]);
  }
  if (colors.length === 0) throw new Error('palette vide');
  return colors;
}

// Adobe Swatch Exchange (.ase, binaire) : en-tête « ASEF », version, nombre de blocs, puis des blocs
// (type, longueur, contenu). Un bloc couleur contient son nom en UTF-16, le modèle (« RGB », « Gray »…)
// et les composantes en flottants de 0 à 1. Les groupes sont ignorés. On avance de bloc en bloc grâce à
// leur longueur : certains fichiers omettent le zéro final du nom que la norme prévoit.
export function parseAse(bytes: Uint8Array): Rgb[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'ASEF') throw new Error('palette .ase attendue (en-tête « ASEF »)');
  const blocks = view.getUint32(8);
  const colors: Rgb[] = [];
  let offset = 12;
  for (let block = 0; block < blocks; block++) {
    const type = view.getUint16(offset);
    const length = view.getUint32(offset + 2);
    const start = offset + 6;
    offset = start + length;
    if (type !== 0x0001) continue; // début ou fin de groupe
    const nameLength = view.getUint16(start);
    const at = start + 2 + nameLength * 2;
    const model = String.fromCharCode(...bytes.subarray(at, at + 4)).trim();
    const channel = (index: number): number => Math.round(Math.min(1, Math.max(0, view.getFloat32(at + 4 + index * 4))) * 255);
    if (model === 'RGB') colors.push([channel(0), channel(1), channel(2)]);
    else if (model === 'Gray') colors.push([channel(0), channel(0), channel(0)]);
    else throw new Error(`couleur ${block + 1} en ${model} : seules RGB et Gray sont prises en charge`);
  }
  if (colors.length === 0) throw new Error('palette vide');
  return colors;
}

export function toGpl(name: string, colors: readonly Rgb[]): string {
  const rows = colors.map(([r, g, b]) => `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}`);
  return ['GIMP Palette', `Name: ${name}`, 'Columns: 8', '#', ...rows, ''].join('\n');
}

const linear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function toOklab([r, g, b]: Rgb): [number, number, number] {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// Écart perceptuel entre deux couleurs : 0 pour deux couleurs identiques, environ 1 entre le noir et le blanc.
export function distance(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toOklab(a);
  const [l2, a2, b2] = toOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export interface Matcher {
  colors: readonly Rgb[];
  colorWeight: number; // poids de la teinte (voir createMatcher), repris par les règles de nettoyage
  // Index de la couleur de la palette la plus proche.
  nearest(color: Rgb): number;
}

// `colorWeight` règle l'importance de la couleur (teinte et saturation, axes a et b d'OKLab) face à la
// luminosité. À 1, l'écart OKLab ordinaire : il préfère volontiers une couleur de même clarté mais d'une
// autre teinte (un roux devient rose, un roux saturé devient terne). Au-dessus de 1, la teinte prime : la
// couleur choisie peut être un peu plus claire ou plus sombre, mais elle reste de la même famille.
export function createMatcher(colors: readonly Rgb[], colorWeight = 1): Matcher {
  const labs = colors.map(toOklab);
  const cache = new Map<number, number>();
  const weight = colorWeight ** 2;
  return {
    colors,
    colorWeight,
    nearest(color) {
      const key = (color[0] << 16) | (color[1] << 8) | color[2];
      const known = cache.get(key);
      if (known !== undefined) return known;
      const [l, a, b] = toOklab(color);
      let best = 0;
      let bestDistance = Infinity;
      labs.forEach(([l2, a2, b2], index) => {
        const d = (l - l2) ** 2 + weight * ((a - a2) ** 2 + (b - b2) ** 2);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      cache.set(key, best);
      return best;
    },
  };
}

if (import.meta.main) {
  const [source, target, name = 'palette'] = process.argv.slice(2);
  if (source === undefined || target === undefined) {
    console.error('usage : node tools/palette.ts <palette.ase> <sortie.gpl> [nom]');
    process.exit(1);
  }
  const colors = parseAse(readFileSync(source));
  writeFileSync(target, toGpl(name, colors));
  console.log(`${target} : ${colors.length} couleurs`);
}
