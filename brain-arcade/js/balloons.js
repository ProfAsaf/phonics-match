// Balloon Pop. The answers float up as balloons; popping the right one lets out a gush of soap
// bubbles to pop (tap or swipe). When the last bubble is gone, the next balloons float up. A
// second-try answer lets out about half as many. During a level check every answer does (there is
// no right or wrong shown then), and a question answered on a card or by spelling gets a surprise
// balloon that pops by itself. The round ends with a count of the bubbles popped, and the best
// round is kept.
import { sfx } from './sfx.js';
import { wait, burst, centerIn, fitLabels, optionInner, esc } from './ui.js';
import { Skin, Waits, COLORS } from './skin.js';
import { BubbleField } from './bubbles.js';
import { store } from './store.js';

export class Balloons extends Skin {
  maxWord = 8;
  constructor(stage, opts) {
    super(stage, opts);
    this.turnEveryAnswer = true; // play.js: during a level check every answer lets out bubbles
    this.w = new Waits();
  }
  start() {
    this.stage.innerHTML = `<div class="scene sky"><div class="sun"></div><div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div><div class="hills"></div><div class="layer"></div>
      <div class="bub-count hidden" aria-label="Bubbles popped"><i class="bub-ico"></i><b>0</b></div><div class="fx"></div></div>`;
    this.scene = this.stage.querySelector('.scene');
    this.layer = this.stage.querySelector('.layer');
    this.fx = this.stage.querySelector('.fx');
    this.countEl = this.stage.querySelector('.bub-count');
    this.field = new BubbleField(this.scene, { big: (this.player?.grade ?? 1) < 0, onPop: (n) => this.counted(n) });
    if (window.__BA_TEST) window.__BA_TEST.bubbles = { spots: () => this.field.spots(), popped: () => this.field.total, busy: () => this.busy };
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

  counted(n) {
    const c = this.countEl;
    c.classList.remove('hidden');
    c.querySelector('b').textContent = n;
    c.classList.remove('bump');
    void c.offsetWidth;
    c.classList.add('bump');
  }

  // Pop balloon i and let the bubbles out; resolves when they're all gone (or Home is tapped).
  async popOut(i, amount) {
    const el = this.els[i];
    if (!el) return;
    sfx.pop();
    const c = centerIn(el.querySelector('.b-body'), this.scene);
    el.classList.add('popped');
    this.els.forEach((e, j) => { if (j !== i) e.classList.add('flyaway'); });
    await this.bubbles(c, amount);
    this.clear();
  }
  async bubbles(c, amount) {
    if (this.w.aborted) return;
    this.busy = true;
    burst(this.fx, c.x, c.y, { n: 10, spread: 70 });
    await this.w.until((done) => this.field.burst(c.x, c.y, { amount }).then(() => done(true)));
    this.busy = false;
  }
  markRight(i, { tries = 0 } = {}) { return this.popOut(i, tries ? 0.5 : 1); }
  neutral(i) { return this.popOut(i, 1); }

  // A right answer given on a card or by spelling: a surprise balloon floats up and pops (a tap
  // pops it sooner).
  async reward({ tries = 0 } = {}) {
    if (this.w.aborted) return;
    this.busy = true;
    const b = document.createElement('button');
    b.className = 'balloon surprise';
    b.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
    b.style.setProperty('--d', '0s');
    b.style.setProperty('--bob', '2.6s');
    b.style.left = 30 + Math.random() * 40 + '%';
    b.style.top = '26%';
    b.innerHTML = '<span class="b-body"></span><span class="b-knot"></span><span class="b-string"></span>';
    this.layer.appendChild(b);
    this.els = [b];
    await this.w.until((done) => {
      const t = setTimeout(() => done(true), 1300);
      b.addEventListener('click', () => { clearTimeout(t); done(true); }, { once: true });
    });
    await this.popOut(0, tries ? 0.5 : 1);
  }

  abort() { this.w.abort(); this.field?.stop(); }

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
    const n = this.field.total;
    if (n && this.player) {
      const rec = (this.player.balloons ||= { best: 0, total: 0, rounds: 0 });
      const best = n > rec.best && rec.rounds > 0;
      rec.best = Math.max(rec.best, n);
      rec.total += n;
      rec.rounds++;
      store.saveSoon();
      const card = document.createElement('div');
      card.className = 'bub-done';
      card.innerHTML = `<i class="bub-ico big"></i><b>${n}</b><span>bubble${n === 1 ? '' : 's'} popped!</span>${best ? '<em>🏆 New record!</em>' : rec.rounds > 1 ? `<small>Best: ${esc(rec.best)}</small>` : ''}`;
      this.scene.appendChild(card);
      await wait(2600);
    } else await wait(1800);
  }
  destroy() {
    this.w.abort();
    this.field?.destroy();
    if (window.__BA_TEST?.bubbles) delete window.__BA_TEST.bubbles;
    super.destroy();
  }
}
