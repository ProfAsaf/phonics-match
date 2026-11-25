// The play screen: question on top (or left), the game world below (or right).
// Right answer: the game celebrates. Wrong: one more try, then the right answer and a short
// explanation. During a level check there is no right/wrong feedback, just "got it".
import * as E from './engine.js';
import { GAMES } from './games.js';
import { speak, stopSpeech } from './speech.js';
import { sfx } from './sfx.js';
import { $, esc, wait, optionInner, centerIn } from './ui.js';
import { store } from './store.js';
import { STICKERS } from './stickers.js';

const PRAISE = ['Yes!', 'Great job!', 'You got it!', 'Awesome!', 'Nice!', 'Super!', 'Way to go!'];

export function sayTextOf(item) {
  let s = item.say || item.prompt;
  if (item.sayOptions && item.kind === 'choice') {
    const names = item.options.map((o) => o.say || (o.emoji ? '' : o.label)).filter(Boolean);
    if (names.length > 1) s += ` ${names.slice(0, -1).join(', ')}, or ${names[names.length - 1]}?`;
  }
  return s;
}

function autoSay(item, player) {
  if (item.listen) return true;
  const mode = player.settings?.readAloud || 'auto';
  if (mode === 'tap') return false;
  if (mode === 'always') return true;
  const lvl = E.readingLevel(player);
  if (item.readingTest) return lvl < 1.0; // only the instruction, for early readers
  return lvl < Math.min(item.autoSayLevel ?? 2.0, 3.0);
}

export async function runRound(root, { player, subject, game, placement = null, onExit, onDone }) {
  const settings = store.settings;
  const sess = E.newSession(player, subject, { settings: { ...settings, focus: { [player.id]: player.settings?.focus || {} } }, placement });
  root.innerHTML = `
  <div class="play g-${game}${sess.placement ? ' placing' : ''}">
    <header class="hud">
      <button class="hud-btn home" aria-label="Home">🏠</button>
      <div class="dots"></div>
      <div class="hud-stars"><span>⭐</span><b>${player.stars || 0}</b></div>
    </header>
    <section class="qpanel">
      ${sess.placement ? '<div class="ribbon">Level check · just do your best</div>' : ''}
      <div class="passage hidden"></div>
      <div class="qtop"><button class="speak" aria-label="Read it to me">🔊</button><div class="prompt"></div></div>
      <div class="context hidden"></div>
      <div class="visual"></div>
      <div class="qtools"><button class="notsure">🤔 Not sure</button></div>
    </section>
    <section class="stage"></section>
    <div class="cards hidden"></div>
    <div class="spell hidden"></div>
    <div class="why hidden"></div>
  </div>`;
  const el = {
    play: $('.play', root), dots: $('.dots', root), stars: $('.hud-stars b', root), prompt: $('.prompt', root), passage: $('.passage', root),
    context: $('.context', root), visual: $('.visual', root), stage: $('.stage', root), cards: $('.cards', root), spell: $('.spell', root),
    why: $('.why', root), notsure: $('.notsure', root), speakBtn: $('.speak', root),
  };
  if (!settings.showDontKnow) el.notsure.classList.add('hidden');

  let resolvePick = null;
  const pick = (r) => { if (resolvePick) { const f = resolvePick; resolvePick = null; f(r); } };
  const nextPick = () => new Promise((r) => { resolvePick = r; });
  const skin = GAMES[game].make(el.stage, { onPick: (i) => pick({ type: 'choice', i }) });
  skin.start(sess.length);

  let exiting = false;
  $('.home', root).addEventListener('click', () => { exiting = true; stopSpeech(); pick({ type: 'exit' }); });
  el.notsure.addEventListener('click', () => pick({ type: 'dontknow' }));
  let current = null, lastPassage = null;
  el.speakBtn.addEventListener('click', () => { if (current) speakItem(current, true); });

  function drawDots() {
    const n = Math.max(sess.length, sess.i);
    el.dots.innerHTML = Array.from({ length: n }, (_, k) => `<i class="${k < sess.results.length ? (sess.placement ? 'done' : sess.results[k].correct ? 'ok' : 'miss') : k === sess.results.length ? 'now' : ''}"></i>`).join('');
  }

  function speakItem(item, manual = false) {
    const p = item.passage;
    if (p && p.mode === 'listen' && (lastPassage !== p.id || manual)) {
      lastPassage = p.id;
      return speak(`${p.text} ... ${sayTextOf(item)}`, { rate: (settings.rate || 0.95) * 0.95 });
    }
    if (p) lastPassage = p.id;
    if (manual || autoSay(item, player)) return speak(sayTextOf(item));
    return Promise.resolve();
  }

  function render(item) {
    current = item;
    el.prompt.innerHTML = esc(item.prompt);
    el.prompt.classList.toggle('long', item.prompt.length > 70);
    const p = item.passage;
    el.passage.classList.toggle('hidden', !p);
    if (p) {
      el.passage.className = `passage ${p.mode}`;
      el.passage.innerHTML = p.mode === 'listen'
        ? `<div class="story-card"><span class="story-emoji">${p.emoji || '📖'}</span><b>${esc(p.title)}</b><button class="btn small hear">🔊 Hear the story</button></div>`
        : `<h3>${p.emoji ? p.emoji + ' ' : ''}${esc(p.title)}</h3>${p.text.split(/\n\n+/).map((t) => `<p>${esc(t)}</p>`).join('')}`;
      $('.hear', el.passage)?.addEventListener('click', () => { lastPassage = null; speakItem(item, true); });
      if (lastPassage !== p.id) el.passage.scrollTop = 0;
    }
    el.context.classList.toggle('hidden', !item.context);
    if (item.context) el.context.textContent = item.context;
    el.visual.innerHTML = item.visual?.svg || item.visual?.html || '';
    el.visual.classList.toggle('empty', !item.visual);
    el.play.dataset.layout = item.layout;
    el.play.classList.toggle('has-passage', !!p && p.mode === 'read');
    el.cards.classList.add('hidden');
    el.spell.classList.add('hidden');
    if (item.kind === 'spell') return renderSpell(item);
    if (skin.handles(item)) return skin.show(item);
    el.cards.classList.remove('hidden');
    el.cards.innerHTML = item.options.map((o, i) => `<button class="card" data-i="${i}">${optionInner(o)}</button>`).join('');
    el.cards.querySelectorAll('.card').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) pick({ type: 'choice', i: +b.dataset.i }); }));
  }

  let spellState = null;
  function renderSpell(item) {
    el.spell.classList.remove('hidden');
    el.spell.innerHTML = `<div class="slots">${item.answerText.split('').map(() => '<span class="slot"></span>').join('')}</div>
      <div class="tiles">${item.tiles.map((t, i) => `<button class="tile" data-i="${i}">${esc(t)}</button>`).join('')}</div>
      <button class="undo" aria-label="Take back a letter">⌫</button>`;
    spellState = { item, typed: [] };
    const slots = [...el.spell.querySelectorAll('.slot')];
    const draw = () => slots.forEach((s, k) => { s.textContent = spellState.typed[k]?.ch || ''; s.classList.toggle('filled', !!spellState.typed[k]); });
    el.spell.querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => {
      if (t.disabled || spellState.typed.length >= slots.length) return;
      sfx.tap();
      t.disabled = true;
      spellState.typed.push({ ch: t.textContent, tile: t });
      draw();
      if (spellState.typed.length === slots.length) setTimeout(() => pick({ type: 'spell', text: spellState.typed.map((x) => x.ch).join('') }), 250);
    }));
    $('.undo', el.spell).addEventListener('click', () => { const x = spellState.typed.pop(); if (x) { x.tile.disabled = false; draw(); } });
    spellState.reset = (keepRight) => {
      const ans = item.answerText;
      const keep = keepRight ? spellState.typed.filter((x, k) => x.ch === ans[k] && spellState.typed.slice(0, k).every((y, j) => y.ch === ans[j])) : [];
      spellState.typed.slice(keep.length).forEach((x) => { x.tile.disabled = false; });
      spellState.typed = spellState.typed.slice(0, keep.length);
      draw();
    };
    spellState.show = (word, cls) => { slots.forEach((s, k) => { s.textContent = word[k]; s.classList.add(cls); }); };
  }

  function flyStar(fromEl) {
    if (!fromEl) return;
    const a = fromEl.getBoundingClientRect(), b = $('.hud-stars', root).getBoundingClientRect();
    const s = document.createElement('div');
    s.className = 'flystar';
    s.textContent = '⭐';
    s.style.left = a.left + a.width / 2 + 'px';
    s.style.top = a.top + a.height / 2 + 'px';
    document.body.appendChild(s);
    requestAnimationFrame(() => { s.style.transform = `translate(${b.left + 12 - (a.left + a.width / 2)}px, ${b.top + 10 - (a.top + a.height / 2)}px) scale(.6)`; s.style.opacity = '0.3'; });
    setTimeout(() => { s.remove(); el.stars.textContent = player.stars || 0; el.stars.parentElement.classList.add('bump'); setTimeout(() => el.stars.parentElement.classList.remove('bump'), 300); }, 650);
  }

  async function showWhy(item) {
    const right = item.kind === 'spell' ? `<span class="o-label m read">${esc(item.answerText)}</span>` : optionInner(item.options[item.answer]);
    el.why.innerHTML = `<div class="why-card"><div class="why-ans">${right}</div><p>${esc(item.why || '')}</p><button class="btn primary next">Next ▶</button></div>`;
    el.why.classList.remove('hidden');
    const sayWhy = item.whySay || item.why;
    if (sayWhy && (autoSay({ ...item, listen: false, readingTest: false, autoSayLevel: 9 }, player) || item.listen)) speak(sayWhy);
    await new Promise((r) => {
      $('.next', el.why).addEventListener('click', r, { once: true });
      const arm = (x) => { if (x.type === 'exit') r(); else resolvePick = arm; }; // stray taps don't disarm Home
      resolvePick = arm;
    });
    resolvePick = null;
    stopSpeech();
    el.why.classList.add('hidden');
  }

  const optionEl = (i) => (skin.handles(current) ? skin.els[i] : el.cards.querySelector(`[data-i="${i}"]`));

  async function playItem(item) {
    if (window.__BA_TEST) window.__BA_TEST.item = item;
    render(item);
    drawDots();
    const t0 = performance.now();
    speakItem(item);
    let scored = false, tries = 0;
    for (;;) {
      const r = await nextPick();
      if (r.type === 'exit') return 'exit';
      const ms = Math.round(performance.now() - t0);
      if (r.type === 'dontknow') {
        stopSpeech();
        if (!scored) { E.answer(sess, item, { dontKnow: true, ms }); scored = true; store.saveSoon(); }
        if (sess.placement) { sfx.soft(); skin.clear(); return 'next'; }
        if (item.kind === 'choice') { skin.handles(item) ? skin.reveal(item.answer) : optionEl(item.answer)?.classList.add('reveal'); }
        else spellState?.show(item.answerText, 'right');
        await showWhy(item);
        skin.clear();
        return 'next';
      }
      const correct = r.type === 'spell' ? r.text === item.answerText : r.i === item.answer;
      if (!scored) { E.answer(sess, item, r.type === 'spell' ? { text: r.text, ms } : { choice: r.i, ms }); scored = true; store.saveSoon(); }
      stopSpeech();
      if (sess.placement) {
        flyStar(r.type === 'choice' ? optionEl(r.i) : el.spell);
        if (r.type === 'choice' && skin.handles(item)) await skin.neutral(r.i);
        else { sfx.soft(); await wait(300); }
        return 'next';
      }
      if (correct) {
        sfx.good();
        if (tries === 0) flyStar(r.type === 'choice' ? optionEl(r.i) : el.spell);
        if (Math.random() < 0.35 || tries > 0) speak(tries ? 'Yes! You got it.' : PRAISE[Math.floor(Math.random() * PRAISE.length)]);
        if (r.type === 'spell') { spellState.show(item.answerText, 'right'); await wait(500); await skin.reward(); }
        else if (skin.handles(item)) await skin.markRight(r.i);
        else { optionEl(r.i)?.classList.add('right'); await wait(400); el.cards.classList.add('hidden'); await skin.reward(); }
        return 'next';
      }
      tries++;
      sfx.bad();
      const left = item.kind === 'choice' ? item.options.length - tries : 1;
      if (r.type === 'choice') { if (skin.handles(item)) skin.markWrong(r.i); else { const c = optionEl(r.i); c?.classList.add('wrong'); if (c) c.disabled = true; } }
      else { el.spell.classList.add('shake'); setTimeout(() => el.spell.classList.remove('shake'), 500); }
      if (tries >= 2 || left <= 1) {
        if (item.kind === 'choice') { skin.handles(item) ? skin.reveal(item.answer) : optionEl(item.answer)?.classList.add('reveal'); }
        else spellState.show(item.answerText, 'right');
        await wait(350);
        await showWhy(item);
        skin.clear();
        return 'next';
      }
      if (r.type === 'spell') { await wait(450); spellState.reset(true); }
      speak('Try again!');
    }
  }

  let item;
  while (!exiting && (item = E.nextItem(sess))) {
    const res = await playItem(item);
    if (res === 'exit') break;
    store.saveSoon();
  }
  stopSpeech();
  if (exiting) {
    if (sess.results.length) { E.finishRound(sess, STICKERS); store.save(); }
    skin.destroy();
    onExit?.();
    return;
  }
  drawDots();
  el.cards.classList.add('hidden');
  el.spell.classList.add('hidden');
  await skin.finish();
  const result = E.finishRound(sess, STICKERS);
  store.save();
  skin.destroy();
  onDone?.({ ...result, placement: sess.placement, subject, game });
}
