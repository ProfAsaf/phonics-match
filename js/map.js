// The world map: home. A winding path climbs through his worlds, one per step, each with its own
// scenery. Every match is a level on the path: played levels carry a flag in his kit color, his
// player stands on today's, and the worlds ahead wait under clouds until signing the queen opens the
// gate. Drawn on the scene's canvas; the buttons and counters are page elements on top.
import { img, size, drawCharacter, characterImages, drawAnimal, drawPiece, kitPiece, drawSnowman, drawPalm, drawCrab, drawTrophy, TAU, shade } from './art.js';
import { LEVELS_PER_WORLD, MAP_WORLD, levelSpot, gateSpot, hereLevel, flagged } from './journey.js';
import { clamp, lerp, hash, easeInOut } from './scene.js';
import { drawWithHat, drawBigMushroom, drawPumpkin, drawVolcano, drawLava } from './gear.js';

const THEMES = {
  meadow: {
    ground: '#a3d96f', patch: '#93cf61', light: '#b6e386', path: '#f3e3b6', edge: '#d8c08e',
    trees: ['bg/tree05', 'bg/tree34', 'bg/tree23', 'bg/tree02', 'bg/tree05'], animals: ['pig', 'cow', 'sheep', 'chicken'],
    mix: { tree: 0.13, bush: 0.1, flower: 0.16, tuft: 0.12, rock: 0.03, house: 0.025, fence: 0.03 },
  },
  river: {
    ground: '#9bd673', patch: '#8bcb63', light: '#afe08a', path: '#f3e3b6', edge: '#d8c08e',
    trees: ['bg/tree23', 'bg/tree25', 'bg/tree05', 'bg/tree34'], animals: ['sheep', 'cow', 'chicken'],
    mix: { tree: 0.13, bush: 0.1, flower: 0.12, tuft: 0.14, rock: 0.04, house: 0.025 },
  },
  forest: {
    ground: '#7cc260', patch: '#6db353', light: '#8ecf70', path: '#ead6a4', edge: '#c9ad78',
    trees: ['bg/tree02', 'bg/tree03', 'bg/tree09', 'bg/tree11', 'bg/tree20', 'bg/tree21', 'bg/tree01', 'bg/tree07', 'bg/tree31', 'bg/tree32'], animals: ['pig', 'sheep'],
    mix: { tree: 0.3, bush: 0.07, mushroom: 0.06, tuft: 0.08, rock: 0.04 },
  },
  snow: {
    ground: '#eef6fc', patch: '#dfeaf5', light: '#ffffff', path: '#f6efe0', edge: '#cfd9e6',
    trees: ['bg/tree04', 'bg/tree12', 'bg/tree15', 'bg/tree22', 'bg/tree33', 'bg/tree35'], animals: ['sheep'],
    mix: { tree: 0.18, snowman: 0.012, rock: 0.04, ice: 0.05 },
  },
  beach: {
    ground: '#f5e3ad', patch: '#ecd598', light: '#fbefcb', path: '#fff6dc', edge: '#e2c88c',
    trees: [], animals: [],
    mix: { palm: 0.07, shell: 0.06, rock: 0.03, crab: 0.012, tuft: 0.04 },
  },
  desert: {
    ground: '#f0cf8c', patch: '#e6c078', light: '#f7dca2', path: '#fff0cc', edge: '#d9b676',
    trees: ['bg/tree16', 'bg/tree18', 'bg/tree19'], animals: [],
    mix: { tree: 0.06, rock: 0.05, palm: 0.015, tuft: 0.02 }, landmarks: ['pyramid', 'pyramid', 'temple'],
  },
  jungle: {
    ground: '#62b455', patch: '#52a447', light: '#76c467', path: '#ecdcab', edge: '#c9b07a',
    trees: ['bg/tree23', 'bg/tree25', 'bg/tree05', 'bg/tree34'], animals: ['pig', 'chicken'],
    mix: { tree: 0.14, palm: 0.08, bush: 0.16, plant: 0.03, flower: 0.06 }, river: true, critters: 'frog',
  },
  autumn: {
    ground: '#cfbf68', patch: '#c3b05a', light: '#ddd07e', path: '#f3e3b6', edge: '#d0b47e',
    trees: ['bg/tree01', 'bg/tree07', 'bg/tree29', 'bg/tree05'], animals: ['pig', 'sheep', 'chicken'],
    mix: { tree: 0.15, bush: 0.05, pumpkin: 0.03, tuft: 0.1, house: 0.015, fence: 0.03 },
  },
  mountain: {
    ground: '#93c26c', patch: '#84b55e', light: '#a6cf80', path: '#ead9aa', edge: '#c9b07a',
    trees: ['bg/tree02', 'bg/tree03', 'bg/tree09', 'bg/tree10', 'bg/tree11', 'bg/tree31', 'bg/tree32'], animals: ['sheep', 'cow'],
    mix: { tree: 0.2, rock: 0.1, tuft: 0.06 }, landmarks: ['peak', 'peak'],
  },
  mushroom: {
    ground: '#c7b6e6', patch: '#b8a3dd', light: '#d6c8ee', path: '#f6ecda', edge: '#d3c0a6',
    trees: [], animals: [],
    mix: { bigmushroom: 0.08, mushroom: 0.08, plant: 0.05, flower: 0.08 }, critters: 'snail',
  },
  town: {
    ground: '#a9d97b', patch: '#99cd6b', light: '#bce391', path: '#f3e3b6', edge: '#d8c08e',
    trees: ['bg/tree23', 'bg/tree25', 'bg/tree05'], animals: ['pig', 'chicken'],
    mix: { house: 0.08, tree: 0.08, fence: 0.04, flower: 0.08 }, landmarks: ['tower', 'castle'],
  },
  volcano: {
    ground: '#6f6763', patch: '#615955', light: '#7d7570', path: '#cdb89a', edge: '#a8927a',
    trees: ['bg/tree29'], animals: [],
    mix: { rock: 0.1, tree: 0.04, lava: 0.05 }, landmarks: ['volcano', 'volcano'],
  },
};
const FLOWER = ['#ffffff', '#ffd23f', '#ff8fab', '#b98cff'];
const STEP = 18; // path samples between two spots

export function mapImages(character) {
  const trees = [...new Set(Object.values(THEMES).flatMap(t => t.trees))];
  return [
    ...characterImages(character), ...characterImages('zombie'),
    ...trees, 'bg/house_beige_front', 'bg/house_beige_side', 'bg/house_grey_front', 'bg/fence', 'bg/tower_grey', 'bg/tower_beige',
    'bg/piramid', 'bg/temple', 'tile/plant', 'tile/cactus',
    'bg/castle_grey', 'bg/castle_beige', 'bg/grass1', 'bg/grass2', 'bg/grass4', 'bg/grass6',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `bg/cloud${n}`),
    'tile/bush', 'tile/rock', 'tile/mushroom', 'critter/bee', 'critter/bee_move', 'critter/frog', 'critter/frog_move', 'critter/snail', 'critter/fishBlue',
  ];
}

// Catmull-Rom through the spots, sampled evenly per segment.
function spline(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < STEP; s++) {
      const t = s / STEP, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push({ ...pts.at(-1) });
  return out;
}

export class MapView {
  constructor({ worlds, character, kit, hat = 'none' }) {
    this.character = character;
    this.kit = kit;
    this.hat = hat;
    this.cam = { y: 0, vy: 0, drag: null, idle: 0 };
    this.time = 0;
    this.cups = []; // past check-ups: a small cup beside the level he was on
    this.cupDue = false; // a check-up is due: a gold cup waits beside his player
    this.setWorlds(worlds);
    const at = this.spotIndex(this.hereWorld, hereLevel(this.worlds[this.hereWorld]));
    this.player = { s: at * STEP, walking: false, anim: 0, flip: false };
    this.cam.y = this.pathAt(this.player.s).y - 40;
  }

  // ---- Layout
  // sync: also match the gates and clouds to the worlds (not while a match's walk is still to come).
  setWorlds(worlds, { sync = true } = {}) {
    const first = !this.worlds || this.worlds.length !== worlds.length;
    this.worlds = worlds;
    this.hereWorld = Math.max(0, worlds.findIndex(w => w.state === 'here'));
    if (worlds.every(w => w.state === 'done' || w.state === 'later')) this.hereWorld = worlds.filter(w => w.state === 'done').length - 1;
    // Spots: a start below world 1, each world's levels, then its gate.
    this.spots = [{ x: 0, y: 60 }];
    worlds.forEach((w, i) => {
      for (let k = 0; k < LEVELS_PER_WORLD; k++) this.spots.push(levelSpot(i, k));
      this.spots.push(gateSpot(i));
    });
    this.path = spline(this.spots);
    this.len = [0];
    for (let i = 1; i < this.path.length; i++) this.len.push(this.len[i - 1] + Math.hypot(this.path[i].x - this.path[i - 1].x, this.path[i].y - this.path[i - 1].y));
    if (first) this.deco = worlds.map((w, i) => this.decorate(w, i));
    if (first || sync) {
      this.clouds = worlds.map(w => ({ open: w.state === 'done' || w.state === 'here' ? 1 : 0 }));
      this.gates = worlds.map(w => ({ open: w.state === 'done' ? 1 : 0 }));
    }
  }

  // cups: [{ world, level }] for each check-up he has done.
  setCups(cups, due) {
    this.cups = cups;
    this.cupDue = due;
  }

  // His player on today's level, with the camera on him.
  placeHere() {
    this.player.s = this.spotIndex(this.hereWorld, hereLevel(this.worlds[this.hereWorld])) * STEP;
    this.player.walking = false;
    this.focus();
  }

  focus() {
    this.cam.y = this.pathAt(this.player.s).y - 40;
    this.cam.vy = 0;
    this.cam.idle = 0;
  }

  spotIndex(i, k) {
    return 1 + i * (LEVELS_PER_WORLD + 1) + k; // k = LEVELS_PER_WORLD is the gate
  }

  pathAt(s) {
    const i = clamp(Math.floor(s), 0, this.path.length - 1), j = Math.min(this.path.length - 1, i + 1), f = s - Math.floor(s);
    return { x: lerp(this.path[i].x, this.path[j].x, f), y: lerp(this.path[i].y, this.path[j].y, f) };
  }

  distToPath(x, y, from = 0, to = this.path.length) {
    let d = Infinity;
    for (let i = from; i < to; i++) d = Math.min(d, Math.hypot(this.path[i].x - x, this.path[i].y - y));
    return d;
  }

  // Scenery for one world, placed once from a seed so it never moves between visits.
  decorate(w, i) {
    const th = THEMES[w.theme];
    const top = -(i + 1) * MAP_WORLD, bottom = -i * MAP_WORLD;
    const near = [Math.max(0, (this.spotIndex(i, 0) - 2) * STEP), Math.min(this.path.length, (this.spotIndex(i, LEVELS_PER_WORLD) + 2) * STEP)];
    let seed = i * 7919 + 17;
    const rand = () => hash(seed++);
    const items = [], ground = [], animals = [], critters = [];
    for (let k = 0; k < 16; k++) {
      ground.push({ x: (rand() - 0.5) * 760, y: lerp(top, bottom, rand()), rx: 60 + rand() * 110, ry: 26 + rand() * 46, col: rand() < 0.5 ? th.patch : th.light });
    }
    const kinds = Object.entries(th.mix);
    for (let gy = top + 40; gy < bottom - 20; gy += 42) {
      for (let gx = -340; gx <= 340; gx += 42) {
        const x = gx + (rand() - 0.5) * 30, y = gy + (rand() - 0.5) * 30;
        if (w.theme === 'beach' && x > this.shoreAt(y) - 30) continue;
        if (th.river && [0, 1].some(n => Math.abs(y - this.riverY(i, n)) < 26)) continue;
        const d = this.distToPath(x, y, ...near);
        let r = rand();
        for (const [kind, p] of kinds) {
          if ((r -= p) >= 0) continue;
          const big = ['tree', 'house', 'palm', 'fence', 'snowman', 'bigmushroom'].includes(kind);
          if (d < (big ? 62 : 36) || (kind === 'ice' && d < 50)) break;
          if (kind === 'ice') ground.push({ x, y, rx: 26 + rand() * 30, ry: 10 + rand() * 10, col: '#d6ecfa' });
          else items.push({ kind, x, y, v: rand(), name: kind === 'tree' ? th.trees[Math.floor(rand() * th.trees.length)] : null });
          break;
        }
      }
    }
    // Friends: a few blocky animals wandering in the open, and critters.
    let tries = 0;
    while (animals.length < (th.animals.length ? 4 : 0) && tries++ < 200) {
      const x = (rand() - 0.5) * 560, y = lerp(top + 120, bottom - 80, rand());
      if (this.distToPath(x, y, ...near) < 70 || items.some(o => Math.hypot(o.x - x, o.y - y) < 34)) continue;
      animals.push({ kind: th.animals[animals.length % th.animals.length], home: x, x, y, dir: rand() < 0.5 ? -1 : 1, pause: rand() * 3, walk: 0 });
    }
    if (w.theme === 'meadow') for (let k = 0; k < 3; k++) critters.push({ kind: 'bee', x: (rand() - 0.5) * 500, y: lerp(top + 100, bottom - 100, rand()), ph: rand() * TAU });
    if (w.theme === 'river') for (let k = 0; k < 3; k++) critters.push({ kind: 'frog', x: (rand() - 0.5) * 520, y: this.riverY(i, k % 2) + (rand() - 0.5) * 40, ph: rand() * TAU });
    if (w.theme === 'forest') {
      for (let k = 0; k < 2; k++) critters.push({ kind: 'snail', x: (rand() - 0.5) * 520, y: lerp(top + 100, bottom - 100, rand()), ph: rand() * TAU });
      const spot = { x: -210, y: lerp(top, bottom, 0.45) };
      items.push({ kind: 'cave', x: spot.x, y: spot.y });
      items.push({ kind: 'zombie', x: spot.x + 46, y: spot.y + 6 });
    }
    if (w.theme === 'meadow') items.push({ kind: 'stadium', x: 205, y: lerp(top, bottom, 0.62) });
    if (th.critters === 'frog') for (let k = 0; k < 3; k++) critters.push({ kind: 'frog', x: (rand() - 0.5) * 520, y: this.riverY(i, k % 2) + (rand() - 0.5) * 40, ph: rand() * TAU });
    if (th.critters === 'snail') for (let k = 0; k < 3; k++) critters.push({ kind: 'snail', x: (rand() - 0.5) * 520, y: lerp(top + 100, bottom - 100, rand()), ph: rand() * TAU });
    // A landmark or two, off the path: pyramids, peaks, a tower, the volcano.
    (th.landmarks ?? []).forEach((kind, k) => {
      for (let n = 0; n < 60; n++) {
        // close enough to show on a phone, clear of the path
        const x = (k % 2 ? 1 : -1) * (120 + rand() * 80), y = lerp(top + 140, bottom - 140, (k + 0.5 + (rand() - 0.5) * 0.8) / th.landmarks.length);
        if (this.distToPath(x, y, ...near) < 78) continue;
        items.push({ kind, x, y, v: rand() });
        break;
      }
    });
    return { items, ground, animals, critters };
  }

  shoreAt(y) {
    return 168 + 34 * Math.sin(y / 130) + 16 * Math.sin(y / 47);
  }

  riverY(i, n) {
    return -i * MAP_WORLD - (n === 0 ? 300 : 690);
  }

  // ---- Camera
  resize() {
    const { W, H, DPR } = this.scene;
    this.zoom = clamp(Math.min(W / 400, H / 560), 0.88, 1.7); // by width on a phone, by height in landscape
    this.u = this.zoom * DPR;
  }

  X(x) {
    return this.scene.Wd / 2 + x * this.u;
  }

  Y(y) {
    return this.scene.Hd * 0.57 + (y - this.cam.y) * this.u;
  }

  // Where his player stands, in page pixels (the circle wipe closes on it).
  playerPoint() {
    const p = this.pathAt(this.player.s);
    return { x: this.X(p.x) / this.scene.DPR, y: (this.Y(p.y) - 34 * this.u) / this.scene.DPR };
  }

  limits() {
    const lowest = this.spots[0].y + 220;
    const locked = this.worlds.findIndex(w => w.state === 'ahead' || w.state === 'later');
    const highest = locked >= 0 ? gateSpot(locked - 1 >= 0 ? locked - 1 : 0).y - 520 : -this.worlds.length * MAP_WORLD;
    return [highest, lowest];
  }

  pointer(type, e) {
    const c = this.cam;
    if (type === 'down') {
      c.drag = { y: e.clientY, cam: c.y, t: performance.now(), last: e.clientY };
      c.vy = 0;
    } else if (type === 'move' && c.drag) {
      const dy = e.clientY - c.drag.last;
      c.drag.last = e.clientY;
      c.y -= (dy * this.scene.DPR) / this.u;
      c.vy = (-dy * this.scene.DPR) / this.u / 0.016;
      c.idle = 0;
    } else if (type === 'up' && c.drag) {
      c.drag = null;
    }
  }

  // ---- Motion
  // Walks his player along the path to a spot, the camera following.
  async walkTo(i, k) {
    const target = this.spotIndex(i, k) * STEP;
    const p = this.player;
    if (Math.abs(target - p.s) < 0.5) return;
    p.walking = true;
    const from = p.s;
    const dist = Math.abs(this.len[Math.round(target)] - this.len[Math.round(from)]);
    await this.scene.tween(clamp(dist / 140, 0.6, 4), t => { p.s = lerp(from, target, t); }, easeInOut);
    p.walking = false;
  }

  // The gate at the end of world i opens, the clouds over the next world part, and he walks in.
  async openGate(i) {
    await this.walkTo(i, LEVELS_PER_WORLD);
    const gate = this.gates[i], cloud = this.clouds[i + 1];
    this.burst = { x: gateSpot(i).x, y: gateSpot(i).y - 40, t: this.time };
    await this.scene.tween(0.8, t => { gate.open = t; });
    if (cloud) await this.scene.tween(1.6, t => { cloud.open = t; });
    if (this.worlds[i + 1]) await this.walkTo(i + 1, 0);
  }

  update(dt) {
    this.time += dt;
    const p = this.player;
    if (p.walking) {
      p.anim += dt * 9;
      const a = this.pathAt(p.s), b = this.pathAt(p.s + 1);
      if (Math.abs(b.x - a.x) > 0.05) p.flip = b.x < a.x;
    }
    // The camera follows him, unless someone is dragging the map (it drifts back after a while).
    const c = this.cam;
    const [hi, lo] = this.limits();
    if (!c.drag) {
      c.idle += dt;
      if (Math.abs(c.vy) > 1) {
        c.y += c.vy * dt;
        c.vy *= Math.exp(-dt * 4);
      }
      if (p.walking || c.idle > 4) c.y += (this.pathAt(p.s).y - 40 - c.y) * (1 - Math.exp(-dt * 3));
    }
    if (!this.free) c.y = clamp(c.y, hi, lo);
    for (const d of this.deco) {
      for (const a of d.animals) {
        if (a.pause > 0) {
          a.pause -= dt;
          a.walk = 0;
          continue;
        }
        a.x += a.dir * dt * 16;
        a.walk += dt * 10;
        if (Math.abs(a.x - a.home) > 34 || Math.random() < dt * 0.15) {
          a.dir = Math.abs(a.x - a.home) > 34 ? -Math.sign(a.x - a.home) : -a.dir;
          a.pause = 1 + Math.random() * 3;
        }
      }
    }
  }

  // ---- Drawing
  draw(c) {
    const { Wd, Hd } = this.scene;
    const u = this.u;
    const top = this.cam.y - (Hd * 0.57) / u - 120, bottom = this.cam.y + (Hd * 0.43) / u + 120;
    const visible = this.worlds.map((w, i) => -i * MAP_WORLD + 200 > top && -(i + 1) * MAP_WORLD - 200 < bottom);
    // Ground: each world's color, blended across the boundaries.
    c.fillStyle = THEMES[this.worlds[0].theme].ground;
    c.fillRect(0, 0, Wd, Hd);
    this.worlds.forEach((w, i) => {
      if (!visible[i]) return;
      const th = THEMES[w.theme];
      const y0 = this.Y(-i * MAP_WORLD), y1 = this.Y(-(i + 1) * MAP_WORLD);
      c.fillStyle = th.ground;
      c.fillRect(0, y1, Wd, y0 - y1 + 1);
      if (i > 0) {
        const g = c.createLinearGradient(0, y0 + 70 * u, 0, y0 - 70 * u);
        g.addColorStop(0, THEMES[this.worlds[i - 1].theme].ground);
        g.addColorStop(1, th.ground);
        c.fillStyle = g;
        c.fillRect(0, y0 - 70 * u, Wd, 140 * u);
      }
      for (const p of this.deco[i].ground) {
        c.fillStyle = p.col;
        c.beginPath();
        c.ellipse(this.X(p.x), this.Y(p.y), p.rx * u, p.ry * u, 0, 0, TAU);
        c.fill();
      }
      if (w.theme === 'river' || th.river) for (const n of [0, 1]) this.drawRiver(c, i, n);
      if (w.theme === 'volcano') for (const p of this.deco[i].items) if (p.kind === 'lava') drawLava(c, this.X(p.x), this.Y(p.y), (16 + p.v * 14) * u, (7 + p.v * 5) * u, this.time + p.v * 6);
      if (w.theme === 'beach') this.drawSea(c, i);
    });
    this.drawPath(c);
    this.drawLevels(c, visible);
    // Everything that stands up, drawn from the top of the screen down so nearer things overlap.
    const things = [];
    this.worlds.forEach((w, i) => {
      if (!visible[i]) return;
      const d = this.deco[i];
      for (const o of d.items) if (o.y > top && o.y < bottom) things.push({ y: o.y, draw: () => this.drawItem(c, o, w) });
      for (const a of d.animals) if (a.y > top && a.y < bottom) things.push({ y: a.y, draw: () => drawAnimal(c, a.kind, this.X(a.x), this.Y(a.y), u * 0.62, Math.sin(a.walk) * 2.4, 0, a.dir < 0) });
      for (const k of d.critters) things.push({ y: k.y, draw: () => this.drawCritter(c, k) });
      const g = gateSpot(i);
      things.push({ y: g.y + 4, draw: () => this.drawGate(c, w, i) });
    });
    for (const cup of this.cups) {
      if (!visible[cup.world]) continue;
      const s = levelSpot(cup.world, Math.min(cup.level, LEVELS_PER_WORLD - 1));
      things.push({ y: s.y - 1, draw: () => this.drawCup(c, s.x - 27, s.y - 1, 0.2) });
    }
    const p = this.pathAt(this.player.s);
    things.push({ y: p.y + 2, draw: () => this.drawPlayer(c, p) });
    if (this.cupDue && !this.player.walking) things.push({ y: p.y + 3, draw: () => this.drawCup(c, p.x + 30, p.y + 3, 0.3, true) });
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();
    this.drawBurst(c);
    this.worlds.forEach((w, i) => {
      if (visible[i] && this.clouds[i].open < 1) this.drawClouds(c, w, i);
    });
    this.worlds.forEach((w, i) => {
      if (visible[i] && w.theme === 'snow' && this.clouds[i].open > 0.5) this.drawSnow(c, i);
    });
    this.worlds.forEach((w, i) => {
      if (visible[i] && this.clouds[i].open > 0.5) this.drawBadge(c, w, i);
    });
  }

  drawRiver(c, i, n) {
    const u = this.u, y = this.riverY(i, n);
    const line = () => {
      c.beginPath();
      for (let x = -420; x <= 420; x += 12) {
        const yy = y + 34 * Math.sin(x / 90 + n * 2 + i) + 12 * Math.sin(x / 37);
        if (x === -420) c.moveTo(this.X(x), this.Y(yy));
        else c.lineTo(this.X(x), this.Y(yy));
      }
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [w, col] of [[64, '#7fcf7a'], [52, '#45ade0'], [40, '#5cc3ea'], [14, '#a7e3f8']]) {
      line();
      c.strokeStyle = col;
      c.lineWidth = w * u;
      c.stroke();
    }
    // a little wooden bridge where the path crosses
    let best = null;
    const from = (this.spotIndex(i, 0) - 1) * STEP, to = (this.spotIndex(i, LEVELS_PER_WORLD) + 1) * STEP;
    for (let s = from; s < to && s < this.path.length - 1; s++) {
      const q = this.path[s];
      const ry = y + 34 * Math.sin(q.x / 90 + n * 2 + i) + 12 * Math.sin(q.x / 37);
      const d = Math.abs(q.y - ry);
      if (!best || d < best.d) best = { d, s };
    }
    if (best) {
      const a = this.path[best.s], b = this.path[best.s + 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      c.save();
      c.translate(this.X(a.x), this.Y(a.y));
      c.rotate(ang);
      c.fillStyle = '#8a5a34';
      c.fillRect(-40 * u, -21 * u, 80 * u, 42 * u);
      c.fillStyle = '#b07a46';
      for (let k = -36; k < 36; k += 9) c.fillRect(k * u, -19 * u, 7 * u, 38 * u);
      c.fillStyle = '#6e4626';
      c.fillRect(-40 * u, -24 * u, 80 * u, 4 * u);
      c.fillRect(-40 * u, 20 * u, 80 * u, 4 * u);
      c.restore();
    }
  }

  drawSea(c, i) {
    const u = this.u, top = -(i + 1) * MAP_WORLD - 40, bottom = -i * MAP_WORLD + 40;
    const edge = (off, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(this.scene.Wd, this.Y(top));
      for (let y = top; y <= bottom; y += 14) c.lineTo(this.X(this.shoreAt(y) + off), this.Y(y));
      c.lineTo(this.scene.Wd, this.Y(bottom));
      c.closePath();
      c.fill();
    };
    edge(-8, '#fff7dd');
    edge(4, '#7fd3ef');
    edge(26, '#56bde3');
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 2.5 * u;
    c.lineCap = 'round';
    for (let k = 0; k < 14; k++) {
      const y = lerp(top, bottom, (k + 0.5) / 14), x = this.shoreAt(y) + 60 + (k % 3) * 46 + Math.sin(this.time * 0.8 + k) * 8;
      c.beginPath();
      c.arc(this.X(x), this.Y(y), 9 * u, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
  }

  drawPath(c) {
    const u = this.u;
    const trace = (from, to) => {
      c.beginPath();
      for (let s = from; s <= to; s++) {
        const q = this.path[s];
        if (s === from) c.moveTo(this.X(q.x), this.Y(q.y));
        else c.lineTo(this.X(q.x), this.Y(q.y));
      }
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const end = this.path.length - 1;
    // The path fades out under the clouds: draw it only through the open worlds.
    const lastOpen = this.clouds.reduce((n, cl, i) => (cl.open > 0 ? i : n), 0);
    const stop = Math.min(end, (this.spotIndex(lastOpen, LEVELS_PER_WORLD) + 1) * STEP);
    this.worlds.forEach((w, i) => {
      if (i > lastOpen) return;
      const th = THEMES[w.theme];
      const a = i === 0 ? 0 : this.spotIndex(i, -1) * STEP, b = Math.min(stop, (this.spotIndex(i, LEVELS_PER_WORLD)) * STEP);
      trace(a, b);
      c.strokeStyle = th.edge;
      c.lineWidth = 36 * u;
      c.stroke();
      trace(a, b);
      c.strokeStyle = th.path;
      c.lineWidth = 28 * u;
      c.stroke();
    });
    // The part he has walked: a warmer trail, so the progress shows.
    const walked = Math.round(this.player.s);
    if (walked > 0) {
      trace(0, Math.min(walked, end));
      c.strokeStyle = 'rgba(214, 160, 70, 0.4)';
      c.lineWidth = 7 * u;
      c.setLineDash([1 * u, 12 * u]);
      c.stroke();
      c.setLineDash([]);
    }
  }

  drawLevels(c, visible) {
    const u = this.u;
    this.worlds.forEach((w, i) => {
      if (!visible[i] || this.clouds[i].open <= 0) return;
      const done = flagged(w);
      const here = w.state === 'here' ? hereLevel(w) : -1;
      const ahead = w.state === 'here' ? Math.min(LEVELS_PER_WORLD - 1, here + 3) : -1;
      for (let k = 0; k < LEVELS_PER_WORLD; k++) {
        const isDone = k < done && (w.state !== 'here' || k !== here || w.played > here);
        const isHere = k === here;
        if (!isDone && !isHere && !(w.state === 'here' && k <= ahead)) continue;
        const s = levelSpot(i, k), x = this.X(s.x), y = this.Y(s.y);
        c.globalAlpha = isDone || isHere ? 1 : 0.6;
        c.fillStyle = '#b9a98a';
        c.beginPath();
        c.ellipse(x, y + 3 * u, 21 * u, 11 * u, 0, 0, TAU);
        c.fill();
        c.fillStyle = isHere ? '#fff4c9' : '#efe7d2';
        c.beginPath();
        c.ellipse(x, y, 21 * u, 11 * u, 0, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
        if (isHere) {
          const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
          c.strokeStyle = `rgba(255, 196, 40, ${0.55 + pulse * 0.4})`;
          c.lineWidth = (3 + pulse * 2) * u;
          c.beginPath();
          c.ellipse(x, y, (25 + pulse * 4) * u, (14 + pulse * 2) * u, 0, 0, TAU);
          c.stroke();
        }
        if (isDone && !isHere) this.drawFlag(c, x + 6 * u, y, k);
      }
    });
  }

  drawFlag(c, x, y, k) {
    const u = this.u, wave = Math.sin(this.time * 4 + k) * 2.5 * u;
    c.fillStyle = '#7b5a3c';
    c.fillRect(x - 1.5 * u, y - 34 * u, 3 * u, 34 * u);
    c.fillStyle = this.kit;
    c.beginPath();
    c.moveTo(x + 1.5 * u, y - 34 * u);
    c.quadraticCurveTo(x + 10 * u, y - 31 * u + wave, x + 18 * u, y - 28 * u + wave);
    c.lineTo(x + 1.5 * u, y - 21 * u);
    c.closePath();
    c.fill();
  }

  drawItem(c, o, w) {
    const u = this.u, x = this.X(o.x), y = this.Y(o.y);
    const pic = (name, k) => {
      const [iw, ih] = size(name);
      if (iw) img(c, name, x - (iw * k * u) / 2, y - ih * k * u, iw * k * u, ih * k * u);
    };
    switch (o.kind) {
      case 'tree': pic(o.name, 0.28 + o.v * 0.12); break;
      case 'house': pic(o.v < 0.5 ? 'bg/house_beige_front' : w.theme === 'river' ? 'bg/house_grey_front' : 'bg/house_beige_side', 0.36); break;
      case 'fence': pic('bg/fence', 0.3); break;
      case 'bush': pic('tile/bush', 0.36 + o.v * 0.1); break;
      case 'rock': pic('tile/rock', 0.32 + o.v * 0.1); break;
      case 'mushroom': pic('tile/mushroom', 0.32); break;
      case 'tuft': pic(['bg/grass1', 'bg/grass2', 'bg/grass4', 'bg/grass6'][Math.floor(o.v * 4)], 0.5); break;
      case 'flower': {
        const col = FLOWER[Math.floor(o.v * FLOWER.length)];
        for (const [dx, dy] of [[0, 0], [7, 3], [-6, 4]]) {
          c.fillStyle = col;
          for (let k = 0; k < 4; k++) {
            c.beginPath();
            c.arc(x + (dx + Math.cos(k * 1.57) * 2.4) * u, y + (dy - 3 + Math.sin(k * 1.57) * 2.4) * u, 2.2 * u, 0, TAU);
            c.fill();
          }
          c.fillStyle = '#ffb703';
          c.beginPath();
          c.arc(x + dx * u, y + (dy - 3) * u, 1.6 * u, 0, TAU);
          c.fill();
        }
        break;
      }
      case 'palm': drawPalm(c, x, y, u * 0.5, this.time + o.v * 5); break;
      case 'bigmushroom': drawBigMushroom(c, x, y, u * (0.42 + o.v * 0.18), [330, 280, 20, 200][Math.floor(o.v * 4)]); break;
      case 'plant': pic('tile/plant', 0.34); break;
      case 'pumpkin': drawPumpkin(c, x, y, u * 0.55); break;
      case 'lava': break; // drawn flat on the ground with the world
      case 'pyramid': pic('bg/piramid', 0.42 + o.v * 0.12); break;
      case 'temple': pic('bg/temple', 0.4); break;
      case 'tower': pic('bg/tower_beige', 0.42); break;
      case 'castle': pic('bg/castle_beige', 0.4); break;
      case 'volcano': drawVolcano(c, x, y, u * 0.42, this.time); break;
      case 'peak': {
        // a snowy mountain top
        c.fillStyle = '#8b97a8';
        c.beginPath();
        c.moveTo(x - 70 * u, y); c.lineTo(x, y - 90 * u); c.lineTo(x + 70 * u, y);
        c.fill();
        c.fillStyle = '#76828f';
        c.beginPath();
        c.moveTo(x, y - 90 * u); c.lineTo(x + 70 * u, y); c.lineTo(x + 12 * u, y);
        c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(x - 24 * u, y - 59 * u); c.lineTo(x, y - 90 * u); c.lineTo(x + 24 * u, y - 59 * u);
        c.lineTo(x + 10 * u, y - 64 * u); c.lineTo(x, y - 56 * u); c.lineTo(x - 10 * u, y - 64 * u);
        c.fill();
        break;
      }
      case 'snowman': drawSnowman(c, x, y, u * 0.62); break;
      case 'crab': drawCrab(c, x + Math.sin(this.time * 0.7 + o.v * 9) * 14 * u, y, u * 0.6, this.time); break;
      case 'shell': {
        c.fillStyle = o.v < 0.5 ? '#ffd1dc' : '#ffe8c2';
        c.beginPath();
        c.arc(x, y, 5 * u, Math.PI, 0);
        c.fill();
        break;
      }
      case 'stadium': this.drawStadium(c, x, y); break;
      case 'cave': {
        c.fillStyle = '#8a8f9c';
        c.beginPath();
        c.ellipse(x, y - 18 * u, 44 * u, 34 * u, 0, Math.PI, 0);
        c.lineTo(x + 44 * u, y);
        c.lineTo(x - 44 * u, y);
        c.fill();
        c.fillStyle = '#6f7482';
        c.beginPath();
        c.ellipse(x + 14 * u, y - 18 * u, 30 * u, 30 * u, 0, Math.PI * 1.5, 0);
        c.lineTo(x + 44 * u, y);
        c.lineTo(x + 14 * u, y);
        c.fill();
        c.fillStyle = '#2b2d3a';
        c.beginPath();
        c.ellipse(x, y, 17 * u, 22 * u, 0, Math.PI, 0);
        c.fill();
        break;
      }
      case 'zombie': {
        const pose = Math.floor(this.time * 2.2) % 6 < 2 ? (Math.floor(this.time * 5) % 2 ? 'cheer0' : 'cheer1') : 'idle';
        this.shadow(c, x, y, 14);
        drawCharacter(c, 'zombie', pose, null, x, y, 0.24 * u);
        break;
      }
    }
  }

  drawStadium(c, x, y) {
    const u = this.u, w = 120 * u, h = 64 * u;
    c.fillStyle = '#5eb848';
    c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = '#6fc457';
    for (let k = 0; k < 6; k += 2) c.fillRect(x - w / 2 + (k * w) / 6, y - h, w / 6, h);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2 * u;
    c.strokeRect(x - w / 2 + 5 * u, y - h + 5 * u, w - 10 * u, h - 10 * u);
    c.beginPath();
    c.moveTo(x, y - h + 5 * u);
    c.lineTo(x, y - 5 * u);
    c.stroke();
    c.beginPath();
    c.arc(x, y - h / 2, 9 * u, 0, TAU);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.fillRect(x - w / 2 - 3 * u, y - h / 2 - 9 * u, 4 * u, 18 * u);
    c.fillRect(x + w / 2 - 1 * u, y - h / 2 - 9 * u, 4 * u, 18 * u);
  }

  drawCritter(c, k) {
    const u = this.u, t = this.time + k.ph;
    if (k.kind === 'bee') {
      const x = k.x + Math.cos(t * 0.9) * 40, y = k.y + Math.sin(t * 1.7) * 18 - 30;
      img(c, Math.floor(t * 12) % 2 ? 'critter/bee' : 'critter/bee_move', this.X(x) - 12 * u, this.Y(y) - 12 * u, 24 * u, 24 * u);
    } else if (k.kind === 'frog') {
      const hop = Math.max(0, Math.sin(t * 1.4)) ** 3;
      const x = k.x + Math.sin(t * 0.35) * 30;
      this.shadow(c, this.X(x), this.Y(k.y), 9);
      img(c, hop > 0.2 ? 'critter/frog_move' : 'critter/frog', this.X(x) - 14 * u, this.Y(k.y - hop * 16) - 26 * u, 28 * u, 28 * u);
    } else if (k.kind === 'snail') {
      const x = k.x + ((t * 3) % 80) - 40;
      img(c, 'critter/snail', this.X(x) - 13 * u, this.Y(k.y) - 22 * u, 26 * u, 26 * u);
    }
  }

  shadow(c, x, y, r) {
    c.fillStyle = 'rgba(30, 50, 40, 0.18)';
    c.beginPath();
    c.ellipse(x, y, r * this.u, r * 0.38 * this.u, 0, 0, TAU);
    c.fill();
  }

  drawGate(c, w, i) {
    const u = this.u, g = gateSpot(i), x = this.X(g.x), y = this.Y(g.y);
    const open = this.gates[i].open;
    if (w.gate === 'castle') {
      const name = w.level % 2 ? 'bg/castle_beige' : 'bg/castle_grey';
      const [iw, ih] = size(name);
      if (!iw) return;
      const k = 0.62 * u;
      img(c, name, x - (iw * k) / 2, y - ih * k + 8 * u, iw * k, ih * k);
      this.drawDoor(c, x, y + 2 * u, 22 * u, 34 * u, open);
      if (w.check && open < 1) this.drawBadge(c, w, i, { x, y: y - ih * k - 6 * u, icon: 'grownup' });
    } else {
      const k = 0.5 * u, [tw, th] = size('bg/tower_grey');
      if (tw) {
        img(c, 'bg/tower_grey', x - 58 * u - (tw * k) / 2, y - th * k + 6 * u, tw * k, th * k);
        img(c, 'bg/tower_grey', x + 58 * u - (tw * k) / 2, y - th * k + 6 * u, tw * k, th * k);
      }
      c.fillStyle = '#a3abb8';
      c.fillRect(x - 52 * u, y - 70 * u, 104 * u, 16 * u);
      c.fillStyle = '#8b93a1';
      c.fillRect(x - 52 * u, y - 58 * u, 104 * u, 4 * u);
      this.drawDoor(c, x, y + 2 * u, 34 * u, 54 * u, open, true);
    }
    // When the queen is ready she waits by the gate.
    if (w.queen && open < 1) {
      const bob = Math.sin(this.time * 3) * 2 * u;
      drawPiece(c, 'queen', x + 44 * u, y + 10 * u + bob, u * 0.3, kitPiece(this.kit));
    }
  }

  // A doorway: bars that lift as it opens.
  drawDoor(c, x, y, w, h, open, arch = false) {
    c.fillStyle = '#2d3240';
    c.beginPath();
    c.moveTo(x - w, y);
    c.lineTo(x - w, y - h + w * (arch ? 1 : 0.6));
    c.arc(x, y - h + w * (arch ? 1 : 0.6), w, Math.PI, 0);
    c.lineTo(x + w, y);
    c.closePath();
    c.fill();
    if (open < 1) {
      c.save();
      c.clip();
      c.fillStyle = '#9aa3b5';
      const lift = open * h;
      for (let k = -w; k <= w; k += w / 3) c.fillRect(x + k - 2 * this.u, y - h - lift, 4 * this.u, h);
      c.fillRect(x - w, y - h * 0.55 - lift, 2 * w, 4 * this.u);
      c.restore();
    }
  }

  drawPlayer(c, p) {
    const u = this.u, x = this.X(p.x), y = this.Y(p.y);
    const pl = this.player;
    const pose = pl.walking ? `walk${Math.floor(pl.anim) % 8}` : 'idle';
    const bob = pl.walking ? 0 : Math.sin(this.time * 2.5) * 0.6 * u;
    this.shadow(c, x, y + 2 * u, 16);
    drawWithHat(c, this.character, pose, this.kit, x, y + 2 * u + bob, 0.3 * u, pl.flip, this.hat, this.time);
  }

  // A cup on the map: small for a check-up done, larger and glowing for one that is due.
  drawCup(c, mx, my, k, due = false) {
    const u = this.u, x = this.X(mx), y = this.Y(my);
    this.shadow(c, x, y + 1 * u, due ? 12 : 8);
    if (due) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
      const r = (30 + pulse * 8) * u;
      const g = c.createRadialGradient(x, y - 22 * u, 2 * u, x, y - 22 * u, r);
      g.addColorStop(0, 'rgba(255, 226, 120, 0.85)');
      g.addColorStop(1, 'rgba(255, 226, 120, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y - 22 * u, r, 0, TAU);
      c.fill();
    }
    const bob = due ? Math.sin(this.time * 3) * 2.5 * u : 0;
    drawTrophy(c, x, y + bob, k * u, this.time);
  }

  drawBurst(c) {
    if (!this.burst) return;
    const age = this.time - this.burst.t;
    if (age > 1.6) return;
    const u = this.u;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU, r = (30 + age * 140) * u;
      c.globalAlpha = Math.max(0, 1 - age / 1.6);
      c.fillStyle = ['#ffd23f', '#ff8fab', '#3d8bff', '#22c55e', this.kit][k % 5];
      c.fillRect(this.X(this.burst.x) + Math.cos(a) * r, this.Y(this.burst.y) + Math.sin(a) * r * 0.7 + age * age * 60 * u, 6 * u, 9 * u);
    }
    c.globalAlpha = 1;
  }

  drawClouds(c, w, i) {
    const u = this.u, open = this.clouds[i].open;
    const top = -(i + 1) * MAP_WORLD - 60, bottom = -i * MAP_WORLD - 40;
    const fade = 1 - open;
    c.save();
    c.globalAlpha = fade;
    const g = c.createLinearGradient(0, this.Y(bottom), 0, this.Y(top));
    g.addColorStop(0, 'rgba(240,248,255,0.85)');
    g.addColorStop(0.15, '#f2f8ff');
    g.addColorStop(1, '#e8f3fc');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, this.Y(top));
    c.lineTo(this.scene.Wd, this.Y(top));
    for (let x = 420; x >= -420; x -= 40) c.lineTo(this.X(x), this.Y(bottom + 18 * Math.sin(x / 31 + i)));
    c.lineTo(0, this.Y(bottom));
    c.closePath();
    c.fill();
    c.restore();
    for (let k = 0; k < 18; k++) {
      const side = hash(i * 31 + k) < 0.5 ? -1 : 1;
      const x0 = (hash(i * 31 + k + 7) - 0.5) * 760, y0 = lerp(top + 40, bottom - 20, hash(i * 31 + k + 3));
      const x = x0 + Math.sin(this.time * 0.15 + k) * 14 + side * open * 420;
      const name = `bg/cloud${1 + (k % 9)}`, [iw, ih] = size(name);
      if (!iw) continue;
      const kk = (0.75 + hash(k + i) * 0.5) * u;
      c.globalAlpha = fade;
      img(c, name, this.X(x) - (iw * kk) / 2, this.Y(y0) - (ih * kk) / 2, iw * kk, ih * kk);
    }
    c.globalAlpha = 1;
    if (fade > 0.3) {
      c.globalAlpha = fade;
      this.drawBadge(c, w, i, { x: this.X(0), y: this.Y(lerp(top, bottom, 0.55)), icon: w.state === 'later' ? 'lock' : null, big: true });
      c.globalAlpha = 1;
    }
  }

  // The world's number on a round sign: at its entrance, or on the clouds while it waits.
  drawBadge(c, w, i, at = null) {
    const u = this.u;
    let x, y;
    if (at) ({ x, y } = at);
    else {
      const s = levelSpot(i, 0);
      x = this.X(s.x + (s.x > 0 ? -52 : 52));
      y = this.Y(s.y + 30);
    }
    const r = (at?.big ? 30 : 17) * u;
    if (at?.icon === 'grownup') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(x, y, 17 * u, 0, TAU);
      c.fill();
      c.strokeStyle = '#ffd23f';
      c.lineWidth = 3 * u;
      c.stroke();
      c.fillStyle = '#1f2a37';
      c.beginPath();
      c.arc(x - 5 * u, y - 5 * u, 4 * u, 0, TAU);
      c.arc(x + 6 * u, y - 2 * u, 3 * u, 0, TAU);
      c.fill();
      c.fillRect(x - 9 * u, y, 8 * u, 9 * u);
      c.fillRect(x + 3 * u, y + 2 * u, 6 * u, 7 * u);
      return;
    }
    if (!at) {
      c.fillStyle = '#7b5a3c';
      c.fillRect(x - 2 * u, y, 4 * u, 18 * u);
    }
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    c.strokeStyle = shade(THEMES[w.theme].ground, -0.25);
    c.lineWidth = (at?.big ? 5 : 3) * u;
    c.stroke();
    c.fillStyle = '#1f2a37';
    c.font = `700 ${r * 1.15}px "Fredoka", ui-rounded, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(w.number), x, y + r * 0.06);
    if (at?.icon === 'lock') {
      const lx = x + r * 0.85, ly = y + r * 0.7;
      c.fillStyle = '#f2c230';
      c.fillRect(lx - 9 * u, ly - 4 * u, 18 * u, 14 * u);
      c.strokeStyle = '#9aa3b5';
      c.lineWidth = 3 * u;
      c.beginPath();
      c.arc(lx, ly - 4 * u, 6 * u, Math.PI, 0);
      c.stroke();
    }
  }

  drawSnow(c, i) {
    const u = this.u, top = -(i + 1) * MAP_WORLD, bottom = -i * MAP_WORLD;
    c.fillStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 60; k++) {
      const x = ((hash(k + i * 99) * 800 + Math.sin(this.time + k) * 20) % 800) - 400;
      const y = top + ((hash(k * 7 + i) * MAP_WORLD + this.time * (20 + (k % 5) * 6)) % MAP_WORLD);
      if (y > bottom) continue;
      c.beginPath();
      c.arc(this.X(x), this.Y(y), (1.4 + (k % 3)) * u, 0, TAU);
      c.fill();
    }
  }
}
