// The game "skins". Balloons, Monster and Rocket draw the answers as part of their world and
// celebrate right answers their own way; the play screen does everything else. Long answers
// (sentences) are shown as cards by the play screen, and the skin just plays its reward.
// Chess (chess-ui.js) is a real game of chess: each right answer earns a move.
import { sfx } from './sfx.js';
import { optionInner, maxLabel, wait, burst, centerIn, fitLabels } from './ui.js';
import { ChessGame } from './chess-ui.js';

const COLORS = ['#ff6b6b', '#4dabf7', '#ffa94d', '#51cf66', '#9775fa', '#f783ac', '#f7c531', '#20c997'];

class Skin {
  constructor(stage, { onPick }) { this.stage = stage; this.onPick = onPick; this.els = []; this.round = 0; }
  handles(item) {
    if (item.kind !== 'choice') return false;
    if (item.layout === 'picture' || item.layout === 'short') return true;
    return item.layout === 'word' && maxLabel(item) <= this.maxWord;
  }
  bind(el, i) {
    el.addEventListener('click', () => { if (!el.disabled && !el.classList.contains('wrong')) this.onPick(i); });
  }
  size(n) {
    const r = this.stage.getBoundingClientRect();
    return Math.max(70, Math.min(160, Math.min(r.width / (n + 0.7), r.height * 0.42)));
  }
  markWrong(i) { const el = this.els[i]; if (!el) return; el.classList.add('wrong'); el.disabled = true; }
  reveal(i) { this.els[i]?.classList.add('reveal'); }
  async neutral(i) { this.els[i]?.classList.add('picked'); sfx.soft(); await wait(380); this.clear(); }
  lock() { this.els.forEach((e) => { e.disabled = true; }); }
  clear() { this.els.forEach((e) => e.remove()); this.els = []; }
  progress() {}
  destroy() { this.stage.innerHTML = ''; }
}

// ------------------------------------------------------------------ Balloon Pop
class Balloons extends Skin {
  maxWord = 8;
  start() {
    this.stage.innerHTML = `<div class="scene sky"><div class="sun"></div><div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div><div class="hills"></div><div class="layer"></div><div class="fx"></div></div>`;
    this.layer = this.stage.querySelector('.layer');
    this.fx = this.stage.querySelector('.fx');
  }
  show(item) {
    this.clear();
    const n = item.options.length, sz = this.size(n);
    this.layer.style.setProperty('--bw', sz + 'px');
    item.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'balloon';
      b.style.setProperty('--c', COLORS[(i + this.round * 3) % COLORS.length]);
      b.style.left = ((i + 0.5) / n) * 100 + '%';
      b.style.top = (n > 2 ? (i % 2 ? 34 : 14) : 22) + Math.random() * 6 + '%';
      b.style.setProperty('--d', i * 0.1 + 's');
      b.style.setProperty('--bob', 2.4 + Math.random() * 1.4 + 's');
      b.innerHTML = `<span class="b-body">${optionInner(o)}</span><span class="b-knot"></span><span class="b-string"></span>`;
      this.bind(b, i);
      this.layer.appendChild(b);
      this.els.push(b);
    });
    this.round++;
    fitLabels(this.stage);
  }
  async markRight(i) {
    const el = this.els[i];
    sfx.pop();
    const c = centerIn(el.querySelector('.b-body'), this.fx);
    burst(this.fx, c.x, c.y, { n: 18 });
    el.classList.add('popped');
    this.els.forEach((e, j) => { if (j !== i) e.classList.add('flyaway'); });
    await wait(700);
    this.clear();
  }
  async reward() {
    const r = this.fx.getBoundingClientRect();
    sfx.pop();
    burst(this.fx, r.width * (0.3 + Math.random() * 0.4), r.height * 0.4, { n: 18 });
    await wait(500);
  }
  async finish() {
    sfx.win();
    for (let k = 0; k < 10; k++) {
      const b = document.createElement('div');
      b.className = 'balloon deco rise';
      b.style.setProperty('--c', COLORS[k % COLORS.length]);
      b.style.left = 5 + Math.random() * 90 + '%';
      b.style.setProperty('--d', k * 0.08 + 's');
      b.innerHTML = '<span class="b-body"></span><span class="b-knot"></span><span class="b-string"></span>';
      this.layer.appendChild(b);
    }
    await wait(1800);
  }
}

// ------------------------------------------------------------------ Monster Munch
const MONSTER_SVG = `<svg viewBox="0 0 200 170" class="monster-svg">
  <g class="m-body"><path d="M 30 160 Q 10 60 100 30 Q 190 60 170 160 Z" fill="var(--mc)" stroke="#2b2d42" stroke-width="5"/>
  <path d="M 62 44 L 48 8 L 80 34 Z M 138 44 L 152 8 L 120 34 Z" fill="var(--mc2)" stroke="#2b2d42" stroke-width="4" stroke-linejoin="round"/>
  <g class="eyes"><circle cx="72" cy="72" r="20" fill="#fff" stroke="#2b2d42" stroke-width="4"/><circle cx="128" cy="72" r="20" fill="#fff" stroke="#2b2d42" stroke-width="4"/>
  <circle class="pupil" cx="76" cy="76" r="8" fill="#2b2d42"/><circle class="pupil" cx="124" cy="76" r="8" fill="#2b2d42"/></g>
  <path class="happy-eyes" d="M 56 76 Q 72 58 88 76 M 112 76 Q 128 58 144 76" fill="none" stroke="#2b2d42" stroke-width="6" stroke-linecap="round"/>
  <g class="mouth-open"><path d="M 60 112 Q 100 160 140 112 Z" fill="#7a1f3d" stroke="#2b2d42" stroke-width="5" stroke-linejoin="round"/><path d="M 72 114 L 80 126 L 88 116 M 112 116 L 120 126 L 128 114" fill="#fff"/><ellipse cx="100" cy="138" rx="16" ry="7" fill="#ff8fab"/></g>
  <path class="mouth-shut" d="M 64 122 Q 100 140 136 122" fill="none" stroke="#2b2d42" stroke-width="6" stroke-linecap="round"/>
  <g class="tongue"><path d="M 66 120 Q 100 132 134 120" fill="none" stroke="#2b2d42" stroke-width="6" stroke-linecap="round"/><path d="M 92 126 Q 100 150 110 126" fill="#ff8fab" stroke="#2b2d42" stroke-width="4"/></g>
  <circle cx="44" cy="108" r="9" fill="#ff8fab" opacity=".6"/><circle cx="156" cy="108" r="9" fill="#ff8fab" opacity=".6"/></g></svg>`;
const FOODS = ['🍪', '🍩', '🧁', '🍓', '🍎', '🍕', '🍉', '🥕', '🍌', '🧀'];
class Monster extends Skin {
  maxWord = 7;
  start() {
    this.stage.innerHTML = `<div class="scene kitchen"><div class="layer"></div><div class="monster">${MONSTER_SVG}</div><div class="table"></div><div class="fx"></div></div>`;
    this.layer = this.stage.querySelector('.layer');
    this.monster = this.stage.querySelector('.monster');
    this.fx = this.stage.querySelector('.fx');
    const hue = Math.floor(Math.random() * 360);
    this.monster.style.setProperty('--mc', `hsl(${hue} 70% 62%)`);
    this.monster.style.setProperty('--mc2', `hsl(${(hue + 40) % 360} 80% 70%)`);
  }
  show(item) {
    this.clear();
    this.monster.classList.remove('happy', 'yuck');
    const n = item.options.length, sz = this.size(n) * 0.95;
    this.layer.style.setProperty('--pw', sz + 'px');
    item.options.forEach((o, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const p = document.createElement('button');
      p.className = 'plate';
      p.style.left = `calc(${sz / 2 + 8}px + (100% - ${sz + 16}px) * ${t})`;
      p.style.top = (n > 2 ? 6 + Math.abs(t - 0.5) * 30 : 14) + '%';
      p.style.setProperty('--d', i * 0.08 + 's');
      p.innerHTML = `<span class="food">${FOODS[(i + this.round * 2) % FOODS.length]}</span><span class="dish">${optionInner(o)}</span>`;
      this.bind(p, i);
      this.layer.appendChild(p);
      this.els.push(p);
    });
    this.round++;
    fitLabels(this.stage);
  }
  async eat(el) {
    const m = this.monster.getBoundingClientRect(), e = el.getBoundingClientRect();
    el.style.setProperty('--tx', m.left + m.width / 2 - (e.left + e.width / 2) + 'px');
    el.style.setProperty('--ty', m.top + m.height * 0.62 - (e.top + e.height / 2) + 'px');
    el.classList.add('eaten');
    await wait(420);
    sfx.chomp();
    this.monster.classList.add('chomp', 'happy');
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y - 40, { n: 8, chars: ['💖', '✨', '💛'], spread: 90 });
    await wait(650);
    this.monster.classList.remove('chomp');
  }
  async markRight(i) {
    this.els.forEach((e, j) => { if (j !== i) e.classList.add('fade'); });
    await this.eat(this.els[i]);
    this.clear();
  }
  markWrong(i) {
    super.markWrong(i);
    this.monster.classList.add('yuck');
    setTimeout(() => this.monster.classList.remove('yuck'), 900);
  }
  async neutral(i) {
    this.els.forEach((e, j) => { if (j !== i) e.classList.add('fade'); });
    await this.eat(this.els[i]);
    this.monster.classList.remove('happy');
    this.clear();
  }
  async reward() {
    const p = document.createElement('div');
    p.className = 'plate deco';
    p.style.left = '50%'; p.style.top = '8%';
    p.innerHTML = `<span class="food big">${FOODS[Math.floor(Math.random() * FOODS.length)]}</span>`;
    this.layer.appendChild(p);
    await wait(60);
    await this.eat(p);
    p.remove();
  }
  async finish() {
    sfx.win();
    this.monster.classList.add('dance', 'happy');
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y - 30, { n: 22, spread: 170 });
    await wait(1800);
  }
}

// ------------------------------------------------------------------ Rocket Ride
class Rocket extends Skin {
  maxWord = 6;
  start(total) {
    this.total = total || 10;
    this.step = 0;
    this.stage.innerHTML = `<div class="scene space"><div class="stars s1"></div><div class="stars s2"></div><div class="planet p1"></div><div class="planet p2"></div><div class="moon"></div>
      <div class="rocket"><div class="flame"></div><div class="ship">🚀</div></div><div class="alt"><div class="alt-fill"></div></div><div class="layer"></div><div class="fx"></div></div>`;
    this.layer = this.stage.querySelector('.layer');
    this.rocket = this.stage.querySelector('.rocket');
    this.scene = this.stage.querySelector('.scene');
    this.fx = this.stage.querySelector('.fx');
    this.setAlt();
  }
  setAlt() {
    const f = Math.min(1, this.step / this.total);
    this.rocket.style.bottom = 6 + f * 52 + '%';
    this.scene.style.setProperty('--scroll', this.step * 60 + 'px');
    this.stage.querySelector('.alt-fill').style.height = f * 100 + '%';
  }
  show(item) {
    this.clear();
    const n = item.options.length, sz = this.size(n) * 0.92;
    this.layer.style.setProperty('--ow', sz + 'px');
    const slots = n <= 2 ? [[40, 30], [76, 52]] : n === 3 ? [[34, 22], [74, 26], [56, 60]] : [[34, 18], [74, 18], [36, 60], [76, 60]];
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
  async boost() {
    sfx.boost();
    this.rocket.classList.add('boost');
    this.step++;
    this.setAlt();
    await wait(700);
    this.rocket.classList.remove('boost');
  }
  async markRight(i) {
    const el = this.els[i];
    const r = this.rocket.getBoundingClientRect(), e = el.getBoundingClientRect();
    el.style.setProperty('--tx', r.left + r.width / 2 - (e.left + e.width / 2) + 'px');
    el.style.setProperty('--ty', r.top + r.height / 2 - (e.top + e.height / 2) + 'px');
    el.classList.add('collected');
    this.els.forEach((x, j) => { if (j !== i) x.classList.add('fade'); });
    await wait(380);
    sfx.star();
    this.clear();
    await this.boost();
  }
  async neutral(i) { await this.markRight(i); }
  async reward() { await this.boost(); }
  async finish() {
    this.scene.classList.add('landed');
    sfx.win();
    const c = centerIn(this.stage.querySelector('.moon'), this.fx);
    burst(this.fx, c.x, c.y, { n: 24, spread: 160, chars: ['⭐', '✨', '🌟'] });
    await wait(1900);
  }
}

export const GAMES = {
  balloons: { name: 'Balloon Pop', icon: '🎈', make: (stage, o) => new Balloons(stage, o) },
  chess: { name: 'Chess', icon: '♞', make: (stage, o) => new ChessGame(stage, o) },
  monster: { name: 'Monster Munch', icon: '🍪', make: (stage, o) => new Monster(stage, o) },
  rocket: { name: 'Rocket Ride', icon: '🚀', make: (stage, o) => new Rocket(stage, o) },
};
export { MONSTER_SVG };
