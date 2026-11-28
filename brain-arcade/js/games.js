// The games. Each draws the answers as part of its world and plays its own game around them;
// the play screen (play.js) does everything else. Long answers (sentences) are shown as cards by
// the play screen, and the game just plays its reward.
// Balloon Pop (balloons.js): a right balloon lets out bubbles to pop.
// Chess (chess-ui.js): a real game of chess, each right answer earns a move.
// Monster Munch (monster.js): a pet monster to raise, fed by right answers.
import { sfx } from './sfx.js';
import { optionInner, wait, burst, centerIn, fitLabels } from './ui.js';
import { Skin, COLORS } from './skin.js';
import { Balloons } from './balloons.js';
import { ChessGame } from './chess-ui.js';
import { MonsterGame } from './monster.js';

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
  monster: { name: 'Monster Munch', icon: '🍪', make: (stage, o) => new MonsterGame(stage, o) },
  rocket: { name: 'Rocket Ride', icon: '🚀', make: (stage, o) => new Rocket(stage, o) },
};
