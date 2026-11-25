// Screens for kids: who's playing, home (pick a game), math or reading, results, sticker book.
// The grown-up area lives in parent.js.
import { store } from './store.js';
import { CONTENT_FILES } from './content-files.js';
import { setContent } from './gen/reading.js';
import * as E from './engine.js';
import { GAMES, MONSTER_SVG } from './games.js';
import { runRound } from './play.js';
import { speak, stopSpeech, configureSpeech, unlockSpeech } from './speech.js';
import { sfx, setSfx, unlockAudio } from './sfx.js';
import { $, $$, esc, wait, holdToOpen, burst } from './ui.js';
import { STICKER_PAGES } from './stickers.js';
import { openParent } from './parent.js';
import { pieceSVG } from './chess-pieces.js';
import { WHITE, KNIGHT } from './chess.js';

const root = document.getElementById('app');
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  unlockSpeech();
  unlockAudio();
}
document.addEventListener('pointerdown', unlock, { capture: true });

const GAME_ART = {
  balloons: '<span class="gt-emoji">🎈</span>',
  chess: `<span class="gt-piece">${pieceSVG(WHITE | KNIGHT)}</span>`,
  monster: `<span class="gt-monster" style="--mc:#7bd389;--mc2:#ffd166">${MONSTER_SVG}</span>`,
  rocket: '<span class="gt-emoji">🚀</span>',
};

async function loadContent() {
  const c = {};
  await Promise.all(CONTENT_FILES.map(async (f) => {
    const r = await fetch(`content/${f}.json`);
    if (!r.ok) throw new Error(`content/${f}.json: ${r.status}`);
    c[f] = await r.json();
  }));
  setContent(c);
  return c;
}

export function showPicker() {
  stopSpeech();
  const players = store.players;
  root.innerHTML = `
  <div class="screen picker">
    <button class="gear" aria-label="Grown-ups (hold)">⚙️</button>
    <h1 class="logo">Brain <span>Arcade</span></h1>
    ${players.length ? `<p class="sub">Who's playing?</p>
    <div class="who">${players.map((p) => `<button class="who-btn" data-id="${p.id}" style="--c:${p.color}"><span class="av">${p.avatar}</span><b>${esc(p.name)}</b></button>`).join('')}</div>`
    : `<div class="welcome"><p>Welcome! A grown-up sets up a player for each child.</p><button class="btn primary big setup">Set up players</button><button class="btn ghost big setupcode">📋 Paste a setup code</button></div>`}
    ${players.length ? '<p class="hint">Grown-ups: hold ⚙️ for 2 seconds</p>' : ''}
  </div>`;
  holdToOpen($('.gear', root), 1800, () => openParent(root, { onClose: showPicker }));
  $('.setup', root)?.addEventListener('click', () => openParent(root, { onClose: showPicker, startWith: 'add' }));
  $('.setupcode', root)?.addEventListener('click', () => openParent(root, { onClose: showPicker, startWith: 'setup' }));
  $$('.who-btn', root).forEach((b) => b.addEventListener('click', () => { sfx.tap(); showHome(store.player(b.dataset.id)); }));
}

function todayBadges(player) {
  const d = player.days?.[E.dayKey()] || {};
  return `<div class="today"><span class="${d.math ? 'done' : ''}">🔢 Math ${d.math ? '✓' : ''}</span><span class="${d.reading ? 'done' : ''}">📖 Reading ${d.reading ? '✓' : ''}</span></div>`;
}

export function showHome(player) {
  stopSpeech();
  root.innerHTML = `
  <div class="screen home" style="--c:${player.color}">
    <header class="home-top">
      <button class="back" aria-label="Switch player">‹</button>
      <div class="me"><span class="av">${player.avatar}</span><b>${esc(player.name)}</b></div>
      <button class="stars-btn" aria-label="Sticker book">⭐ <b>${player.stars || 0}</b> <span class="book">📒</span></button>
    </header>
    <div class="games">${Object.entries(GAMES).map(([id, g]) => `<button class="game-tile gt-${id}" data-g="${id}">${GAME_ART[id]}<b>${g.name}</b></button>`).join('')}</div>
    ${todayBadges(player)}
  </div>`;
  $('.back', root).addEventListener('click', showPicker);
  $('.stars-btn', root).addEventListener('click', () => showStickers(player));
  $$('.game-tile', root).forEach((b) => b.addEventListener('click', () => { sfx.tap(); chooseSubject(player, b.dataset.g); }));
  if (!player.greeted || Date.now() - player.greeted > 3600e3) { player.greeted = Date.now(); speak(`Hi ${player.name}! Pick a game.`); }
}

function chooseSubject(player, game) {
  const mode = player.settings?.subjectMode || 'choice';
  if (mode === 'math' || mode === 'reading') return startGame(player, game, mode);
  if (mode === 'alternate') return startGame(player, game, player.lastSubject === 'math' ? 'reading' : 'math');
  const needs = (s) => !E.placementDone(player, s);
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet subject-pick"><p>What do you want to play?</p>
    <div class="row">
      <button class="subj math" data-s="math"><span>123</span><b>Math</b>${needs('math') ? '<i>level check</i>' : ''}</button>
      <button class="subj reading" data-s="reading"><span>ABC</span><b>Reading</b>${needs('reading') ? '<i>level check</i>' : ''}</button>
    </div><button class="link cancel">Back</button></div>`;
  root.appendChild(el);
  speak('Math or reading?');
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.cancel')) { el.remove(); stopSpeech(); return; }
    const s = e.target.closest('.subj')?.dataset.s;
    if (s) { sfx.tap(); el.remove(); startGame(player, game, s); }
  });
}

async function startGame(player, game, subject) {
  E.ensureSubject(player, subject);
  const sub = player.subjects[subject];
  if (!E.placementDone(player, subject) && sub.placement.n === 0) {
    const ok = await placementIntro(player, subject);
    if (!ok) return showHome(player);
  }
  runRound(root, {
    player, subject, game,
    onExit: () => showHome(player),
    onDone: (res) => showResults(player, res),
  });
}

function placementIntro(player, subject) {
  const { of } = E.placementRounds(player, subject);
  return new Promise((resolve) => {
    root.innerHTML = `<div class="screen intro" style="--c:${player.color}">
      <div class="intro-card"><div class="big">🧭</div><h2>Let's find your ${subject} level!</h2>
      <p>It takes ${of} short rounds. Some questions will be easy and some will be tricky. That's on purpose! Just do your best. If you don't know, tap <b>🤔 Not sure</b>.</p>
      <button class="btn primary big go">Start</button><button class="link back">Not now</button></div></div>`;
    speak(`Let's find your ${subject} level! It takes ${of} short rounds. Some questions will be easy, and some will be tricky. That's on purpose. Just do your best. If you don't know, tap not sure.`);
    $('.go', root).addEventListener('click', () => { stopSpeech(); resolve(true); });
    $('.back', root).addEventListener('click', () => { stopSpeech(); resolve(false); });
  });
}

async function showResults(player, res) {
  const pl = res.placement;
  const doneCheck = res.finishedPlacement;
  const moreCheck = pl && !doneCheck;
  const lc = E.placementRounds(player, res.subject);
  const left = Math.max(1, lc.of - lc.done);
  const title = doneCheck ? 'Level check done!' : moreCheck ? 'Great work!' : res.correct >= res.total * 0.8 ? 'Amazing!' : 'Great playing!';
  const line = doneCheck ? 'Now your games will be just right for you.' : moreCheck ? `${left === 1 ? 'One more round' : `${left} more rounds`} to find your level. Keep going!` : `You got ${res.correct} of ${res.total}.`;
  root.innerHTML = `<div class="screen results" style="--c:${player.color}">
    <div class="res-card"><div class="res-stars">${'⭐'.repeat(Math.min(res.stars, 12))}</div>
    <h2>${title}</h2><p>${line}</p>
    <div class="new-sticker hidden"></div>
    <div class="row"><button class="btn primary big again">${moreCheck ? 'Keep going' : 'Play again'}</button><button class="btn ghost big home">Home</button></div></div><div class="fx"></div></div>`;
  sfx.win();
  const fx = $('.fx', root);
  burst(fx, innerWidth / 2, innerHeight * 0.3, { n: 30, spread: 220 });
  speak(`${title} ${line}`);
  $('.again', root).addEventListener('click', () => startGame(player, res.game, res.subject));
  $('.home', root).addEventListener('click', () => showHome(player));
  if (res.newStickers?.length) {
    await wait(1400);
    const ns = $('.new-sticker', root);
    ns.innerHTML = `<span class="sticker pop">${res.newStickers[0]}</span><b>New sticker!</b>`;
    ns.classList.remove('hidden');
    sfx.star();
    speak('You got a new sticker!');
  }
}

function showStickers(player) {
  const have = new Set(player.stickers || []);
  const next = E.STICKER_EVERY - ((player.stars || 0) % E.STICKER_EVERY);
  root.innerHTML = `<div class="screen book" style="--c:${player.color}">
    <header class="home-top"><button class="back">‹</button><div class="me"><b>${esc(player.name)}'s stickers</b></div><span class="count">${have.size}</span></header>
    <p class="next">⭐ ${next} more star${next === 1 ? '' : 's'} for a new sticker</p>
    <div class="pages">${STICKER_PAGES.map((pg) => `<section><h3>${pg.name}</h3><div class="grid">${pg.items.map((s) => `<span class="slot-st ${have.has(s) ? 'got' : ''}">${have.has(s) ? s : '?'}</span>`).join('')}</div></section>`).join('')}</div></div>`;
  $('.back', root).addEventListener('click', () => showHome(player));
}

async function boot() {
  store.load();
  if (window.__BA_TEST) window.__BA_TEST.store = store; // the UI test reads and sets saved games
  configureSpeech(store.settings);
  setSfx(store.settings.sfx);
  root.innerHTML = '<div class="screen loading"><h1 class="logo">Brain <span>Arcade</span></h1><p>Loading…</p></div>';
  try {
    await loadContent();
  } catch (e) {
    root.innerHTML = `<div class="screen loading"><p>Could not load the game files. ${esc(e.message)}</p></div>`;
    return;
  }
  showPicker();
  // A link ending in #setup opens the paste-a-setup-code screen directly (also when already open).
  const maybeSetup = () => {
    if (location.hash !== '#setup') return;
    history.replaceState(null, '', location.pathname + location.search);
    stopSpeech();
    openParent(root, { onClose: showPicker, startWith: 'setup' });
  };
  maybeSetup();
  window.addEventListener('hashchange', maybeSetup);
  if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('pagehide', () => store.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.save(); });
boot();
