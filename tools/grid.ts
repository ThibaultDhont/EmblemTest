// Grille des « gros pixels » d'une image générée par IA. Le modèle dessine des carrés d'environ 8 px de côté,
// mais pas tout à fait réguliers (7, 8, 9 px…) : une grille fixe se décalerait au fil de l'image. On estime
// donc la taille moyenne, puis on suit les bords réels d'une coupe à l'autre. Chaque case de la grille
// redevient un seul pixel : c'est la résolution « native » du dessin, sans mélange ni flou.
import type { Matcher } from './palette.ts';
import { createImage } from './png.ts';
import type { Image } from './png.ts';

// Force des bords verticaux par colonne (entre x-1 et x) et horizontaux par ligne (entre y-1 et y).
export function edgeProfiles(image: Image): { columns: Float64Array; rows: Float64Array } {
  const { width, height, data } = image;
  const columns = new Float64Array(width);
  const rows = new Float64Array(height);
  const gap = (i: number, j: number): number =>
    Math.abs((data[i] ?? 0) - (data[j] ?? 0)) +
    Math.abs((data[i + 1] ?? 0) - (data[j + 1] ?? 0)) +
    Math.abs((data[i + 2] ?? 0) - (data[j + 2] ?? 0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (x > 0) columns[x] = (columns[x] ?? 0) + gap(at, at - 4);
      if (y > 0) rows[y] = (rows[y] ?? 0) + gap(at, at - width * 4);
    }
  }
  return { columns, rows };
}

// Taille moyenne d'un gros pixel. On relève les bords nets (pics du profil plus forts que la moyenne d'un
// écart type, au moins `min` px d'écart : une transition floue sur 2 ou 3 px fait sinon deux bords),
// puis on cherche la taille p qui explique le mieux les écarts entre bords voisins : chaque écart doit valoir
// à peu près un nombre entier de p (deux cases de même couleur côte à côte ne font pas de bord, d'où 2p,
// 3p…). L'erreur est mesurée en part de p, ce qui écarte p/2 (qui expliquerait aussi tout, mais deux fois
// moins précisément) ; un multiple de p, lui, n'explique pas les écarts d'une seule case.
// NaN quand aucune taille n'explique les bords : pas de grille visible.
// Les pixels du modèle sont carrés : passer les profils des colonnes et des lignes ensemble donne une seule
// taille pour les deux sens, plus sûre, et évite d'étirer le dessin.
export function detectPeriod(profiles: Float64Array[], min = 4, max = 40): number {
  const gaps = profiles.flatMap((profile) => edgeGaps(profile, min));
  if (gaps.length < 3) return Number.NaN;

  let best = Number.NaN;
  let bestError = Infinity;
  for (let period = min; period <= max; period += 0.05) {
    let error = 0;
    for (const gap of gaps) {
      const cells = Math.max(1, Math.round(gap / period));
      error += Math.min(0.5, Math.abs(gap - cells * period) / period);
    }
    error /= gaps.length;
    if (error < bestError - 1e-9) {
      bestError = error;
      best = period;
    }
  }
  return bestError <= 0.25 ? best : Number.NaN;
}

// Écarts entre bords nets voisins d'un profil.
function edgeGaps(profile: Float64Array, min: number): number[] {
  const n = profile.length;
  const mean = profile.reduce((sum, value) => sum + value, 0) / n;
  const spread = Math.sqrt(profile.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n);
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    const value = profile[i] ?? 0;
    if (value <= mean + spread || value < (profile[i - 1] ?? 0) || value <= (profile[i + 1] ?? 0)) continue;
    const last = peaks[peaks.length - 1];
    if (last !== undefined && i - last < min) {
      if (value > (profile[last] ?? 0)) peaks[peaks.length - 1] = i;
    } else {
      peaks.push(i);
    }
  }
  return peaks.slice(1).map((peak, index) => peak - (peaks[index] ?? 0));
}

// Positions des coupes, de 0 à la longueur du profil comprises. On part de la phase où les bords tombent le
// mieux, puis chaque coupe suivante est cherchée autour de la précédente + période, sur le bord le plus net
// à ±35 % ; sans bord net (zone unie), on reste sur la position attendue.
export function gridCuts(profile: Float64Array, period: number): number[] {
  const n = profile.length;
  const mean = profile.reduce((sum, value) => sum + value, 0) / n;

  let phase = 0;
  let phaseScore = -1;
  for (let offset = 0; offset < period; offset += 0.5) {
    let sum = 0;
    let count = 0;
    for (let k = offset; k < n; k += period) {
      sum += profile[Math.round(k)] ?? 0;
      count++;
    }
    if (sum / count > phaseScore) {
      phaseScore = sum / count;
      phase = offset;
    }
  }

  const reach = Math.max(1, Math.round(period * 0.35));
  const snap = (expected: number): number => {
    const center = Math.round(expected);
    let best = center;
    let bestValue = -1;
    for (let i = center - reach; i <= center + reach; i++) {
      const value = profile[i] ?? -1;
      if (value > bestValue) {
        best = i;
        bestValue = value;
      }
    }
    return bestValue > mean ? best : center;
  };

  const start = snap(phase);
  const forward = [start];
  for (let next = snap(start + period); next < n - period / 2; next = snap(next + period)) forward.push(next);
  const backward: number[] = [];
  for (let previous = snap(start - period); previous > period / 2; previous = snap(previous - period)) backward.unshift(previous);

  const cuts = [0];
  for (const cut of [...backward, ...forward, n]) {
    const last = cuts[cuts.length - 1] ?? 0;
    if (cut - last >= Math.max(2, period * 0.4)) cuts.push(cut);
    else if (cut === n) cuts[cuts.length - 1] = n; // dernière case trop étroite : fusionnée avec la précédente
  }
  return cuts;
}

// Une case de la grille devient un pixel : la couleur de palette la plus fréquente au cœur de la case
// (on laisse un quart de chaque côté, où traînent les bavures), transparent si le cœur l'est surtout.
export function sampleGrid(image: Image, columns: number[], rows: number[], matcher: Matcher): Image {
  const out = createImage(columns.length - 1, rows.length - 1);
  const votes = new Map<number, number>();
  for (let cy = 0; cy < out.height; cy++) {
    const top = rows[cy] ?? 0;
    const bottom = rows[cy + 1] ?? top + 1;
    const insetY = Math.floor((bottom - top) / 4);
    for (let cx = 0; cx < out.width; cx++) {
      const left = columns[cx] ?? 0;
      const right = columns[cx + 1] ?? left + 1;
      const insetX = Math.floor((right - left) / 4);
      votes.clear();
      let transparent = 0;
      let total = 0;
      for (let y = top + insetY; y < bottom - insetY; y++) {
        for (let x = left + insetX; x < right - insetX; x++) {
          const at = (y * image.width + x) * 4;
          total++;
          if ((image.data[at + 3] ?? 0) < 128) {
            transparent++;
            continue;
          }
          const color = matcher.nearest([image.data[at] ?? 0, image.data[at + 1] ?? 0, image.data[at + 2] ?? 0]);
          votes.set(color, (votes.get(color) ?? 0) + 1);
        }
      }
      if (transparent * 2 >= total) continue;
      let best = 0;
      let bestVotes = -1;
      for (const [color, count] of votes) {
        if (count > bestVotes) {
          best = color;
          bestVotes = count;
        }
      }
      const [r, g, b] = matcher.colors[best] ?? [0, 0, 0];
      out.data.set([r, g, b, 255], (cy * out.width + cx) * 4);
    }
  }
  return out;
}
