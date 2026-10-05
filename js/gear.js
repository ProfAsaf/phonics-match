// His gear and the day's extras, drawn in the same flat style as art.js, with no outlines and one shade
// per shape: hats, the moves of each goal celebration, the mystery chest, and visitors in the sky.
// All original shapes, not copied from any game.
import { IMG, TAU, shade, characterFrame } from './art.js';
import { clamp, easeInOut } from './scene.js';

// ---- Where a hat sits: the top of the head in each frame, found once from the picture itself. The
// head is the biggest blob in the top half, so a spike of hair or a raised arm is skipped.
const heads = new Map();
export function headTop(ch, pose) {
  const key = `${ch}/${pose}`;
  if (heads.has(key)) return heads.get(key);
  const im = IMG[`char/${key}`];
  if (!im?.naturalWidth) return null;
  const W = im.naturalWidth, H = im.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0);
  let d;
  try {
    d = x.getImageData(0, 0, W, H).data;
  } catch {
    const guess = { x: W / 2, y: H * 0.12, w: W * 0.5, tilt: 0 };
    heads.set(key, guess);
    return guess;
  }
  // The longest run of solid pixels in a row.
  const run = y => {
    let best = null, a = -1;
    for (let i = 0; i <= W; i++) {
      const solid = i < W && d[(y * W + i) * 4 + 3] > 60;
      if (solid && a < 0) a = i;
      if (!solid && a >= 0) {
        if (!best || i - a > best[1] - best[0]) best = [a, i];
        a = -1;
      }
    }
    return best;
  };
  let headW = 0;
  for (let y = 0; y < H * 0.5; y++) {
    const r = run(y);
    if (r && r[1] - r[0] > headW) headW = r[1] - r[0];
  }
  let out = { x: W / 2, y: H * 0.12, w: headW || W * 0.5, tilt: 0 };
  for (let y = 0; y < H * 0.5; y++) {
    const r = run(y);
    if (r && r[1] - r[0] >= headW * 0.55) {
      const lower = run(Math.min(H - 1, y + 34));
      const cx = (r[0] + r[1]) / 2;
      const tilt = lower ? clamp(Math.atan2(cx - (lower[0] + lower[1]) / 2, 34), -0.35, 0.35) : 0;
      out = { x: cx, y, w: headW, tilt };
      break;
    }
  }
  heads.set(key, out);
  return out;
}

// A character with his hat on, feet at (x, y), like drawCharacter in art.js.
export function drawWithHat(c, ch, pose, kit, x, y, k, flip = false, hat = 'none', t = 0) {
  const fr = characterFrame(ch, pose, kit);
  if (!fr) return;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(fr, -96 * k, -256 * k, 192 * k, 256 * k);
  if (hat && hat !== 'none') {
    const head = headTop(ch, pose);
    if (head) {
      c.translate((head.x - 96) * k, (head.y - 256) * k);
      c.rotate(head.tilt);
      drawHat(c, hat, head.w * k, kit, t);
    }
  }
  c.restore();
}

// Hats, drawn facing right with (0, 0) at the top middle of the head; w is the head's width.
export const HATS = ['none', 'cap', 'party', 'crown', 'wizard', 'viking', 'pirate', 'propeller', 'astronaut'];
export function drawHat(c, id, w, kit = '#e63946', t = 0) {
  const u = w / 100;
  c.save();
  c.scale(u, u);
  const fill = (col, f) => {
    c.fillStyle = col;
    c.beginPath();
    f();
    c.fill();
  };
  switch (id) {
    case 'cap':
      fill(kit, () => { c.ellipse(0, 14, 50, 40, 0, Math.PI, TAU); });
      fill(shade(kit, -0.2), () => { c.ellipse(0, 14, 50, 40, 0, Math.PI * 1.55, TAU); c.lineTo(0, 14); });
      fill(shade(kit, -0.28), () => { c.moveTo(26, 8); c.quadraticCurveTo(70, 4, 82, 16); c.quadraticCurveTo(60, 22, 26, 18); });
      fill('#ffffff', () => { c.arc(0, -26, 6, 0, TAU); });
      break;
    case 'party':
      c.rotate(0.18);
      fill('#3a86ff', () => { c.moveTo(-28, 10); c.lineTo(0, -78); c.lineTo(28, 10); });
      c.save();
      c.beginPath();
      c.moveTo(-28, 10); c.lineTo(0, -78); c.lineTo(28, 10);
      c.clip();
      c.fillStyle = '#ffd23f';
      for (let k = 0; k < 4; k++) c.fillRect(-40, -62 + k * 20, 80, 8);
      c.restore();
      fill('#ef476f', () => { c.arc(0, -80, 10, 0, TAU); });
      break;
    case 'crown':
      fill('#ffd23f', () => {
        c.moveTo(-40, 14); c.lineTo(-44, -26); c.lineTo(-22, -6); c.lineTo(0, -36); c.lineTo(22, -6); c.lineTo(44, -26); c.lineTo(40, 14);
      });
      fill('#e8a900', () => { c.rect(-40, 4, 80, 10); });
      fill('#ef476f', () => { c.arc(0, -2, 6, 0, TAU); });
      fill('#3a86ff', () => { c.arc(-24, 4, 4.5, 0, TAU); c.arc(24, 4, 4.5, 0, TAU); });
      for (const [x, y] of [[-44, -26], [0, -36], [44, -26]]) fill('#ffd23f', () => { c.arc(x, y, 5, 0, TAU); });
      break;
    case 'wizard':
      fill('#2b3a8f', () => { c.ellipse(0, 12, 66, 13, 0, 0, TAU); });
      fill('#3949ab', () => { c.moveTo(-38, 10); c.quadraticCurveTo(-8, -40, 26, -104); c.quadraticCurveTo(12, -40, 38, 10); });
      fill('#ffd23f', () => {
        for (const [x, y, r] of [[-8, -20, 7], [14, -48, 5], [-2, -2, 4]]) {
          c.moveTo(x + r, y);
          for (let k = 1; k <= 10; k++) {
            const a = (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
            c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
        }
      });
      break;
    case 'viking':
      fill('#f3ead8', () => { c.moveTo(-40, -6); c.quadraticCurveTo(-74, -18, -70, -62); c.quadraticCurveTo(-58, -34, -34, -26); });
      fill('#f3ead8', () => { c.moveTo(40, -6); c.quadraticCurveTo(74, -18, 70, -62); c.quadraticCurveTo(58, -34, 34, -26); });
      fill('#9aa3b5', () => { c.ellipse(0, 14, 48, 42, 0, Math.PI, TAU); });
      fill('#7d8699', () => { c.ellipse(0, 14, 48, 42, 0, Math.PI * 1.55, TAU); c.lineTo(0, 14); });
      fill('#c98a4b', () => { c.rect(-50, 6, 100, 12); });
      break;
    case 'pirate':
      fill('#2f2a3a', () => {
        c.moveTo(-66, 8); c.quadraticCurveTo(-60, -40, -30, -34); c.quadraticCurveTo(0, -60, 30, -34);
        c.quadraticCurveTo(60, -40, 66, 8); c.quadraticCurveTo(0, -6, -66, 8);
      });
      fill('#ffd23f', () => { c.rect(-56, -2, 112, 6); });
      fill('#ffffff', () => {
        c.moveTo(0, -36);
        for (let k = 1; k <= 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 4.5 : 10;
          c.lineTo(Math.cos(a) * rr, -26 + Math.sin(a) * rr);
        }
      });
      break;
    case 'propeller': {
      fill(kit, () => { c.ellipse(0, 14, 48, 40, 0, Math.PI, TAU); });
      c.save();
      c.beginPath();
      c.ellipse(0, 14, 48, 40, 0, Math.PI, TAU);
      c.clip();
      c.fillStyle = '#ffd23f';
      for (let k = -2; k <= 2; k++) c.fillRect(k * 20 - 5, -30, 10, 50);
      c.restore();
      fill('#5b6673', () => { c.rect(-2.5, -40, 5, 16); });
      const spin = Math.cos(t * 22);
      fill('#ef476f', () => { c.ellipse(-26 * spin, -42, 26 * Math.abs(spin) + 2, 6, 0, 0, TAU); });
      fill('#3a86ff', () => { c.ellipse(26 * spin, -42, 26 * Math.abs(spin) + 2, 6, 0, 0, TAU); });
      fill('#ffd23f', () => { c.arc(0, -42, 5, 0, TAU); });
      break;
    }
    case 'astronaut':
      c.fillStyle = 'rgba(190,230,255,0.28)';
      c.beginPath();
      c.arc(0, 42, 66, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 6;
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.ellipse(-26, 8, 9, 20, 0.5, 0, TAU);
      c.fill();
      fill('#dfe6ee', () => { c.rect(-56, 92, 112, 14); });
      break;
    default:
  }
  c.restore();
}

// ---- Goal celebrations, as his pose and an offset over time t (seconds since the goal; two at most).
// dx runs away from the goal; fx asks the run for extras: dust, music notes, or fireworks.
export const CELEBRATIONS = ['cheer', 'slide', 'spin', 'dance', 'flip', 'robot', 'airplane', 'fireworks', 'moonwalk'];
export function celebrationFrame(id, t) {
  const beat = (rate, a, b) => (Math.floor(t * rate) % 2 ? a : b);
  const hop = (h, rate = 9) => -Math.abs(Math.sin(t * rate)) * h;
  switch (id) {
    case 'slide': {
      if (t < 0.3) return { pose: `run${Math.floor(t * 12) % 3}`, dx: -t * 140, dy: 0, rot: 0, flip: true };
      if (t < 1.0) {
        const u = (t - 0.3) / 0.7;
        return { pose: 'kick', dx: -42 - 60 * (1 - (1 - u) ** 2), dy: 0, rot: 0.1, flip: true, fx: 'dust' };
      }
      return { pose: beat(5, 'cheer1', 'cheer0'), dx: -102, dy: hop(10), rot: 0, flip: true };
    }
    case 'spin': {
      if (t < 0.15) return { pose: 'idle', dx: 0, dy: 4, rot: 0 };
      if (t < 0.95) {
        const u = (t - 0.15) / 0.8;
        return { pose: 'jump', dx: 0, dy: -150 * 4 * u * (1 - u), rot: TAU * easeInOut(u), spin: true };
      }
      return { pose: beat(5, 'cheer1', 'cheer0'), dx: 0, dy: hop(8), rot: 0 };
    }
    case 'dance': {
      const step = Math.floor(t * 5) % 4;
      return { pose: ['cheer0', 'walk3', 'cheer1', 'walk7'][step], dx: Math.sin(t * 10) * 12, dy: hop(10, 10), rot: Math.sin(t * 10) * 0.1, flip: step >= 2, fx: 'notes' };
    }
    case 'flip': {
      if (t < 0.12) return { pose: 'idle', dx: 0, dy: 5, rot: 0 };
      if (t < 1.0) {
        const u = (t - 0.12) / 0.88;
        return { pose: u < 0.5 ? 'jump' : 'fall', dx: -30 * u, dy: -170 * 4 * u * (1 - u), rot: -TAU * easeInOut(u) };
      }
      return { pose: beat(5, 'cheer1', 'cheer0'), dx: -30, dy: hop(8), rot: 0 };
    }
    case 'robot': {
      const step = Math.floor(t * 4);
      return { pose: ['idle', 'kick', 'cheer0', 'kick'][step % 4], dx: 0, dy: 0, rot: [0, 0.08, 0, -0.08][step % 4], flip: step % 4 === 3 };
    }
    case 'airplane': {
      const a = t * 3.2;
      return { pose: 'jump', dx: -60 + Math.cos(a) * -60, dy: -20 + Math.sin(a * 2) * 6, rot: -Math.sin(a) * 0.3, flip: Math.sin(a) > 0 };
    }
    case 'fireworks':
      return { pose: t < 0.3 ? 'idle' : 'cheer0', dx: 0, dy: t < 0.3 ? 0 : hop(5, 6), rot: 0, fx: t > 0.25 ? 'fireworks' : null };
    case 'moonwalk':
      return { pose: `walk${7 - (Math.floor(t * 10) % 8)}`, dx: -t * 55, dy: 0, rot: 0 };
    default:
      return { pose: beat(4.5, 'cheer1', 'cheer0'), dx: 0, dy: hop(16), rot: 0 };
  }
}

// ---- The mystery chest: wood with gold trim; `open` from 0 to 1 swings the lid back.
export function drawChest(c, x, y, u, open = 0, t = 0) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  if (open > 0) {
    const g = c.createRadialGradient(0, -34, 2, 0, -34, 70);
    g.addColorStop(0, `rgba(255,230,120,${0.75 * open})`);
    g.addColorStop(1, 'rgba(255,230,120,0)');
    c.fillStyle = g;
    c.fillRect(-70, -104, 140, 140);
  }
  c.fillStyle = '#8a5a2b';
  c.fillRect(-26, -30, 52, 30);
  c.fillStyle = '#6f4521';
  c.fillRect(-26, -9, 52, 9);
  c.fillStyle = '#ffd23f';
  c.fillRect(-26, -30, 5, 30);
  c.fillRect(21, -30, 5, 30);
  // the lid, hinged at the back
  c.save();
  c.translate(0, -30);
  c.rotate(-1.9 * easeInOut(clamp(open, 0, 1)));
  c.fillStyle = '#9b6a35';
  c.beginPath();
  c.moveTo(-26, 0);
  c.lineTo(-26, -10);
  c.quadraticCurveTo(0, -24, 26, -10);
  c.lineTo(26, 0);
  c.closePath();
  c.fill();
  c.fillStyle = '#ffd23f';
  c.fillRect(-26, -10, 5, 10);
  c.fillRect(21, -10, 5, 10);
  c.fillRect(-4, -8, 8, 10);
  c.restore();
  if (open < 0.05) {
    const tw = 0.5 + 0.5 * Math.sin(t * 5);
    c.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.5})`;
    c.beginPath();
    c.arc(15, -44 - tw * 4, 2.5 + tw, 0, TAU);
    c.fill();
  }
  c.restore();
}

// ---- Scenery for the later worlds, feet at (x, y).
// A giant mushroom for the mushroom world: a spotted cap on a pale stem.
export function drawBigMushroom(c, x, y, u, hue = 330) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.fillStyle = '#f3ead8';
  c.beginPath();
  c.moveTo(-9, 0); c.quadraticCurveTo(-12, -30, -7, -58); c.lineTo(7, -58); c.quadraticCurveTo(12, -30, 9, 0);
  c.fill();
  c.fillStyle = '#ded3bd';
  c.fillRect(2, -56, 6, 56);
  c.fillStyle = `hsl(${hue} 70% 62%)`;
  c.beginPath();
  c.ellipse(0, -58, 44, 30, 0, Math.PI, 0);
  c.quadraticCurveTo(0, -50, -44, -58);
  c.fill();
  c.fillStyle = `hsl(${hue} 60% 52%)`;
  c.beginPath();
  c.ellipse(0, -58, 44, 30, 0, Math.PI * 1.55, 0);
  c.lineTo(0, -54);
  c.fill();
  c.fillStyle = '#fff6e8';
  for (const [sx, sy, r] of [[-22, -70, 6], [4, -80, 7], [24, -66, 5], [-6, -64, 4]]) {
    c.beginPath();
    c.arc(sx, sy, r, 0, TAU);
    c.fill();
  }
  c.restore();
}

// A pumpkin for the autumn world.
export function drawPumpkin(c, x, y, u) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  for (const [dx, w, col] of [[-9, 12, '#e8862a'], [9, 12, '#e8862a'], [0, 13, '#f39a3a']]) {
    c.fillStyle = col;
    c.beginPath();
    c.ellipse(dx, -11, w, 11, 0, 0, TAU);
    c.fill();
  }
  c.fillStyle = 'rgba(160,70,10,0.25)';
  c.beginPath();
  c.ellipse(6, -9, 10, 9, 0, -0.5, 1.8);
  c.fill();
  c.fillStyle = '#5b8a3c';
  c.fillRect(-2, -27, 4, 7);
  c.restore();
}

// A volcano for the volcano world's skyline, smoking, with lava down one side.
export function drawVolcano(c, x, y, u, t) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  for (let k = 0; k < 5; k++) {
    const a = ((t * 0.25 + k / 5) % 1);
    c.fillStyle = `rgba(90,80,80,${0.35 * (1 - a)})`;
    c.beginPath();
    c.arc(Math.sin(k * 2 + t * 0.3) * 14 * a, -150 - a * 120, 18 + a * 30, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#4b3b3a';
  c.beginPath();
  c.moveTo(-170, 0); c.lineTo(-34, -150); c.lineTo(34, -150); c.lineTo(170, 0);
  c.fill();
  c.fillStyle = '#3c2f2e';
  c.beginPath();
  c.moveTo(20, -150); c.lineTo(34, -150); c.lineTo(170, 0); c.lineTo(60, 0);
  c.fill();
  const glow = 0.75 + 0.25 * Math.sin(t * 3);
  c.fillStyle = `rgba(255,120,40,${glow})`;
  c.beginPath();
  c.moveTo(-26, -150); c.lineTo(26, -150); c.lineTo(10, -128);
  c.quadraticCurveTo(-6, -90, -30, -40); c.lineTo(-44, 0); c.lineTo(-52, 0);
  c.quadraticCurveTo(-30, -70, -14, -128);
  c.fill();
  c.restore();
}

// A pool of lava, glowing.
export function drawLava(c, x, y, rx, ry, t) {
  const g = c.createRadialGradient(x, y, 1, x, y, rx);
  g.addColorStop(0, '#ffd166');
  g.addColorStop(0.5, '#ff7b25');
  g.addColorStop(1, 'rgba(200,50,20,0.9)');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
  c.fillStyle = `rgba(255,240,180,${0.4 + 0.3 * Math.sin(t * 2)})`;
  c.beginPath();
  c.ellipse(x - rx * 0.3, y - ry * 0.2, rx * 0.25, ry * 0.25, 0, 0, TAU);
  c.fill();
}

// ---- Visitors in the sky, facing right, centered on (x, y).
export function drawBalloon(c, x, y, u, colors, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 0.8) * 6 * u);
  c.scale(u, u);
  c.strokeStyle = '#6b4a2b';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-14, 22); c.lineTo(-8, 52); c.moveTo(14, 22); c.lineTo(8, 52);
  c.stroke();
  c.fillStyle = '#a8703c';
  c.fillRect(-10, 50, 20, 13);
  c.fillStyle = colors[0];
  c.beginPath();
  c.moveTo(-14, 24);
  c.bezierCurveTo(-50, -4, -40, -54, 0, -54);
  c.bezierCurveTo(40, -54, 50, -4, 14, 24);
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = colors[1];
  for (const sx of [-30, -6, 18]) c.fillRect(sx, -60, 12, 90);
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(10, -60, 40, 90);
  c.restore();
  c.restore();
}

export function drawPlane(c, x, y, u, color, t) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  // the ribbon tail
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(-34, -2);
  for (let k = 0; k <= 10; k++) c.lineTo(-34 - k * 9, -2 + Math.sin(t * 6 + k * 0.8) * 4);
  for (let k = 10; k >= 0; k--) c.lineTo(-34 - k * 9, 6 + Math.sin(t * 6 + k * 0.8) * 4);
  c.closePath();
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, 0, 34, 9, 0, 0, TAU);
  c.fill();
  c.fillStyle = shade(color, -0.25);
  c.fillRect(-6, -2, 16, 16);
  c.beginPath();
  c.moveTo(-26, -2); c.lineTo(-36, -18); c.lineTo(-28, -18); c.lineTo(-18, -2);
  c.fill();
  c.fillStyle = '#bfe6ff';
  c.beginPath();
  c.ellipse(14, -5, 7, 4, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5b6673';
  const blade = Math.abs(Math.cos(t * 40)) * 12 + 2;
  c.fillRect(33, -blade, 3, blade * 2);
  c.restore();
}

export function drawBirds(c, x, y, u, t) {
  c.strokeStyle = '#3d4a63';
  c.lineWidth = 2.2 * u;
  c.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const bx = x - (k % 3) * 22 * u - Math.floor(k / 3) * 12 * u, by = y + (k % 3) * 12 * u + Math.floor(k / 3) * 26 * u;
    const f = Math.sin(t * 9 + k) * 5 * u;
    c.beginPath();
    c.moveTo(bx - 9 * u, by - f);
    c.quadraticCurveTo(bx - 4 * u, by - 4 * u, bx, by);
    c.quadraticCurveTo(bx + 4 * u, by - 4 * u, bx + 9 * u, by - f);
    c.stroke();
  }
}

export function drawKite(c, x, y, gx, gy, u, colors, t) {
  const sx = x + Math.sin(t * 1.1) * 14 * u, sy = y + Math.cos(t * 0.9) * 8 * u;
  c.strokeStyle = 'rgba(80,80,90,0.6)';
  c.lineWidth = 1.2 * u;
  c.beginPath();
  c.moveTo(sx, sy + 26 * u);
  c.quadraticCurveTo((sx + gx) / 2 + 30 * u, (sy + gy) / 2 + 40 * u, gx, gy);
  c.stroke();
  c.save();
  c.translate(sx, sy);
  c.rotate(Math.sin(t * 1.3) * 0.15);
  c.scale(u, u);
  c.fillStyle = colors[0];
  c.beginPath();
  c.moveTo(0, -30); c.lineTo(20, 0); c.lineTo(0, 30); c.lineTo(-20, 0);
  c.closePath();
  c.fill();
  c.fillStyle = colors[1];
  c.beginPath();
  c.moveTo(0, -30); c.lineTo(20, 0); c.lineTo(0, 0);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(0, 30); c.lineTo(-20, 0); c.lineTo(0, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = colors[1];
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 30);
  for (let k = 1; k <= 6; k++) c.lineTo(Math.sin(t * 4 + k) * 7, 30 + k * 10);
  c.stroke();
  for (let k = 1; k <= 3; k++) {
    c.fillStyle = k % 2 ? colors[0] : '#ffd23f';
    c.fillRect(Math.sin(t * 4 + k * 2) * 7 - 4, 30 + k * 20 - 3, 8, 6);
  }
  c.restore();
}

export function drawBlimp(c, x, y, u, color, t) {
  c.save();
  c.translate(x, y + Math.sin(t * 0.6) * 4 * u);
  c.scale(u, u);
  c.fillStyle = '#e9edf3';
  c.beginPath();
  c.ellipse(0, 0, 70, 24, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#d3d9e2';
  c.beginPath();
  c.ellipse(0, 6, 70, 18, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = color;
  c.fillRect(-52, -5, 104, 9);
  c.beginPath();
  c.moveTo(-58, -4); c.lineTo(-84, -24); c.lineTo(-76, 0); c.lineTo(-84, 22); c.lineTo(-58, 4);
  c.fill();
  c.fillStyle = '#9aa3b5';
  c.fillRect(-12, 22, 24, 9);
  c.restore();
}

export function drawUfo(c, x, y, u, t) {
  c.save();
  c.translate(x + Math.sin(t * 1.7) * 30 * u, y + Math.sin(t * 2.3) * 10 * u);
  c.rotate(Math.sin(t * 1.7) * 0.12);
  c.scale(u, u);
  const g = c.createLinearGradient(0, 10, 0, 60);
  g.addColorStop(0, 'rgba(160,255,190,0.35)');
  g.addColorStop(1, 'rgba(160,255,190,0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-14, 8); c.lineTo(14, 8); c.lineTo(30, 60); c.lineTo(-30, 60);
  c.fill();
  c.fillStyle = 'rgba(190,240,255,0.85)';
  c.beginPath();
  c.ellipse(0, -8, 16, 13, 0, Math.PI, TAU);
  c.fill();
  c.fillStyle = '#9aa3b5';
  c.beginPath();
  c.ellipse(0, 0, 40, 10, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7d8699';
  c.beginPath();
  c.ellipse(0, 3, 40, 7, 0, 0, Math.PI);
  c.fill();
  for (let k = 0; k < 5; k++) {
    c.fillStyle = Math.floor(t * 6 + k) % 2 ? '#ffd23f' : '#ff6b6b';
    c.beginPath();
    c.arc(-28 + k * 14, 1, 2.6, 0, TAU);
    c.fill();
  }
  c.restore();
}

export function drawRocket(c, x, y, u, t) {
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  for (let k = 0; k < 7; k++) {
    c.fillStyle = `rgba(230,230,240,${0.5 - k * 0.06})`;
    c.beginPath();
    c.arc(Math.sin(t * 3 + k) * 4, 36 + k * 16, 8 + k * 2.5, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#ffb23b';
  c.beginPath();
  c.moveTo(-7, 22); c.lineTo(0, 34 + Math.sin(t * 30) * 5); c.lineTo(7, 22);
  c.fill();
  c.fillStyle = '#f3f5f8';
  c.beginPath();
  c.moveTo(-9, 22); c.lineTo(-9, -12); c.quadraticCurveTo(0, -36, 9, -12); c.lineTo(9, 22);
  c.closePath();
  c.fill();
  c.fillStyle = '#ef476f';
  c.beginPath();
  c.moveTo(-9, 10); c.lineTo(-18, 24); c.lineTo(-9, 22); c.moveTo(9, 10); c.lineTo(18, 24); c.lineTo(9, 22);
  c.fill();
  c.fillStyle = '#3a86ff';
  c.beginPath();
  c.arc(0, -6, 4, 0, TAU);
  c.fill();
  c.restore();
}

export function drawRainbow(c, x, y, r, a) {
  c.save();
  c.globalAlpha = a;
  const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  const band = r * 0.06;
  cols.forEach((col, k) => {
    c.strokeStyle = col;
    c.lineWidth = band;
    c.beginPath();
    c.arc(x, y, r - k * band, Math.PI, TAU);
    c.stroke();
  });
  c.restore();
}

export function drawButterfly(c, x, y, u, color, t) {
  const f = Math.abs(Math.sin(t * 14));
  c.save();
  c.translate(x, y);
  c.scale(u, u);
  c.fillStyle = color;
  for (const s of [-1, 1]) {
    c.beginPath();
    c.ellipse(s * 6 * (0.3 + f * 0.7), -4, 6 * (0.3 + f * 0.7), 7, s * 0.4, 0, TAU);
    c.ellipse(s * 5 * (0.3 + f * 0.7), 4, 4 * (0.3 + f * 0.7), 5, -s * 0.4, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#3d2c22';
  c.fillRect(-1, -7, 2, 14);
  c.restore();
}
