// The game: the start screen and sound check, first-launch setup (team, kit color, and player),
// home on the world map, the match as a trip past six levels with the halftime show and the
// trophy, the squad album, the word book, and his letter gems (SPEC.md, "Session flow", "Game
// layer", and "Changes after version 1").
import { CONFIG as cfg } from './config.js';
import { loadContent, clip, stepLE } from './content.js';
import { STOPS, HALFTIME_STOP, TROPHY_STOP, stopOf, stopStates, worldFor } from './journey.js';
import {
  pixelMapSVG, pixelLevelSVG, pixelGoalSVG, pixelPlayer, pixelGrownUp, PIXEL_ICONS, pawnIcon, letterGem, routeAt, ROUTE, CHARACTERS,
} from './pixel.js';
import { AudioEngine } from './audio.js';
import { playChant } from './music.js';
import { today } from './mastery.js';
import { loadProgress, saveProgress } from './storage.js';
import { listIds, getAudio } from './clipstore.js';
import {
  planSession, currentItem, advance, atHalftime, halftime, halfTotal, scoreItem, finishSession,
  introduceSightWords, chantFor, placementItems, applyPlacement,
} from './session.js';
import { itemClips, letterState } from './choose.js';
import { RUNNERS, placementItem } from './activities.js';
import { openParent } from './parent.js';
import {
  h, mount, sleep, tapped, confirmButton, pick, parentCorner, replayButton, caption, celebrate, confetti, pieceEl, Pitch,
} from './ui.js';

const state = { C: null, P: null, audio: null, day: today(), replay: null, screen: null };
const TEAM_PICTURES = ['cat', 'bat', 'rat', 'dog', 'fox', 'pig', 'hen', 'bug', 'duck', 'sun', 'jet', 'bus', 'van', 'net', 'web', 'box'];
const KIT_COLORS = ['#e63946', '#1d6fd8', '#f77f00', '#7b2cbf', '#ff4fa3', '#e0b100', '#222222', '#00a6a6'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const save = () => saveProgress(state.P);
const setReplay = fn => { state.replay = fn; };
const replay = () => {
  state.audio.stop();
  state.replay?.();
};
const kit = () => state.P.team?.color ?? KIT_COLORS[0];
const player = () => state.P.character ?? CHARACTERS[0];

// Drawn art (SVG markup) as an element.
function art(markup, cls) {
  const el = h('div', { class: cls });
  el.innerHTML = markup;
  return el;
}
const figure = markup => art(`<svg viewBox="-36 -126 72 130" shape-rendering="crispEdges">${markup}</svg>`, 'figure');

function applySettings() {
  state.audio.placeholders = state.P.settings.placeholders;
  state.audio.useCues = state.P.sessionCount >= cfg.promptCueAfterSessions;
  document.documentElement.style.setProperty('--kit', state.P.team?.color ?? KIT_COLORS[0]);
}

function topBar(middle = null) {
  return h('div', { class: 'top' },
    parentCorner(() => openParent(state, {
      onClose: () => {
        applySettings();
        if (state.screen === 'home') home();
      },
      runPlacement: async () => {
        await placement();
        home();
      },
    })),
    h('div', { class: 'top-mid' }, middle),
    replayButton(replay));
}

// A screen, optionally over a drawn, animated scene.
function screen(name, middle, stageKids = [], bottomKids = [], { scene = null } = {}) {
  state.screen = name;
  const stage = h('div', { class: 'stage' }, stageKids);
  const bottom = h('div', { class: 'bottom' }, bottomKids);
  const el = h('div', { class: `screen ${name}` }, topBar(middle), stage, bottom);
  const root = mount(scene ? h('div', { class: 'scene-wrap' }, art(scene, 'scene-bg'), el) : el);
  return { root, stage, bottom };
}

function activityContext(stage, bottom, mode = 'solo') {
  return {
    C: state.C, cfg, audio: state.audio, stage, bottom, setReplay, mode,
    childName: state.P.settings.childName, sessions: state.P.sessionCount,
    onSight: words => {
      state.P = introduceSightWords(state.P, words);
      save();
    },
  };
}

function crest() {
  const { C, P } = state;
  const teamWord = C.byWord.get(P.team?.word);
  const readable = teamWord && stepLE(C, teamWord.step, P.step) && teamWord.letters.every(l => letterState(P, l) !== 'new');
  return h('div', { class: 'crest' }, teamWord?.picture ?? art(PIXEL_ICONS.ball, 'ico'), readable && h('span', { class: 'crest-word' }, teamWord.word));
}

// ---- Start: a tap unlocks audio, then the sound check plays a clip and waits for his tap,
// since the iPhone's silent switch can mute web audio.
function startScreen() {
  const ball = h('button', { class: 'start-ball', 'aria-label': 'Start' }, art(PIXEL_ICONS.ball, 'ball-art'));
  const hint = h('div', { class: 'sound-hint' });
  screen('start', null, [ball, hint]);
  setReplay(null);
  ball.addEventListener('click', async () => {
    state.audio.unlock();
    ball.classList.add('ready');
    const check = () => state.audio.prompt('tap-ball');
    setReplay(check);
    const nudge = setTimeout(() => { hint.textContent = 'No sound? Check the volume and the silent switch, then tap 🔊.'; }, 7000);
    check();
    await tapped(ball);
    clearTimeout(nudge);
    state.audio.stop();
    state.audio.effect('pass');
    if (!state.P.team) await setup();
    else if (!state.P.placementDone) await placement();
    home();
  }, { once: true });
}

// ---- First launch: he names the team with a picture, picks the kit color, and picks his player.
async function setup() {
  const teams = TEAM_PICTURES.filter(k => state.C.byWord.get(k)?.picture)
    .map(k => [k, h('button', { class: 'card pic team' }, state.C.byWord.get(k).picture)]);
  let confirm = confirmButton();
  screen('setup', null, [h('div', { class: 'choices grid-team' }, teams.map(t => t[1]))], [confirm]);
  const askTeam = () => state.audio.say(() => state.audio.prompt('pick-team'));
  setReplay(askTeam);
  askTeam();
  const team = await pick(teams, confirm, k => {
    state.audio.stop();
    state.audio.play(clip.word(k));
  });

  const colors = KIT_COLORS.map(c => [c, h('button', { class: 'card swatch', style: { background: c }, 'aria-label': 'Color' })]);
  confirm = confirmButton();
  screen('setup', h('div', { class: 'crest' }, state.C.byWord.get(team).picture), [h('div', { class: 'choices grid-colors' }, colors.map(c => c[1]))], [confirm]);
  const askColor = () => state.audio.say(() => state.audio.prompt('pick-color'));
  setReplay(askColor);
  askColor();
  const color = await pick(colors, confirm, c => {
    state.audio.effect('tap');
    document.documentElement.style.setProperty('--kit', c);
  });
  state.P.team = { word: team, color };
  save();
  applySettings();
  await pickPlayer();
  await placement();
}

// His player walks the world map and scores the goals. Asked once; existing progress is kept.
async function pickPlayer() {
  const cards = CHARACTERS.map(c => [c, h('button', { class: 'card player', 'aria-label': cap(c) }, figure(pixelPlayer(c, kit(), 6)))]);
  const confirm = confirmButton();
  screen('setup', state.P.team ? crest() : null, [h('div', { class: 'choices grid-players' }, cards.map(c => c[1]))], [confirm]);
  const ask = () => state.audio.say(() => state.audio.prompt('pick-player'));
  setReplay(ask);
  ask();
  state.P.character = await pick(cards, confirm, () => {
    state.audio.stop();
    state.audio.effect('tap');
  });
  save();
}

// ---- Placement: a one-time Sound match sweep over every letter in levels 1 and 2.
async function placement() {
  const items = placementItems(state.C, `${state.day}:placement:${state.P.sessionCount}`);
  const dots = items.map(() => h('span', { class: 'pdot' }));
  const { stage, bottom } = screen('placement', h('div', { class: 'pdots' }, dots));
  const ctx = activityContext(stage, bottom);
  await state.audio.prepare([clip.prompt('placement'), ...items.map(i => clip.sound(i.sound))]);
  await state.audio.say(() => state.audio.prompt('placement'));
  const results = {};
  for (const [i, item] of items.entries()) {
    results[item.letter] = await placementItem(ctx, item);
    dots[i].classList.add('done');
  }
  state.P = applyPlacement(state.C, state.P, results, state.day);
  save();
}

// ---- Home: the world map for his current step, his counters, and two picture buttons, "Just me"
// and "With a grown-up" (the choice only changes how Read aloud is scored). After today's match
// the map shows every stop done. The app never asks for a second session.
function mapSVG(stops, at) {
  const world = worldFor(state.C, state.P.step);
  return pixelMapSVG({ theme: world.theme, kit: kit(), character: player(), stops, at, world: world.number });
}

function home() {
  const { C, P } = state;
  if (!P.character) {
    pickPlayer().then(home);
    return;
  }
  const doneToday = P.lastSessionDay === state.day;
  const map = art(mapSVG(STOPS.map(() => (doneToday ? 'done' : 'ahead')), doneToday ? ROUTE.length - 1 : 0), 'map-wrap');
  const squadValue = P.signed.reduce((n, k) => n + (cfg.pieceValues[C.squad.byWord[k]?.piece] ?? 0), 0);
  const found = C.letters.filter(l => letterState(P, l) !== 'new').length;
  const chip = (markup, n, label, onclick) => h(onclick ? 'button' : 'div', { class: 'chip-stat', 'aria-label': label, onclick }, art(markup, 'ico'), h('b', {}, n));
  const stats = h('div', { class: 'home-stats' },
    chip(PIXEL_ICONS.ball, P.seasonGoals, 'Goals'),
    chip(PIXEL_ICONS.book, P.wordBook.length, 'Word book', book),
    chip(pawnIcon(kit()), squadValue, 'Squad', album),
    chip(PIXEL_ICONS.gem, found, 'Letter gems', gems));
  const solo = h('button', { class: 'card who', 'aria-label': 'Just me' }, figure(pixelPlayer(player(), kit(), 6)));
  const together = h('button', { class: 'card who two', 'aria-label': 'With a grown-up' }, figure(pixelPlayer(player(), kit(), 6)), figure(pixelGrownUp(6)));
  const confirm = confirmButton();
  screen('home', crest(), [stats, map], [solo, confirm, together]);
  const ask = () => state.audio.say(() => state.audio.prompt('who'));
  setReplay(ask);
  if (P.lastSessionDay !== state.day) ask();
  pick([['solo', solo], ['parent', together]], confirm, mode => {
    state.audio.stop();
    state.audio.prompt(mode === 'solo' ? 'just-me' : 'grown-up');
  }).then(match);
}

// ---- The trip: between levels the map comes back and his player walks to the next stop. Any
// tap skips the walk.
async function walk(stops, from, to) {
  const map = art(mapSVG(stops, from), 'map-wrap');
  screen('trip', crest(), [map], []);
  setReplay(null);
  const hero = map.querySelector('#hero');
  const flip = hero?.querySelector('.hero-flip');
  const pose = walking => {
    hero?.querySelector('.pose-stand')?.setAttribute('display', walking ? 'none' : 'inline');
    hero?.querySelector('.pose-walk')?.setAttribute('display', walking ? 'inline' : 'none');
  };
  pose(true);
  let skip = false;
  const onTap = () => { skip = true; };
  document.addEventListener('pointerdown', onTap);
  await sleep(300);
  const ease = t => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
  const place = (seg, t) => {
    const [x, y] = routeAt(seg, ease(t));
    hero.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - 4).toFixed(1)})`);
  };
  for (let seg = from; seg < to && hero; seg++) {
    flip?.setAttribute('transform', ROUTE[seg + 1][0] < ROUTE[seg][0] ? 'scale(-1 1)' : '');
    const t0 = performance.now();
    await new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        place(seg, 1);
        resolve();
      };
      const frame = now => {
        if (finished) return;
        const t = skip ? 1 : Math.min(1, (now - t0) / 650);
        place(seg, t);
        if (t < 1) requestAnimationFrame(frame);
        else finish();
      };
      requestAnimationFrame(frame);
      setTimeout(finish, 950); // even if the screen isn't drawing frames (the app in the background)
    });
  }
  flip?.setAttribute('transform', '');
  pose(false);
  state.audio.effect('tap');
  await sleep(skip ? 120 : 450);
  document.removeEventListener('pointerdown', onTap);
}

// A level: the activity's questions on a frosted panel over its animated scene, with the pitch
// (passes and goals) in the top bar. His signed players cheer in the stadium.
function levelScreen(activity, pitch) {
  const kind = STOPS[stopOf(activity)].kind;
  const signed = state.P.signed.map(k => state.C.squad.byWord[k]?.piece).filter(Boolean);
  const panel = h('div', { class: 'panel' });
  const view = screen(`level ${kind}`, pitch.el, [panel], [], { scene: pixelLevelSVG(kind, { kit: kit(), signed }) });
  return { ...view, panel };
}

// ---- The match: two halves, a pass for every first-try right answer, a goal for three in a row.
// Each activity is a level on the day's trip.
async function match(mode) {
  const { C } = state;
  const S = planSession(C, state.P, { day: state.day, mode, audioOK: id => state.audio.available(id) });
  if (!S.order.length) return home();
  const chant = chantFor(C, state.P, state.P.sessionCount);

  // Decode the session's clips up front.
  const ids = new Set([...Object.keys(C.prompts).map(clip.prompt), ...C.commentary.map((_, i) => clip.commentary(i)), clip.shout]);
  for (const a of S.order) for (const item of S.queues[a]) for (const id of itemClips(C, item)) ids.add(id);
  for (const t of chant.lines.flat()) ids.add(clip.word(t.word));
  screen('loading', null, [art(PIXEL_ICONS.ball, 'loading ball-art')]);
  await state.audio.prepare([...ids]);

  const pitch = new Pitch();
  pitch.half(halfTotal(S, 1));
  const done = new Set(); // stops finished today
  let at = 0; // the route point his player stands on
  const go = async stop => {
    await walk(stopStates(S.order, done, stop), at, stop + 1);
    at = stop + 1;
  };

  state.session = S;
  let item = currentItem(S);
  let current = null;
  let ctx = null;
  while (item) {
    state.item = item;
    if (item.activity !== current) {
      if (current) done.add(stopOf(current));
      if (atHalftime(S)) {
        await go(HALFTIME_STOP);
        await halftimeChant(chant);
        halftime(C, state.P, S);
        done.add(HALFTIME_STOP);
        pitch.half(halfTotal(S, 2));
      }
      await go(stopOf(item.activity));
      const view = levelScreen(item.activity, pitch);
      ctx = activityContext(view.panel, view.bottom, mode);
      if (!current) {
        state.audio.effect('whistle');
        await sleep(700);
      }
      current = item.activity;
    }
    let out = null;
    try {
      out = await RUNNERS[item.activity](ctx, item);
    } catch (e) {
      // An unexpected error skips this item rather than freezing the match.
      console.error(`${item.activity} failed`, e);
      state.audio.stop();
    }
    if (out) {
      const result = scoreItem(C, state.P, S, item, out, cfg);
      state.P = result.P;
      save(); // after every item
      pitch.resize(halfTotal(S, S.half));
      await showEvents(result.events, pitch, S);
    }
    item = advance(C, state.P, S);
  }
  done.add(stopOf(current));
  await go(TROPHY_STOP);
  await fullTime(S);
  state.P = finishSession(C, state.P, S);
  save();
  applySettings();
  await afterMatch(S);
  home();
}

async function showEvents(events, pitch, S) {
  const types = events.map(e => e.type);
  pitch.mark(types.includes('pass') ? 'pass' : types.includes('miss') ? 'miss' : 'help');
  for (const e of events) {
    if (e.type === 'goal') {
      pitch.goals(e.goals[0] + e.goals[1]);
      await pitch.shoot();
      await goal(S);
    } else if (e.type === 'sign') {
      await signing(e);
    } else if (e.type === 'promote') {
      await promotion();
    } else if (e.type === 'book') {
      bookFlash();
    }
  }
}

// A goal: his player shoots and the net shakes, two seconds at most, and a tap skips it. His own
// shout rotates with the commentary.
async function goal(S) {
  const n = state.P.seasonGoals + S.game.goals[0] + S.game.goals[1];
  const id = n % 2 ? clip.shout : clip.commentary(Math.floor(n / 2) % Math.max(1, state.C.commentary.length));
  state.audio.effect('goal');
  state.audio.play(id);
  await celebrate(h('div', { class: 'goal-anim' }, art(pixelGoalSVG(kit(), player()), 'goal-art'), confetti()), {
    ms: cfg.celebrationSeconds * 1000, onSkip: () => state.audio.stop(),
  });
}

async function signing(e) {
  state.audio.effect('sign');
  state.audio.prompt('new-player');
  await celebrate(h('div', { class: 'signing card' }, pieceEl(e.piece, { number: e.number, name: cap(e.word) }), h('div', { class: 'plus' }, `+${e.value}`)), {
    ms: 1800, onSkip: () => state.audio.stop(),
  });
}

// Signing the queen is the ceremony for moving up to the next world.
async function promotion() {
  state.audio.effect('goal');
  state.audio.prompt('queen');
  await celebrate(h('div', { class: 'promotion' }, art(PIXEL_ICONS.crown, 'crown-art'), pieceEl('queen'), confetti(60)), {
    ms: 3500, cls: 'gold', onSkip: () => state.audio.stop(),
  });
}

function bookFlash() {
  const el = h('div', { class: 'book-flash' }, art(PIXEL_ICONS.book, 'ico'), '+1');
  document.body.append(el);
  setTimeout(() => el.remove(), 1200);
}

// ---- Halftime: the team chant on the halftime-show stage, twice. First each word's clip plays on
// its beat; then only the music plays and he sings. A ball bounces from word to word.
async function halftimeChant(chant) {
  const { audio } = state;
  const words = chant.lines.map(line => line.map(t => h('span', { class: 'cw' }, t.text)));
  const ball = art(PIXEL_ICONS.ball, 'chant-ball');
  const lyrics = h('div', { class: 'lyrics' }, words.map(ws => h('div', { class: 'cline' }, ws)), ball);
  const next = confirmButton();
  screen('halftime', null, [h('div', { class: 'panel' }, lyrics)], [next], { scene: pixelLevelSVG('show') });
  const bounce = (li, wi) => {
    for (const el of words.flat()) el.classList.remove('on');
    const el = words[li][wi];
    el.classList.add('on');
    ball.style.left = `${el.offsetLeft + el.offsetWidth / 2}px`;
    ball.style.top = `${el.offsetTop}px`;
    ball.classList.remove('hop');
    void ball.offsetWidth;
    ball.classList.add('hop');
  };
  const tempo = state.P.settings.tempo;
  const sing = () => audio.say(
    () => audio.prompt('halftime'),
    () => playChant(audio, { lines: chant.lines, tune: chant.verse.tune, tempo, clips: true, onWord: bounce }),
    () => audio.prompt('your-turn'),
    () => playChant(audio, { lines: chant.lines, tune: chant.verse.tune, tempo, clips: false, onWord: bounce }),
  );
  setReplay(sing);
  await sing();
  next.disabled = false;
  await tapped(next);
  audio.stop();
}

// ---- Full time, at the trophy: the two halves as a sum. He taps the total; the answer shows
// either way and goes into his season goals.
async function fullTime(S) {
  const [a, b] = S.game.goals;
  const total = a + b;
  const balls = n => h('div', { class: 'balls' }, Array.from({ length: n }, () => art(PIXEL_ICONS.ball, 'ico')));
  const answer = h('b', { class: 'answer' }, '?');
  const sum = h('div', { class: 'sum' },
    h('div', { class: 'term' }, h('b', {}, a), balls(a)), h('span', { class: 'op' }, '+'),
    h('div', { class: 'term' }, h('b', {}, b), balls(b)), h('span', { class: 'op' }, '='), answer);
  const options = [total - 1, total, total + 1, total + 2].filter(n => n >= 0).slice(0, 3).sort(() => Math.random() - 0.5);
  const choices = options.map(n => [n, h('button', { class: 'card num' }, n)]);
  const confirm = confirmButton();
  const panel = h('div', { class: 'panel' }, sum, h('div', { class: 'choices row3' }, choices.map(c => c[1])));
  screen('fulltime', null, [panel], [confirm], { scene: pixelLevelSVG('trophy') });
  const ask = () => state.audio.say(() => state.audio.prompt('full-time'));
  setReplay(ask);
  state.audio.effect('whistle');
  await sleep(900);
  ask();
  const picked = await pick(choices, confirm, () => {
    state.audio.stop();
    state.audio.effect('tap');
  });
  answer.textContent = total;
  choices.find(([n]) => n === total)[1].classList.add('right');
  if (picked === total) state.audio.effect('goal');
  const before = state.P.seasonGoals;
  const season = h('b', {}, before);
  panel.append(h('div', { class: 'season' }, art(PIXEL_ICONS.ball, 'ico'), season));
  for (let n = before + 1; n <= before + total; n++) {
    await sleep(Math.max(80, 600 / Math.max(1, total)));
    season.textContent = n;
    state.audio.effect('tap');
  }
  await sleep(1500);
}

async function afterMatch(S) {
  if (!S.signed.length && !S.booked.length) return;
  const players = S.signed.map(k => {
    const p = state.C.squad.byWord[k];
    return pieceEl(p.piece, { number: p.number, name: cap(k), small: true });
  });
  await celebrate(h('div', { class: 'after card' }, h('div', { class: 'after-players' }, players),
    S.booked.length > 0 && h('div', { class: 'after-book' }, art(PIXEL_ICONS.book, 'ico'), `+${S.booked.length}`)), {
    ms: 3000,
  });
}

function backHome() {
  const back = h('button', { class: 'confirm', 'aria-label': 'Home', disabled: false }, art(PIXEL_ICONS.home, 'confirm-ball'));
  back.addEventListener('click', home);
  return back;
}

// ---- The squad album: every step's players, with silhouettes for the unsigned. The king is
// goalkeeper and captain from the first day.
function album() {
  const { C, P } = state;
  const values = P.signed.map(k => cfg.pieceValues[C.squad.byWord[k]?.piece] ?? 0);
  const total = values.reduce((n, v) => n + v, 0);
  // The squad value as a running sum he can add up; past five cards, just the newest five.
  const terms = values.length > 5 ? ['…', ...values.slice(-5)] : values;
  const sum = values.length > 1 ? `${terms.join(' + ')} = ${total}` : String(total);
  const rows = C.steps.map(s => h('div', { class: 'album-row' }, C.squad.players.filter(p => p.step === s.step).map(p => {
    const signed = P.signed.includes(p.word);
    const el = pieceEl(p.piece, { signed, number: p.number, name: signed ? cap(p.word) : null });
    if (signed) el.addEventListener('click', () => state.audio.play(clip.word(p.word)));
    return el;
  })));
  screen('album', h('div', { class: 'squad-value' }, art(pawnIcon(kit()), 'ico'), sum),
    [h('div', { class: 'scroll' }, h('div', { class: 'album-row captain' }, pieceEl('king', { number: 1 })), rows)], [backHome()]);
  setReplay(null);
}

// ---- The word book: every real word he has read right on a first try, once.
function book() {
  const { C, P } = state;
  const words = P.wordBook.map(k => {
    const w = C.byWord.get(k);
    return h('button', { class: 'card bword', onclick: () => state.audio.play(clip.word(w.word)) }, w.picture && h('span', { class: 'bpic' }, w.picture), w.word);
  });
  screen('book', h('div', { class: 'squad-value' }, art(PIXEL_ICONS.book, 'ico'), P.wordBook.length), [h('div', { class: 'scroll book-grid' }, words)], [backHome()]);
  setReplay(null);
}

// ---- His letter gems: gold when mastered, blue while learning, "?" until he meets the letter.
// Tapping a found gem plays its sound.
function gems() {
  const { C, P } = state;
  const cells = C.letters.map(l => {
    const st = letterState(P, l);
    const el = h('button', { class: `gemcell ${st}`, 'aria-label': st === 'new' ? 'Not found yet' : l });
    el.innerHTML = letterGem(l, st);
    if (st !== 'new') {
      el.addEventListener('click', () => {
        state.audio.stop();
        state.audio.play(clip.sound(C.letterSound[l]));
      });
    }
    return el;
  });
  const found = C.letters.filter(l => letterState(P, l) !== 'new').length;
  screen('gems', h('div', { class: 'squad-value' }, art(PIXEL_ICONS.gem, 'ico'), found), [h('div', { class: 'scroll gem-grid' }, cells)], [backHome()]);
  setReplay(null);
}

// ---- Boot
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// Not on localhost, where it would keep serving stale files while you work (add ?sw to test it).
function registerServiceWorker() {
  if ('serviceWorker' in navigator && (!LOCAL || location.search.includes('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker failed', e));
  }
}

async function boot() {
  document.addEventListener('gesturestart', e => e.preventDefault());
  try {
    state.C = await loadContent();
  } catch (e) {
    mount(h('div', { class: 'fatal' }, 'The game could not load its content files. ', String(e)));
    return;
  }
  state.P = loadProgress(state.C, state.day);
  state.audio = new AudioEngine(state.C);
  state.audio.onCaption = text => caption(text);
  state.audio.getLocal = getAudio;
  state.audio.local = new Set(await listIds()); // clips recorded or made on this device
  applySettings();
  await state.audio.loadManifest();
  document.addEventListener('visibilitychange', () => {
    const ctx = state.audio.ctx;
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
  // Any tap revives the audio if iOS stopped it (a phone call, the microphone, the app in the
  // background); taps count as the user gesture iOS requires.
  document.addEventListener('pointerdown', () => {
    if (!state.audio.running) state.audio.unlock();
  }, true);
  registerServiceWorker();
  if (LOCAL) window.phonics = state; // for poking at a session from the console while testing
  startScreen();
}

boot();
