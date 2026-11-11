import { deflateSync, inflateSync } from 'node:zlib';

// Image en mémoire : RGBA sur 8 bits, ligne par ligne (index = (y * width + x) * 4).
export interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

export function createImage(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// Lit un PNG non entrelacé : niveaux de gris, RGB, RGBA, gris + alpha (8 bits) et palette (1 à 8 bits).
// Suffit pour les sorties de ComfyUI et de Pixelorama ; le reste est refusé avec un message clair.
export function decodePng(bytes: Uint8Array): Image {
  if (!SIGNATURE.every((value, index) => bytes[index] === value)) throw new Error("ce fichier n'est pas un PNG");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let palette: Uint8Array = new Uint8Array();
  let paletteAlpha: Uint8Array = new Uint8Array();
  const compressed: Uint8Array[] = [];

  for (let offset = 8; offset < bytes.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }
    offset += 12 + length;
    if (type === 'IHDR') {
      depth = body[8] ?? 0;
      colorType = body[9] ?? 0;
      if (body[12] !== 0) throw new Error('PNG entrelacé non pris en charge');
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') paletteAlpha = body;
    else if (type === 'IDAT') compressed.push(body);
    else if (type === 'IEND') break;
  }

  const channels = CHANNELS[colorType];
  if (channels === undefined) throw new Error(`type de couleur PNG ${colorType} inconnu`);
  if (colorType !== 3 && depth !== 8) throw new Error(`PNG en ${depth} bits non pris en charge (8 bits seulement)`);

  const raw = inflateSync(Buffer.concat(compressed));
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const step = Math.max(1, bitsPerPixel / 8);
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const left = i >= step ? (pixels[y * stride + i - step] ?? 0) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + i] ?? 0) : 0;
      const upLeft = y > 0 && i >= step ? (pixels[(y - 1) * stride + i - step] ?? 0) : 0;
      const value = line[i] ?? 0;
      const predicted =
        filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? up
        : filter === 3 ? (left + up) >> 1
        : filter === 4 ? paeth(left, up, upLeft)
        : Number.NaN;
      if (Number.isNaN(predicted)) throw new Error(`filtre PNG ${filter} inconnu`);
      pixels[y * stride + i] = (value + predicted) & 0xff;
    }
  }

  const image = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      const at = y * stride + x * channels;
      if (colorType === 3) {
        const bit = x * depth;
        const index = ((pixels[y * stride + (bit >> 3)] ?? 0) >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        image.data.set([palette[index * 3] ?? 0, palette[index * 3 + 1] ?? 0, palette[index * 3 + 2] ?? 0], out);
        image.data[out + 3] = paletteAlpha[index] ?? 255;
      } else if (colorType === 0 || colorType === 4) {
        const gray = pixels[at] ?? 0;
        image.data.set([gray, gray, gray, colorType === 4 ? (pixels[at + 1] ?? 255) : 255], out);
      } else {
        image.data.set(
          [pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0, colorType === 6 ? (pixels[at + 3] ?? 255) : 255],
          out,
        );
      }
    }
  }
  return image;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(Array.from(type, (char) => char.charCodeAt(0)), 4);
  out.set(body, 8);
  view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

function headerChunk(image: Image): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  header.set([8, 6, 0, 0, 0], 8);
  return chunk('IHDR', header);
}

// Pixels compressés, chaque ligne précédée de son filtre (0 : aucun).
function compressedPixels(image: Image): Uint8Array {
  const stride = image.width * 4;
  const raw = new Uint8Array((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) raw.set(image.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return deflateSync(raw, { level: 9 });
}

// Écrit un PNG RGBA 8 bits, sans filtre (les assets font quelques centaines d'octets).
export function encodePng(image: Image): Uint8Array {
  return Buffer.concat([SIGNATURE, headerChunk(image), chunk('IDAT', compressedPixels(image)), chunk('IEND', new Uint8Array())]);
}

// PNG animé (APNG), pour les aperçus : les navigateurs l'animent, les autres lecteurs montrent la première
// image. `delays` : durée de chaque image en millisecondes. L'animation tourne en boucle.
export function encodeApng(frames: readonly Image[], delays: readonly number[]): Uint8Array {
  const first = frames[0];
  if (first === undefined) throw new Error('APNG : aucune image');
  if (frames.some((frame) => frame.width !== first.width || frame.height !== first.height)) throw new Error('APNG : images de tailles différentes');
  const control = new Uint8Array(8);
  new DataView(control.buffer).setUint32(0, frames.length); // nombre d'images, puis 0 lecture = en boucle
  const chunks = [SIGNATURE, headerChunk(first), chunk('acTL', control)];
  let sequence = 0;
  frames.forEach((frame, index) => {
    const frameControl = new Uint8Array(26);
    const view = new DataView(frameControl.buffer);
    view.setUint32(0, sequence++);
    view.setUint32(4, frame.width);
    view.setUint32(8, frame.height);
    view.setUint16(20, Math.round(delays[index] ?? 100)); // durée = numérateur / dénominateur secondes
    view.setUint16(22, 1000);
    chunks.push(chunk('fcTL', frameControl));
    const pixels = compressedPixels(frame);
    if (index === 0) {
      chunks.push(chunk('IDAT', pixels));
    } else {
      const data = new Uint8Array(4 + pixels.length);
      new DataView(data.buffer).setUint32(0, sequence++);
      data.set(pixels, 4);
      chunks.push(chunk('fdAT', data));
    }
  });
  chunks.push(chunk('IEND', new Uint8Array()));
  return Buffer.concat(chunks);
}
