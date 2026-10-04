// The game's art: Kenney's free CC0 images (kenney.nl; no credit required) plus a few things drawn in
// code in the same flat style, with no outlines and one shade per shape: the ball, goals, chess
// pieces, crystals, and the blocky farm friends. Shared by the map, the run, and the DOM screens.
export const TAU = Math.PI * 2;
let BASE = 'art/';
export const setArtBase = b => { BASE = b; }; // for preview pages in a subfolder

// ---- Loading
export const IMG = {};
const ok = im => im && im.complete && im.naturalWidth > 0;

export function loadImages(names) {
  return Promise.all(names.filter(n => !IMG[n]).map(n => new Promise(resolve => {
    const im = new Image();
    im.onload = im.onerror = () => resolve();
    im.src = `${BASE}${n}.png`;
    IMG[n] = im;
  })));
}

export function img(c, name, x, y, w, h) {
  const im = IMG[name];
  if (ok(im)) c.drawImage(im, x, y, w, h);
}

// An image's natural size, so things can be drawn at their own proportions.
export const size = name => (ok(IMG[name]) ? [IMG[name].naturalWidth, IMG[name].naturalHeight] : [0, 0]);

const tints = new Map();
export function tinted(name, color) {
  const key = `${name}|${color}`;
  if (!tints.has(key)) {
    const im = IMG[name];
    if (!ok(im)) return null;
    const cv = document.createElement('canvas');
    cv.width = im.naturalWidth;
    cv.height = im.naturalHeight;
    const x = cv.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, cv.width, cv.height);
    tints.set(key, cv);
  }
  return tints.get(key);
}

// ---- Colors
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  const [r, g, b] = hexRgb(hex);
  const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `#${[f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function rgbHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslRgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// ---- Characters: Kenney's Toon Characters. His shirt takes his team's kit color.
export const CHARACTERS = ['boy', 'girl', 'robot', 'zombie'];
const SHIRT = {
  boy: { hue: [128, 172], light: 0.49 },
  girl: { hue: [188, 218], light: 0.6 },
  robot: { hue: [192, 222], light: 0.55 },
  zombie: { hue: [222, 256], light: 0.56 },
};
export const POSES = ['idle', 'run0', 'run1', 'run2', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'walk6', 'walk7', 'kick', 'cheer0', 'cheer1', 'jump', 'fall'];
export const characterImages = ch => POSES.map(p => `char/${ch}/${p}`);

const kitFrames = new Map();
export function characterFrame(ch, pose, kit) {
  const name = `char/${ch}/${pose}`;
  const im = IMG[name];
  if (!ok(im)) return null;
  if (!kit || !SHIRT[ch]) return im;
  const key = `${name}|${kit}`;
  if (kitFrames.has(key)) return kitFrames.get(key);
  const cv = document.createElement('canvas');
  cv.width = im.naturalWidth;
  cv.height = im.naturalHeight;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  try {
    const data = x.getImageData(0, 0, cv.width, cv.height);
    const d = data.data;
    const [kh, ks, kl] = rgbHsl(...hexRgb(kit));
    const { hue: [h0, h1], light } = SHIRT[ch];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const [h, s, l] = rgbHsl(d[i], d[i + 1], d[i + 2]);
      if (s < 0.18 || h < h0 || h > h1) continue;
      const nl = Math.max(0.06, Math.min(0.94, l + (kl - light) * (ks < 0.1 ? 0.8 : 0.9)));
      const [r, g, b] = hslRgb(kh, Math.min(1, ks * (s / 0.5)), nl);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    x.putImageData(data, 0, 0);
  } catch {
    // A canvas the browser won't read back (a file:// page): keep the original colors.
  }
  kitFrames.set(key, cv);
  return cv;
}

// Draws a character with the feet at (x, y). Frames are 192 by 256; k scales them.
export function drawCharacter(c, ch, pose, kit, x, y, k, flip = false) {
  const fr = characterFrame(ch, pose, kit);
  if (!fr) return;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(fr, -96 * k, -256 * k, 192 * k, 256 * k);
  c.restore();
}

// ---- The ball
function poly(c, x, y, r, n, rot) {
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rot + (k * TAU) / n;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
}

export function drawBall(c, x, y, r, angle) {
  c.save();
  c.translate(x, y);
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fillStyle = '#fbfcfd';
  c.fill();
  c.save();
  c.clip();
  c.rotate(angle);
  c.fillStyle = '#2f3542';
  c.strokeStyle = '#2f3542';
  c.lineWidth = r * 0.09;
  poly(c, 0, 0, r * 0.37, 5, -Math.PI / 2);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    c.beginPath();
    c.moveTo(Math.cos(a) * r * 0.37, Math.sin(a) * r * 0.37);
    c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    c.stroke();
    poly(c, Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06, r * 0.36, 5, a + Math.PI);
  }
  c.restore();
  // One flat shade on the lower right. It follows the light, not the spin.
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.clip();
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.moveTo(-r * 0.25 + r * 0.98, -r * 0.25);
  c.arc(-r * 0.25, -r * 0.25, r * 0.98, 0, TAU, true);
  c.fillStyle = 'rgba(30, 50, 90, 0.2)';
  c.fill('evenodd');
  c.restore();
  c.restore();
}

export function ballSVG() {
  const pent = (cx, cy, r, rot) => Array.from({ length: 5 }, (_, k) => {
    const a = rot + (k * TAU) / 5;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
  let patches = `<polygon points="${pent(50, 50, 17, -Math.PI / 2)}"/>`;
  let seams = '';
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    patches += `<polygon points="${pent(50 + Math.cos(a) * 49, 50 + Math.sin(a) * 49, 16.5, a + Math.PI)}"/>`;
    seams += `M${(50 + Math.cos(a) * 17).toFixed(1)} ${(50 + Math.sin(a) * 17).toFixed(1)}L${(50 + Math.cos(a) * 37).toFixed(1)} ${(50 + Math.sin(a) * 37).toFixed(1)}`;
  }
  const id = `b${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="50" cy="50" r="46"/></clipPath></defs>
    <circle cx="50" cy="50" r="46" fill="#fbfcfd"/>
    <g clip-path="url(#${id})"><g fill="#2f3542">${patches}</g><path d="${seams}" stroke="#2f3542" stroke-width="4"/>
    <path d="M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92zM44 0a44 44 0 1 0 0.1 0z" fill="rgba(30,50,90,0.18)" fill-rule="evenodd"/></g>
    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(30,50,90,0.25)" stroke-width="2"/></svg>`;
}

// ---- Goals, seen from the side with the mouth facing left. goalBack draws the net and back frame,
// goalFront the near post, so a ball drawn between them lands inside.
export const GOAL = { h: 150, d: 104 };
export const GOAL_STYLES = {
  white: { post: '#ffffff', shade: '#d3dce7', back: '#e6ecf3', net: 'rgba(255,255,255,0.8)', fill: 'rgba(255,255,255,0.18)' },
  stone: { post: '#d4d7df', shade: '#a6abb8', back: '#b9bdc8', net: 'rgba(255,226,170,0.8)', fill: 'rgba(255,240,210,0.14)' },
  wood: { post: '#d39a5e', shade: '#a8703c', back: '#b8854f', net: 'rgba(255,236,190,0.75)', fill: 'rgba(255,236,190,0.12)' },
  gold: { post: '#ffd23f', shade: '#e0a800', back: '#f2c230', net: 'rgba(255,255,255,0.85)', fill: 'rgba(255,255,255,0.16)' },
};

export function goalBack(c, x, g, u, s, bulge) {
  const h = GOAL.h * u, d = GOAL.d * u, top = g - h;
  const bt = x + d * 0.72, bb = x + d;
  const bx = bulge * 26 * u;
  c.save();
  c.beginPath();
  c.moveTo(x, top);
  c.lineTo(bt, top);
  c.quadraticCurveTo((bt + bb) / 2 + bx * 1.7, (top + g) / 2, bb + bx * 0.3, g);
  c.lineTo(x, g);
  c.closePath();
  c.fillStyle = s.fill;
  c.fill();
  c.clip();
  c.strokeStyle = s.net;
  c.lineWidth = Math.max(1, 1.6 * u);
  const step = 13 * u;
  c.beginPath();
  for (let i = x - d; i < bb + 2 * d; i += step) {
    c.moveTo(i, top);
    c.lineTo(i + d * 0.3 + bx, g);
  }
  for (let j = top + step * 0.5; j <= g; j += step) {
    c.moveTo(x, j);
    c.lineTo(bb + bx * 1.5, j);
  }
  c.stroke();
  c.restore();
  c.lineCap = 'round';
  c.strokeStyle = s.back;
  c.lineWidth = 5 * u;
  c.beginPath();
  c.moveTo(x, top);
  c.lineTo(bt, top);
  c.lineTo(bb, g);
  c.stroke();
}

export function goalFront(c, x, g, u, s) {
  const h = GOAL.h * u, w = 10 * u;
  c.fillStyle = s.post;
  c.fillRect(x - w / 2, g - h - w / 2, w, h + w / 2);
  c.fillStyle = s.shade;
  c.fillRect(x + w * 0.05, g - h + w / 2, w * 0.45, h - w / 2);
}

// ---- Chess pieces, as SVG path data so the same shapes draw on the canvas and in the page.
// Design units: the origin is the middle of the base, and up is negative.
const rr = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circ = (x, y, r) => `M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}Z`;
const base = (w, h = 18) => rr(-w, -h, 2 * w, h, 6);
const collar = (w, y = -29) => rr(-w, y, 2 * w, 12, 4);
const ring = (w, y) => rr(-w, y, 2 * w, 11, 5);
const stem = (bot, top, h) => `M${-bot} -20Q${-top + 2} ${-h * 0.72} ${-top} ${-h}H${top}Q${top - 2} ${-h * 0.72} ${bot} -20Z`;
const PIECE_PATHS = {
  pawn: [base(32), collar(23), stem(16, 10, 70), ring(19, -80), circ(0, -100, 21)],
  rook: [base(36, 20), collar(28, -31), 'M-23 -22L-19 -104H19L23 -22Z', rr(-31, -120, 62, 18, 3), rr(-31, -138, 16, 21, 2), rr(-8, -138, 16, 21, 2), rr(15, -138, 16, 21, 2)],
  knight: [base(35, 20), collar(27, -31),
    'M-24 -31C-26 -50 -20 -62 -18 -72C-28 -74 -40 -78 -44 -88C-46 -96 -42 -104 -34 -108C-26 -116 -18 -122 -12 -128L-6 -146L4 -131C24 -124 34 -100 30 -72C28 -54 26 -42 26 -31Z'],
  bishop: [base(32), collar(23), stem(15, 10, 76), ring(18, -86), 'M0 -146C22 -130 24 -102 14 -88H-14C-24 -102 -22 -130 0 -146Z', circ(0, -151, 7)],
  queen: [base(35), collar(26), stem(17, 11, 82), ring(21, -92), 'M-22 -91L-32 -132L-14 -110L0 -140L14 -110L32 -132L22 -91Z', circ(-32, -136, 6), circ(0, -145, 7), circ(32, -136, 6)],
  king: [base(35), collar(26), stem(17, 11, 82), ring(21, -92), 'M-24 -91L-28 -126Q0 -140 28 -126L24 -91Z', rr(-5, -166, 10, 34, 2), rr(-14, -156, 28, 10, 2)],
};
export const PIECE_TOP = { pawn: -121, rook: -138, knight: -146, bishop: -158, queen: -151, king: -166 };
const piece2d = {};

export const PIECE_COLORS = {
  light: { fill: '#f6f1e7', shade: '#d9cdb8', detail: '#4b4f6b' },
  dark: { fill: '#50557a', shade: '#3c405f', detail: '#f6f1e7' },
};
export const kitPiece = kit => ({ fill: kit, shade: shade(kit, -0.22), detail: '#ffffff' });

export function drawPiece(c, kind, x, y, u, col, sx = 1, sy = 1) {
  const parts = (piece2d[kind] ||= PIECE_PATHS[kind].map(d => new Path2D(d)));
  c.save();
  c.translate(x, y);
  c.scale(u * sx, u * sy);
  c.fillStyle = col.fill;
  for (const p of parts) c.fill(p);
  c.fillStyle = col.shade;
  for (const p of parts) {
    c.save();
    c.clip(p);
    c.fillRect(5, -200, 100, 220);
    c.restore();
  }
  if (kind === 'knight') {
    c.fillStyle = col.detail;
    c.beginPath();
    c.arc(-20, -103, 4.5, 0, TAU);
    c.fill();
  }
  if (kind === 'bishop') {
    c.strokeStyle = col.shade;
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(8, -130);
    c.lineTo(-6, -110);
    c.stroke();
  }
  c.restore();
}

export function pieceSVG(kind, col) {
  const d = PIECE_PATHS[kind].join('');
  const id = `p${Math.random().toString(36).slice(2, 8)}`;
  const top = PIECE_TOP[kind] - 6;
  const detail = kind === 'knight' ? `<circle cx="-20" cy="-103" r="4.5" fill="${col.detail}"/>`
    : kind === 'bishop' ? `<path d="M8 -130L-6 -110" stroke="${col.shade}" stroke-width="5" stroke-linecap="round"/>` : '';
  return `<svg viewBox="-50 ${top} 100 ${-top + 2}" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs>
    <path d="${d}" fill="${col.fill}"/><rect x="5" y="-200" width="100" height="220" fill="${col.shade}" clip-path="url(#${id})"/>${detail}</svg>`;
}

// ---- Crystals for the cave
export function drawCrystals(c, x, y, u, hue, glow) {
  const shards = [[-16, 34, -0.3], [0, 52, 0], [15, 40, 0.28], [-6, 26, -0.1], [9, 24, 0.2]];
  c.save();
  c.translate(x, y);
  for (const [dx, h, tilt] of shards) {
    c.save();
    c.translate(dx * u, 0);
    c.rotate(tilt);
    const w = 9 * u, hh = h * u;
    c.beginPath();
    c.moveTo(-w, 0);
    c.lineTo(-w, -hh * 0.75);
    c.lineTo(0, -hh);
    c.lineTo(w, -hh * 0.75);
    c.lineTo(w, 0);
    c.closePath();
    c.fillStyle = `hsl(${hue} 85% ${62 + glow * 10}%)`;
    c.fill();
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -hh);
    c.lineTo(w, -hh * 0.75);
    c.lineTo(w, 0);
    c.closePath();
    c.fillStyle = `hsl(${hue} 75% ${48 + glow * 8}%)`;
    c.fill();
    c.restore();
  }
  c.restore();
}

// ---- Friends: blocky farm animals, drawn facing right with the feet at (x, y). `walk` is the leg
// phase (0 when standing); u scales design units. All original shapes, not copied from any game.
function box(c, x, y, w, h, fill, shadeFill) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  if (shadeFill) {
    c.fillStyle = shadeFill;
    c.fillRect(x, y + h * 0.7, w, h * 0.3);
  }
}
function eye(c, x, y, s) {
  c.fillStyle = '#1f2433';
  c.fillRect(x, y, s, s);
  c.fillStyle = '#ffffff';
  c.fillRect(x, y, s * 0.45, s * 0.45);
}
const ANIMALS = {
  pig(c, w, b) {
    const leg = '#e07f98';
    box(c, -18, -10 + w * 0.8, 6, 10, leg); box(c, 9, -10 - w * 0.8, 6, 10, leg);
    box(c, -22, -26 + b, 34, 18, '#f7a8bc', '#ea93aa');
    box(c, -14, -10 - w * 0.8, 6, 10, leg); box(c, 13, -10 + w * 0.8, 6, 10, leg);
    box(c, 8, -32 + b, 18, 17, '#f7a8bc', '#ea93aa');
    box(c, 22, -24 + b, 8, 7, '#ec8aa3');
    c.fillStyle = '#9b4a5e';
    c.fillRect(24, -22 + b, 1.6, 2.4); c.fillRect(27.4, -22 + b, 1.6, 2.4);
    box(c, 9, -36 + b, 6, 5, '#ec8aa3');
    eye(c, 17, -29 + b, 3.2);
    c.strokeStyle = '#ea93aa'; c.lineWidth = 2;
    c.beginPath(); c.arc(-24, -21 + b, 3, 0.5, 5); c.stroke();
  },
  cow(c, w, b) {
    const leg = '#4a3c36';
    box(c, -20, -12 + w, 7, 12, leg); box(c, 10, -12 - w, 7, 12, leg);
    box(c, -24, -32 + b, 40, 22, '#f5f1e8', '#e2dccf');
    c.fillStyle = '#3d322e';
    c.fillRect(-18, -30 + b, 10, 8); c.fillRect(-2, -24 + b, 12, 9); c.fillRect(-23, -17 + b, 7, 5);
    box(c, -16, -12 - w, 7, 12, leg); box(c, 14, -12 + w, 7, 12, leg);
    box(c, 12, -40 + b, 18, 18, '#f5f1e8', '#e2dccf');
    box(c, 24, -30 + b, 9, 8, '#f2b6c2');
    c.fillStyle = '#e8e2d2'; c.fillRect(12, -45 + b, 4, 6); c.fillRect(24, -45 + b, 4, 6);
    c.fillStyle = '#3d322e'; c.fillRect(8, -38 + b, 5, 4);
    eye(c, 19, -36 + b, 3.4);
  },
  sheep(c, w, b) {
    const leg = '#4b3f3a';
    box(c, -16, -10 + w, 6, 10, leg); box(c, 8, -10 - w, 6, 10, leg);
    c.fillStyle = '#f4f2ea';
    for (const [x, y, r] of [[-14, -22, 10], [-4, -26, 11], [6, -22, 10], [-8, -15, 9], [4, -15, 9]]) {
      c.beginPath(); c.arc(x, y + b, r, 0, TAU); c.fill();
    }
    c.fillStyle = '#e1ddd0';
    c.beginPath(); c.arc(-4, -12 + b, 10, 0, Math.PI); c.fill();
    box(c, -12, -10 - w, 6, 10, leg); box(c, 12, -10 + w, 6, 10, leg);
    box(c, 12, -32 + b, 14, 15, '#5c4d46');
    c.fillStyle = '#f4f2ea'; c.fillRect(10, -35 + b, 12, 5);
    eye(c, 20, -27 + b, 3);
  },
  chicken(c, w, b) {
    c.strokeStyle = '#f2a22c'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-3, -9); c.lineTo(-3 + w * 0.6, 0); c.moveTo(3, -9); c.lineTo(3 - w * 0.6, 0); c.stroke();
    box(c, -10, -22 + b, 20, 14, '#fbfbf6', '#e7e6dc');
    box(c, -14, -21 + b, 6, 8, '#fbfbf6');
    box(c, 4, -31 + b, 10, 11, '#fbfbf6');
    c.fillStyle = '#e8453c'; c.fillRect(5, -35 + b, 3, 4); c.fillRect(8, -36 + b, 3, 5); c.fillRect(6, -22 + b, 3, 4);
    c.fillStyle = '#f2a22c'; c.fillRect(14, -27 + b, 5, 3);
    eye(c, 9, -29 + b, 2.6);
  },
};
export const FRIENDS = Object.keys(ANIMALS);
export function drawAnimal(c, kind, x, y, u, walk = 0, bob = 0, flip = false) {
  c.save();
  c.translate(x, y);
  c.scale(flip ? -u : u, u);
  ANIMALS[kind](c, walk, bob);
  c.restore();
}

export function drawBat(c, x, y, u, t) {
  const flap = Math.sin(t * 18);
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.fillStyle = '#4a3f6b';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 5, -2);
    c.lineTo(side * 26, -10 - flap * 12);
    c.lineTo(side * 20, 2 - flap * 4);
    c.lineTo(side * 14, -2 - flap * 3);
    c.lineTo(side * 9, 4);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#5b4f80';
  c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(-6, -5); c.lineTo(-5, -13); c.lineTo(-1, -7); c.moveTo(6, -5); c.lineTo(5, -13); c.lineTo(1, -7); c.fill();
  c.fillStyle = '#fff4b0';
  c.fillRect(-4, -2, 2.6, 2.6); c.fillRect(1.6, -2, 2.6, 2.6);
  c.restore();
}

export function drawCrab(c, x, y, u, t) {
  const step = Math.sin(t * 12) * 2;
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.strokeStyle = '#c4382f'; c.lineWidth = 2.4;
  c.beginPath();
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.moveTo(s * (6 + k * 4), -6); c.lineTo(s * (11 + k * 4), step * (k % 2 ? 1 : -1)); }
  c.stroke();
  c.fillStyle = '#e8473c';
  c.beginPath(); c.ellipse(0, -9, 13, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#c93a31';
  c.beginPath(); c.ellipse(0, -6, 13, 4, 0, 0, Math.PI); c.fill();
  c.fillStyle = '#e8473c';
  c.beginPath(); c.arc(-17, -15 - step, 5, 0, TAU); c.arc(17, -15 + step, 5, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.fillRect(-6, -21, 4, 4); c.fillRect(2, -21, 4, 4);
  c.fillStyle = '#1f2433'; c.fillRect(-5, -20, 2, 2); c.fillRect(3, -20, 2, 2);
  c.restore();
}

export function drawSnowman(c, x, y, u) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  for (const [cy, r] of [[-14, 15], [-38, 11], [-55, 8]]) {
    c.fillStyle = '#fbfdff';
    c.beginPath(); c.arc(0, cy, r, 0, TAU); c.fill();
    c.fillStyle = '#dce8f3';
    c.beginPath(); c.arc(0, cy, r, -0.4, Math.PI * 0.6); c.lineTo(0, cy); c.fill();
  }
  c.fillStyle = '#2f3542';
  c.fillRect(-4, -58, 2.6, 2.6); c.fillRect(2, -58, 2.6, 2.6);
  c.fillRect(-1.3, -40, 2.6, 2.6); c.fillRect(-1.3, -33, 2.6, 2.6);
  c.fillStyle = '#f08a24';
  c.beginPath(); c.moveTo(0, -54); c.lineTo(9, -52.5); c.lineTo(0, -51); c.fill();
  c.strokeStyle = '#7a5235'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-10, -40); c.lineTo(-22, -48); c.moveTo(10, -40); c.lineTo(22, -47); c.stroke();
  c.restore();
}

export function drawPalm(c, x, y, u, t = 0) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.fillStyle = '#b07a46';
  for (let k = 0; k < 7; k++) {
    const yy = -k * 13, xx = Math.sin(k * 0.35) * 8;
    c.fillRect(xx - 6 + k * 0.4, yy - 13, 12 - k * 0.6, 12);
  }
  const sway = Math.sin(t * 1.3) * 0.05;
  c.translate(14, -92);
  for (const [a, len, col] of [[-2.6, 46, '#4c9a3c'], [-1.9, 42, '#5aae46'], [-0.9, 44, '#4c9a3c'], [-0.2, 40, '#5aae46'], [-3.3, 38, '#5aae46']]) {
    c.save();
    c.rotate(a + sway);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -14, len, 6); c.quadraticCurveTo(len * 0.5, 4, 0, 4); c.fill();
    c.restore();
  }
  c.fillStyle = '#7a4f2a';
  c.beginPath(); c.arc(-2, 2, 4.5, 0, TAU); c.arc(5, 3, 4.5, 0, TAU); c.fill();
  c.restore();
}

export function drawTrophy(c, x, y, u, t = 0) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.fillStyle = '#6b4a2b'; c.fillRect(-26, -16, 52, 16);
  c.fillStyle = '#56391f'; c.fillRect(4, -16, 22, 16);
  c.fillStyle = '#f2c230'; c.fillRect(-8, -40, 16, 24);
  c.strokeStyle = '#f2c230'; c.lineWidth = 7;
  c.beginPath(); c.arc(-30, -82, 14, 0.9, 4.2); c.stroke();
  c.beginPath(); c.arc(30, -82, 14, -1.1, 2.3); c.stroke();
  c.fillStyle = '#ffd23f';
  c.beginPath(); c.moveTo(-34, -104); c.lineTo(34, -104); c.quadraticCurveTo(32, -50, 0, -40); c.quadraticCurveTo(-32, -50, -34, -104); c.fill();
  c.fillStyle = '#e8a900';
  c.beginPath(); c.moveTo(6, -104); c.lineTo(34, -104); c.quadraticCurveTo(32, -50, 0, -40); c.quadraticCurveTo(14, -60, 6, -104); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath(); c.ellipse(-16, -88, 4, 12, 0.2, 0, TAU); c.fill();
  const tw = 0.6 + 0.4 * Math.sin(t * 4);
  c.fillStyle = `rgba(255,255,255,${tw})`;
  c.beginPath(); c.moveTo(20, -112); c.lineTo(22, -106); c.lineTo(28, -104); c.lineTo(22, -102); c.lineTo(20, -96); c.lineTo(18, -102); c.lineTo(12, -104); c.lineTo(18, -106); c.fill();
  c.restore();
}

// ---- Icons for the page (SVG), in the same flat style. Nothing on a child screen is emoji except
// the word pictures.
export const ICONS = {
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.6 8.6 0 0 1 0 12" stroke="currentColor" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>',
  ear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 2.6c-4.3 0-7.6 3.2-7.6 7.3 0 2.3.9 3.6 1.9 4.9.9 1.2 1.6 2.2 1.6 3.7a3.5 3.5 0 0 0 6.9.9c.3-.9.9-1.4 1.6-2 1.6-1.4 3.4-3.1 3.4-6.6 0-4.6-3.5-8.2-7.8-8.2z" fill="#f5c7a4"/><path d="M15 6c1.6.9 2.6 2.6 2.6 4.4" stroke="#fbe0cb" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M9.4 10.2a3.2 3.2 0 0 1 6.2-1c.4 1.4-.3 2.5-1.3 3.2-.8.6-1.2 1.3-1.2 2.2" stroke="#c98b6a" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5C5.6 4.4 8.6 4.6 12 6.6v13c-3.4-2-6.4-2.2-9-1.1z" fill="#3d8bff"/><path d="M21 5.5c-2.6-1.1-5.6-.9-9 1.1v13c3.4-2 6.4-2.2 9-1.1z" fill="#2a6fd6"/><path d="M12 6.6v13" stroke="#fff" stroke-width="1.2"/></svg>',
  gem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l4 5-9 11L3 9z" fill="#40b8f4"/><path d="M12 20 21 9h-5.5z" fill="#1f95d6"/><path d="M3 9h18" stroke="#9fdcff" stroke-width="1.2"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="#f2c230"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#9aa3b5" stroke-width="2.6"/><circle cx="12" cy="15.5" r="1.8" fill="#8a6a10"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="#ffd23f"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5a3 3 0 1 1-2-2.8V5l11-2v11.5a3 3 0 1 1-2-2.8V6.3L9 7.6z" fill="#b06ce0"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5 9 3l4.5 3.4-2.2 2.2 9.2 9.2-2.7 2.7-9.2-9.2-2.2 2.2z" fill="#c98a4b"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z" fill="#8fcff5"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3a8.5 8.5 0 1 0 5.5 14.5A7 7 0 0 1 15.5 3z" fill="#f6c945"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0zM10.2 14.6h3.6v3.2h3.2V21H7v-3.2h3.2zM4 4h3v3.5A3 3 0 0 1 4 4.5zM20 4h-3v3.5A3 3 0 0 0 20 4.5z" fill="#f4b400"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5l4.6 3.8L12 5l4.4 7.3L21 8.5 19 18H5z" fill="#ffd23f"/><path d="M5 18h14v2.6H5z" fill="#e8a900"/><circle cx="3" cy="8" r="1.6" fill="#ffd23f"/><circle cx="12" cy="4.6" r="1.6" fill="#ffd23f"/><circle cx="21" cy="8" r="1.6" fill="#ffd23f"/></svg>',
  rook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 21h13v-2.6h-13zM7.4 17.6h9.2l-.9-7.6H8.3zM6.6 9.2h10.8V4.4h-2.5v2.1h-1.9V4.4H11v2.1H9.1V4.4H6.6z" fill="#7a72c9"/></svg>',
  // A pointing hand, for showing him where to tap.
  hand: '<svg viewBox="0 0 64 72" aria-hidden="true"><path d="M27 66c-3 0-5-2-5-5V43c-1 1-3 2-5 2-3 0-5-2-5-4-1 1-2 1-4 1-3 0-5-2-5-5V26c0-9 7-16 16-16h12c6 0 10 3 13 8l9 14c1 2 1 5-2 6-2 1-4 0-6-2l-2-3v28c0 3-2 5-4 5H27z" transform="rotate(180 32 38)" fill="#ffffff" stroke="#1f2a37" stroke-width="3.2" stroke-linejoin="round"/></svg>',
};
