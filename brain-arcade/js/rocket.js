// Rocket Ride: a trip across a star map (space.js has the rules, space-art.js the drawings). The
// answers are fuel orbs; a right one flies into the rocket, and then the child steers it for a few
// seconds (drag anywhere), grabbing stars and dodging rocks. Enough fuel reaches the next stop,
// where an alien friend says hello and tells a true fact (pretend planets say so), and joins the
// child's map (🗺️). The trip is saved between rounds. During a level check every answer is fuel.
import { sfx } from './sfx.js';
import { speak } from './speech.js';
import { burst, centerIn, fitLabels, optionInner, esc } from './ui.js';
import { Skin, Waits, COLORS } from './skin.js';
import { store } from './store.js';
import { STOPS, PRETEND, loadTrip, target, from, addFuel, pilotAfter, flightPlan } from './space.js';
import { ROCKET_SVG, planetSVG, alienSVG } from './space-art.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

function starSprite(px) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d'), r = px / 2;
  g.translate(r, r);
  const glow = g.createRadialGradient(0, 0, 0, 0, 0, r);
  glow.addColorStop(0, 'rgba(255,236,153,.9)'); glow.addColorStop(0.45, 'rgba(255,212,59,.35)'); glow.addColorStop(1, 'rgba(255,212,59,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.26 : r * 0.62; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath();
  g.fillStyle = '#ffd43b'; g.fill();
  g.lineWidth = px * 0.035; g.strokeStyle = '#e67700'; g.stroke();
  return c;
}
function rockSprite(px, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d'), r = px / 2;
  g.translate(r, r);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.beginPath();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, rr = r * (0.72 + rnd() * 0.2); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  g.closePath();
  const fill = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
  fill.addColorStop(0, '#adb5bd'); fill.addColorStop(1, '#5c636a');
  g.fillStyle = fill; g.fill();
  g.lineWidth = px * 0.05; g.strokeStyle = '#2b2d42'; g.lineJoin = 'round'; g.stroke();
  g.fillStyle = 'rgba(43,45,66,.35)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc((rnd() - 0.5) * r * 0.9, (rnd() - 0.5) * r * 0.9, r * (0.1 + rnd() * 0.12), 0, TAU); g.fill(); }
  return c;
}
let sprites = null;
const getSprites = () => (sprites ||= { star: starSprite(96), rocks: [11, 23, 37].map((k) => rockSprite(120, k)) });

export class RocketGame extends Skin {
  maxWord = 6;
  constructor(stage, opts) {
    super(stage, opts);
    this.turnEveryAnswer = true; // play.js: during a level check every answer is fuel
    this.w = new Waits();
    this.phase = 'start';
    this.coverOpen = null;
    this.playEl = opts.playEl;
    this.flying = false;
  }
  get small() { return (this.player?.grade ?? 1) < 0; }
  say(text, always = false) { if (always || (this.player?.grade ?? 1) < 1 || this.player?.settings?.readAloud === 'always') speak(text); }

  async start() {
    this.trip = loadTrip(this.player);
    this.stage.innerHTML = `<div class="scene space rtrip"><div class="stars s1"></div><div class="stars s2"></div>
      <div class="rdest"></div>
      <div class="rbar"><span class="rb-from"></span><span class="rb-pips"></span><span class="rb-to"></span></div>
      <canvas class="rfly"></canvas>
      <div class="rship">${ROCKET_SVG}</div>
      <div class="layer"></div>
      <div class="rdust" aria-label="Stars grabbed"><b>★</b><span>0</span></div>
      <button class="mbtn rmap" aria-label="Space map">🗺️</button>
      <div class="rhint hidden">👆 Drag to steer!</div>
      <div class="mbanner hidden"></div><div class="fx"></div></div>`;
    const q = (s) => this.stage.querySelector(s);
    this.scene = q('.scene');
    this.layer = q('.layer');
    this.dest = q('.rdest');
    this.ship = q('.rship');
    this.canvas = q('.rfly');
    this.g = this.canvas.getContext('2d');
    this.fx = q('.fx');
    this.bannerEl = q('.mbanner');
    this.hint = q('.rhint');
    this.dustEl = q('.rdust span');
    q('.rmap').addEventListener('click', () => this.map());
    this.bindSteering();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.scene);
    this.drawTrip();
    this.dustEl.textContent = this.trip.dust;
    if (window.__BA_TEST) window.__BA_TEST.rocket = { phase: () => this.phase, flying: () => this.flying, trip: () => JSON.parse(JSON.stringify(this.trip)), objects: () => this.objectsOnScreen(), ship: () => this.shipBox() };
    if (!this.trip.flights && !this.trip.friends.length) await this.intro();
    else { const s = target(this.trip); this.banner(`Next stop: ${s.short || s.name}! ${s.dist - this.trip.fuel} more fuel.`, 2600); }
    if (!this.w.aborted) this.phase = 'play';
  }
  resize() {
    const r = this.scene.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    if (!this.flying && this.phase !== 'arrive') this.park();
  }
  // The rocket is placed by script (its centre at x, y in the scene); glide animates the move.
  shipAt(x, y, glide = false) {
    this.ship.classList.toggle('glide', glide);
    this.ship.style.transform = `translate(${Math.round(x - this.ship.offsetWidth / 2)}px, ${Math.round(y - this.ship.offsetHeight / 2)}px)`;
  }
  park(glide = false) { this.shipAt(Math.max(this.ship.offsetWidth * 0.7, this.W * 0.11), this.H * 0.8, glide); } // waiting at the bottom left

  // ------------------------------------------------------------ the trip so far
  drawTrip() {
    const t = this.trip, s = target(t), f = from(t);
    const pips = Array.from({ length: s.dist }, (_, i) => `<i class="${i < t.fuel ? 'on' : ''}"></i>`).join('');
    this.stage.querySelector('.rb-from').innerHTML = f ? planetSVG(f.id, { cls: 'mini' }) : '<span class="rb-earth">🌍</span>';
    this.stage.querySelector('.rb-pips').innerHTML = pips;
    this.stage.querySelector('.rb-to').innerHTML = `${planetSVG(s.id, { cls: 'mini' })}<b>${esc(s.short || s.name)}</b>`;
    if (this.dest.dataset.id !== s.id) { this.dest.innerHTML = planetSVG(s.id); this.dest.dataset.id = s.id; }
    this.dest.style.setProperty('--near', (t.fuel / s.dist).toFixed(3)); // the planet grows as the rocket gets close
  }
  banner(text, ms = 2200) {
    const b = this.bannerEl;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.add('hidden'), ms);
  }
  cover(html) {
    const el = document.createElement('div');
    el.className = 'cover rcover';
    el.innerHTML = html;
    this.scene.appendChild(el);
    this.coverOpen = el;
    this.playEl?.classList.add('cover-open'); // the question card steps aside so the panel has room (phones)
    return el;
  }
  closeCover(el) { el.remove(); if (this.coverOpen === el) { this.coverOpen = null; this.playEl?.classList.remove('cover-open'); } }
  tapIn(el, sel) {
    return this.w.until((done) => el.addEventListener('click', (e) => { const b = e.target.closest(sel); if (b && !b.disabled) { sfx.tap(); done(b); } }));
  }
  async intro() {
    this.phase = 'intro';
    const s = target(this.trip);
    const c = this.cover(`<div class="cpanel rpanel"><div class="rp-art">${planetSVG(s.id)}<div class="rp-ship">${ROCKET_SVG}</div></div><h2>Let's fly to ${esc(s.name)}!</h2>
      <p>Every answer fills your rocket with fuel. Then steer: grab the stars ★ and dodge the rocks!</p><button class="btn primary big r-ok">Blast off! 🚀</button></div>`);
    this.say(`Let's fly to ${s.name}! Every answer fills your rocket with fuel. Then steer: grab the stars, and dodge the rocks!`);
    await this.tapIn(c, '.r-ok');
    this.closeCover(c);
  }

  // ------------------------------------------------------------ answers: fuel orbs
  show(item) {
    this.clear();
    this.bannerEl.classList.add('hidden');
    const n = item.options.length, sz = this.size(n) * 0.92;
    this.layer.style.setProperty('--ow', sz + 'px');
    const slots = n <= 2 ? [[44, 34], [78, 56]] : n === 3 ? [[38, 26], [78, 30], [60, 64]] : [[38, 24], [78, 24], [40, 64], [80, 64]];
    item.options.forEach((o, i) => {
      const s = document.createElement('button');
      s.className = 'orb';
      s.style.setProperty('--c', COLORS[(i + this.round) % COLORS.length]);
      s.style.left = slots[i][0] + '%';
      s.style.top = slots[i][1] + '%';
      s.style.setProperty('--d', i * 0.1 + 's');
      s.innerHTML = `<span class="orb-in">${optionInner(o)}</span>`;
      this.bind(s, i);
      this.layer.appendChild(s);
      this.els.push(s);
    });
    this.round++;
    fitLabels(this.stage);
  }
  async fuelUp(el, secs) {
    if (this.w.aborted || !el) return;
    this.busy = true;
    const r = this.ship.getBoundingClientRect(), e = el.getBoundingClientRect();
    el.style.setProperty('--tx', r.left + r.width / 2 - (e.left + e.width / 2) + 'px');
    el.style.setProperty('--ty', r.top + r.height / 2 - (e.top + e.height / 2) + 'px');
    el.classList.add('collected');
    this.els.forEach((x) => { if (x !== el) x.classList.add('fade'); });
    await this.w.sleep(380);
    this.clear();
    sfx.star();
    await this.fly(secs);
    if (this.w.aborted) return;
    const res = addFuel(this.trip);
    store.saveSoon();
    if (res.arrived) { // keep showing the stop just reached (with a full fuel line) until the hello is over
      this.stage.querySelectorAll('.rb-pips i').forEach((i) => i.classList.add('on'));
      this.dest.style.setProperty('--near', '1');
      await this.arrive(res.arrived, res.friend);
    } else this.drawTrip();
    this.busy = false;
  }
  markRight(i, { tries = 0 } = {}) { return this.fuelUp(this.els[i], tries ? 3.5 : 5); }
  neutral(i) { return this.fuelUp(this.els[i], 5); }
  async reward({ tries = 0 } = {}) {
    if (this.w.aborted) return;
    this.clear();
    const s = document.createElement('div');
    s.className = 'orb deco';
    s.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
    s.style.left = '58%'; s.style.top = '40%';
    s.innerHTML = '<span class="orb-in"><span class="o-emoji">⛽</span></span>';
    this.layer.appendChild(s);
    this.els = [s];
    await this.w.sleep(450);
    await this.fuelUp(s, tries ? 3.5 : 5);
  }

  // ------------------------------------------------------------ a flight: steer for a few seconds
  bindSteering() {
    const set = (e) => { const r = this.canvas.getBoundingClientRect(); this.aimX = e.clientX - r.left; this.steered = true; };
    this.canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); try { this.canvas.setPointerCapture(e.pointerId); } catch { /* fine */ } this.down = true; set(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.down || e.pointerType === 'mouse') set(e); });
    const up = () => { this.down = false; };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }
  shipBox() { const r = this.ship.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  objectsOnScreen() {
    const r = this.canvas.getBoundingClientRect();
    return (this.objs || []).filter((o) => !o.gone && o.y > 0 && o.y < this.H).map((o) => ({ kind: o.kind, x: r.left + o.x, y: r.top + o.y, r: o.r }));
  }
  async fly(secs) {
    if (this.w.aborted) return;
    const fast = !!window.__BA_TEST?.fast;
    const plan = flightPlan(this.trip.pilot, { secs: secs * (fast ? 0.3 : 1), small: this.small });
    const W = this.W, H = this.H, m = Math.min(W, H);
    this.flying = true;
    this.phase = 'fly';
    this.scene.classList.add('flying');
    this.canvas.classList.add('live');
    const showHint = this.trip.flights < 2 && !fast;
    this.hint.classList.toggle('hidden', !showHint);
    // the rocket moves to the middle, low down; a finger anywhere moves it sideways
    const shipW = this.ship.offsetWidth || 60;
    this.shipX = W / 2; this.aimX = W / 2; this.steered = false;
    const shipY = H * 0.8;
    this.ship.classList.add('flight');
    this.shipAt(this.shipX, shipY, true);
    await this.w.sleep(fast ? 120 : 380);
    const sp = getSprites();
    const starR = Math.max(16, m * 0.04) * (this.small ? 1.25 : 1);
    const rockR = Math.max(20, m * 0.055);
    const speed = plan.speed * H;
    const spawnFor = Math.max(0.5, plan.secs - (shipY + rockR) / speed); // the last things spawned still reach the rocket
    // stars come in little lines; rocks in between
    const objs = [];
    let t = 0.2;
    for (let k = 0; k < plan.stars;) {
      const x = rand(starR + 10, W - starR - 10), n = Math.min(plan.stars - k, 1 + Math.floor(Math.random() * 3));
      const dx = n > 1 ? rand(-1, 1) * starR * 1.4 : 0;
      for (let j = 0; j < n; j++) objs.push({ kind: 'star', x: Math.max(starR, Math.min(W - starR, x + dx * j)), at: t + j * (starR * 2.4) / speed, r: starR });
      k += n;
      t += spawnFor / Math.ceil(plan.stars / 2);
    }
    for (let k = 0; k < plan.rocks; k++) {
      const at = 0.4 + (k + Math.random() * 0.6) * (spawnFor - 0.4) / Math.max(1, plan.rocks);
      let x = rand(rockR, W - rockR);
      for (let tries = 0; tries < 8 && objs.some((o) => o.kind === 'star' && Math.abs(o.at - at) * speed < rockR * 3 && Math.abs(o.x - x) < rockR * 2.2); tries++) x = rand(rockR, W - rockR);
      objs.push({ kind: 'rock', x, at, r: rockR, spin: rand(-2, 2), img: sp.rocks[k % 3] });
    }
    objs.forEach((o) => { o.y = -o.r; o.gone = false; });
    this.objs = objs;
    const score = { stars: 0, of: plan.stars, bumps: 0 };
    let chain = 0, lastStar = 0;
    const shipR = shipW * 0.36;
    await this.w.until((done) => {
      let prev = performance.now(), clock = 0;
      const loop = (now) => {
        if (this.w.aborted) { done(false); return; }
        const dt = Math.min(0.05, (now - prev) / 1000);
        prev = now;
        clock += dt;
        this.shipX += (this.aimX - this.shipX) * (1 - Math.exp(-11 * dt));
        this.shipX = Math.max(shipW / 2, Math.min(W - shipW / 2, this.shipX));
        this.shipAt(this.shipX, shipY);
        for (const o of objs) {
          if (o.gone || clock < o.at) continue;
          o.y = -o.r + (clock - o.at) * speed;
          const d = Math.hypot(o.x - this.shipX, o.y - shipY);
          if (o.kind === 'star' && d < o.r + shipR + 14) {
            o.gone = true; score.stars++;
            chain = now - lastStar < 900 ? chain + 1 : 0; lastStar = now;
            sfx.bubble(chain + 2);
            this.trip.dust++; this.dustEl.textContent = this.trip.dust;
            this.burstAt(o.x, o.y, ['✨', '⭐']);
          } else if (o.kind === 'rock' && d < o.r * 0.8 + shipR * 0.8 && !o.hit) {
            o.hit = true; score.bumps++;
            sfx.bump();
            this.ship.classList.remove('bonk'); void this.ship.offsetWidth; this.ship.classList.add('bonk');
          }
          if (o.y > H + o.r) o.gone = true;
        }
        this.drawObjs(objs, clock, sp);
        if (clock >= plan.secs) { done(true); return; }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
    cancelAnimationFrame(this.raf);
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.objs = [];
    this.hint.classList.add('hidden');
    this.canvas.classList.remove('live');
    this.scene.classList.remove('flying');
    this.ship.classList.remove('flight', 'bonk');
    this.down = false;
    this.flying = false;
    this.lastFlight = score;
    if (!this.w.aborted) { pilotAfter(this.trip, score); if (window.__BA_TEST) (window.__BA_TEST.flights ||= []).push({ ...score, steered: this.steered }); }
    this.phase = 'play';
    this.park(true);
  }
  burstAt(x, y, chars) {
    const r = this.canvas.getBoundingClientRect(), f = this.fx.getBoundingClientRect();
    burst(this.fx, x + r.left - f.left, y + r.top - f.top, { n: 5, chars, spread: 50 });
  }
  drawObjs(objs, clock, sp) {
    const g = this.g, s = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    for (const o of objs) {
      if (o.gone || clock < o.at) continue;
      g.save();
      g.translate(o.x, o.y);
      if (o.kind === 'star') { const k = 1 + 0.12 * Math.sin(clock * 8 + o.x); g.scale(k, k); g.drawImage(sp.star, -o.r * 1.5, -o.r * 1.5, o.r * 3, o.r * 3); }
      else { g.rotate(clock * o.spin); g.globalAlpha = o.hit ? 0.5 : 1; g.drawImage(o.img, -o.r, -o.r, o.r * 2, o.r * 2); }
      g.restore();
    }
  }

  // ------------------------------------------------------------ arriving at a stop
  async arrive(stop, friend) {
    this.phase = 'arrive';
    this.scene.classList.add('arriving');
    this.shipAt(this.W / 2, this.H * 0.62, true);
    sfx.win();
    const c = centerIn(this.dest, this.fx);
    burst(this.fx, c.x, c.y, { n: 24, spread: 170, chars: ['⭐', '✨', '🌟'] });
    await this.w.sleep(1300);
    if (this.w.aborted) return;
    const hi = `Hi! I'm ${friend.name}!`;
    const cv = this.cover(`<div class="cpanel rpanel"><div class="rp-art">${planetSVG(stop.id)}<div class="rp-alien">${alienSVG(friend)}</div></div>
      <h2>You made it to ${esc(stop.name)}!</h2><p class="rp-hi">“${esc(hi)}”</p><p class="rp-fact">${esc(stop.fact)}</p>
      <p class="mp-note">${esc(friend.name)} joined your space map 🗺️</p><button class="btn primary big r-ok">Hooray! 🎉</button></div>`);
    speak(`${hi} ${stop.fact}`);
    await this.tapIn(cv, '.r-ok');
    this.closeCover(cv);
    this.scene.classList.remove('arriving');
    this.park(true);
    const next = target(this.trip);
    this.drawTrip();
    this.banner(`Next stop: ${next.short || next.name}!`, 2400);
    this.phase = 'play';
  }

  // ------------------------------------------------------------ the space map
  async map() {
    if (this.coverOpen || this.busy) return;
    const back = this.phase;
    this.phase = 'map';
    const t = this.trip;
    const met = new Map(t.friends.map((f) => [`${f.stop}:${f.lap}`, f]));
    const tiles = STOPS.map((s, i) => {
      const f = met.get(`${s.id}:${t.lap}`) || (t.lap > 1 && i < PRETEND ? met.get(`${s.id}:1`) : null);
      const here = i === t.leg;
      const known = f || here || i <= t.leg + 1 || (t.lap > 1 && i < PRETEND);
      return `<div class="rm-stop${here ? ' here' : ''}${f ? ' met' : ''}${s.pretend && known ? ' pretend' : ''}">
        <div class="rm-pl">${known ? planetSVG(s.id, { cls: 'mini' }) : '<span class="rm-q">?</span>'}${f ? `<span class="rm-al">${alienSVG(f, { cls: 'mini' })}</span>` : ''}</div>
        <b>${known ? esc(s.short || s.name) : '???'}</b>${f ? `<i>${esc(f.name)}</i>` : here ? `<i>🚀 ${t.fuel}/${s.dist}</i>` : s.pretend && known ? '<i>pretend</i>' : ''}</div>`;
    }).join('');
    const c = this.cover(`<div class="cpanel rpanel rmap-panel"><h2>🗺️ Space map${t.lap > 1 ? ` · trip ${t.lap}` : ''}</h2>
      <p class="mp-note">${t.friends.length} friend${t.friends.length === 1 ? '' : 's'} met · ★ ${t.dust} stars grabbed</p>
      <div class="rm-stops">${tiles}</div><button class="btn primary big r-ok">Back</button></div>`);
    sfx.tap();
    await this.tapIn(c, '.r-ok');
    this.closeCover(c);
    this.phase = back;
  }

  abort() { this.w.abort(); }
  async finish() {
    const s = target(this.trip);
    sfx.win();
    const c = centerIn(this.ship, this.fx);
    burst(this.fx, c.x, c.y, { n: 16, spread: 140, chars: ['⭐', '✨', '🌟'] });
    this.banner(this.trip.fuel ? `${s.dist - this.trip.fuel} more fuel to ${s.short || s.name}!` : `Next stop: ${s.short || s.name}!`, 2400);
    await this.w.sleep(1900);
  }
  destroy() {
    this.w.abort();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.bannerT);
    this.ro?.disconnect();
    if (window.__BA_TEST?.rocket) delete window.__BA_TEST.rocket;
    super.destroy();
  }
}
