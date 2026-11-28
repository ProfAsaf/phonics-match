// Soap bubbles for Balloon Pop. A popped balloon lets out a gush of bubbles that drift around the
// sky until the child pops them (tap, or swipe through several) or they pop by themselves after a
// few seconds, so every burst is finite. A few bubbles have a little friend inside. All drawn on
// one canvas: dozens of DOM nodes moving every frame would stutter on an older iPad.
import { sfx } from './sfx.js';

const TAU = Math.PI * 2;
const FRIENDS = ['🐟', '🦋', '🐞', '⭐', '🐸', '🐥', '🐙', '🐝', '🌸', '🦄', '🐢', '🍓'];
const TINTS = [[110, 190, 255], [255, 140, 205], [255, 214, 102], [120, 230, 190]];
const SPRITE = 160; // px; drawn once, then scaled

const rand = (a, b) => a + Math.random() * (b - a);

function bubbleSprite(tint) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d'), r = SPRITE / 2;
  g.translate(r, r);
  const [R, G, B] = tint;
  const body = g.createRadialGradient(0, 0, 0, 0, 0, r);
  body.addColorStop(0, `rgba(${R},${G},${B},0.05)`);
  body.addColorStop(0.68, `rgba(${R},${G},${B},0.13)`);
  body.addColorStop(0.88, 'rgba(255,255,255,0.30)');
  body.addColorStop(0.965, 'rgba(255,255,255,0.85)');
  body.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = body;
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  // the rainbow sheen soap films have, in patches round the rim
  g.lineWidth = r * 0.075;
  g.lineCap = 'round';
  for (const [col, a0, a1] of [['rgba(255,110,200,.5)', 2.3, 3.3], ['rgba(90,210,255,.55)', 5.5, 6.7], ['rgba(255,225,80,.5)', 0.35, 1.2], ['rgba(120,250,160,.4)', 3.7, 4.3]]) {
    g.strokeStyle = col;
    g.beginPath(); g.arc(0, 0, r * 0.88, a0, a1); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.92)';
  g.save(); g.rotate(-Math.PI / 4); g.beginPath(); g.ellipse(0, -r * 0.6, r * 0.3, r * 0.11, 0, 0, TAU); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,.6)';
  g.beginPath(); g.arc(r * 0.4, r * 0.46, r * 0.07, 0, TAU); g.fill();
  return c;
}

function emojiSprite(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(SPRITE * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.fillText(ch, SPRITE / 2, SPRITE / 2 + SPRITE * 0.05);
  return c;
}

let sprites = null; // shared by every field: [bubble tints], Map(friend → sprite)
function getSprites() {
  if (!sprites) sprites = { tints: TINTS.map(bubbleSprite), friends: new Map() };
  return sprites;
}
function friendSprite(ch) {
  const s = getSprites();
  if (!s.friends.has(ch)) s.friends.set(ch, emojiSprite(ch));
  return s.friends.get(ch);
}

export class BubbleField {
  // host: a positioned element the canvas fills. big: bigger, slower bubbles (Pre-K).
  constructor(host, { onPop, big = false } = {}) {
    this.host = host;
    this.onPop = onPop;
    this.big = big;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bubbles';
    host.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d');
    this.list = [];
    this.fx = [];
    this.waiters = [];
    this.total = 0; // popped by the child, this round
    this.chain = 0;
    this.lastPop = 0;
    this.lastSound = 0;
    this.lastFizz = 0;
    this.raf = 0;
    this.prev = 0;
    this.clock = 0;
    this.pointers = new Map();
    this.W = 0; this.H = 0; this.dpr = 1;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    const c = this.canvas;
    this.onDown = (e) => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch { /* fine */ }
      const p = this.pt(e);
      this.pointers.set(e.pointerId, p);
      this.sweep(p, p);
    };
    this.onMove = (e) => {
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      const p = this.pt(e);
      this.sweep(last, p);
      this.pointers.set(e.pointerId, p);
    };
    this.onUp = (e) => this.pointers.delete(e.pointerId);
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    if (!this.raf) this.draw();
  }
  pt(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // Let out a gush of bubbles at (x, y), in the host's coordinates. amount: 1 for a right answer
  // first time, less for a second try. Resolves when every bubble is gone.
  burst(x, y, { amount = 1 } = {}) {
    const W = this.W, H = this.H, m = Math.min(W, H);
    if (!W || !H) return Promise.resolve();
    const fast = !!window.__BA_TEST?.fast;
    const big = this.big ? 1.3 : 1;
    const n = Math.max(8, Math.round(Math.min(56, Math.max(24, (W * H) / 11000)) * amount / (this.big ? 1.25 : 1)));
    const rMin = Math.max(16, m * 0.035) * big, rMax = Math.max(30, m * 0.085) * big;
    const spread = 0.55; // seconds over which the bubbles pour out
    const now = this.clock;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (Math.random() - 0.5) * TAU * 0.86; // mostly down and sideways: the balloons float high
      const v = rand(0.45, 1.3) * m * 1.25;
      this.list.push({
        x: x + rand(-10, 10), y: y + rand(-10, 10),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: rMin + (rMax - rMin) * Math.random() ** 1.6,
        at: now + (i / n) * spread * (fast ? 0.3 : 1),
        life: rand(4.5, 8.5) * (this.big ? 1.25 : 1) * (fast ? 0.18 : 1),
        sink: rand(-0.05, 0.035) * H, // slow drift once the gush settles: some rise, some sink
        ph: rand(0, TAU), wf: rand(1.4, 2.8), wa: rand(10, 26),
        tint: Math.floor(Math.random() * TINTS.length),
        friend: Math.random() < 0.11 ? FRIENDS[Math.floor(Math.random() * FRIENDS.length)] : null,
        dead: false,
      });
    }
    this.canvas.classList.add('live');
    this.go();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  live() { return this.list.filter((b) => !b.dead && b.at <= this.clock); }
  // where the live bubbles are on screen (for the UI test)
  spots() {
    const r = this.canvas.getBoundingClientRect();
    return this.live().map((b) => ({ x: r.left + b.x, y: r.top + b.y, r: b.r }));
  }

  sweep(a, b) {
    const slop = this.big ? 14 : 10;
    for (const u of this.list) {
      if (u.dead || u.at > this.clock) continue;
      // distance from the bubble's centre to the finger's path since the last event
      const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((u.x - a.x) * dx + (u.y - a.y) * dy) / L)) : 0;
      const px = a.x + t * dx - u.x, py = a.y + t * dy - u.y;
      if (px * px + py * py <= (u.r + slop) ** 2) this.pop(u, false);
    }
  }

  pop(u, byItself) {
    u.dead = true;
    const now = this.clock;
    this.fx.push({ kind: 'ring', x: u.x, y: u.y, r: u.r, t0: now });
    const k = u.r / 30;
    for (let i = 0; i < 7; i++) {
      const a = rand(0, TAU), v = rand(140, 260) * k;
      this.fx.push({ kind: 'drop', x: u.x + Math.cos(a) * u.r * 0.8, y: u.y + Math.sin(a) * u.r * 0.8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(1.8, 3.2), t0: now });
    }
    if (u.friend) this.fx.push({ kind: 'friend', ch: u.friend, x: u.x, y: u.y, r: u.r, sway: rand(-1, 1), t0: now });
    const t = performance.now();
    if (byItself) {
      if (t - this.lastFizz > 120) { this.lastFizz = t; sfx.fizz(); }
      return;
    }
    this.total++;
    this.chain = t - this.lastPop < 650 ? this.chain + 1 : 0;
    this.lastPop = t;
    if (t - this.lastSound > 28) { this.lastSound = t; sfx.bubble(this.chain); }
    if (u.friend) setTimeout(() => sfx.friend(), 90);
    this.onPop?.(this.total);
  }

  go() {
    if (this.raf) return;
    this.prev = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - this.prev) / 1000);
      this.prev = t;
      this.clock += dt;
      this.step(dt);
      this.draw();
      if (!this.list.length && !this.fx.length) { this.raf = 0; this.settle(); return; }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  step(dt) {
    const W = this.W, H = this.H, now = this.clock;
    const ease = 1 - Math.exp(-2.0 * dt);
    for (const u of this.list) {
      if (u.dead || u.at > now) continue;
      const age = now - u.at;
      if (age > u.life) { this.pop(u, true); continue; }
      const tx = W * 0.03 * Math.sin(now * 0.45 + u.ph); // a gentle breeze
      u.vx += (tx - u.vx) * ease;
      u.vy += (u.sink - u.vy) * ease;
      u.x += (u.vx + Math.sin(age * u.wf + u.ph) * u.wa) * dt;
      u.y += u.vy * dt;
      if (u.x < u.r) { u.x = u.r; u.vx = Math.abs(u.vx) * 0.5; }
      if (u.x > W - u.r) { u.x = W - u.r; u.vx = -Math.abs(u.vx) * 0.5; }
      if (u.y < u.r) { u.y = u.r; u.vy = Math.abs(u.vy) * 0.3; }
      if (u.y > H - u.r) { u.y = H - u.r; u.vy = -Math.abs(u.vy) * 0.4; }
    }
    this.list = this.list.filter((u) => !u.dead);
    for (const f of this.fx) {
      if (f.kind === 'drop') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; }
    }
    this.fx = this.fx.filter((f) => now - f.t0 < (f.kind === 'friend' ? 1.15 : f.kind === 'ring' ? 0.22 : 0.38));
  }

  draw() {
    const g = this.g, s = this.dpr, now = this.clock;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    const sp = getSprites();
    for (const u of this.list) {
      if (u.at > now) continue;
      const age = now - u.at;
      const grow = Math.min(1, 0.35 + age / 0.18 * 0.65);
      const rr = u.r * grow * (1 + 0.025 * Math.sin(age * 3 + u.ph));
      const sq = 0.045 * Math.sin(age * 2.3 + u.ph);
      const fade = u.life - age < 0.5 ? 0.65 + 0.35 * Math.abs(Math.sin(age * 22)) : 1; // thinning just before it pops
      g.save();
      g.translate(u.x, u.y);
      g.globalAlpha = fade;
      if (u.friend) {
        g.save();
        g.rotate(0.25 * Math.sin(age * 1.7 + u.ph));
        g.drawImage(friendSprite(u.friend), -rr * 0.58, -rr * 0.58, rr * 1.16, rr * 1.16);
        g.restore();
      }
      g.scale(1 + sq, 1 - sq);
      g.drawImage(sp.tints[u.tint], -rr, -rr, rr * 2, rr * 2);
      g.restore();
    }
    for (const f of this.fx) {
      const t = now - f.t0;
      if (f.kind === 'ring') {
        const p = t / 0.22;
        g.globalAlpha = 0.85 * (1 - p);
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5 * (1 - p) + 0.5;
        g.beginPath(); g.arc(f.x, f.y, f.r * (1 + 0.4 * p), 0, TAU); g.stroke();
      } else if (f.kind === 'drop') {
        g.globalAlpha = Math.max(0, 1 - t / 0.38);
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(f.x, f.y, f.s, 0, TAU); g.fill();
      } else {
        const p = t / 1.15;
        const sc = p < 0.2 ? 1 + p : p > 0.78 ? 1.2 * (1 - (p - 0.78) / 0.22) : 1.2;
        const sz = f.r * 1.2 * sc;
        g.globalAlpha = p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.22) : 1;
        g.save();
        g.translate(f.x + Math.sin(t * 6) * 10 * f.sway, f.y - 90 * p);
        g.rotate(0.3 * Math.sin(t * 7));
        g.drawImage(friendSprite(f.ch), -sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  }

  settle() {
    this.canvas.classList.remove('live');
    this.pointers.clear();
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }
  // Home: drop everything now
  stop() {
    this.list = [];
    this.fx = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.draw();
    this.settle();
  }
  destroy() {
    this.stop();
    this.ro.disconnect();
    this.canvas.remove();
  }
}
