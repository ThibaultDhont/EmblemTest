// Règles de nettoyage pour les petits sprites (16×16) après la réduction. Une réduction ×6 laisse des
// pixels isolés, trop de couleurs et une silhouette qui se fond dans le décor : on applique ici quelques
// règles classiques du pixel art à la main.
import { toOklab } from './palette.ts';
import type { Matcher, Rgb } from './palette.ts';
import { createImage } from './png.ts';
import type { Image } from './png.ts';

const NEIGHBOURS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

const colorAt = (image: Image, x: number, y: number): Rgb | undefined => {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return undefined;
  const at = (y * image.width + x) * 4;
  if ((image.data[at + 3] ?? 0) < 128) return undefined;
  return [image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0];
};
const key = (color: Rgb): number => (color[0] << 16) | (color[1] << 8) | color[2];
const lightness = (color: Rgb): number => toOklab(color)[0];

// Pixel isolé : ses quatre voisins sont opaques et tous d'une même autre couleur. Il prend leur couleur,
// sauf s'il est nettement plus sombre qu'eux : un point sombre isolé est souvent un œil, une bouche, un bouton.
export function removeSpeckles(image: Image): Image {
  const out: Image = { width: image.width, height: image.height, data: image.data.slice() };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const own = colorAt(image, x, y);
      if (own === undefined) continue;
      const around = NEIGHBOURS.map(([dx, dy]) => colorAt(image, x + dx, y + dy));
      const first = around[0];
      if (first === undefined || around.some((color) => color === undefined || key(color) !== key(first))) continue;
      if (key(first) === key(own) || lightness(own) < lightness(first) - 0.15) continue;
      out.data.set(first, (y * image.width + x) * 4);
    }
  }
  return out;
}

// Garde au plus `max` couleurs : la moins utilisée est remplacée par la plus proche des autres, jusqu'au compte.
export function limitColors(image: Image, max: number, matcher: Matcher): Image {
  const out: Image = { width: image.width, height: image.height, data: image.data.slice() };
  const counts = new Map<number, { color: Rgb; count: number }>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const color = colorAt(image, x, y);
      if (color === undefined) continue;
      const entry = counts.get(key(color)) ?? { color, count: 0 };
      entry.count++;
      counts.set(key(color), entry);
    }
  }
  const replaced = new Map<number, Rgb>();
  while (counts.size > max) {
    const [rarestKey, rarest] = [...counts].reduce((a, b) => (b[1].count < a[1].count ? b : a));
    counts.delete(rarestKey);
    const others = [...counts.values()].map((entry) => entry.color);
    const target = others[createMatcherLike(others, matcher).nearest(rarest.color)] ?? rarest.color;
    const entry = counts.get(key(target));
    if (entry !== undefined) entry.count += rarest.count;
    replaced.set(rarestKey, target);
    // Une couleur déjà remplacée vers celle-ci suit le même chemin.
    for (const [from, to] of replaced) if (key(to) === rarestKey) replaced.set(from, target);
  }
  for (let index = 0; index < image.width * image.height; index++) {
    const color = colorAt(image, index % image.width, Math.floor(index / image.width));
    const target = color === undefined ? undefined : replaced.get(key(color));
    if (target !== undefined) out.data.set(target, index * 4);
  }
  return out;
}

// Même réglage de teinte que la palette, mais sur un sous-ensemble de couleurs.
function createMatcherLike(colors: Rgb[], matcher: Matcher): { nearest(color: Rgb): number } {
  return {
    nearest(color) {
      const [l, a, b] = toOklab(color);
      let best = 0;
      let bestDistance = Infinity;
      colors.forEach((candidate, index) => {
        const [l2, a2, b2] = toOklab(candidate);
        const d = (l - l2) ** 2 + matcher.colorWeight ** 2 * ((a - a2) ** 2 + (b - b2) ** 2);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      return best;
    },
  };
}

export type OutlineMode = 'sombre' | 'teinte';

// Contour extérieur d'un pixel : chaque pixel transparent qui touche le sujet (par un côté) devient contour.
// « sombre » : la couleur la plus sombre de la palette partout. « teinte » : une version très assombrie de la
// couleur voisine (contour sélectif : brun foncé autour des cheveux roux, vert foncé autour de l'écharpe…).
// Le sujet doit laisser un pixel libre sur chaque bord, sinon le contour y manque.
export function addOutline(image: Image, mode: OutlineMode, matcher: Matcher): Image {
  const out: Image = { width: image.width, height: image.height, data: image.data.slice() };
  const labs = matcher.colors.map(toOklab);
  const darkest = matcher.colors[labs.reduce((best, lab, index) => (lab[0] < (labs[best]?.[0] ?? Infinity) ? index : best), 0)];
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (colorAt(image, x, y) !== undefined) continue;
      const touching = NEIGHBOURS.map(([dx, dy]) => colorAt(image, x + dx, y + dy)).filter(
        (color): color is Rgb => color !== undefined,
      );
      if (touching.length === 0) continue;
      let color = darkest ?? [0, 0, 0];
      if (mode === 'teinte') {
        // Moyenne des voisins en OKLab, clarté divisée par trois, puis la couleur de palette la plus proche.
        const mean = touching.map(toOklab).reduce((sum, lab) => [sum[0] + lab[0], sum[1] + lab[1], sum[2] + lab[2]], [0, 0, 0]);
        const [l, a, b] = mean.map((value) => value / touching.length) as [number, number, number];
        let best = 0;
        let bestDistance = Infinity;
        labs.forEach(([l2, a2, b2], index) => {
          const d = (l / 3 - l2) ** 2 + matcher.colorWeight ** 2 * ((a * 0.8 - a2) ** 2 + (b * 0.8 - b2) ** 2);
          if (d < bestDistance) {
            bestDistance = d;
            best = index;
          }
        });
        color = matcher.colors[best] ?? color;
      }
      out.data.set([...color, 255], (y * image.width + x) * 4);
    }
  }
  return out;
}

// Ajoute `size` pixels transparents tout autour (pour faire de la place au contour).
export function pad(image: Image, size: number): Image {
  const out = createImage(image.width + 2 * size, image.height + 2 * size);
  for (let y = 0; y < image.height; y++) {
    out.data.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), ((y + size) * out.width + size) * 4);
  }
  return out;
}
