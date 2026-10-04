// The day's run: one continuous side-scrolling world through the eight stops, in Kenney's flat art.
// His player runs from stop to stop. At an activity stop the camera frames him and that stop's goal
// above the question card: each pass dribbles the ball one step closer, the third in a row shoots,
// and a miss sends the ball back to the start mark (SPEC.md, "The match"). The sky goes from morning
// to night across the day, and the world he is in sets the ground, trees, weather, and friends.
import {
  IMG, img, size, tinted, drawCharacter, characterImages, drawBall, goalBack, goalFront, GOAL, GOAL_STYLES,
  drawPiece, PIECE_COLORS, kitPiece, drawCrystals, drawAnimal, drawBat, drawCrab, drawSnowman, drawPalm, drawTrophy, TAU, shade,
} from './art.js';
import { clamp, lerp, smooth, easeBack, hash } from './scene.js';

const T = 64;
const STEP = 52, KICK = 112, RUN = 540, GRAV = 2600;
export const START_X = 150;

// ---- The day's layout: segments in order. A segment is a stretch of world with one look; the
// stops sit inside them at fixed places, so the routine never changes.
const SEGMENTS = [
  ['stadium', 3050], ['lane', 650], ['castle', 2250], ['rocky', 600], ['cave', 1800], ['dusk', 400], ['show', 1500],
  ['village', 500], ['workshop', 1700], ['cliff', 300], ['islands', 2400], ['landing', 300], ['night', 1900], ['trophy', 1700],
];
const SEG = [];
{
  let x = -800;
  for (const [key, len] of SEGMENTS) {
    SEG.push({ key, x0: x, x1: x + len });
    x += len;
  }
}
const seg = key => SEG.find(s => s.key === key);
const MOUTH_X = seg('cave').x0, CAVE_END = seg('cave').x1;
const ISLAND_START = seg('islands').x0, ISLAND_END = seg('islands').x1;
// Where each of the eight stops is: a goal for the activities, the stage, and the podium.
export const ANCHORS = [1380, 3980, 6800, 8700, 10900, 13300, 15700, 17350];
const STOP_SEG = ['stadium', 'castle', 'cave', 'show', 'workshop', 'islands', 'night', 'trophy'];
const GOAL_STYLE = ['white', 'stone', 'wood', null, 'wood', 'white', 'white', null];
// Floating islands in the sky; bridges between them.
const ISLANDS = [[ISLAND_START + 250, ISLAND_START + 600], [ANCHORS[5] - 350, ANCHORS[5] + 300], [ISLAND_END - 500, ISLAND_END - 250]];

const SKY = {
  stadium: ['#3fa9ee', '#c8edff'], lane: ['#4ab3ef', '#d6f3ff'], castle: ['#7b82e0', '#ffd0d6'], rocky: ['#5aa3e8', '#ffe0c0'],
  cave: ['#5aa3e8', '#ffe0c0'], dusk: ['#ef8a62', '#ffd9a3'], show: ['#d9708f', '#ffc993'], village: ['#9a6fcf', '#ffb38c'],
  workshop: ['#7a5fc4', '#ffa58d'], cliff: ['#5b5fc0', '#f39ab8'], islands: ['#4655b8', '#e99ac7'], landing: ['#2f3d8c', '#b88ac8'],
  night: ['#101a3d', '#2a3a76'], trophy: ['#0e1636', '#283670'],
};
const NIGHT = { islands: 0.35, landing: 0.6, night: 1, trophy: 1, workshop: 0.15, cliff: 0.25 };
const HILLS = {
  meadow: ['#8bcf69', '#a9dd8a'], river: ['#86cc6a', '#a2d98a'], forest: ['#5fae58', '#7fc06b'], snow: ['#dbe9f6', '#eef5fb'], beach: ['#e8cf8f', '#f3e0aa'],
};
const GROUND = { meadow: 'grass', river: 'grass', forest: 'grass', snow: 'snow', beach: 'sand' };
const TREES = {
  meadow: ['bg/tree05', 'bg/tree34', 'bg/tree23', 'bg/tree02'],
  river: ['bg/tree23', 'bg/tree25', 'bg/tree05', 'bg/tree34'],
  forest: ['bg/tree02', 'bg/tree03', 'bg/tree09', 'bg/tree11', 'bg/tree01', 'bg/tree07', 'bg/tree20', 'bg/tree21'],
  snow: ['bg/tree04', 'bg/tree12', 'bg/tree15', 'bg/tree22', 'bg/tree33', 'bg/tree35'],
  beach: ['palm', 'palm', 'bg/tree16', 'palm', 'bg/tree18'],
};
const ANIMALS = { meadow: ['pig', 'cow', 'sheep', 'chicken'], river: ['cow', 'sheep', 'chicken'], forest: ['pig', 'sheep', 'chicken'], snow: ['sheep'], beach: [] };

export function runImages(character, theme) {
  return [
    ...characterImages(character), ...characterImages('zombie'),
    ...['grass', 'snow', 'sand', 'stone'].flatMap(g => [`tile/${g}-top`, `tile/${g}-fill`]), 'tile/brick', 'tile/brick-brown', 'tile/torch1', 'tile/torch2',
    'tile/bush', 'tile/rock', 'tile/fence', 'tile/sign', 'tile/tuft', 'tile/mushroom', 'tile/window', 'tile/crate', 'tile/bridge', 'tile/ladder',
    'item/gemBlue', 'item/gemGreen', 'item/gemRed', 'item/gemYellow', 'item/flagRed1', 'item/flagRed2', 'item/flagBlue1', 'item/flagBlue2',
    'item/flagYellow1', 'item/flagYellow2', 'item/flagGreen1', 'item/flagGreen2', 'item/star',
    ...[1, 2, 3, 5, 7].map(n => `bg/cloud${n}`), 'bg/sun', 'bg/moon_full', 'bg/house_beige_front', 'bg/house_beige_side', 'bg/house_grey_front', 'bg/house_grey_side',
    'far/castle', 'far/tower', 'far/mountain1', 'far/mountain2', 'far/mountain3', 'far/pointy_mountains',
    ...TREES[theme].filter(t => t !== 'palm'), 'critter/bee', 'critter/bee_move', 'critter/mouse', 'critter/mouse_move', 'critter/fishBlue',
  ];
}

export class RunView {
  constructor({ character, kit, theme = 'meadow', skip = [], followers = [] }) {
    this.character = character;
    this.kit = kit;
    this.theme = theme;
    this.ground = GROUND[theme] ?? 'grass';
    this.skip = new Set(skip); // stop indices with nothing to play today
    this.player = { x: START_X, y: 0, v: 0, vy: 0, air: false, anim: 0, goal: null, dribble: false, sprint: 0, kickT: -99, cheer: false, back: false, ground: 0 };
    this.ball = { x: 0, y: 0, r: 15, spin: 0, mode: 'hidden', vx: 0, vy: 0, flight: null, stop: -1 };
    this.cam = { cx: START_X + 110, zoom: 1, gy: 0.64 };
    this.view = { mode: 'follow', cx: 0, zoom: 1, gy: 0.64 };
    this.particles = [];
    this.glows = [];
    this.lights = [];
    this.time = 0;
    this.shake = 0;
    this.hype = 0;
    this.goalText = -99;
    this.flash = 0;
    this.streak = 0;
    this.at = -1; // the stop he is at
    this.bulge = ANCHORS.map(() => -99);
    this.followers = followers.slice(-3).map((kind, k) => ({ kind, x: START_X - 70 - k * 52, y: 0, vy: 0, hop: 0, k }));
    this.skipper = null;
    this.dustT = 0;
    this.dark = document.createElement('canvas');
    this.dk = this.dark.getContext('2d');
    this.layoutProps();
  }

  // ---- Props and friends, placed once.
  layoutProps() {
    const P = [];
    const th = this.theme;
    let seed = 991;
    const rand = () => hash(seed++);
    P.push({ t: 'corner', x: -30 }, { t: 'corner', x: seg('stadium').x1 - 60 });
    // The countryside lanes: bushes, a fence, a sign, a crate to hop, and the friends.
    const lane = seg('lane');
    P.push({ t: 'bush', x: lane.x0 + 40 }, { t: 'fence', x: lane.x0 + 130 }, { t: 'fence', x: lane.x0 + 194 }, { t: 'sign', x: lane.x0 + 280 },
      { t: 'crate', x: lane.x0 + 390 }, { t: 'tuft', x: lane.x0 + 470 }, { t: th === 'snow' ? 'snowman' : th === 'beach' ? 'crab' : 'mushroom', x: lane.x0 + 520 });
    P.push({ t: 'gate', x: seg('castle').x0 }, { t: 'block', x: seg('castle').x0 + 430 });
    const rocky = seg('rocky');
    P.push({ t: 'tuft', x: rocky.x0 + 100 }, { t: 'bush', x: rocky.x0 + 150 }, { t: 'rock', x: rocky.x0 + 320 });
    for (let x = MOUTH_X + 120, k = 0; x < CAVE_END - 200; x += 200 + rand() * 110, k++) {
      const a = ANCHORS[2];
      if ((x > a - KICK - 2 * STEP - 120 && x < a + GOAL.d + 70) || Math.abs(x - (MOUTH_X + 500)) < 80) continue;
      P.push({ t: 'crystal', x, hue: [190, 285, 160, 320, 205][k % 5], s: 0.85 + rand() * 0.4 });
    }
    P.push({ t: 'pick', x: MOUTH_X + 500 }, { t: 'cart', x: CAVE_END - 330 });
    P.push({ t: 'stage', x: ANCHORS[3] }, { t: 'lights', x: seg('show').x0 + 200 }, { t: 'lights', x: ANCHORS[3] + 520 });
    const village = seg('village');
    P.push({ t: 'lantern', x: village.x0 + 90 }, { t: 'bush', x: village.x0 + 260 }, { t: 'lantern', x: village.x0 + 420 });
    P.push({ t: 'bench', x: ANCHORS[4] - KICK - 2 * STEP - 170 }, { t: 'crate', x: ANCHORS[4] + GOAL.d + 120 }, { t: 'ladder', x: ANCHORS[4] + GOAL.d + 230 });
    P.push({ t: 'podium', x: ANCHORS[7] }, { t: 'corner', x: seg('night').x0 + 40 });
    this.props = P;
    this.obstacles = P.filter(p => p.t === 'crate' || p.t === 'rock' || p.t === 'block');
    // Friends who live along the way: farm animals in the lanes, bats in the cave, a mouse in the
    // workshop, and the zombie, who waves from the cave and dances at the show.
    this.friends = [];
    const kinds = ANIMALS[th] ?? [];
    for (const [x, k] of [[lane.x0 + 80, 0], [lane.x0 + 330, 1], [seg('stadium').x1 - 300, 2], [village.x0 + 170, 3], [rocky.x0 + 230, 1]]) {
      if (kinds.length) this.friends.push({ t: 'animal', kind: kinds[k % kinds.length], home: x, x, dir: rand() < 0.5 ? -1 : 1, pause: rand() * 2, walk: 0 });
    }
    if (th === 'beach') for (const x of [lane.x0 + 200, village.x0 + 300]) this.friends.push({ t: 'crab', home: x, x });
    for (let k = 0; k < 4; k++) this.friends.push({ t: 'bat', x: MOUTH_X + 300 + k * 380, y: -300 - k * 30, ph: rand() * TAU });
    this.friends.push({ t: 'zombie', x: ANCHORS[2] + GOAL.d + 160, pose: 'idle' });
    this.friends.push({ t: 'mouse', home: ANCHORS[4] + GOAL.d + 60, x: ANCHORS[4] + GOAL.d + 60 });
    for (const [kind, dx] of [['zombie', -140], ['pig', -70], ['sheep', 70], ['chicken', 135]]) this.friends.push({ t: 'dancer', kind, x: ANCHORS[3] + dx });
  }

  // ---- Screen
  resize() {
    this.dark.width = this.scene.Wd;
    this.dark.height = this.scene.Hd;
  }

  layer(f) {
    const { S, DPR, Wd, Hd } = this.scene;
    const zl = 1 + (this.cam.zoom - 1) * f;
    const u = S * zl * DPR;
    const G = this.cam.gy * Hd + (this.shy ?? 0);
    const ox = Wd / 2 - this.cam.cx * f * u + (this.shx ?? 0) * f;
    return { f, u, G, ox, X: x => ox + x * u, Y: y => G + y * u, left: -ox / u, right: (Wd - ox) / u, top: -G / u, bottom: (Hd - G) / u };
  }

  pointer(type) {
    if (type !== 'down') return;
    if (this.skipper) this.skipper();
    else if (this.player.goal && !this.player.dribble && !this.player.back) {
      this.player.sprint = 0.8;
      this.puff(this.player.x - 10, 0, 4);
    }
  }

  waitOrTap(s) {
    return new Promise(resolve => {
      const done = () => {
        if (this.skipper === done) this.skipper = null;
        resolve();
      };
      this.skipper = done;
      this.scene.wait(s).then(done);
    });
  }

  // ---- Where things are
  segAt(x) {
    return SEG.find(s => x < s.x1) ?? SEG.at(-1);
  }

  // What the ground is made of at x: his world's ground, the castle's chessboard, cave stone, or
  // open sky (and the bridges) between the floating islands.
  groundAt(x) {
    if (x >= seg('castle').x0 && x < seg('castle').x1) return 'checker';
    if (x >= MOUTH_X - 2 * T && x < CAVE_END + 2 * T) return 'stone';
    if (x >= ISLAND_START && x < ISLAND_END) return ISLANDS.some(([a, b]) => x >= a && x < b) ? 'island' : 'bridge';
    return this.ground;
  }

  spotFor(i, streak = this.streak) {
    if (i === 3) return ANCHORS[3] + 10;
    if (i === 7) return ANCHORS[7] - 95;
    return ANCHORS[i] - KICK - (2 - streak) * STEP;
  }

  // ---- Motion
  moveTo(x, { speed = RUN, dribble = false, back = false } = {}) {
    return new Promise(resolve => {
      this.player.goal = { x, speed, resolve };
      this.player.dribble = dribble;
      this.player.back = back || x < this.player.x;
    });
  }

  jump(h = 88) {
    const p = this.player;
    p.air = true;
    p.vy = -Math.sqrt(2 * GRAV * h);
    this.scene.audio?.effect('hop');
  }

  update(dt) {
    this.time += dt;
    this.updatePlayer(dt);
    this.updateBall(dt);
    this.updateFollowers(dt);
    this.updateFriends(dt);
    this.updateCamera(dt);
    this.updateParticles(dt);
    this.hype = Math.max(0, this.hype - dt * 0.4);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }

  updatePlayer(dt) {
    const p = this.player, g = p.goal;
    if (g) {
      const dir = Math.sign(g.x - p.x) || 1;
      const dist = Math.abs(g.x - p.x);
      const vmax = g.speed * (p.sprint > 0 ? 1.7 : 1);
      const want = Math.max(Math.min(vmax, Math.sqrt(2 * 1500 * dist)), 40);
      p.v += clamp(want - p.v, -3200 * dt, 1900 * dt);
      p.x += dir * p.v * dt;
      if ((dir > 0 && p.x >= g.x - 0.5) || (dir < 0 && p.x <= g.x + 0.5)) {
        p.x = g.x;
        p.v = 0;
        p.goal = null;
        p.dribble = false;
        p.back = false;
        g.resolve();
      }
    }
    for (const ob of this.obstacles) {
      const d = ob.x - p.x;
      if (!ob.hopped && !p.air && p.v > 200 && !p.back && d < 110 && d > 30) {
        ob.hopped = true;
        this.jump();
      }
    }
    if (p.air) {
      p.vy += GRAV * dt;
      p.y += p.vy * dt;
      if (p.y >= -p.ground) {
        p.y = -p.ground;
        p.vy = 0;
        p.air = false;
        this.puff(p.x, -p.ground, 7);
        this.scene.audio?.effect('land');
      }
    }
    p.anim += dt * p.v * (p.dribble || p.back ? 0.05 : 0.021);
    p.sprint = Math.max(0, p.sprint - dt);
    this.dustT -= dt;
    if (!p.air && p.v > 330 && this.dustT <= 0 && this.groundAt(p.x) !== 'bridge') {
      this.dustT = p.sprint > 0 ? 0.06 : 0.13;
      this.puff(p.x - 22, 0, 1);
    }
  }

  updateBall(dt) {
    const b = this.ball, p = this.player;
    if (b.mode === 'feet') {
      const lead = (p.dribble || p.goal) && p.v > 20 ? 12 * Math.abs(Math.sin((p.anim * Math.PI) / 4)) : 0;
      const want = p.x + (p.back ? -30 : 38) + lead;
      const dx = (want - b.x) * Math.min(1, dt * 16);
      b.x += dx;
      b.spin += dx / b.r;
      b.y = -b.r + (p.y < 0 && !p.air ? p.y : 0);
    } else if (b.mode === 'flight') {
      const f = b.flight;
      const t = clamp((this.time - f.t0) / f.dur, 0, 1);
      b.x = lerp(f.x0, f.x1, t);
      b.y = lerp(f.y0, f.y1, t) - f.arc * 4 * t * (1 - t);
      b.spin += dt * 24;
      if (t >= 1) {
        b.mode = 'net';
        b.vx = 150;
        b.vy = -40;
        f.resolve();
      }
    } else if (b.mode === 'drop' || b.mode === 'net' || b.mode === 'roll') {
      b.vy += GRAV * 0.85 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += (b.vx * dt) / b.r;
      if (b.mode === 'net') {
        const back = ANCHORS[b.stop] + GOAL.d * 0.8 - b.r;
        if (b.x > back) {
          b.x = back;
          b.vx = -Math.abs(b.vx) * 0.3;
        }
      }
      if (b.y > -b.r) {
        b.y = -b.r;
        if (b.vy > 140) {
          b.vy *= -0.52;
          if (b.mode === 'drop') this.scene.audio?.effect('bounce');
        } else b.vy = 0;
        b.vx *= b.mode === 'roll' ? 0.995 : 0.82;
        if (b.mode === 'drop' && b.vy === 0) b.mode = 'feet';
      }
      if (b.mode === 'roll') {
        // a pass from a teammate: it slows to a stop at his feet
        const target = p.x + 38;
        b.vx = (target - b.x) * 3;
        if (Math.abs(target - b.x) < 4) b.mode = 'feet';
      }
    }
  }

  updateFollowers(dt) {
    const p = this.player;
    this.followers.forEach((f, k) => {
      const want = p.x - 72 - k * 50;
      const dx = want - f.x;
      f.x += dx * Math.min(1, dt * 5);
      f.moving = Math.abs(dx) > 6;
      if (!f.air && (f.moving || this.cheering) && Math.random() < dt * (this.cheering ? 5 : 3)) {
        f.air = true;
        f.vy = -(this.cheering ? 420 : 260);
      }
      if (f.air) {
        f.vy += GRAV * 0.7 * dt;
        f.y += f.vy * dt;
        if (f.y >= 0) {
          f.y = 0;
          f.air = false;
        }
      }
    });
  }

  updateFriends(dt) {
    for (const a of this.friends) {
      if (a.t !== 'animal' && a.t !== 'crab' && a.t !== 'mouse') continue;
      if (a.pause > 0) {
        a.pause -= dt;
        a.walk = 0;
        continue;
      }
      const speed = a.t === 'mouse' ? 70 : a.t === 'crab' ? 30 : 22;
      a.dir ||= 1;
      a.x += a.dir * dt * speed;
      a.walk = (a.walk ?? 0) + dt * 10;
      if (Math.abs(a.x - a.home) > (a.t === 'mouse' ? 70 : 50) || Math.random() < dt * 0.12) {
        a.dir = Math.abs(a.x - a.home) > 50 ? -Math.sign(a.x - a.home) : -a.dir;
        a.pause = (a.t === 'mouse' ? 0.4 : 1) + Math.random() * 2;
      }
    }
  }

  updateCamera(dt) {
    const v = this.view, { W, S } = this.scene;
    if (v.mode === 'follow') {
      v.zoom = 1;
      v.gy = 0.64;
      v.cx = this.player.x + (W / S) * 0.16 + this.player.v * 0.2 * (this.player.back ? -1 : 1);
    }
    const k = v.mode === 'follow' ? 6 : 2.6;
    this.cam.cx += (v.cx - this.cam.cx) * (1 - Math.exp(-dt * k));
    this.cam.zoom += (v.zoom - this.cam.zoom) * (1 - Math.exp(-dt * 2.4));
    this.cam.gy += (v.gy - this.cam.gy) * (1 - Math.exp(-dt * 2.8));
  }

  puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 20, y: y - 4, vx: (Math.random() - 0.5) * 80 - (n === 1 ? 40 : 0), vy: -30 - Math.random() * 50, life: 0.5, max: 0.5, size: 9 + Math.random() * 8 });
    }
  }

  confetti(x, y, n) {
    const cols = ['#e63946', '#ffd23f', '#3d8bff', '#22c55e', '#ffffff', '#ff8fab', this.kit];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 380 + Math.random() * 520;
      this.particles.push({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, drag: 0.985, life: 2.4 + Math.random(), max: 3.4, size: 8 + Math.random() * 5, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14, color: cols[i % cols.length], seed: Math.random() * 9 });
    }
  }

  sparkles(x, y, n, spread = 60) {
    for (let i = 0; i < n; i++) this.particles.push({ kind: 'spark', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, vx: 0, vy: -20, life: 0.5 + Math.random() * 0.5, max: 1, size: 10 + Math.random() * 10 });
  }

  fireworks(x, y, hue) {
    this.scene.audio?.effect('boom');
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + Math.random() * 0.1, sp = 220 + Math.random() * 90;
      this.particles.push({ kind: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, drag: 0.97, life: 1.1 + Math.random() * 0.4, max: 1.5, size: 6, color: `hsl(${hue + Math.random() * 40} 92% ${this.nightAt() > 0.5 ? 62 : 52}%)` });
    }
  }

  gemBurst(x, y) {
    const names = ['item/gemBlue', 'item/gemGreen', 'item/gemRed', 'item/gemYellow'];
    for (let i = 0; i < 16; i++) this.particles.push({ kind: 'gem', name: names[i % 4], x, y, vx: (Math.random() - 0.5) * 700, vy: -650 - Math.random() * 500, g: 1600, life: 2.8, max: 2.8, size: 42, rot: 0, vr: (Math.random() - 0.5) * 8, bounce: 0.45 });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += (p.g || 0) * dt;
      if (p.drag) {
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      if (p.kind === 'confetti') {
        p.vy = Math.min(p.vy, 150);
        p.vx += Math.sin(this.time * 7 + p.seed) * 260 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.bounce && p.y > -p.size * 0.4) {
        p.y = -p.size * 0.4;
        p.vy *= -p.bounce;
        p.vx *= 0.7;
        p.vr *= 0.7;
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  // ---- What the match does with the run
  // Frames a stop above the card: his player at his spot, the goal (or stage, or podium) in view.
  frame(i, cardH) {
    const v = this.view, { W, H, S } = this.scene;
    let left, right;
    if (i === 3 || i === 7) {
      left = ANCHORS[i] - 230;
      right = ANCHORS[i] + 230;
    } else {
      left = this.spotFor(i, 0) - 80;
      right = ANCHORS[i] + GOAL.d + 40;
    }
    v.mode = 'frame';
    v.zoom = clamp(W / (S * (right - left)), 0.6, 1.05);
    v.gy = clamp((H - cardH - 16) / H, 0.38, 0.66);
    v.cx = (left + right) / 2;
  }

  // Runs to stop i, carrying the ball if a move is on. The camera frames the stop as he arrives.
  async toStop(i, cardH) {
    this.at = -1;
    this.view.mode = 'follow';
    const x = this.spotFor(i);
    const carrying = this.ball.mode === 'feet';
    const arriving = this.moveTo(x, { speed: carrying ? RUN * 0.85 : RUN });
    await this.scene.until(() => this.player.x > x - 380 || !this.player.goal);
    this.frame(i, cardH);
    await arriving;
    this.at = i;
  }

  // A ball for the next move: the kickoff drops from the sky; later a teammate passes one in.
  async ballIn(kickoff = false) {
    const b = this.ball, p = this.player;
    if (b.mode === 'feet') return;
    if (kickoff) {
      this.scene.audio?.effect('whistle');
      Object.assign(b, { mode: 'drop', x: p.x + 90, y: -560, vx: -70, vy: 0 });
    } else {
      const L = this.layer(1);
      Object.assign(b, { mode: 'roll', x: Math.min(p.x - 140, L.left - 20), y: -b.r, vx: 300, vy: 0 });
    }
    await this.scene.until(() => b.mode === 'feet');
  }

  // A pass: he dribbles one step toward the goal.
  async pass(i) {
    this.streak = Math.min(2, this.streak + 1);
    this.scene.audio?.effect('touch');
    await this.moveTo(this.spotFor(i), { speed: 230, dribble: true });
  }

  // A miss ends the move: the ball rolls back to the start mark and he jogs after it.
  async miss(i) {
    if (this.streak === 0) return;
    this.streak = 0;
    await this.moveTo(this.spotFor(i), { speed: 260, back: true });
  }

  // The third pass: he shoots and scores. The celebration lasts two seconds at most and a tap
  // skips it (SPEC.md, "Pace and art"). `cheer` plays the commentary or his own shout.
  async goal(i, cardH, cheer) {
    const v = this.view, { W, S } = this.scene;
    v.mode = 'frame';
    v.gy = 0.68;
    v.zoom = clamp(W / (S * (KICK + GOAL.d + 230)), 0.7, 1.15);
    v.cx = ANCHORS[i] - KICK / 2 + GOAL.d / 2;
    await this.scene.wait(0.45);
    this.player.kickT = this.time;
    await this.scene.wait(0.13);
    this.scene.audio?.effect('kick');
    this.scene.audio?.effect('whoosh');
    const b = this.ball;
    await new Promise(resolve => {
      b.mode = 'flight';
      b.stop = i;
      b.flight = { x0: b.x, y0: b.y, x1: ANCHORS[i] + GOAL.d * 0.45, y1: -GOAL.h * 0.55, arc: 80, t0: this.time, dur: 0.46, resolve };
    });
    this.bulge[i] = this.time;
    this.scene.audio?.effect('net');
    this.celebrate(i);
    cheer?.();
    this.player.cheer = true;
    this.cheering = true;
    await this.waitOrTap(2);
    this.player.cheer = false;
    this.cheering = false;
    this.goalText = -99;
    this.streak = 0;
    // Back to the start mark for the next move, while the camera returns to the card's framing.
    this.frame(i, cardH);
    await this.moveTo(this.spotFor(i), { speed: 300, back: true });
  }

  celebrate(i) {
    const calm = this.scene.calm;
    this.goalText = this.time;
    this.shake = calm ? 0 : 0.4;
    this.flash = calm ? 0 : 0.45;
    this.scene.audio?.effect('cheer');
    this.confetti(ANCHORS[i] + GOAL.d * 0.4, -GOAL.h - 10, 90);
    const kind = STOP_SEG[i];
    if (kind === 'stadium' || kind === 'night') this.hype = 1.2;
    if (kind === 'castle' || kind === 'night' || kind === 'islands') {
      const { H } = this.scene, top = -(this.view.gy * H) / (this.scene.S * this.view.zoom);
      this.fireworks(ANCHORS[i] - 150, top * 0.62, 0);
      this.scene.wait(0.35).then(() => this.fireworks(ANCHORS[i] + 110, top * 0.74, 200));
      this.scene.wait(0.7).then(() => this.fireworks(ANCHORS[i] - 20, top * 0.5, 45));
    }
    if (kind === 'castle') this.hopPieces = this.time;
    if (kind === 'cave') {
      this.gemBurst(ANCHORS[i] + GOAL.d * 0.4, -40);
      this.sparkles(ANCHORS[i] + GOAL.d * 0.4, -90, 14, 160);
      this.scene.audio?.effect('sparkle');
    }
  }

  // A new player signs: the chess piece runs in and joins the ones following him.
  sign(kind) {
    const p = this.player;
    this.followers.unshift({ kind, x: p.x + 260, y: -300, vy: 0, air: true, k: 0 });
    this.followers = this.followers.slice(0, 3);
    this.sparkles(p.x + 60, -120, 10, 120);
  }

  // At the podium: he jumps up beside the trophy and the fireworks start.
  async podium() {
    const p = this.player;
    this.cheering = true;
    await this.moveTo(ANCHORS[7] - 40, { speed: 200 });
    p.ground = T;
    this.jump(110);
    await this.scene.until(() => !p.air);
    p.cheer = true;
    this.hype = 1.4;
    const { H } = this.scene, top = -(this.view.gy * H) / (this.scene.S * this.view.zoom);
    for (let k = 0; k < 4; k++) this.scene.wait(k * 0.45).then(() => this.fireworks(ANCHORS[7] + (k % 2 ? 140 : -150), top * (0.5 + (k % 3) * 0.1), k * 70));
    this.confetti(ANCHORS[7], -200, 80);
  }

  // Where his player is between the stops, for the trail at the top of the screen: 0 at the first
  // stop, 7 at the trophy.
  trail() {
    const x = this.player.x;
    if (x <= ANCHORS[0]) return 0;
    for (let i = 0; i < ANCHORS.length - 1; i++) if (x < ANCHORS[i + 1]) return i + (x - ANCHORS[i]) / (ANCHORS[i + 1] - ANCHORS[i]);
    return ANCHORS.length - 1;
  }

  // Page coordinates of his player, for the circle wipe.
  playerPoint() {
    const L = this.layer(1);
    return { x: L.X(this.player.x) / this.scene.DPR, y: L.Y(this.player.y - 60) / this.scene.DPR };
  }

  nightAt(cx = this.cam.cx) {
    const w = this.weights(cx);
    let n = 0;
    for (const k in w) n += (NIGHT[k] ?? 0) * w[k];
    return n;
  }

  // ---- Drawing
  weights(cx) {
    const w = {}, FADE = 330;
    SEG.forEach((s, i) => {
      const lo = i === 0 ? 1 : smooth(clamp((cx - (s.x0 - FADE)) / (2 * FADE), 0, 1));
      const hi = i === SEG.length - 1 ? 1 : 1 - smooth(clamp((cx - (s.x1 - FADE)) / (2 * FADE), 0, 1));
      const v = lo * hi;
      if (v > 0.001) w[s.key] = (w[s.key] ?? 0) + v;
    });
    return w;
  }

  draw(c) {
    this.glows = [];
    this.lights = [];
    const { DPR } = this.scene;
    this.shx = this.shake > 0 ? (Math.random() - 0.5) * 16 * this.shake * DPR : 0;
    this.shy = this.shake > 0 ? (Math.random() - 0.5) * 12 * this.shake * DPR : 0;
    const w = this.weights(this.cam.cx);
    const night = this.nightAt();
    this.drawSky(c, w, night);
    this.drawClouds(c, night);
    this.drawFar(c, w, night);
    this.drawHills(c, w, 0.32, 1, 120, 40, 260, 1.7, night);
    this.drawHills(c, w, 0.45, 0, 60, 28, 190, 4.1, night);
    this.drawIslandSky(c, w);
    this.drawTrees(c, w, night);
    this.drawStands(c, (w.stadium ?? 0) + (w.night ?? 0) + (w.trophy ?? 0), night);
    this.drawCastle(c, w.castle ?? 0);
    this.drawFestival(c, (w.show ?? 0) + (w.dusk ?? 0) * 0.5);
    this.drawVillage(c, (w.village ?? 0) + (w.workshop ?? 0));
    this.drawCaveBack(c);
    this.drawPieces(c, this.layer(0.92));
    const L = this.layer(1);
    this.drawGround(c, L, night);
    for (const p of this.props) if (p.x > L.left - 300 && p.x < L.right + 300) this.drawProp(c, L, p);
    this.drawMountains(c, L);
    this.drawFriends(c, L);
    ANCHORS.forEach((ax, i) => {
      const style = GOAL_STYLE[i];
      if (!style || ax < L.left - 200 || ax > L.right + 100) return;
      const age = this.time - this.bulge[i];
      const bulge = age >= 0 && age < 1.4 ? Math.exp(-age * 4) * Math.cos(age * 16) : 0;
      const gx = L.X(ax), g = L.Y(0);
      goalBack(c, gx, g, L.u, GOAL_STYLES[style], bulge);
      if (this.ball.mode === 'net' && this.ball.stop === i) this.drawBall(c, L);
      goalFront(c, gx, g, L.u, GOAL_STYLES[style]);
    });
    this.drawFollowers(c, L);
    this.drawPlayer(c, L);
    if (this.ball.mode !== 'net') this.drawBall(c, L);
    this.drawLighting(c, L, night);
    this.drawParticles(c, L);
    this.drawWeather(c, L);
    if (this.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${this.flash * 0.5})`;
      c.fillRect(0, 0, this.scene.Wd, this.scene.Hd);
    }
    this.drawGoalText(c);
  }

  drawSky(c, w, night) {
    const { Wd, Hd } = this.scene;
    const mix = idx => {
      let r = 0, g = 0, b = 0, tot = 0;
      for (const k in w) {
        const n = parseInt(SKY[k][idx].slice(1), 16);
        r += ((n >> 16) & 255) * w[k];
        g += ((n >> 8) & 255) * w[k];
        b += (n & 255) * w[k];
        tot += w[k];
      }
      return `rgb(${(r / tot) | 0},${(g / tot) | 0},${(b / tot) | 0})`;
    };
    const gr = c.createLinearGradient(0, 0, 0, this.cam.gy * Hd);
    gr.addColorStop(0, mix(0));
    gr.addColorStop(1, mix(1));
    c.fillStyle = gr;
    c.fillRect(0, 0, Wd, Hd);
    const L = this.layer(0.03);
    const day = 1 - night - (w.dusk ?? 0) - (w.show ?? 0) - (w.village ?? 0) - (w.castle ?? 0) * 0.8;
    if (day > 0.05) this.disc(c, L, 120, -470, 30, '#fff6c9', 'rgba(255,246,200,0.55)', day);
    const eve = (w.castle ?? 0) + (w.dusk ?? 0) + (w.show ?? 0) + (w.village ?? 0) * 0.8;
    if (eve > 0.05) this.disc(c, L, 40, -170, 58, '#ffd9a8', 'rgba(255,190,150,0.6)', Math.min(1, eve));
    if (night > 0.05) {
      c.globalAlpha = night;
      for (let k = 0; k < 70; k++) {
        const x = (hash(k * 3 + 1) - 0.5) * this.scene.Wd * 1.1 + Wd / 2, y = hash(k * 5 + 2) * this.cam.gy * Hd * 0.85;
        const tw = 0.5 + 0.5 * Math.sin(this.time * (1 + (k % 4)) + k);
        c.fillStyle = `rgba(255,255,240,${0.4 + tw * 0.6})`;
        const sz = (1 + (k % 3 === 0)) * this.scene.DPR;
        c.fillRect(x, y, sz, sz);
      }
      const [mw, mh] = size('bg/moon_full');
      if (mw) img(c, 'bg/moon_full', L.X(-150) - mw * 0.32 * L.u, L.Y(-500), mw * 0.64 * L.u * 0.7, mh * 0.64 * L.u * 0.7);
      c.globalAlpha = 1;
    }
  }

  disc(c, L, x, y, r, core, halo, a) {
    const sx = L.X(this.cam.cx * 0.03 + x), sy = L.Y(y), rr = r * L.u;
    const g = c.createRadialGradient(sx, sy, rr * 0.6, sx, sy, rr * 3.2);
    g.addColorStop(0, halo);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = a;
    c.fillStyle = g;
    c.fillRect(sx - rr * 3.2, sy - rr * 3.2, rr * 6.4, rr * 6.4);
    c.fillStyle = core;
    c.beginPath();
    c.arc(sx, sy, rr, 0, TAU);
    c.fill();
    c.globalAlpha = 1;
  }

  drawClouds(c, night) {
    const L = this.layer(0.07);
    const span = 470, drift = this.time * 10;
    c.globalAlpha = 0.9 - night * 0.6;
    for (let i = Math.floor((L.left + drift - 400) / span); i <= Math.ceil((L.right + drift + 100) / span); i++) {
      const name = `bg/cloud${[1, 2, 3, 5, 7][Math.floor(hash(i) * 5)]}`, [iw, ih] = size(name);
      if (!iw) continue;
      const sc = (0.8 + hash(i + 11) * 0.7) * L.u * 0.85;
      img(c, name, L.X(i * span + hash(i + 7) * 220 - drift), L.Y(-360 - hash(i + 3) * 200), iw * sc, ih * sc);
    }
    c.globalAlpha = 1;
  }

  farColor(key, night) {
    const base = { stadium: '#aedcf2', lane: '#b6e1f4', castle: '#c6bdec', rocky: '#c6d3e6', dusk: '#f2b9a0', show: '#e9a8b4', village: '#c39fd4', workshop: '#b28fd0' }[key];
    if (!base) return null;
    const themed = this.theme === 'snow' ? shade(base, 0.35) : this.theme === 'beach' ? shade(base, 0.1) : base;
    return night > 0.3 ? shade(themed, -0.45 * night) : themed;
  }

  drawFar(c, w, night) {
    const L = this.layer(0.2);
    for (const key in w) {
      const col = this.farColor(key, night);
      if (!col) continue;
      c.globalAlpha = w[key] * 0.75;
      const set = key === 'castle' ? ['far/castle', 'far/mountain2', 'far/tower', 'far/castle', 'far/mountain3'] : ['far/mountain2', 'far/pointy_mountains', 'far/mountain1', 'far/pointy_mountains', 'far/mountain2'];
      for (let i = Math.floor(L.left / 230) - 2; i <= Math.ceil(L.right / 230) + 1; i++) {
        const im = tinted(set[Math.floor(hash(i + 300) * set.length)], col);
        if (!im) continue;
        const sc = (0.55 + hash(i + 301) * 0.35) * L.u;
        c.drawImage(im, L.X(i * 230 + hash(i + 302) * 90), L.Y(12) - im.height * sc, im.width * sc, im.height * sc);
      }
    }
    c.globalAlpha = 1;
    // The beach world has the sea on the horizon.
    if (this.theme === 'beach') {
      const L2 = this.layer(0.25);
      const open = 1 - (w.cave ?? 0) - (w.islands ?? 0);
      if (open > 0.05) {
        c.globalAlpha = open;
        c.fillStyle = night > 0.5 ? '#2a4a7a' : '#5cc3e6';
        c.fillRect(0, L2.Y(-70), this.scene.Wd, 90 * L2.u);
        c.fillStyle = 'rgba(255,255,255,0.5)';
        for (let k = 0; k < 12; k++) c.fillRect(L2.X(((k * 170 + this.time * 6) % 2040) + Math.floor(L2.left / 2040) * 2040), L2.Y(-50 + (k % 3) * 14), 26 * L2.u, 2.5 * L2.u);
        c.globalAlpha = 1;
      }
    }
  }

  drawHills(c, w, f, which, h0, amp, per, seedv, night) {
    const L = this.layer(f);
    const col = HILLS[this.theme]?.[which] ?? HILLS.meadow[which];
    const open = 1 - (w.islands ?? 0) - (w.cliff ?? 0) * 0.5 - (w.landing ?? 0) * 0.5;
    if (open <= 0.02) return;
    c.globalAlpha = open;
    c.fillStyle = night > 0.2 ? shade(col, -0.55 * night) : (w.castle ?? 0) > 0.5 ? shade(col, -0.08) : col;
    c.beginPath();
    c.moveTo(0, this.scene.Hd);
    const stepPx = 10 * this.scene.DPR;
    for (let sx = 0; sx <= this.scene.Wd + stepPx; sx += stepPx) {
      const xw = (sx - L.ox) / L.u;
      c.lineTo(sx, L.Y(-(h0 + amp * Math.sin(xw / per + seedv) + amp * 0.55 * Math.sin(xw / (per * 0.43) + seedv * 2.3))));
    }
    c.lineTo(this.scene.Wd, this.scene.Hd);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }

  // Up among the floating islands: far islands drifting, and clouds below.
  drawIslandSky(c, w) {
    const a = (w.islands ?? 0) + (w.cliff ?? 0) * 0.5 + (w.landing ?? 0) * 0.5;
    if (a < 0.02) return;
    c.globalAlpha = Math.min(1, a);
    for (const [f, k, col, top] of [[0.25, 0.55, '#b9a6d8', '#c9b9e3'], [0.4, 0.8, '#9d86c8', '#a9c98f']]) {
      const L = this.layer(f);
      for (let i = Math.floor(L.left / 340) - 1; i <= Math.ceil(L.right / 340) + 1; i++) {
        const x = i * 340 + hash(i + 40 + f * 100) * 140, y = -150 - hash(i + 41) * 230;
        const wd = (50 + hash(i + 42) * 50) * k;
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(L.X(x - wd), L.Y(y));
        c.quadraticCurveTo(L.X(x - wd * 0.6), L.Y(y + wd * 0.5), L.X(x - wd * 0.15), L.Y(y + wd * 0.9));
        c.lineTo(L.X(x + wd * 0.1), L.Y(y + wd * 1.05));
        c.quadraticCurveTo(L.X(x + wd * 0.7), L.Y(y + wd * 0.45), L.X(x + wd), L.Y(y));
        c.closePath();
        c.fill();
        c.fillStyle = top;
        c.beginPath();
        c.ellipse(L.X(x), L.Y(y), wd * L.u, 9 * k * L.u, 0, 0, TAU);
        c.fill();
        // a little tree on some of them
        if (hash(i + 43) < 0.6) {
          c.fillStyle = shade(top, -0.2);
          c.beginPath();
          c.arc(L.X(x + wd * 0.3), L.Y(y - 18 * k), 13 * k * L.u, 0, TAU);
          c.fill();
          c.fillRect(L.X(x + wd * 0.3) - 1.5 * k * L.u, L.Y(y - 8 * k), 3 * k * L.u, 8 * k * L.u);
        }
      }
    }
    const L2 = this.layer(0.55);
    for (let i = Math.floor(L2.left / 260) - 1; i <= Math.ceil(L2.right / 260) + 1; i++) {
      const name = `bg/cloud${[1, 3, 5, 7, 2][((i % 5) + 5) % 5]}`, [iw, ih] = size(name);
      if (iw) img(c, name, L2.X(i * 260 + hash(i) * 80), L2.Y(40 + hash(i + 5) * 160), iw * 1.1 * L2.u, ih * 1.1 * L2.u);
    }
    c.globalAlpha = 1;
  }

  drawTrees(c, w, night) {
    const L = this.layer(0.66);
    const a = (w.lane ?? 0) + (w.rocky ?? 0) + (w.dusk ?? 0) + (w.cliff ?? 0) * 0.6 + (w.landing ?? 0) * 0.6;
    if (a < 0.02) return;
    c.globalAlpha = Math.min(1, a);
    const names = TREES[this.theme] ?? TREES.meadow;
    const dim = night > 0.2 ? night * 0.5 : 0;
    for (let i = Math.floor(L.left / 120) - 2; i <= Math.ceil(L.right / 120) + 1; i++) {
      const name = names[Math.floor(hash(i + 500) * names.length)], x = L.X(i * 120 + hash(i + 503) * 60), y = L.Y(10);
      const sc = (0.75 + hash(i + 502) * 0.5) * L.u;
      if (name === 'palm') drawPalm(c, x, y, sc * 1.1, this.time + i);
      else {
        const [iw, ih] = size(name);
        if (iw) img(c, name, x - (iw * sc) / 2, y - ih * sc, iw * sc, ih * sc);
      }
    }
    if (dim) {
      c.globalAlpha = Math.min(1, a) * dim;
      c.fillStyle = '#1a1f45';
      c.fillRect(0, 0, this.scene.Wd, L.Y(12));
    }
    c.globalAlpha = 1;
    if ((w.rocky ?? 0) > 0.01) {
      // the rising rock face of the mountain the cave goes into
      c.globalAlpha = w.rocky;
      const L2 = this.layer(0.5);
      c.fillStyle = this.theme === 'snow' ? '#c9d6e6' : '#9aa3b5';
      c.beginPath();
      c.moveTo(0, this.scene.Hd);
      const stepPx = 10 * this.scene.DPR;
      for (let sx = 0; sx <= this.scene.Wd + stepPx; sx += stepPx) {
        const xw = (sx - L2.ox) / L2.u;
        const rise = clamp((xw - (seg('rocky').x0 - 300) * 0.5) / 300, 0, 1);
        c.lineTo(sx, L2.Y(-(70 + rise * 260 + 26 * Math.sin(xw / 70) + 14 * Math.sin(xw / 23))));
      }
      c.lineTo(this.scene.Wd, this.scene.Hd);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
    }
  }

  // ---- The stands: a cached static segment, with the crowd and lights drawn live.
  standSegment() {
    if (this.standCache) return this.standCache;
    const k = 2, cv = document.createElement('canvas');
    cv.width = STAND.SEG * k;
    cv.height = (STAND.TOP + 12) * k;
    const x = cv.getContext('2d');
    x.scale(k, k);
    x.translate(0, STAND.TOP);
    const { SEG: W, AD, ROW, ROWS, SEAT, ROOF, DECK } = STAND;
    for (let r = 0; r < ROWS; r++) {
      x.fillStyle = r % 2 ? '#2e5cb2' : '#3567c4';
      x.fillRect(0, -AD - ROW * (r + 1), W, ROW);
      x.fillStyle = 'rgba(15,35,80,0.35)';
      for (let s = 0; s < W / SEAT; s++) x.fillRect(3 + s * SEAT, -AD - ROW * r - 8, 9, 6);
    }
    for (const ax of STAND.AISLES) {
      x.fillStyle = '#5a7fc7';
      x.fillRect(ax, -DECK, 16, DECK - AD);
      x.fillStyle = 'rgba(255,255,255,0.18)';
      for (let r = 0; r < ROWS * 2; r++) x.fillRect(ax, -DECK + r * (ROW / 2), 16, 2);
    }
    x.fillStyle = '#39404f';
    x.fillRect(-2, -STAND.TOP, W + 4, ROOF);
    x.fillStyle = '#4d5668';
    x.fillRect(-2, -STAND.TOP + ROOF - 7, W + 4, 7);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(0, -DECK, W, 9);
    const ads = ['#ffd23f', '#2d6cdf', '#ffffff', this.kit];
    for (let a = 0; a < W / 100; a++) {
      x.fillStyle = ads[a % 4];
      x.fillRect(a * 100, -AD, 100, AD + 12);
      x.fillStyle = a % 4 === 2 ? this.kit : 'rgba(255,255,255,0.85)';
      x.beginPath();
      x.roundRect ? x.roundRect(a * 100 + 14, -21, 44, 10, 5) : x.rect(a * 100 + 14, -21, 44, 10);
      x.fill();
      x.beginPath();
      x.arc(a * 100 + 76, -16, 7, 0, TAU);
      x.fill();
      x.fillStyle = 'rgba(0,0,0,0.12)';
      x.fillRect(a * 100, -4, 100, 16);
    }
    this.standCache = { cv, k };
    return this.standCache;
  }

  drawStands(c, alpha, night) {
    if (alpha < 0.01) return;
    const L = this.layer(0.6);
    const seg0 = this.standSegment();
    const { SEG: W, AD, ROW, ROWS, SEAT, TOP } = STAND;
    c.globalAlpha = Math.min(1, alpha);
    const u = L.u;
    const shirts = [this.kit, this.kit, '#ffffff', '#ffd23f', this.kit, '#ff8c42', '#ffffff'];
    const skins = ['#f6d3b3', '#e8b48a', '#c98b5a', '#8d5a3b', '#ffdcb5'];
    const bodies = shirts.map(() => new Path2D()), heads = skins.map(() => new Path2D()), arms = shirts.map(() => new Path2D());
    const waveX = ((this.time * 380) % (W * 6)) + Math.floor(L.left / (W * 6)) * W * 6;
    for (let i = Math.floor(L.left / W) - 1; i <= Math.floor(L.right / W) + 1; i++) {
      const x0 = i * W;
      c.drawImage(seg0.cv, L.X(x0), L.Y(-TOP), W * u, (TOP + 12) * u);
      for (let r = 0; r < ROWS; r++) {
        for (let s = 0; s < W / SEAT; s++) {
          const id = i * 997 + r * 61 + s;
          const x = x0 + 7.5 + s * SEAT;
          if (STAND.AISLES.some(ax => x - x0 > ax - 6 && x - x0 < ax + 22) || hash(id) < 0.12) continue;
          const ph = hash(id + 5) * TAU;
          const bump = Math.exp(-(((x - waveX) / 60) ** 2));
          const up = this.hype * (4 + 6 * Math.abs(Math.sin(this.time * 9 + ph))) + bump * 8 + 0.8 * (1 + Math.sin(this.time * 2.6 + ph));
          const px = L.X(x), py = L.Y(-AD - ROW * r - 3 - up);
          const si = Math.floor(hash(id + 9) * shirts.length);
          bodies[si].rect(px - 5 * u, py - 10 * u, 10 * u, 10 * u);
          const hd = heads[Math.floor(hash(id + 13) * skins.length)];
          hd.moveTo(px + 4.5 * u, py - 14 * u);
          hd.arc(px, py - 14 * u, 4.5 * u, 0, TAU);
          if (this.hype > 0.25 || bump > 0.45) {
            arms[si].moveTo(px - 4 * u, py - 8 * u);
            arms[si].lineTo(px - 7 * u, py - 18 * u);
            arms[si].moveTo(px + 4 * u, py - 8 * u);
            arms[si].lineTo(px + 7 * u, py - 18 * u);
          }
        }
      }
      for (let f = 0; f < 4; f++) {
        const name = `item/${['flagRed', 'flagYellow', 'flagBlue', 'flagGreen'][f]}${Math.floor(this.time * 4 + f * 0.7 + i) % 2 ? '1' : '2'}`;
        img(c, name, L.X(x0 + 50 + f * 150), L.Y(-TOP - 28), 30 * u, 30 * u);
      }
      if (((i % 2) + 2) % 2 === 0) {
        const mx = x0 + 300;
        c.fillStyle = '#5b6475';
        c.fillRect(L.X(mx - 3), L.Y(-TOP - 110), 6 * u, 110 * u);
        c.fillStyle = '#3c4352';
        c.fillRect(L.X(mx - 23), L.Y(-TOP - 134), 46 * u, 27 * u);
        c.fillStyle = '#fff4c4';
        for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) c.fillRect(L.X(mx - 19 + a * 13.5), L.Y(-TOP - 130 + b * 11.5), 10.5 * u, 8 * u);
        this.glows.push({ x: L.X(mx), y: L.Y(-TOP - 120), r: (80 + night * 120) * u, col: 'rgba(255,250,215,', a: (0.35 + night * 0.35) * alpha });
      }
    }
    c.lineCap = 'round';
    c.lineWidth = 3 * u;
    shirts.forEach((col, i) => {
      c.fillStyle = col;
      c.fill(bodies[i]);
      c.strokeStyle = col;
      c.stroke(arms[i]);
    });
    skins.forEach((col, i) => {
      c.fillStyle = col;
      c.fill(heads[i]);
    });
    if (night > 0.1) {
      // the stands under the lights at night
      c.globalAlpha = Math.min(1, alpha) * night * 0.42;
      c.fillStyle = '#0d1435';
      c.fillRect(0, L.Y(-TOP), this.scene.Wd, (TOP + 12) * u);
      c.globalAlpha = Math.min(1, alpha) * night;
      for (let k = 0; k < 40; k++) {
        const x = L.X(Math.floor(L.left / 37) * 37 + k * 37 + hash(k) * 20), y = L.Y(-AD - (hash(k + 3) * ROWS) * ROW - 16);
        if (Math.sin(this.time * 3 + k * 2.1) > 0.2) {
          c.fillStyle = '#fffbe0';
          c.fillRect(x, y, 2.4 * u, 2.4 * u);
        }
      }
    }
    c.globalAlpha = 1;
  }

  // ---- The castle walls: small brick blocks, so they sit far back.
  castleSegment() {
    if (this.castleCache) return this.castleCache;
    const im = IMG['tile/brick'], win = IMG['tile/window'];
    if (!im?.naturalWidth) return null;
    const { BT, W, WALL, TOWER, ROOFH } = CASTLE;
    const k = 2, top = (TOWER + 1) * BT + ROOFH + 10, cv = document.createElement('canvas');
    cv.width = W * k;
    cv.height = (top + 12) * k;
    const x = cv.getContext('2d');
    x.scale(k, k);
    x.translate(0, top);
    const brick = (col, row) => x.drawImage(im, col * BT, -(row + 1) * BT + 6, BT + 0.5, BT + 0.5);
    for (let col = 0; col < W / BT; col++) {
      for (let r = 0; r < WALL; r++) brick(col, r);
      if (col % 2 === 0) brick(col, WALL);
    }
    for (let col = 1; col < 4; col++) for (let r = 0; r < TOWER; r++) brick(col, r);
    brick(1, TOWER);
    brick(3, TOWER);
    if (win?.naturalWidth) for (const r of [5, 8]) x.drawImage(win, 2 * BT, -(r + 1) * BT + 6, BT, BT);
    const roofY = -(TOWER + 1) * BT + 6;
    x.fillStyle = '#e2574c';
    x.beginPath();
    x.moveTo(BT - 6, roofY);
    x.lineTo(2.5 * BT, roofY - ROOFH);
    x.lineTo(4 * BT + 6, roofY);
    x.closePath();
    x.fill();
    x.fillStyle = '#b8443b';
    x.beginPath();
    x.moveTo(2.5 * BT, roofY - ROOFH);
    x.lineTo(4 * BT + 6, roofY);
    x.lineTo(2.5 * BT, roofY);
    x.closePath();
    x.fill();
    for (const [bc, col] of [[7.6, this.kit], [13.6, '#3d6fd8']]) {
      const bx = bc * BT, bw = 1.15 * BT;
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(bx, -WALL * BT + 4);
      x.lineTo(bx + bw, -WALL * BT + 4);
      x.lineTo(bx + bw, -2.3 * BT);
      x.lineTo(bx + bw / 2, -2.75 * BT);
      x.lineTo(bx, -2.3 * BT);
      x.closePath();
      x.fill();
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(bx + bw * 0.66, -WALL * BT + 4, bw * 0.34, 3.4 * BT);
      drawPiece(x, bc < 10 ? 'rook' : 'knight', bx + bw / 2, -3.3 * BT, 0.15, { fill: '#fff', shade: '#f1f1f1', detail: col });
    }
    x.fillStyle = 'rgba(110,100,175,0.28)';
    x.fillRect(0, -top, W, top + 12);
    this.castleCache = { cv, top, roofY };
    return this.castleCache;
  }

  drawCastle(c, alpha) {
    if (alpha < 0.01) return;
    const segc = this.castleSegment();
    if (!segc) return;
    const L = this.layer(0.66);
    const { BT, W, ROOFH } = CASTLE;
    c.globalAlpha = Math.min(1, alpha);
    for (let i = Math.floor(L.left / W) - 1; i <= Math.floor(L.right / W) + 1; i++) {
      const x0 = i * W;
      c.drawImage(segc.cv, L.X(x0), L.Y(-segc.top), W * L.u, (segc.top + 12) * L.u);
      img(c, `item/flagRed${Math.floor(this.time * 4 + i) % 2 ? '1' : '2'}`, L.X(x0 + 2.5 * BT - 4), L.Y(segc.roofY - ROOFH - 30), 32 * L.u, 32 * L.u);
      for (const tc of [5.5, 10.5, 16.5]) {
        const tx = x0 + tc * BT;
        img(c, `tile/torch${Math.floor(this.time * 8 + tc + i) % 2 ? '1' : '2'}`, L.X(tx - 13), L.Y(-3.9 * BT), 26 * L.u, 26 * L.u);
        this.glows.push({ x: L.X(tx), y: L.Y(-3.6 * BT), r: 50 * L.u, col: 'rgba(255,170,70,', a: 0.4 * alpha });
      }
    }
    c.globalAlpha = 1;
  }

  // ---- The halftime show: string lights and tents behind the stage.
  drawFestival(c, alpha) {
    if (alpha < 0.01) return;
    const L = this.layer(0.7);
    c.globalAlpha = Math.min(1, alpha);
    const tents = ['#e63946', '#ffd23f', '#3d8bff', '#22c55e', '#b06ce0'];
    for (let i = Math.floor(L.left / 210) - 1; i <= Math.ceil(L.right / 210) + 1; i++) {
      const x = i * 210 + hash(i + 70) * 60, col = tents[((i % 5) + 5) % 5];
      const w = 70 + hash(i + 71) * 30, h = 80 + hash(i + 72) * 40;
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(L.X(x - w), L.Y(8));
      c.lineTo(L.X(x), L.Y(-h));
      c.lineTo(L.X(x + w), L.Y(8));
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.moveTo(L.X(x - w * 0.33), L.Y(8));
      c.lineTo(L.X(x), L.Y(-h));
      c.lineTo(L.X(x + w * 0.33), L.Y(8));
      c.closePath();
      c.fill();
      c.fillStyle = '#5b3a2a';
      c.beginPath();
      c.moveTo(L.X(x - 12), L.Y(8));
      c.lineTo(L.X(x), L.Y(-h * 0.35));
      c.lineTo(L.X(x + 12), L.Y(8));
      c.fill();
    }
    // string lights across the top
    c.strokeStyle = 'rgba(60,40,60,0.6)';
    c.lineWidth = 1.5 * L.u;
    const y0 = -230;
    c.beginPath();
    for (let x = Math.floor(L.left / 20) * 20; x < L.right + 20; x += 20) c.lineTo(L.X(x), L.Y(y0 + 26 * Math.abs(Math.sin(x / 130))));
    c.stroke();
    for (let x = Math.floor(L.left / 40) * 40; x < L.right + 40; x += 40) {
      const on = Math.sin(this.time * 4 + x * 0.05) > -0.3;
      const col = ['#ffd23f', '#ff8fab', '#7ee0ff', '#b6ff8a'][((x / 40) % 4 + 4) % 4];
      c.fillStyle = on ? col : shade(col, -0.4);
      const y = L.Y(y0 + 26 * Math.abs(Math.sin(x / 130)) + 6);
      c.beginPath();
      c.arc(L.X(x), y, 4.5 * L.u, 0, TAU);
      c.fill();
      if (on) this.glows.push({ x: L.X(x), y, r: 18 * L.u, col: 'rgba(255,240,180,', a: 0.35 * alpha });
    }
    c.globalAlpha = 1;
  }

  // ---- The village and the workshop: houses at dusk with lit windows.
  drawVillage(c, alpha) {
    if (alpha < 0.01) return;
    const L = this.layer(0.68);
    c.globalAlpha = Math.min(1, alpha);
    const houses = ['bg/house_beige_front', 'bg/house_grey_side', 'bg/house_beige_side', 'bg/house_grey_front'];
    for (let i = Math.floor(L.left / 190) - 1; i <= Math.ceil(L.right / 190) + 1; i++) {
      const name = houses[((i % 4) + 4) % 4], [iw, ih] = size(name);
      if (!iw) continue;
      const sc = (0.9 + hash(i + 80) * 0.25) * L.u, x = L.X(i * 190 + hash(i + 81) * 40);
      img(c, name, x - (iw * sc) / 2, L.Y(10) - ih * sc, iw * sc, ih * sc);
      this.glows.push({ x, y: L.Y(10) - ih * sc * 0.4, r: 40 * L.u, col: 'rgba(255,200,120,', a: 0.25 * alpha });
    }
    c.fillStyle = 'rgba(70,50,120,0.25)';
    c.fillRect(0, 0, this.scene.Wd, L.Y(12));
    c.globalAlpha = 1;
  }

  // ---- The cave: a dark wall, seen from the mouth to the way out.
  caveSegment() {
    if (this.caveCache) return this.caveCache;
    const st = tinted('tile/stone-fill', '#3d3570'), raw = IMG['tile/stone-fill'];
    if (!st || !raw?.naturalWidth) return null;
    const k = 2, tile = 60, cols = 10, rows = 12, cv = document.createElement('canvas');
    cv.width = cols * tile * k;
    cv.height = rows * tile * k;
    const x = cv.getContext('2d');
    x.scale(k, k);
    x.fillStyle = '#1f1a3a';
    x.fillRect(0, 0, cols * tile, rows * tile);
    for (let col = 0; col < cols; col++) {
      for (let r = 0; r < rows; r++) {
        x.globalAlpha = 0.3 + hash(col * 31 + r * 7) * 0.2;
        x.drawImage(raw, col * tile, r * tile, tile + 0.5, tile + 0.5);
        x.globalAlpha = 0.82;
        x.drawImage(st, col * tile, r * tile, tile + 0.5, tile + 0.5);
        if (hash(col * 131 + r * 17) < 0.1) {
          const gem = IMG[`item/${['gemBlue', 'gemGreen', 'gemRed', 'gemYellow'][Math.floor(hash(col + r * 3) * 4)]}`];
          x.globalAlpha = 0.95;
          if (gem?.naturalWidth) for (const [gx, gy] of [[0.12, 0.16], [0.52, 0.42], [0.22, 0.62]]) x.drawImage(gem, col * tile + gx * tile, r * tile + gy * tile, tile * 0.36, tile * 0.36 * 0.85);
        }
      }
    }
    x.globalAlpha = 1;
    this.caveCache = { cv, w: cols * tile, h: rows * tile };
    return this.caveCache;
  }

  caveSpan(L1) {
    return [L1.X(MOUTH_X - 2 * T), L1.X(CAVE_END + 2 * T)];
  }

  drawCaveBack(c) {
    const L1 = this.layer(1);
    const [mx, ex] = this.caveSpan(L1);
    if (mx >= this.scene.Wd || ex <= 0) return;
    const segc = this.caveSegment();
    if (!segc) return;
    const L = this.layer(0.86);
    c.save();
    c.beginPath();
    c.rect(Math.max(0, mx), 0, Math.min(this.scene.Wd, ex) - Math.max(0, mx), this.scene.Hd);
    c.clip();
    for (let i = Math.floor(L.left / segc.w) - 1; i <= Math.floor(L.right / segc.w) + 1; i++) c.drawImage(segc.cv, L.X(i * segc.w), L.Y(-segc.h + 30), segc.w * L.u, segc.h * L.u);
    for (let i = Math.floor((L.left - 200) / 360); i <= Math.ceil(L.right / 360); i++) {
      const tx = i * 360 + 120;
      const sx = L.X(tx);
      if (sx + 30 < mx || sx - 30 > ex) continue;
      img(c, `tile/torch${Math.floor(this.time * 9 + i) % 2 ? '1' : '2'}`, L.X(tx - 18), L.Y(-200), 44 * L.u, 44 * L.u);
      const fl = 1 + 0.08 * Math.sin(this.time * 13 + i * 2) + 0.05 * Math.sin(this.time * 29 + i);
      this.glows.push({ x: L.X(tx + 4), y: L.Y(-188), r: 180 * L.u * fl, col: 'rgba(255,160,60,', a: 0.42 });
      this.lights.push({ x: L.X(tx + 4), y: L.Y(-188), r: 270 * L.u * fl });
    }
    c.restore();
  }

  // ---- The giant chess pieces in the castle courtyard, behind his path.
  drawPieces(c, L) {
    const pieces = CASTLE_PIECES;
    for (const p of pieces) {
      if (p.x < L.left - 120 || p.x > L.right + 120) continue;
      let hop = 0, sy = 1, sx = 1;
      const idle = (this.time + p.phase) % p.period;
      const age = this.time - (this.hopPieces ?? -99) - Math.abs(p.x - ANCHORS[1]) / 1400;
      const big = age >= 0 && age < 0.55;
      const t = big ? age / 0.55 : idle < 0.5 ? idle / 0.5 : -1;
      if (t >= 0) {
        hop = Math.sin(t * Math.PI) * (big ? 46 : 18);
        const sq = Math.sin(t * Math.PI * 2);
        sy = 1 + 0.07 * sq;
        sx = 1 - 0.05 * sq;
      }
      const px = L.X(p.x);
      const pw = 84 * L.u;
      img(c, 'tile/brick', px - pw / 2, L.Y(-T * 0.55), pw, T * 0.55 * L.u + 1);
      c.fillStyle = 'rgba(0,0,0,0.14)';
      c.beginPath();
      c.ellipse(px, L.Y(-T * 0.55), 34 * L.u * (1 - hop / 120), 6 * L.u, 0, 0, TAU);
      c.fill();
      drawPiece(c, p.kind, px, L.Y(-T * 0.55 - hop), L.u * 0.95, p.dark ? PIECE_COLORS.dark : PIECE_COLORS.light, sx, sy);
    }
  }

  // ---- Ground
  drawOre(c, sx, sy, s, seed) {
    const gem = `item/${['gemBlue', 'gemGreen', 'gemRed', 'gemYellow'][Math.floor(hash(seed) * 4)]}`;
    for (const [gx, gy] of [[0.1, 0.12], [0.52, 0.38], [0.18, 0.6]]) img(c, gem, sx + gx * s, sy + gy * s, s * 0.38, s * 0.32);
  }

  drawGround(c, L, night) {
    const u = L.u, ts = T * u, sw = Math.ceil(ts) + 1;
    const rows = Math.ceil(L.bottom / T) + 1;
    for (let col = Math.floor(L.left / T) - 1; col <= Math.ceil(L.right / T); col++) {
      const x = col * T, kind = this.groundAt(x + T / 2);
      const sx = Math.floor(L.X(x));
      if (kind === 'bridge') {
        // a rope bridge across the sky
        img(c, 'tile/bridge', sx, Math.floor(L.Y(-6)), sw, Math.ceil(T * 0.5 * u));
        continue;
      }
      if (kind === 'island') {
        const [a, b] = ISLANDS.find(([p, q]) => x + T / 2 >= p && x + T / 2 < q);
        const depth = Math.max(1, Math.min(3, Math.floor(Math.min(x - a, b - x - T) / T) + 1));
        const g = this.ground;
        for (let r = 0; r < depth; r++) img(c, r === 0 ? `tile/${g}-top` : `tile/${g}-fill`, sx, Math.floor(L.Y(r * T)), sw, sw);
        continue;
      }
      for (let r = 0; r < rows; r++) {
        const sy = Math.floor(L.Y(r * T));
        let name;
        if (kind === 'checker') name = r < 2 ? 'tile/brick' : 'tile/stone-fill';
        else if (kind === 'stone') name = r === 0 ? 'tile/stone-top' : 'tile/stone-fill';
        else name = r === 0 ? `tile/${kind}-top` : r < 3 ? `tile/${kind}-fill` : 'tile/stone-fill';
        img(c, name, sx, sy, sw, sw);
        if (kind === 'checker' && r < 2 && (col + r) % 2) {
          c.fillStyle = 'rgba(45,40,80,0.42)';
          c.fillRect(sx, sy, sw, sw);
        }
        if (name === 'tile/stone-fill' && hash(col * 7919 + r * 104729) < (kind === 'stone' ? 0.22 : 0.08)) this.drawOre(c, sx, sy, ts, col * 13 + r);
      }
      if (kind === 'stone') {
        c.fillStyle = 'rgba(30,22,70,0.36)';
        c.fillRect(sx, Math.floor(L.Y(0)), sw, this.scene.Hd);
      }
    }
    if (night > 0.15) {
      c.fillStyle = `rgba(12,16,48,${0.45 * night})`;
      c.fillRect(0, L.Y(0), this.scene.Wd, this.scene.Hd);
    }
    // The bridges' ropes and posts.
    for (const [a, b] of [[ISLAND_START, ISLANDS[0][0]], [ISLANDS[0][1], ISLANDS[1][0]], [ISLANDS[1][1], ISLANDS[2][0]], [ISLANDS[2][1], ISLAND_END]]) {
      if (b < L.left || a > L.right) continue;
      c.strokeStyle = '#8a6a44';
      c.lineWidth = 2.2 * u;
      c.beginPath();
      c.moveTo(L.X(a), L.Y(-46));
      c.quadraticCurveTo(L.X((a + b) / 2), L.Y(-6), L.X(b), L.Y(-46));
      c.stroke();
      c.fillStyle = '#7b5a3c';
      for (const px of [a, b]) c.fillRect(L.X(px) - 3 * u, L.Y(-52), 6 * u, 52 * u);
    }
  }

  // The mountain the cave goes through: stepped blocks, a cliff over the doorway, the ceiling inside,
  // and the way out at the far end.
  drawMountains(c, L) {
    const x0 = MOUTH_X - 2 * T, x1 = CAVE_END + 2 * T;
    if (L.right < x0 - 6 * T || L.left > x1 + 6 * T) return;
    const u = L.u, ts = Math.ceil(T * u) + 1, topY = L.top - T;
    const DOOR = -3.6 * T, CEIL = -6 * T;
    const top = this.ground === 'snow' ? 'tile/snow-top' : this.ground === 'sand' ? 'tile/sand-top' : 'tile/grass-top';
    const tile = (name, x, y, flip) => {
      const sx = Math.floor(L.X(x)), sy = Math.floor(L.Y(y));
      if (flip) {
        c.save();
        c.translate(sx, sy + ts);
        c.scale(1, -1);
        img(c, name, 0, 0, ts, ts);
        c.restore();
      } else img(c, name, sx, sy, ts, ts);
    };
    const steps = (dir, from) => {
      [[1, -1], [2, -2], [3, -4], [4, -6]].forEach(([k, h]) => {
        const sx = dir < 0 ? from - k * T : from + (k - 1) * T;
        for (let r = h; r < 0; r++) tile(r === h ? top : 'tile/stone-fill', sx, r * T);
        c.fillStyle = 'rgba(30,40,80,0.28)';
        c.fillRect(Math.floor(L.X(sx)), Math.floor(L.Y(h * T)), ts, Math.ceil(-h * T * u) + 1);
      });
    };
    steps(-1, x0);
    steps(1, x1);
    for (let col = Math.floor(Math.max(x0, L.left) / T); col * T < Math.min(x1, L.right + T); col++) {
      const x = col * T;
      if (x < x0 || x >= x1) continue;
      const bottom = x < x0 + 3 * T || x >= x1 - 3 * T ? DOOR : CEIL;
      for (let y = bottom - T; y > topY - T; y -= T) tile('tile/stone-fill', x, y);
      tile('tile/stone-top', x, bottom - T, true);
    }
    for (let k = Math.floor(Math.max(x0 + 3 * T, L.left) / 90); k * 90 < Math.min(x1 - 3 * T, L.right); k++) {
      const sx = k * 90 + hash(k + 900) * 40;
      if (sx < x0 + 3 * T || sx > x1 - 3 * T) continue;
      const len = 22 + hash(k + 901) * 46, w = 12 + hash(k + 902) * 10;
      c.fillStyle = '#8f98aa';
      c.beginPath();
      c.moveTo(L.X(sx - w), L.Y(CEIL - 2));
      c.lineTo(L.X(sx), L.Y(CEIL + len));
      c.lineTo(L.X(sx + w), L.Y(CEIL - 2));
      c.fill();
      c.fillStyle = '#6f7789';
      c.beginPath();
      c.moveTo(L.X(sx), L.Y(CEIL - 2));
      c.lineTo(L.X(sx), L.Y(CEIL + len));
      c.lineTo(L.X(sx + w), L.Y(CEIL - 2));
      c.fill();
    }
    for (let k = Math.floor(Math.max(x0 + 4 * T, L.left - 200) / 330); k * 330 < Math.min(x1 - 4 * T, L.right + 200); k++) {
      const sx = k * 330 + 160, hue = [285, 190, 320][((k % 3) + 3) % 3];
      if (sx < x0 + 4 * T || sx > x1 - 4 * T) continue;
      const glow = 0.5 + 0.5 * Math.sin(this.time * 1.8 + k);
      c.save();
      c.translate(L.X(sx), L.Y(CEIL - 4));
      c.scale(1, -1);
      drawCrystals(c, 0, 0, u * 0.75, hue, glow);
      c.restore();
      this.glows.push({ x: L.X(sx), y: L.Y(CEIL + 22), r: 80 * u, col: `hsla(${hue},90%,65%,`, a: 0.22 + glow * 0.12 });
      this.lights.push({ x: L.X(sx), y: L.Y(CEIL + 22), r: 130 * u });
    }
  }

  drawProp(c, L, p) {
    const u = L.u, X = L.X(p.x), G = L.Y(0), t = this.time;
    const pic = (name, w, h, dy = 0) => img(c, name, X - (w * u) / 2, G - h * u + dy * u, w * u, h * u);
    switch (p.t) {
      case 'bush': pic('tile/bush', 1.15 * T, 1.15 * T, 2); break;
      case 'tuft': pic('tile/tuft', 0.8 * T, 0.8 * T, 2); break;
      case 'mushroom': pic('tile/mushroom', 0.7 * T, 0.7 * T, 2); break;
      case 'fence': img(c, 'tile/fence', X, G - T * u + 2, T * u, T * u); break;
      case 'sign': pic('tile/sign', T, T, 2); break;
      case 'crate': pic('tile/crate', 0.8 * T, 0.8 * T); break;
      case 'block': pic('tile/brick', 0.8 * T, 0.8 * T); break;
      case 'rock': pic('tile/rock', 1.1 * T, 1.1 * T, 4); break;
      case 'ladder': pic('tile/ladder', 0.9 * T, 1.8 * T); break;
      case 'snowman': drawSnowman(c, X, G, u); break;
      case 'crab': break;
      case 'corner': {
        c.fillStyle = '#f2f2f2';
        c.fillRect(X - 2 * u, G - 74 * u, 4 * u, 74 * u);
        img(c, `item/flagYellow${Math.floor(t * 4) % 2 ? '1' : '2'}`, X - 6 * u, G - 82 * u, 40 * u, 40 * u);
        break;
      }
      case 'gate': {
        const b = T * 0.8 * u;
        for (const side of [-2.6, 1.6]) for (let r = 0; r < 5; r++) img(c, 'tile/brick', X + side * b, G - (r + 1) * b, b + 0.5, b + 0.5);
        for (let k = -2.6; k < 2.6; k += 1) img(c, 'tile/brick', X + k * b, G - 6 * b, b + 0.5, b + 0.5);
        for (let k = -2.6; k < 2.6; k += 2) img(c, 'tile/brick', X + k * b, G - 7 * b, b + 0.5, b + 0.5);
        c.fillStyle = this.kit;
        c.beginPath();
        c.moveTo(X - 0.45 * b, G - 5 * b);
        c.lineTo(X + 0.45 * b, G - 5 * b);
        c.lineTo(X + 0.45 * b, G - 3.6 * b);
        c.lineTo(X, G - 3.9 * b);
        c.lineTo(X - 0.45 * b, G - 3.6 * b);
        c.closePath();
        c.fill();
        drawPiece(c, 'knight', X, G - 4.15 * b, u * 0.17, { fill: '#fff', shade: '#f0f0f0', detail: this.kit });
        break;
      }
      case 'crystal': {
        const glow = 0.5 + 0.5 * Math.sin(t * 2.2 + p.x);
        const cs = p.s || 1;
        drawCrystals(c, X, G + 2, u * cs, p.hue, glow);
        this.glows.push({ x: X, y: G - 26 * u * cs, r: 100 * u * cs, col: `hsla(${p.hue},90%,65%,`, a: 0.26 + glow * 0.16 });
        this.lights.push({ x: X, y: G - 26 * u * cs, r: 170 * u * cs });
        if (Math.random() < 0.02) this.sparkles(p.x, -40, 1, 50);
        break;
      }
      case 'pick': {
        pic('tile/rock', 1.1 * T, 1.1 * T, 4);
        c.save();
        c.translate(X + 2 * u, G - 40 * u);
        c.rotate(-0.5);
        c.fillStyle = '#a8703c';
        c.fillRect(-3.5 * u, -50 * u, 7 * u, 56 * u);
        c.fillStyle = '#c5ccd8';
        c.beginPath();
        c.moveTo(-30 * u, -40 * u);
        c.quadraticCurveTo(0, -60 * u, 30 * u, -40 * u);
        c.lineTo(30 * u, -36 * u);
        c.quadraticCurveTo(0, -50 * u, -30 * u, -36 * u);
        c.closePath();
        c.fill();
        c.restore();
        break;
      }
      case 'cart': {
        // a mine cart full of gems on a short track
        c.fillStyle = '#5b4a3a';
        c.fillRect(X - 70 * u, G - 6 * u, 140 * u, 4 * u);
        c.fillStyle = '#7d8696';
        c.beginPath();
        c.moveTo(X - 40 * u, G - 54 * u);
        c.lineTo(X + 40 * u, G - 54 * u);
        c.lineTo(X + 32 * u, G - 14 * u);
        c.lineTo(X - 32 * u, G - 14 * u);
        c.closePath();
        c.fill();
        c.fillStyle = '#626b7b';
        c.fillRect(X + 4 * u, G - 54 * u, 36 * u, 40 * u);
        for (const [gx, name] of [[-22, 'gemBlue'], [-4, 'gemRed'], [14, 'gemYellow']]) img(c, `item/${name}`, X + (gx - 9) * u, G - 68 * u, 22 * u, 18 * u);
        c.fillStyle = '#2f3542';
        for (const wx of [-24, 24]) {
          c.beginPath();
          c.arc(X + wx * u, G - 10 * u, 9 * u, 0, TAU);
          c.fill();
        }
        break;
      }
      case 'stage': this.drawStage(c, L, p); break;
      case 'lights': {
        // a spotlight tower
        c.fillStyle = '#4b4f63';
        c.fillRect(X - 3 * u, G - 210 * u, 6 * u, 210 * u);
        c.fillStyle = '#2f3240';
        c.fillRect(X - 16 * u, G - 222 * u, 32 * u, 18 * u);
        const sway = Math.sin(t * 0.9 + p.x) * 0.35;
        c.save();
        c.translate(X, G - 210 * u);
        c.rotate(sway + (p.x < ANCHORS[3] ? 0.5 : -0.5));
        const g = c.createLinearGradient(0, 0, 0, 260 * u);
        g.addColorStop(0, 'rgba(255,245,200,0.35)');
        g.addColorStop(1, 'rgba(255,245,200,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-8 * u, 0);
        c.lineTo(8 * u, 0);
        c.lineTo(70 * u, 260 * u);
        c.lineTo(-70 * u, 260 * u);
        c.fill();
        c.restore();
        break;
      }
      case 'lantern': {
        c.fillStyle = '#4b3a2c';
        c.fillRect(X - 2.5 * u, G - 96 * u, 5 * u, 96 * u);
        c.fillRect(X - 2.5 * u, G - 96 * u, 22 * u, 4 * u);
        c.fillStyle = '#ffcf6b';
        c.fillRect(X + 12 * u, G - 92 * u, 14 * u, 18 * u);
        this.glows.push({ x: X + 19 * u, y: G - 83 * u, r: 60 * u, col: 'rgba(255,200,110,', a: 0.45 });
        break;
      }
      case 'bench': this.drawBench(c, L, X, G); break;
      case 'podium': {
        // three steps of stone with the trophy on top
        const b = T * u;
        img(c, 'tile/brick', X - b * 1.5, G - b, b + 1, b + 1);
        img(c, 'tile/brick', X - b * 0.5, G - b, b + 1, b + 1);
        img(c, 'tile/brick', X + b * 0.5, G - b * 0.6, b + 1, b * 0.6 + 1);
        img(c, 'tile/brick', X - b * 2.5, G - b * 0.45, b + 1, b * 0.45 + 1);
        c.fillStyle = '#ffd23f';
        c.font = `700 ${30 * u}px "Fredoka", ui-rounded, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('1', X - b * 0.5, G - b * 0.5);
        drawTrophy(c, X + b * 0.1, G - b, u * 0.75, t);
        this.glows.push({ x: X + b * 0.1, y: G - b - 60 * u, r: 120 * u, col: 'rgba(255,220,120,', a: 0.35 });
        break;
      }
    }
  }

  drawStage(c, L, p) {
    const u = L.u, X = L.X(p.x), G = L.Y(0);
    const w = 300 * u, h = 26 * u;
    // the stage platform, a backdrop with a music note, and speakers
    c.fillStyle = '#6b4a8a';
    c.fillRect(X - w / 2, G - 230 * u, w, 204 * u);
    c.fillStyle = '#5a3c77';
    c.fillRect(X + w * 0.15, G - 230 * u, w * 0.35, 204 * u);
    c.fillStyle = '#e63946';
    c.fillRect(X - w / 2 - 10 * u, G - 244 * u, w + 20 * u, 18 * u);
    for (let k = -4; k <= 4; k++) {
      c.fillStyle = ['#ffd23f', '#ff8fab', '#7ee0ff'][((k % 3) + 3) % 3];
      const on = Math.sin(this.time * 6 + k) > 0;
      c.globalAlpha = on ? 1 : 0.45;
      c.beginPath();
      c.arc(X + k * 34 * u, G - 235 * u, 5 * u, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#8a5a34';
    c.fillRect(X - w / 2 - 20 * u, G - h, w + 40 * u, h);
    c.fillStyle = '#a8703c';
    for (let k = 0; k < 10; k++) c.fillRect(X - w / 2 - 20 * u + k * (w + 40 * u) / 10, G - h, 2 * u, h);
    for (const side of [-1, 1]) {
      const sx = X + side * (w / 2 + 8 * u);
      c.fillStyle = '#2f3240';
      c.fillRect(sx - 22 * u, G - 110 * u, 44 * u, 84 * u);
      const pulse = 1 + 0.12 * Math.max(0, Math.sin(this.time * 9.4));
      c.fillStyle = '#4b4f63';
      for (const [cy, r] of [[-82, 12], [-48, 15]]) {
        c.beginPath();
        c.arc(sx, G + cy * u, r * u * pulse, 0, TAU);
        c.fill();
      }
    }
    // a big music note on the backdrop
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(X - 12 * u, G - 110 * u, 16 * u, 0, TAU);
    c.arc(X + 34 * u, G - 122 * u, 16 * u, 0, TAU);
    c.fill();
    c.fillRect(X + 2 * u, G - 190 * u, 6 * u, 82 * u);
    c.fillRect(X + 48 * u, G - 202 * u, 6 * u, 82 * u);
    c.fillRect(X + 2 * u, G - 202 * u, 52 * u, 14 * u);
    this.glows.push({ x: X, y: G - 140 * u, r: 220 * u, col: 'rgba(255,170,220,', a: 0.18 });
  }

  drawBench(c, L, X, G) {
    const u = L.u;
    // a workbench with tools: an original design, a table and a hammer and saw
    c.fillStyle = '#8a5a34';
    c.fillRect(X - 70 * u, G - 62 * u, 140 * u, 16 * u);
    c.fillStyle = '#a8703c';
    c.fillRect(X - 70 * u, G - 62 * u, 140 * u, 5 * u);
    c.fillStyle = '#6e4626';
    c.fillRect(X - 62 * u, G - 46 * u, 12 * u, 46 * u);
    c.fillRect(X + 50 * u, G - 46 * u, 12 * u, 46 * u);
    c.fillRect(X - 62 * u, G - 22 * u, 124 * u, 6 * u);
    c.save();
    c.translate(X - 30 * u, G - 66 * u);
    c.rotate(-0.3);
    c.fillStyle = '#a8703c';
    c.fillRect(-3 * u, -34 * u, 6 * u, 34 * u);
    c.fillStyle = '#8b93a1';
    c.fillRect(-12 * u, -40 * u, 24 * u, 10 * u);
    c.restore();
    c.fillStyle = '#c5ccd8';
    c.beginPath();
    c.moveTo(X + 6 * u, G - 66 * u);
    c.lineTo(X + 52 * u, G - 66 * u);
    c.lineTo(X + 52 * u, G - 78 * u);
    c.closePath();
    c.fill();
    c.fillStyle = '#c0392b';
    c.fillRect(X + 46 * u, G - 82 * u, 14 * u, 10 * u);
    img(c, 'tile/crate', X + 80 * u, G - 46 * u, 46 * u, 46 * u);
  }

  drawFriends(c, L) {
    const u = L.u, t = this.time;
    for (const a of this.friends) {
      if (a.x < L.left - 200 || a.x > L.right + 200) continue;
      const X = L.X(a.x), G = L.Y(0);
      if (a.t === 'animal') {
        this.shadowAt(c, X, G, 18 * u);
        drawAnimal(c, a.kind, X, G, u * 0.85, Math.sin(a.walk) * 2.4, 0, a.dir < 0);
      } else if (a.t === 'crab') drawCrab(c, X, G, u * 0.8, t);
      else if (a.t === 'bat') {
        const x = a.x + Math.sin(t * 0.6 + a.ph) * 120, y = a.y + Math.sin(t * 1.3 + a.ph) * 40;
        drawBat(c, L.X(x), L.Y(y), u * 0.9, t + a.ph);
      } else if (a.t === 'mouse') {
        img(c, Math.floor(t * 10) % 2 && !a.pause ? 'critter/mouse_move' : 'critter/mouse', X - 16 * u, G - 26 * u, 32 * u, 32 * u);
      } else if (a.t === 'zombie') {
        // the friendly zombie: waves, and cheers when he scores in the cave
        const cheer = this.cheering && this.at === 2;
        const pose = cheer || Math.floor(t * 0.7) % 4 === 0 ? (Math.floor(t * 5) % 2 ? 'cheer0' : 'cheer1') : 'idle';
        this.shadowAt(c, X, G, 26 * u);
        drawCharacter(c, 'zombie', pose, null, X, G, 0.42 * u, true);
      } else if (a.t === 'dancer') {
        const beat = Math.abs(Math.sin(t * Math.PI * (this.tempo ?? 70) / 60));
        const up = beat * (this.dancing ? 16 : 6);
        if (a.kind === 'zombie') {
          drawCharacter(c, 'zombie', this.dancing ? (beat > 0.5 ? 'cheer0' : 'cheer1') : 'idle', null, X, G - 26 * u - up * u * 0.6, 0.38 * u);
        } else drawAnimal(c, a.kind, X, G - 26 * u - up * u, u * 0.8, this.dancing ? Math.sin(t * 12) * 2 : 0, 0, a.x > ANCHORS[3]);
      }
    }
  }

  shadowAt(c, x, y, r) {
    c.fillStyle = 'rgba(20,30,50,0.16)';
    c.beginPath();
    c.ellipse(x, y - 1, r, r * 0.26, 0, 0, TAU);
    c.fill();
  }

  // ---- His player, the ball, and his squad following him
  pose() {
    const p = this.player, kickAge = this.time - p.kickT;
    if (kickAge >= 0 && kickAge < 0.55) return kickAge < 0.13 ? 'walk3' : 'kick';
    if (p.cheer) return Math.floor(this.time * 4.5) % 2 ? 'cheer1' : 'cheer0';
    if (p.air) return p.vy < 0 ? 'jump' : 'fall';
    if (p.v > 25) {
      if (p.dribble || p.back) return `walk${Math.floor(p.anim) % 8}`;
      return `run${Math.floor(p.anim) % 3}`;
    }
    return 'idle';
  }

  drawPlayer(c, L) {
    const p = this.player, k = 0.5 * L.u;
    const bob = p.cheer ? Math.abs(Math.sin(this.time * 9)) * 16 : 0;
    const x = L.X(p.x), y = L.Y(p.y - bob);
    const lift = clamp(-(p.y + p.ground - bob) / 120, 0, 1);
    this.shadowAt(c, x, L.Y(-p.ground), 30 * L.u * (1 - lift * 0.5));
    c.save();
    if (!p.cheer && p.v < 25 && !p.air) {
      c.translate(x, y);
      c.scale(1, 1 + 0.012 * Math.sin(this.time * 3));
      c.translate(-x, -y);
    }
    drawCharacter(c, this.character, this.pose(), this.kit, x, y, k, p.back);
    c.restore();
  }

  drawBall(c, L) {
    const b = this.ball;
    if (b.mode === 'hidden') return;
    const x = L.X(b.x), y = L.Y(b.y), r = b.r * L.u;
    const h = clamp(-(b.y + b.r) / 300, 0, 1);
    c.fillStyle = `rgba(20,30,50,${0.2 * (1 - h)})`;
    c.beginPath();
    c.ellipse(x, L.Y(0) - 1, r * (1 - h * 0.5), r * 0.3 * (1 - h * 0.5), 0, 0, TAU);
    c.fill();
    drawBall(c, x, y, r, b.spin);
  }

  drawFollowers(c, L) {
    const col = kitPiece(this.kit);
    for (const f of this.followers) {
      if (f.x < L.left - 80 || f.x > L.right + 80) continue;
      this.shadowAt(c, L.X(f.x), L.Y(0), 16 * L.u);
      drawPiece(c, f.kind, L.X(f.x), L.Y(f.y), L.u * 0.42, col);
    }
  }

  drawParticles(c, L) {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      const x = L.X(p.x), y = L.Y(p.y), s = p.size * L.u;
      if (p.kind === 'dust') {
        c.globalAlpha = a * 0.55;
        c.fillStyle = this.ground === 'snow' ? '#ffffff' : '#efe6d2';
        c.beginPath();
        c.arc(x, y, s * (1.6 - a * 0.6), 0, TAU);
        c.fill();
      } else if (p.kind === 'confetti') {
        c.globalAlpha = Math.min(1, p.life);
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        c.scale(1, Math.abs(Math.cos(p.rot * 1.7)) * 0.8 + 0.2);
        c.fillStyle = p.color;
        c.fillRect(-s / 2, -s / 3, s, s * 0.66);
        c.restore();
      } else if (p.kind === 'spark') {
        c.globalAlpha = Math.sin(a * Math.PI);
        c.fillStyle = '#fffbe0';
        c.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 ? s * 0.18 : s * 0.5, ang = (k * TAU) / 8;
          c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        c.fill();
      } else if (p.kind === 'gem') {
        c.globalAlpha = Math.min(1, p.life * 2);
        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        img(c, p.name, -s / 2, -s * 0.42, s, s * 0.85);
        c.restore();
      }
    }
    c.lineCap = 'round';
    for (const p of this.particles) {
      if (p.kind !== 'fire') continue;
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      c.strokeStyle = p.color;
      c.lineWidth = p.size * L.u;
      c.beginPath();
      c.moveTo(L.X(p.x - p.vx * 0.06), L.Y(p.y - p.vy * 0.06));
      c.lineTo(L.X(p.x), L.Y(p.y));
      c.stroke();
      c.fillStyle = '#fffbe6';
      c.beginPath();
      c.arc(L.X(p.x), L.Y(p.y), p.size * L.u * 0.45, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // Snow in the snow world, leaves in the forest, bees in the meadow.
  drawWeather(c, L) {
    const { Wd, Hd } = this.scene;
    const inside = this.cam.cx > MOUTH_X && this.cam.cx < CAVE_END;
    if (inside) return;
    if (this.theme === 'snow') {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 70; k++) {
        const x = (hash(k) * Wd + Math.sin(this.time * 0.8 + k) * 30 * L.u - this.cam.cx * 0.3 * L.u) % Wd;
        const y = (hash(k + 50) * Hd + this.time * (40 + (k % 5) * 12) * L.u) % Hd;
        c.beginPath();
        c.arc(x < 0 ? x + Wd : x, y, (1.5 + (k % 3)) * L.u, 0, TAU);
        c.fill();
      }
    } else if (this.theme === 'forest') {
      for (let k = 0; k < 14; k++) {
        const x = ((hash(k) * Wd - this.cam.cx * 0.4 * L.u) % Wd + Wd) % Wd + Math.sin(this.time + k) * 20 * L.u;
        const y = (hash(k + 9) * Hd * 0.7 + this.time * (30 + k * 3) * L.u) % (Hd * 0.75);
        c.save();
        c.translate(x, y);
        c.rotate(this.time * 2 + k);
        c.fillStyle = k % 2 ? '#e8963a' : '#c8a13e';
        c.beginPath();
        c.ellipse(0, 0, 6 * L.u, 3 * L.u, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    } else if (this.theme === 'meadow') {
      const lane = seg('lane');
      for (let k = 0; k < 3; k++) {
        const x = lane.x0 + 150 + k * 170 + Math.cos(this.time * 0.9 + k) * 40, y = -90 + Math.sin(this.time * 1.7 + k) * 22;
        if (x < L.left - 40 || x > L.right + 40) continue;
        img(c, Math.floor(this.time * 12 + k) % 2 ? 'critter/bee' : 'critter/bee_move', L.X(x) - 14 * L.u, L.Y(y) - 14 * L.u, 28 * L.u, 28 * L.u);
      }
    }
  }

  // Light and dark: glows are added on top; in the cave a dark veil has holes cut around lights.
  drawLighting(c, L) {
    const { Wd, Hd } = this.scene;
    const [mx, ex] = this.caveSpan(L);
    if (mx < Wd && ex > 0) {
      const dk = this.dk;
      dk.globalCompositeOperation = 'source-over';
      dk.clearRect(0, 0, Wd, Hd);
      const gr = dk.createLinearGradient(mx - 30 * L.u, 0, ex + 30 * L.u, 0);
      const span = Math.max(1, ex - mx + 60 * L.u);
      const k = (330 * L.u) / span;
      gr.addColorStop(0, 'rgba(14,8,36,0)');
      gr.addColorStop(clamp(k, 0, 0.49), 'rgba(14,8,36,0.5)');
      gr.addColorStop(clamp(1 - k, 0.51, 1), 'rgba(14,8,36,0.5)');
      gr.addColorStop(1, 'rgba(14,8,36,0)');
      dk.fillStyle = gr;
      dk.fillRect(Math.max(0, mx - 30 * L.u), 0, Math.min(Wd, ex + 30 * L.u) - Math.max(0, mx - 30 * L.u), Hd);
      dk.globalCompositeOperation = 'destination-out';
      this.lights.push({ x: L.X(this.player.x), y: L.Y(this.player.y - 60), r: 300 * L.u });
      for (const l of this.lights) {
        const g = dk.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, 'rgba(0,0,0,0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dk.fillStyle = g;
        dk.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      c.drawImage(this.dark, 0, 0);
    }
    c.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const rg = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      rg.addColorStop(0, `${g.col}${g.a})`);
      rg.addColorStop(1, `${g.col}0)`);
      c.fillStyle = rg;
      c.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  drawGoalText(c) {
    const age = this.time - this.goalText;
    if (age < 0 || age > 2.1) return;
    const { Wd, Hd, S, DPR } = this.scene;
    const s = age < 0.38 ? easeBack(age / 0.38) : 1 + 0.03 * Math.sin(age * 8);
    const a = age > 1.7 ? 1 - (age - 1.7) / 0.4 : 1;
    const sz = Math.min(Wd * 0.21, 104 * S * DPR);
    c.save();
    c.globalAlpha = a;
    c.translate(Wd / 2, this.cam.gy * Hd * 0.36);
    c.rotate(-0.06 + Math.sin(age * 5) * 0.03);
    c.scale(s, s);
    c.font = `700 ${sz}px "Fredoka", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = sz * 0.18;
    c.strokeStyle = '#1f2a37';
    c.strokeText('GOAL!', 0, 0);
    const gr = c.createLinearGradient(0, -sz * 0.45, 0, sz * 0.45);
    gr.addColorStop(0, '#fffbe0');
    gr.addColorStop(1, '#ffc23c');
    c.fillStyle = gr;
    c.fillText('GOAL!', 0, 0);
    c.restore();
  }
}

const STAND = { SEG: 600, AD: 30, ROW: 21, ROWS: 8, SEAT: 15, ROOF: 24, AISLES: [135, 435] };
STAND.DECK = STAND.AD + STAND.ROWS * STAND.ROW;
STAND.TOP = STAND.DECK + STAND.ROOF;
const CASTLE = { BT: 28, WALL: 6, TOWER: 11 };
CASTLE.W = 20 * CASTLE.BT;
CASTLE.ROOFH = 2.4 * CASTLE.BT;
const CASTLE_PIECES = [
  ['rook', 3150, 1], ['knight', 3480, 0], ['pawn', 3640, 1], ['bishop', 4230, 0], ['queen', 4420, 1], ['king', 4610, 0],
  ['knight', 4800, 1], ['rook', 4990, 0],
].map(([kind, x, dark], i) => ({ kind, x, dark, phase: hash(i + 40) * 6, period: 4.5 + hash(i + 50) * 3 }));
