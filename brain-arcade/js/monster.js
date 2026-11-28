// Monster Munch: a pet monster to raise. Each child has one monster that stays between rounds
// (monster-pet.js has the rules, monster-art.js draws it). It starts as an egg; right answers warm
// it until it hatches and the child names it. Then before each round the child picks what it eats
// today, every right answer feeds it a treat, and what it eats most shapes how it grows. Stars
// unlock hats (👒 button) and things for its room; grown monsters move into the Monster Castle (🏰)
// and a new egg arrives. During a level check every answer feeds it (no right or wrong is shown).
import { sfx } from './sfx.js';
import { speak } from './speech.js';
import { burst, centerIn, fitLabels, optionInner, esc } from './ui.js';
import { Skin, Waits } from './skin.js';
import { store } from './store.js';
import { MENUS, menuOf, NAMES, UNLOCKS, HATCH, STAGES, loadPet, isEgg, stageOf, isGrown, feed, moveOut, newUnlocks, markSeen, unlocked, growthLine } from './monster-pet.js';
import { monsterSVG, eggSVG, mouthAt } from './monster-art.js';

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export class MonsterGame extends Skin {
  maxWord = 7;
  constructor(stage, opts) {
    super(stage, opts);
    this.turnEveryAnswer = true; // play.js: during a level check every answer feeds it
    this.w = new Waits();
    this.phase = 'start';
    this.coverOpen = null;
  }
  get pet() { return this._pet; }
  get m() { return this._pet.cur; }
  // read the instructions aloud to children still learning to read; the monster's own lines always
  say(text, always = false) { if (always || (this.player?.grade ?? 1) < 1 || this.player?.settings?.readAloud === 'always') speak(text); }

  async start() {
    this._pet = loadPet(this.player);
    this.stage.innerHTML = `<div class="scene kitchen mroom"><div class="mdecos"></div><div class="layer"></div>
      <div class="monster" aria-label="Your monster"></div>
      <div class="table"><div class="mtag"><b></b><i><s></s></i></div></div>
      <button class="mbtn mdress" aria-label="Dress up">👒</button><button class="mbtn mhouse" aria-label="Monster Castle">🏰</button>
      <div class="mbanner hidden"></div><div class="fx"></div></div>`;
    const q = (s) => this.stage.querySelector(s);
    this.scene = q('.scene');
    this.layer = q('.layer');
    this.monster = q('.monster');
    this.fx = q('.fx');
    this.tag = q('.mtag');
    this.bannerEl = q('.mbanner');
    this.monster.addEventListener('click', () => this.tickle());
    q('.mdress').addEventListener('click', () => this.dressUp());
    q('.mhouse').addEventListener('click', () => this.house());
    this.draw();
    this.drawRoom();
    if (window.__BA_TEST) { window.__BA_TEST.monster = { phase: () => this.phase, pet: () => JSON.parse(JSON.stringify(this._pet)) }; window.__BA_TEST.monsterLog ||= []; }
    await this.roundStart();
    if (!this.w.aborted) this.phase = 'play';
  }

  // ------------------------------------------------------------ drawing
  draw() {
    const m = this.m;
    this.monster.innerHTML = isEgg(m) ? eggSVG(m) : monsterSVG(m);
    this.monster.classList.toggle('is-egg', isEgg(m));
    this.stage.querySelector('.mdress').classList.toggle('hidden', isEgg(m));
    this.updateTag();
  }
  updateTag() {
    const m = this.m, st = stageOf(m);
    let f = 1;
    if (isEgg(m)) f = (m.warm || 0) / HATCH;
    else {
      const k = STAGES.findIndex((s) => s.id === st.id), next = STAGES[k + 1];
      if (next) f = (m.fed - st.from) / (next.from - st.from);
    }
    this.tag.querySelector('b').textContent = isEgg(m) ? 'Egg' : m.name || 'Baby';
    this.tag.querySelector('s').style.width = Math.round(Math.max(0.04, Math.min(1, f)) * 100) + '%';
    this.tag.title = isEgg(m) ? `${m.warm || 0} of ${HATCH} to hatch` : st.name;
  }
  drawRoom() {
    const have = unlocked(this.player?.stars).filter((u) => u.kind === 'room');
    this.stage.querySelector('.mdecos').innerHTML = have.map((u) => `<span class="mdeco d-${u.id}">${u.emoji}</span>`).join('');
  }
  banner(text, ms = 2200) {
    window.__BA_TEST?.monsterLog?.push(text);
    const b = this.bannerEl;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.add('hidden'), ms);
  }
  cover(html) {
    const el = document.createElement('div');
    el.className = 'cover mcover';
    el.innerHTML = html;
    this.scene.appendChild(el);
    this.coverOpen = el;
    return el;
  }
  closeCover(el) { el.remove(); if (this.coverOpen === el) this.coverOpen = null; }
  // wait for a tap on something matching sel inside a cover; resolves with that element (or null after Home)
  tapIn(el, sel) {
    return this.w.until((done) => el.addEventListener('click', (e) => { const b = e.target.closest(sel); if (b && !b.disabled) { sfx.tap(); done(b); } }));
  }

  // ------------------------------------------------------------ before the first question
  async roundStart() {
    if (isGrown(this.m)) await this.movedOut();
    const fresh = newUnlocks(this.pet, this.player?.stars);
    if (fresh.length && !this.w.aborted) await this.showUnlocks(fresh);
    if (this.w.aborted) return;
    if (isEgg(this.m)) { if (!this.m.warm) await this.eggIntro(); } else await this.pickMenu();
  }
  async eggIntro() {
    this.phase = 'egg';
    const c = this.cover(`<div class="cpanel mpanel"><div class="mp-pet">${eggSVG(this.m, { cls: 'mini' })}</div><h2>A monster egg!</h2><p>Answer questions to keep it warm. After ${HATCH} answers, it hatches!</p><button class="btn primary big m-ok">OK!</button></div>`);
    this.say(`A monster egg! Answer questions to keep it warm. After ${HATCH} answers, it hatches!`);
    await this.tapIn(c, '.m-ok');
    this.closeCover(c);
  }
  async pickMenu(first = false) {
    this.phase = 'menu';
    const m = this.m, last = this.pet.menu;
    const c = this.cover(`<div class="cpanel mpanel"><div class="mp-pet">${monsterSVG(m, { cls: 'mini', big: true })}</div>
      <h2>What should ${esc(m.name)} eat ${first ? 'first' : 'today'}?</h2>
      <div class="mmenus">${MENUS.map((x) => `<button class="mmenu${x.id === last ? ' last' : ''}" data-id="${x.id}"><span>${x.foods.slice(0, 3).join('')}</span><b>${x.name}</b></button>`).join('')}</div>
      <p class="mp-note">What it eats most changes how it grows!</p></div>`);
    this.say(`What should ${m.name} eat ${first ? 'first' : 'today'}?`);
    const b = await this.tapIn(c, '.mmenu');
    this.closeCover(c);
    if (b) { this.pet.menu = b.dataset.id; store.saveSoon(); }
  }
  async movedOut() {
    this.phase = 'moved';
    const m = this.m, name = esc(m.name || 'Your monster');
    const c = this.cover(`<div class="cpanel mpanel"><div class="mp-pet">${monsterSVG(m, { cls: 'mini', big: true })}</div><h2>${name} is all grown up!</h2>
      <p>${name} moved into the Monster Castle 🏰. Visit any time!</p><p><b>And look: a new egg!</b></p><button class="btn primary big m-ok">Hello, egg! 🥚</button></div>`);
    this.say(`${m.name} is all grown up, and moved into the Monster Castle. And look, a new egg!`, true);
    await this.tapIn(c, '.m-ok');
    this.closeCover(c);
    moveOut(this.pet);
    store.saveSoon();
    this.draw();
  }
  async showUnlocks(items) {
    this.phase = 'unlocks';
    const who = isEgg(this.m) ? 'your monster' : esc(this.m.name || 'your monster');
    const hat = items.some((u) => u.kind === 'hat');
    const c = this.cover(`<div class="cpanel mpanel"><h2>New things for ${who}!</h2>
      <div class="mnew">${items.map((u) => `<div><span>${u.emoji}</span><b>${esc(u.name)}</b><i>${u.kind === 'hat' ? 'to wear' : 'for its room'}</i></div>`).join('')}</div>
      <p class="mp-note">You earned ${items.length > 1 ? 'them' : 'it'} with ⭐ stars.${hat && !isEgg(this.m) ? ' Tap 👒 to try on hats.' : ''}</p><button class="btn primary big m-ok">Yay!</button></div>`);
    sfx.star();
    await this.tapIn(c, '.m-ok');
    this.closeCover(c);
    markSeen(this.pet, items);
    store.saveSoon();
  }

  // ------------------------------------------------------------ answers on plates
  show(item) {
    this.clear();
    this.bannerEl.classList.add('hidden');
    this.monster.classList.remove('happy', 'yuck');
    const n = item.options.length, sz = this.size(n) * 0.95;
    const foods = isEgg(this.m) ? null : menuOf(this.pet.menu).foods;
    this.layer.style.setProperty('--pw', sz + 'px');
    item.options.forEach((o, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const p = document.createElement('button');
      p.className = 'plate';
      p.style.left = `calc(${sz / 2 + 8}px + (100% - ${sz + 16}px) * ${t})`;
      p.style.top = (n > 2 ? 6 + Math.abs(t - 0.5) * 30 : 14) + '%';
      p.style.setProperty('--d', i * 0.08 + 's');
      p.innerHTML = `${foods ? `<span class="food">${foods[(i + this.round) % foods.length]}</span>` : ''}<span class="dish">${optionInner(o)}</span>`;
      this.bind(p, i);
      this.layer.appendChild(p);
      this.els.push(p);
    });
    this.round++;
    fitLabels(this.stage);
  }
  // fly a plate into the monster's mouth (or onto the egg)
  async fly(el) {
    const m = this.monster.getBoundingClientRect(), e = el.getBoundingClientRect();
    const at = isEgg(this.m) ? { x: 0.5, y: 0.7 } : mouthAt(this.m);
    el.style.setProperty('--tx', m.left + m.width * at.x - (e.left + e.width / 2) + 'px');
    el.style.setProperty('--ty', m.top + m.height * at.y - (e.top + e.height / 2) + 'px');
    el.classList.add('eaten');
    await this.w.sleep(420);
  }
  async treat(el) {
    if (this.w.aborted || !el) return;
    this.busy = true;
    this.els.forEach((e) => { if (e !== el) e.classList.add('fade'); });
    if (isEgg(this.m)) await this.warm(el);
    else await this.eat(el);
    this.clear(); // the eaten plate and the others, now faded
    this.busy = false;
  }
  async eat(el) {
    await this.fly(el);
    sfx.chomp();
    this.monster.classList.add('chomp', 'happy');
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y - 30, { n: 8, chars: ['💖', '✨', '💛'], spread: 90 });
    const r = feed(this.m, this.pet.menu || 'berry');
    store.saveSoon();
    this.updateTag();
    await this.w.sleep(650);
    this.monster.classList.remove('chomp');
    if (r.grew) await this.grow(r.grew);
  }
  async warm(el) {
    await this.fly(el);
    sfx.star();
    const r = feed(this.m);
    store.saveSoon();
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y, { n: 8, chars: ['✨', '💛', '⭐'], spread: 80 });
    this.monster.innerHTML = eggSVG(this.m);
    this.updateTag();
    this.monster.classList.remove('wobble');
    void this.monster.offsetWidth;
    this.monster.classList.add('wobble');
    await this.w.sleep(700);
    if (r.hatched) await this.hatch();
  }
  async hatch() {
    this.phase = 'hatch';
    this.monster.classList.add('wobble-hard');
    sfx.crack();
    await this.w.sleep(900);
    this.monster.classList.remove('wobble', 'wobble-hard');
    sfx.win();
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y, { n: 22, spread: 170 });
    burst(this.fx, c.x, c.y, { n: 10, chars: ['🥚', '✨', '💖'], spread: 120 });
    this.draw();
    this.monster.classList.add('popin', 'happy');
    await this.w.sleep(900);
    this.monster.classList.remove('popin');
    await this.nameIt();
    if (!this.w.aborted) await this.pickMenu(true);
    this.phase = 'play';
  }
  async nameIt() {
    this.phase = 'name';
    let pool = shuffle(NAMES);
    const names = () => { if (pool.length < 3) pool = shuffle(NAMES); return pool.splice(0, 3); };
    const c = this.cover(`<div class="cpanel mpanel"><div class="mp-pet">${monsterSVG(this.m, { cls: 'mini', big: true })}</div><h2>It hatched! What's its name?</h2>
      <div class="mnames"></div><button class="btn ghost m-more">🔀 Other names</button></div>`);
    const fill = () => { c.querySelector('.mnames').innerHTML = names().map((n) => `<button class="btn big m-name" data-n="${esc(n)}">${esc(n)}</button>`).join(''); };
    fill();
    this.say('It hatched! Pick a name for your monster.');
    for (;;) {
      const b = await this.tapIn(c, '.m-name, .m-more');
      if (!b) break;
      if (b.classList.contains('m-more')) { fill(); continue; }
      this.m.name = b.dataset.n;
      store.saveSoon();
      break;
    }
    this.closeCover(c);
    if (this.m.name) { this.updateTag(); speak(`Hi! I'm ${this.m.name}!`); }
  }
  async grow(stage) {
    this.phase = 'grow';
    sfx.win();
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y, { n: 14, chars: ['✨', '⭐', '💫'], spread: 140 });
    this.monster.classList.add('growing');
    await this.w.sleep(380);
    this.draw();
    await this.w.sleep(520);
    this.monster.classList.remove('growing');
    const line = growthLine(this.m, stage);
    this.banner(line, stage.id === 'grown' ? 3200 : 2600);
    speak(line);
    await this.w.sleep(stage.id === 'grown' ? 2600 : 1900);
    this.phase = 'play';
  }

  markRight(i) { return this.treat(this.els[i]); }
  neutral(i) { return this.treat(this.els[i]); }
  markWrong(i) {
    super.markWrong(i);
    this.monster.classList.add('yuck');
    setTimeout(() => this.monster.classList.remove('yuck'), 900);
  }
  // a right answer given on a card or by spelling: a treat appears and is eaten
  async reward() {
    if (this.w.aborted) return;
    this.clear();
    const p = document.createElement('div');
    p.className = 'plate deco';
    p.style.left = '50%'; p.style.top = '8%';
    const foods = isEgg(this.m) ? ['✨'] : menuOf(this.pet.menu).foods;
    p.innerHTML = `<span class="food big">${foods[Math.floor(Math.random() * foods.length)]}</span>`;
    this.layer.appendChild(p);
    this.els = [p];
    await this.w.sleep(300);
    await this.treat(p);
    this.clear();
  }

  // ------------------------------------------------------------ things to tap any time
  tickle() {
    if (this.busy || this.coverOpen || this.w.aborted) return;
    sfx.giggle();
    this.monster.classList.remove('tickle');
    void this.monster.offsetWidth;
    this.monster.classList.add('tickle', 'happy');
    clearTimeout(this.tickleT);
    this.tickleT = setTimeout(() => this.monster.classList.remove('tickle', 'happy'), 800);
  }
  async dressUp() {
    if (this.coverOpen || this.busy || isEgg(this.m)) return;
    const back = this.phase;
    this.phase = 'dress';
    const m = this.m, stars = this.player?.stars || 0;
    const hats = UNLOCKS.filter((u) => u.kind === 'hat');
    const c = this.cover(`<div class="cpanel mpanel"><div class="mp-pet">${monsterSVG(m, { cls: 'mini', big: true })}</div><h2>Dress up ${esc(m.name)}</h2>
      <div class="mhats"><button class="mhat${m.hat ? '' : ' on'}" data-id="" aria-label="No hat">🚫</button>${hats.map((u) => (stars >= u.stars
      ? `<button class="mhat${m.hat === u.id ? ' on' : ''}" data-id="${u.id}" aria-label="${esc(u.name)}">${u.emoji}</button>`
      : `<button class="mhat locked" data-id="${u.id}" aria-label="${esc(u.name)}, locked"><span>${u.emoji}</span><i>🔒${u.stars}⭐</i></button>`)).join('')}</div>
      <button class="btn primary big m-ok">Done</button></div>`);
    sfx.tap();
    for (;;) {
      const b = await this.tapIn(c, '.mhat, .m-ok');
      if (!b || b.classList.contains('m-ok')) break;
      const u = UNLOCKS.find((x) => x.id === b.dataset.id);
      if (b.classList.contains('locked')) { sfx.bad(); this.say(`Earn ${u.stars} stars to unlock ${u.name}!`, true); continue; }
      m.hat = b.dataset.id || null;
      store.saveSoon();
      c.querySelectorAll('.mhat').forEach((x) => x.classList.toggle('on', x === b));
      c.querySelector('.mp-pet').innerHTML = monsterSVG(m, { cls: 'mini', big: true });
      this.draw();
    }
    this.closeCover(c);
    this.phase = back;
  }
  async house() {
    if (this.coverOpen || this.busy) return;
    const back = this.phase;
    this.phase = 'house';
    const fam = this.pet.family;
    const who = isEgg(this.m) ? 'your monster' : esc(this.m.name || 'your monster');
    const c = this.cover(`<div class="cpanel mpanel mhouse-panel"><h2>🏰 Monster Castle</h2>
      ${fam.length ? `<div class="mfam">${fam.map((f) => `<div>${monsterSVG(f, { cls: 'mini', big: true })}<b>${esc(f.name || '')}</b></div>`).join('')}</div>`
        : `<p>When ${who} grows up, it will move in here.</p>`}
      <button class="btn primary big m-ok">Back</button></div>`);
    sfx.tap();
    await this.tapIn(c, '.m-ok');
    this.closeCover(c);
    this.phase = back;
  }

  abort() { this.w.abort(); }
  async finish() {
    sfx.win();
    this.monster.classList.add('dance', 'happy');
    const c = centerIn(this.monster, this.fx);
    burst(this.fx, c.x, c.y - 30, { n: 22, spread: 170 });
    await this.w.sleep(1800);
  }
  destroy() {
    this.w.abort();
    clearTimeout(this.bannerT);
    clearTimeout(this.tickleT);
    if (window.__BA_TEST?.monster) delete window.__BA_TEST.monster;
    super.destroy();
  }
}
