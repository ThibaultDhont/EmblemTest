// Transforme une image générée par IA (grande, « façon pixel art », couleurs libres) en asset du jeu :
// recadrage, fond rendu transparent, réduction à la taille réelle, couleurs ramenées sur la palette.
//
//   node tools/pixelize.ts <source.png> <sortie.png> --taille 16x16 [options]
//
//   --recadrage x,y,l,h  ne garder que ce rectangle de la source (en pixels de la source)
//   --recadrage auto     cadrer le sujet une fois le fond effacé (avec --fond auto), aux proportions de --taille
//   --marge 0.05         avec --recadrage auto : marge autour du sujet, en part de sa taille
//   --fond auto          rend transparent le fond uni qui touche les bords (pour les unités, portraits, objets)
//   --tolerance 0.06     écart de couleur toléré pour le fond (OKLab, 0 à 1)
//   --sous base.png      pose le résultat sur cette image de même taille (une unité de terrain sur l'herbe)
//   --methode moyenne    résumer chaque zone par sa couleur moyenne plutôt que par vote (voir downscale)
//   --grille auto        retrouver la grille des « gros pixels » de la source (voir tools/grid.ts) et en faire
//                        de vrais pixels avant tout le reste ; --grille 8 impose leur taille en px
//   --teinte 3           poids de la teinte face à la luminosité pour choisir la couleur de palette (3 par défaut,
//                        1 = OKLab pur, qui fait virer les roux au rose avec cette palette)
//   --palette f.gpl      palette à utiliser (art/palette.gpl par défaut)
//
// Nettoyage des petits sprites (voir tools/cleanup.ts), dans cet ordre après la réduction :
//   --details 0.2        un détail sombre couvrant au moins 20 % d'une zone l'emporte (yeux, ceinture)
//   --couleurs 8         au plus 8 couleurs : les plus rares sont fondues dans les plus proches
//   --nettoyage          les pixels isolés prennent la couleur de leurs voisins (sauf les points sombres)
//   --contour teinte     contour extérieur d'un pixel, assombri d'après la couleur voisine (« sombre » : uni)
//   --apercu 8           écrit aussi art/sources/<nom>.apercu.png agrandi 8 fois, pour juger à l'œil
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createImage, decodePng, encodePng } from './png.ts';
import type { Image } from './png.ts';
import { detectPeriod, edgeProfiles, gridCuts, sampleGrid } from './grid.ts';
import { addOutline, limitColors, pad, removeSpeckles } from './cleanup.ts';
import type { OutlineMode } from './cleanup.ts';
import { createMatcher, distance, parseGpl, toOklab } from './palette.ts';
import type { Matcher, Rgb } from './palette.ts';

// Poids de la teinte par défaut (voir createMatcher), choisi au test de style du 2026-11-11.
const DEFAULT_HUE_WEIGHT = 3;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const rgbAt = (image: Image, index: number): Rgb => [
  image.data[index * 4] ?? 0,
  image.data[index * 4 + 1] ?? 0,
  image.data[index * 4 + 2] ?? 0,
];
const alphaAt = (image: Image, index: number): number => image.data[index * 4 + 3] ?? 0;

// Ce qui dépasse de la source est transparent.
export function crop(image: Image, rect: Rect): Image {
  const out = createImage(rect.width, rect.height);
  for (let y = 0; y < rect.height; y++) {
    const sy = rect.y + y;
    if (sy < 0 || sy >= image.height) continue;
    for (let x = 0; x < rect.width; x++) {
      const sx = rect.x + x;
      if (sx < 0 || sx >= image.width) continue;
      const from = (sy * image.width + sx) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * rect.width + x) * 4);
    }
  }
  return out;
}

// Cadre serré autour des pixels opaques, élargi aux proportions voulues (sujet centré) et d'une marge
// relative (0.1 = 10 % de chaque côté). Sans pixel opaque, toute l'image.
export function subjectFrame(image: Image, ratio: number, margin: number): Rect {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (alphaAt(image, y * image.width + x) < 128) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return { x: 0, y: 0, width: image.width, height: image.height };
  let width = (right - left + 1) * (1 + 2 * margin);
  let height = (bottom - top + 1) * (1 + 2 * margin);
  if (width / height < ratio) width = height * ratio;
  else height = width / ratio;
  width = Math.round(width);
  height = Math.round(height);
  return {
    x: Math.round((left + right + 1 - width) / 2),
    y: Math.round((top + bottom + 1 - height) / 2),
    width,
    height,
  };
}

// Le fond est la couleur la plus fréquente sur les bords ; il est effacé par remplissage depuis les bords,
// pour ne pas trouer un personnage qui porterait la même couleur au milieu.
export function removeBackground(image: Image, tolerance: number): Image {
  const { width, height } = image;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);

  const counts = new Map<number, number>();
  for (const index of border) {
    // Regroupe les teintes voisines (bruit de compression) avant de compter.
    const [r, g, b] = rgbAt(image, index);
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const background: Rgb = [((top >> 10) << 3) + 4, (((top >> 5) & 31) << 3) + 4, ((top & 31) << 3) + 4];

  const close = new Map<number, boolean>();
  const isBackground = (index: number): boolean => {
    const color = rgbAt(image, index);
    const key = (color[0] << 16) | (color[1] << 8) | color[2];
    let known = close.get(key);
    if (known === undefined) {
      known = distance(color, background) <= tolerance;
      close.set(key, known);
    }
    return known;
  };

  const out: Image = { width, height, data: image.data.slice() };
  const seen = new Uint8Array(width * height);
  const stack = border.filter((index) => isBackground(index));
  for (const index of stack) seen[index] = 1;
  while (stack.length > 0) {
    const index = stack.pop() ?? 0;
    out.data[index * 4 + 3] = 0;
    const x = index % width;
    const neighbours = [x > 0 ? index - 1 : -1, x < width - 1 ? index + 1 : -1, index - width, index + width];
    for (const next of neighbours) {
      if (next < 0 || next >= width * height || seen[next] === 1) continue;
      seen[next] = 1;
      if (isBackground(next)) stack.push(next);
    }
  }
  return out;
}

// Comment un pixel d'arrivée résume sa zone de la source :
// - vote : la couleur de palette la plus fréquente. Contours nets, aucune couleur intermédiaire. Le bon choix
//   quand la zone fait à peu près la taille d'un « gros pixel » de la source (portraits, réduction ~ ×10).
// - moyenne : la couleur moyenne, ramenée sur la palette. Pour les fortes réductions (tuiles, ×40 et plus) :
//   une teinte éclatée sur plusieurs couleurs de palette y perdrait le vote face aux contours sombres.
// Une zone majoritairement transparente donne un pixel transparent.
// `darkShare` (vote seulement, 0 = sans effet) : un détail sombre qui couvre au moins cette part de la zone
// l'emporte sur la couleur majoritaire s'il est nettement plus sombre qu'elle. Sans ça, un œil ou une ceinture
// d'un cinquième de la zone disparaît dans la peau ou la veste.
export type Method = 'vote' | 'moyenne';

export function downscale(
  image: Image,
  width: number,
  height: number,
  matcher: Matcher,
  method: Method = 'vote',
  darkShare = 0,
): Image {
  const out = createImage(width, height);
  const votes = new Map<number, number>();
  const lightness = matcher.colors.map((color) => toOklab(color)[0]);
  for (let ty = 0; ty < height; ty++) {
    const y0 = Math.floor((ty * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * image.height) / height));
    for (let tx = 0; tx < width; tx++) {
      const x0 = Math.floor((tx * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * image.width) / width));
      votes.clear();
      let transparent = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const index = y * image.width + x;
          if (alphaAt(image, index) < 128) {
            transparent++;
            continue;
          }
          const rgb = rgbAt(image, index);
          red += rgb[0];
          green += rgb[1];
          blue += rgb[2];
          if (method === 'vote') {
            const color = matcher.nearest(rgb);
            votes.set(color, (votes.get(color) ?? 0) + 1);
          }
        }
      }
      const area = (x1 - x0) * (y1 - y0);
      if (transparent * 2 > area) continue;
      const opaque = area - transparent;
      const mean: Rgb = [Math.round(red / opaque), Math.round(green / opaque), Math.round(blue / opaque)];
      let best = method === 'moyenne' ? matcher.nearest(mean) : 0;
      let bestVotes = -1;
      for (const [color, count] of votes) {
        if (count > bestVotes) {
          best = color;
          bestVotes = count;
        }
      }
      if (darkShare > 0) {
        let darkest = best;
        for (const [color, count] of votes) {
          if (count >= darkShare * opaque && (lightness[color] ?? 1) < (lightness[darkest] ?? 1)) darkest = color;
        }
        if ((lightness[darkest] ?? 1) < (lightness[best] ?? 0) - 0.25) best = darkest;
      }
      const [r, g, b] = matcher.colors[best] ?? [0, 0, 0];
      out.data.set([r, g, b, 255], (ty * width + tx) * 4);
    }
  }
  return out;
}

// Pose `over` sur `under` (même taille) : les pixels transparents laissent voir le dessous.
export function composite(over: Image, under: Image): Image {
  if (over.width !== under.width || over.height !== under.height) {
    throw new Error(`--sous attend une image de ${over.width}×${over.height}, reçu ${under.width}×${under.height}`);
  }
  const out: Image = { width: over.width, height: over.height, data: under.data.slice() };
  for (let index = 0; index < over.width * over.height; index++) {
    if (alphaAt(over, index) >= 128) out.data.set(over.data.subarray(index * 4, index * 4 + 4), index * 4);
  }
  return out;
}

// Met une image déjà en vrais pixels (sortie de la grille) à la taille voulue. Si elle la dépasse de 25 % au
// plus, on rogne les bords plutôt que de réduire : réduire de 70 à 64 pixels en sauterait quelques-uns au
// hasard et déformerait le dessin. Plus petite, elle est centrée sur du transparent. Bien plus grande,
// il faut réduire (la perte est alors inévitable).
export function fitToSize(image: Image, width: number, height: number, matcher: Matcher, method: Method): Image {
  if (image.width <= width * 1.25 && image.height <= height * 1.25) {
    return crop(image, {
      x: Math.round((image.width - width) / 2),
      y: Math.round((image.height - height) / 2),
      width,
      height,
    });
  }
  return downscale(image, width, height, matcher, method);
}

export function upscale(image: Image, factor: number): Image {
  const out = createImage(image.width * factor, image.height * factor);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const from = (Math.floor(y / factor) * image.width + Math.floor(x / factor)) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
}

function parseNumbers(text: string, count: number, separator: string, what: string): number[] {
  const numbers = text.split(separator).map(Number);
  if (numbers.length !== count || numbers.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`${what} invalide : « ${text} »`);
  }
  return numbers;
}

function main(args: string[]): void {
  const [source, target] = args;
  const size = option(args, 'taille');
  if (source === undefined || target === undefined || size === undefined) {
    console.error('usage : node tools/pixelize.ts <source.png> <sortie.png> --taille LxH [options], voir le début du fichier');
    process.exit(1);
  }
  const [width = 0, height = 0] = parseNumbers(size, 2, 'x', '--taille');
  const hueWeight = Number(option(args, 'teinte') ?? DEFAULT_HUE_WEIGHT);
  const matcher = createMatcher(parseGpl(readFileSync(option(args, 'palette') ?? 'art/palette.gpl', 'utf8')), hueWeight);
  const method = option(args, 'methode') ?? 'vote';
  if (method !== 'vote' && method !== 'moyenne') throw new Error(`--methode vote ou moyenne, pas « ${method} »`);

  let image = decodePng(readFileSync(source));
  const area = option(args, 'recadrage');
  if (area !== undefined && area !== 'auto') {
    const [x = 0, y = 0, w = 0, h = 0] = parseNumbers(area, 4, ',', '--recadrage');
    image = crop(image, { x, y, width: w, height: h });
  }
  if (option(args, 'fond') === 'auto') image = removeBackground(image, Number(option(args, 'tolerance') ?? 0.06));

  const grid = option(args, 'grille');
  if (grid !== undefined) {
    const { columns, rows } = edgeProfiles(image);
    const forced = grid === 'auto' ? Number.NaN : Number(grid);
    const period = Number.isNaN(forced) ? detectPeriod([columns, rows]) : forced;
    if (Number.isNaN(period)) throw new Error('aucune grille de pixels détectée : essayer --grille <taille en px>');
    image = sampleGrid(image, gridCuts(columns, period), gridCuts(rows, period), matcher);
    console.log(`grille : pixels de ${period.toFixed(1)} px, image native ${image.width}×${image.height}`);
  }

  // Avec un contour, le sujet est réduit à 2 px de moins dans chaque sens : le contour prend le pixel du bord.
  const outline = option(args, 'contour');
  if (outline !== undefined && outline !== 'sombre' && outline !== 'teinte') throw new Error(`--contour sombre ou teinte, pas « ${outline} »`);
  const inner = outline === undefined ? { width, height } : { width: width - 2, height: height - 2 };

  if (area === 'auto') image = crop(image, subjectFrame(image, inner.width / inner.height, Number(option(args, 'marge') ?? 0)));
  let result =
    grid !== undefined
      ? fitToSize(image, inner.width, inner.height, matcher, method)
      : downscale(image, inner.width, inner.height, matcher, method, Number(option(args, 'details') ?? 0));
  const maxColors = option(args, 'couleurs');
  if (maxColors !== undefined) result = limitColors(result, Number(maxColors), matcher);
  if (args.includes('--nettoyage')) result = removeSpeckles(result);
  if (outline !== undefined) result = addOutline(pad(result, 1), outline as OutlineMode, matcher);
  const under = option(args, 'sous');
  if (under !== undefined) result = composite(result, decodePng(readFileSync(under)));

  writeFileSync(target, encodePng(result));
  // L'aperçu va avec les brouillons : dans src/sprites/, Vite l'embarquerait dans le jeu.
  const preview = option(args, 'apercu');
  if (preview !== undefined) {
    mkdirSync('art/sources', { recursive: true });
    writeFileSync(join('art/sources', basename(target).replace(/\.png$/, '.apercu.png')), encodePng(upscale(result, Number(preview))));
  }
  console.log(`${target} : ${width}×${height}`);
}

if (import.meta.main) main(process.argv.slice(2));
