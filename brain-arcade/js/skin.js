// What every game "skin" can do. The play screen (play.js) asks the skin to show a question's
// answers, then tells it what happened: markRight / markWrong / reveal / neutral (level check),
// reward (a right answer that wasn't one of the skin's own buttons), finish (end of the round).
import { sfx } from './sfx.js';
import { maxLabel, wait } from './ui.js';

export const COLORS = ['#ff6b6b', '#4dabf7', '#ffa94d', '#51cf66', '#9775fa', '#f783ac', '#f7c531', '#20c997'];

export class Skin {
  constructor(stage, { onPick, player } = {}) { this.stage = stage; this.onPick = onPick; this.player = player; this.els = []; this.round = 0; }
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

// Waiting that Home can cut short: until(setup) resolves with what setup's done() is given, or
// null once abort() is called. Skins that run long animations or wait for taps use it.
export class Waits {
  constructor() { this.cancels = new Set(); this.aborted = false; }
  until(setup) {
    return new Promise((resolve) => {
      if (this.aborted) { resolve(null); return; }
      let open = true;
      const cancel = () => finish(null);
      const finish = (v) => { if (!open) return; open = false; this.cancels.delete(cancel); resolve(v); };
      this.cancels.add(cancel);
      setup(finish);
    });
  }
  sleep(ms) { return this.until((done) => setTimeout(() => done(true), ms)); }
  abort() { this.aborted = true; for (const c of [...this.cancels]) c(); }
}
