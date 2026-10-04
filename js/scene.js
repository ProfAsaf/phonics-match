// The canvas behind every screen: one frame loop that draws the current view (the world map or the
// day's run), game-clock timers so motion keeps step with the frames, and the circle wipe that
// carries his player from the map into the run and back.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const easeOut = t => 1 - (1 - t) ** 3;
export const easeInOut = t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeBack = t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
export function hash(n) {
  n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.view = null;
    this.time = 0;
    this.timers = [];
    this.watchers = [];
    this.wipe = null; // the circle wipe: radius from 0 (closed) to 1 (open), centered on a point
    this.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.view?.pointer?.('down', e));
    addEventListener('pointermove', e => this.view?.pointer?.('move', e));
    addEventListener('pointerup', e => this.view?.pointer?.('up', e));
    addEventListener('pointercancel', e => this.view?.pointer?.('up', e));
  }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = innerWidth;
    this.H = innerHeight;
    this.Wd = Math.round(this.W * this.DPR);
    this.Hd = Math.round(this.H * this.DPR);
    this.canvas.width = this.Wd;
    this.canvas.height = this.Hd;
    this.S = clamp(this.H / 844, 0.75, 1.5); // the design scale: a phone in portrait is about 844 tall
    this.c.imageSmoothingQuality = 'high';
    this.view?.resize?.();
  }

  show(view) {
    this.view = view;
    view.scene = this;
    view.resize?.();
  }

  start() {
    this.last = performance.now();
    this.schedule();
  }

  wait(s) {
    return new Promise(resolve => this.timers.push({ at: this.time + s, resolve }));
  }

  until(pred) {
    return new Promise(resolve => this.watchers.push({ pred, resolve }));
  }

  // Runs fn(p) every frame for s seconds, p eased from 0 to 1.
  tween(s, fn, ease = easeInOut) {
    const t0 = this.time;
    return this.until(() => {
      const p = clamp((this.time - t0) / s, 0, 1);
      fn(ease(p));
      return p >= 1;
    });
  }

  // The circle wipe: closes on (x, y) in page pixels, or opens from it.
  async circle(to, { x = this.W / 2, y = this.H / 2, s = 0.6 } = {}) {
    const from = this.wipe?.r ?? (to ? 0 : 1);
    this.wipe = { r: from, x, y };
    await this.tween(s, p => { this.wipe.r = lerp(from, to, p); }, easeInOut);
    if (to >= 1) this.wipe = null;
  }

  frame(now) {
    clearTimeout(this.fallback);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.time >= this.timers[i].at) this.timers.splice(i, 1)[0].resolve();
    for (let i = this.watchers.length - 1; i >= 0; i--) if (this.watchers[i].pred()) this.watchers.splice(i, 1)[0].resolve();
    const { c } = this;
    if (this.view) {
      this.view.update?.(dt);
      this.view.draw(c);
    } else {
      c.fillStyle = '#8fd3f4';
      c.fillRect(0, 0, this.Wd, this.Hd);
    }
    if (this.wipe) this.drawWipe();
    this.schedule();
  }

  drawWipe() {
    const { c, Wd, Hd, DPR } = this;
    const { r, x, y } = this.wipe;
    const max = Math.hypot(Math.max(x, this.W - x), Math.max(y, this.H - y)) * DPR;
    c.fillStyle = '#16233a';
    c.beginPath();
    c.rect(0, 0, Wd, Hd);
    if (r > 0) {
      c.moveTo(x * DPR + r * max, y * DPR);
      c.arc(x * DPR, y * DPR, r * max, 0, Math.PI * 2, true);
    }
    c.fill('evenodd');
  }

  // Frames stop in hidden tabs and some previews; a slow timer keeps the game moving there.
  schedule() {
    this.raf = requestAnimationFrame(now => this.frame(now));
    this.fallback = setTimeout(() => {
      cancelAnimationFrame(this.raf);
      this.frame(performance.now());
    }, 120);
  }
}
