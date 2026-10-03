// Draws the home-screen icons (a pawn on the pitch) as PNGs, with no dependencies.
// Run once: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const dir = new URL('../icons/', import.meta.url);
mkdirSync(dir, { recursive: true });

// Coverage of one point (u, v in 0..1) by each shape, painted in order.
const GRASS = [69, 160, 73];
const STRIPE = [60, 148, 66];
const WHITE = [255, 255, 255];
const KIT = [230, 57, 70];
const inside = {
  ring: (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5); return d > 0.36 && d < 0.39; },
  line: (u, v) => Math.abs(v - 0.5) < 0.015 && (u < 0.1 || u > 0.9),
  head: (u, v) => Math.hypot(u - 0.5, v - 0.31) < 0.085,
  collar: (u, v) => ((u - 0.5) / 0.13) ** 2 + ((v - 0.42) / 0.035) ** 2 < 1,
  body: (u, v) => v > 0.42 && v < 0.68 && Math.abs(u - 0.5) < 0.055 + (v - 0.42) * 0.42,
  base: (u, v) => v > 0.66 && v < 0.75 && Math.abs(u - 0.5) < 0.2,
};

function color(u, v) {
  let c = Math.floor(u * 8) % 2 ? STRIPE : GRASS;
  if (inside.ring(u, v) || inside.line(u, v)) c = WHITE;
  if (inside.head(u, v) || inside.collar(u, v) || inside.body(u, v) || inside.base(u, v)) c = KIT;
  return c;
}

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const n = 4; // 4x4 samples a pixel, for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = color((x + (sx + 0.5) / n) / size, (y + (sy + 0.5) / n) / size);
          for (let k = 0; k < 3; k++) sum[k] += c[k];
        }
      }
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(sum[k] / (n * n));
      px[i + 3] = 255;
    }
  }
  return png(size, size, px);
}

function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) writeFileSync(new URL(`icon-${size}.png`, dir), draw(size));
console.log('Wrote icons/icon-180.png, icon-192.png, icon-512.png');
