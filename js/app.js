// The game: the start screen and sound check, first-launch setup (team, kit color, and player), home
// on the world map, the match as one run past the day's stops with the halftime show and the trophy,
// the squad album, the word book, and his letter gems (SPEC.md, "Session flow", "Game layer", and
// "Changes after version 1"). The world is drawn on one canvas behind the page; the questions sit on a
// card that rises from the bottom.
import { CONFIG as cfg } from './config.js';
import { loadContent, clip, stepLE } from './content.js';
import { STOPS, HALFTIME_STOP, TROPHY_STOP, stopOf, worldFor, mapWorlds, hereLevel } from './journey.js';
import { Scene } from './scene.js';
import { MapView, mapImages } from './map.js';
import { RunView, runImages } from './run.js';
import { loadImages, CHARACTERS, characterFrame, characterImages, ICONS } from './art.js';
import { AudioEngine } from './audio.js';
import { playChant } from './music.js';
import { today } from './mastery.js';
import { loadProgress, saveProgress, activePlayer } from './storage.js';
import { listIds, getAudio } from './clipstore.js';
import {
  planSession, currentItem, advance, atHalftime, halftime, scoreItem, finishSession,
  introduceSightWords, chantFor, placementItems, applyPlacement,
} from './session.js';
import { itemClips, letterState } from './choose.js';
import { RUNNERS, placementItem } from './activities.js';
import { openParent } from './parent.js';
import {
  h, mount, sleep, tapped, confirmButton, pick, parentCorner, replayButton, caption, celebrate, confetti, pieceEl, icon, ballIcon, setKickHint,
} from './ui.js';

const state = { C: null, P: null, audio: null, day: today(), replay: null, screen: null, scene: null, map: null, mapKey: '', run: null, kicks: 0 };
const TEAM_PICTURES = ['cat', 'bat', 'rat', 'dog', 'fox', 'pig', 'hen', 'bug', 'duck', 'sun', 'jet', 'bus', 'van', 'net', 'web', 'box'];
const KIT_COLORS = ['#e63946', '#1d6fd8', '#f77f00', '#7b2cbf', '#ff4fa3', '#e0b100', '#222222', '#00a6a6'];
const TRAIL_ICONS = ['ball', 'rook', 'gem', 'music', 'hammer', 'cloud', 'moon', 'trophy'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const AUTO = LOCAL && new URLSearchParams(location.search).has('auto'); // plays itself, for testing

const save = () => saveProgress(state.P);
const setReplay = fn => { state.replay = fn; };
const replay = () => {
  state.audio.stop();
  state.replay?.();
};
const kit = () => state.P.team?.color ?? KIT_COLORS[0];
const player = () => (CHARACTERS.includes(state.P.character) ? state.P.character : CHARACTERS[0]);

function applySettings() {
  state.audio.placeholders = state.P.settings.placeholders;
  state.audio.useCues = state.P.sessionCount >= cfg.promptCueAfterSessions;
  document.documentElement.style.setProperty('--kit', kit());
}

// His player as a picture for the page, in his kit color.
const portraits = new Map();
function portrait(ch, pose = 'idle', colors = kit()) {
  const key = `${ch}|${pose}|${colors}`;
  if (!portraits.has(key)) {
    const fr = characterFrame(ch, pose, ch === 'grownup' ? null : colors);
    if (!fr) return '';
    const cv = document.createElement('canvas');
    cv.width = 192;
    cv.height = 256;
    cv.getContext('2d').drawImage(fr, 0, 0);
    portraits.set(key, cv.toDataURL());
  }
  return portraits.get(key);
}
const figure = (ch, pose) => h('img', { class: 'figure', src: portrait(ch, pose), alt: '', draggable: 'false' });

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

// A page screen over the world: a top bar, the middle, and a bottom row.
function screen(name, middle, stageKids = [], bottomKids = []) {
  state.screen = name;
  const stage = h('div', { class: 'stage' }, stageKids);
  const bottom = h('div', { class: 'bottom' }, bottomKids);
  const root = mount(h('div', { class: `screen ${name}` }, topBar(middle), stage, bottom));
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
  return h('div', { class: 'crest' }, teamWord?.picture ?? ballIcon(), readable && h('span', { class: 'crest-word' }, teamWord.word));
}

// ---- The world behind the page
function ensureMap({ sync = true } = {}) {
  const key = `${player()}|${kit()}`;
  const worlds = mapWorlds(state.C, state.P);
  if (!state.map || state.mapKey !== key) {
    state.map = new MapView({ worlds, character: player(), kit: kit() });
    state.mapKey = key;
  } else {
    state.map.setWorlds(worlds, { sync });
    if (sync) state.map.placeHere();
  }
  if (state.scene.view !== state.map) state.scene.show(state.map);
  return state.map;
}

// ---- Start: a tap unlocks audio, then the sound check plays a clip and waits for his tap,
// since the iPhone's silent switch can mute web audio.
function startScreen() {
  const ball = h('button', { class: 'start-ball', 'aria-label': 'Start' }, ballIcon('ball-art'));
  const hint = h('div', { class: 'sound-hint' });
  screen('start', null, [ball, hint]);
  setReplay(null);
  ball.addEventListener('click', async () => {
    state.audio.unlock();
    ball.classList.add('ready');
    const check = () => state.audio.prompt('tap-ball');
    setReplay(check);
    const nudge = setTimeout(() => { hint.textContent = 'No sound? Check the volume and the silent switch, then tap the speaker.'; }, 7000);
    check();
    await tapped(ball);
    clearTimeout(nudge);
    state.audio.stop();
    state.audio.effect('pass');
    if (!state.P.team) await setup();
    else if (!state.P.placementDone) await placement();
    home();
  }, { once: true });
  if (AUTO) setTimeout(() => { ball.click(); setTimeout(() => ball.click(), 900); }, 1200);
}

// ---- First launch: he names the team with a picture, picks the kit color, and picks his player.
async function setup() {
  const teams = TEAM_PICTURES.filter(k => state.C.byWord.get(k)?.picture)
    .map(k => [k, h('button', { class: 'card pic team' }, state.C.byWord.get(k).picture)]);
  let confirm = confirmButton();
  screen('setup', null, [h('div', { class: 'sheet' }, h('div', { class: 'choices grid-team' }, teams.map(t => t[1])))], [confirm]);
  const askTeam = () => state.audio.say(() => state.audio.prompt('pick-team'));
  setReplay(askTeam);
  askTeam();
  const team = await pick(teams, confirm, k => {
    state.audio.stop();
    state.audio.play(clip.word(k));
  });

  const colors = KIT_COLORS.map(c => [c, h('button', { class: 'card swatch', style: { background: c }, 'aria-label': 'Color' })]);
  confirm = confirmButton();
  screen('setup', h('div', { class: 'crest' }, state.C.byWord.get(team).picture), [h('div', { class: 'sheet' }, h('div', { class: 'choices grid-colors' }, colors.map(c => c[1])))], [confirm]);
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

// His player runs the day and scores the goals: a boy, a girl, a robot, or the friendly zombie,
// all in his kit color. Asked again if the game's players change; his progress is kept.
async function pickPlayer() {
  await loadImages(CHARACTERS.flatMap(characterImages));
  const cards = CHARACTERS.map(ch => {
    const img = figure(ch, 'idle');
    return [ch, h('button', { class: 'card player', 'aria-label': cap(ch) }, img)];
  });
  const confirm = confirmButton();
  screen('setup', state.P.team ? crest() : null, [h('div', { class: 'sheet' }, h('div', { class: 'choices grid-players' }, cards.map(c => c[1])))], [confirm]);
  const ask = () => state.audio.say(() => state.audio.prompt('pick-player'));
  setReplay(ask);
  ask();
  state.P.character = await pick(cards, confirm, ch => {
    state.audio.stop();
    state.audio.effect('tap');
    for (const [c, el] of cards) el.querySelector('img').src = portrait(c, c === ch ? 'cheer0' : 'idle');
  });
  save();
}

// ---- Placement: a one-time Sound match sweep over every letter in levels 1 and 2.
async function placement() {
  const items = placementItems(state.C, `${state.day}:placement:${state.P.sessionCount}`);
  const dots = items.map(() => h('span', { class: 'pdot' }));
  state.screen = 'placement';
  const { card, inner, bottom } = makeCard();
  mount(h('div', { class: 'screen placement' }, topBar(h('div', { class: 'pdots' }, dots)), card));
  const ctx = activityContext(inner, bottom);
  await state.audio.prepare([clip.prompt('placement'), ...items.map(i => clip.sound(i.sound))]);
  card.classList.add('up');
  await state.audio.say(() => state.audio.prompt('placement'));
  const results = {};
  for (const [i, item] of items.entries()) {
    results[item.letter] = await placementItem(ctx, item);
    dots[i].classList.add('done');
  }
  state.P = applyPlacement(state.C, state.P, results, state.day);
  save();
}

// ---- Home: the world map, his counters, and two picture buttons, "Just me" and "With a grown-up"
// (the choice only changes how Read aloud is scored). After today's match his player waits on
// tomorrow's level. The app never asks for a second session.
function home() {
  const { C, P } = state;
  if (!CHARACTERS.includes(P.character)) {
    pickPlayer().then(home);
    return;
  }
  ensureMap();
  const squadValue = P.signed.reduce((n, k) => n + (cfg.pieceValues[C.squad.byWord[k]?.piece] ?? 0), 0);
  const found = C.letters.filter(l => letterState(P, l) !== 'new').length;
  const chip = (ico, n, label, onclick) => h(onclick ? 'button' : 'div', { class: 'chip-stat', 'aria-label': label, onclick }, ico, h('b', {}, n));
  const stats = h('div', { class: 'home-stats' },
    chip(ballIcon(), P.seasonGoals, 'Goals'),
    chip(icon('book'), P.wordBook.length, 'Word book', book),
    chip(icon('rook'), squadValue, 'Squad', album),
    chip(icon('gem'), found, 'Letter gems', gems));
  const solo = h('button', { class: 'card who', 'aria-label': 'Just me' }, figure(player(), 'idle'));
  const together = h('button', { class: 'card who two', 'aria-label': 'With a grown-up' }, figure(player(), 'idle'), figure('grownup', 'idle'));
  const confirm = confirmButton();
  screen('home', crest(), [stats], [solo, confirm, together]);
  const ask = () => state.audio.say(() => state.audio.prompt('who'));
  setReplay(ask);
  if (P.lastSessionDay !== state.day) ask();
  pick([['solo', solo], ['parent', together]], confirm, mode => {
    state.audio.stop();
    state.audio.prompt(mode === 'solo' ? 'just-me' : 'grown-up');
  }).then(match);
  if (AUTO && !state.autoDone) setTimeout(() => { solo.click(); setTimeout(() => confirm.click(), 900); }, 3500);
  else if (AUTO) setTimeout(() => { document.title = 'done'; }, 2500);
}

// ---- The card: the questions rise on it from the bottom, over the ground.
function makeCard() {
  const inner = h('div', { class: 'stage inner' });
  const bottom = h('div', { class: 'bottom' });
  const card = h('section', { class: 'qcard' }, inner, bottom);
  return { card, inner, bottom };
}

// The top of the run: the replay button, today's trail of stops, and the score with the move meter.
function runHud(run) {
  const marker = h('span', { class: 'me', style: { backgroundImage: `url(${portrait(player())})` } });
  const fill = h('span', { class: 'fill' });
  const stops = TRAIL_ICONS.map((k, i) => h('span', { class: `stop${run.skip.has(i) ? ' skip' : ''}` }, k === 'ball' ? ballIcon() : icon(k)));
  const trail = h('div', { class: 'trail' }, h('span', { class: 'track' }, fill), h('div', { class: 'stops' }, stops), marker);
  const count = h('b', {}, '0');
  const dots = [0, 1, 2].map(() => h('i'));
  const score = h('div', { class: 'score' }, ballIcon(), count, h('span', { class: 'moves' }, dots));
  const { card, inner, bottom } = makeCard();
  const root = h('div', { class: 'screen run' }, h('div', { class: 'top' }, replayButton(replay), trail, score), card);
  mount(root);
  state.screen = 'run';
  let alive = true;
  state.scene.until(() => {
    const w = trail.clientWidth;
    const px = 22 + (run.trail() * (w - 44)) / 7;
    marker.style.left = `${px}px`;
    fill.style.width = `${Math.max(0, px - 22)}px`;
    return !alive;
  });
  const cardH = () => (card.classList.contains('up') ? card.offsetHeight : card.offsetHeight || 380);
  new ResizeObserver(() => {
    if (run.at >= 0 && run.view.mode === 'frame' && !run.cheering && card.classList.contains('up')) run.frame(run.at, card.offsetHeight);
  }).observe(card);
  return {
    card, inner, bottom, cardH,
    up() {
      card.classList.add('up');
      if (run.at >= 0) run.frame(run.at, card.offsetHeight);
    },
    down() { card.classList.remove('up'); },
    here(i) { stops.forEach((el, k) => el.classList.toggle('here', k === i)); },
    done(i) { stops[i]?.classList.add('done'); },
    meter(n) { dots.forEach((d, k) => d.classList.toggle('on', k < n)); },
    goals(n) {
      count.textContent = n;
      score.classList.remove('pop');
      void score.offsetWidth;
      score.classList.add('pop');
    },
    end() { alive = false; },
  };
}

// The first few times, if he picks an answer and doesn't kick, a hand points at the ball and the
// voice says to kick it.
function kickHints() {
  setKickHint(confirm => {
    if (state.P.sessionCount >= 3 && state.kicks >= 6) return null;
    confirm.addEventListener('click', () => { state.kicks++; }, { once: true });
    let hand = null;
    const timer = setTimeout(() => {
      // Placed inside the card (or whatever holds the ball), so it moves with it.
      const holder = confirm.offsetParent;
      if (!holder || !confirm.offsetWidth) return;
      hand = h('div', { class: 'hand', html: ICONS.hand, style: { left: `${confirm.offsetLeft + confirm.offsetWidth * 0.55}px`, top: `${confirm.offsetTop - confirm.offsetHeight * 0.55}px` } });
      holder.append(hand);
      if (!confirm.dataset.hinted) {
        confirm.dataset.hinted = '1';
        state.audio.prompt('kick');
      }
    }, 2400);
    return { cancel() { clearTimeout(timer); hand?.remove(); } };
  });
}

// ---- The match: two halves on one run. Each first-try right answer is a pass that dribbles the
// ball toward the stop's goal; three in a row shoot and score.
async function match(mode) {
  const { C } = state;
  const S = planSession(C, state.P, { day: state.day, mode, audioOK: id => state.audio.available(id) });
  if (!S.order.length) return home();
  const chant = chantFor(C, state.P, state.P.sessionCount);
  const worldsBefore = mapWorlds(C, state.P);
  const world = worldFor(C, state.P.step);

  // Into the run: the circle closes on his player while the clips decode.
  state.audio.stop();
  setReplay(null);
  mount(h('div', { class: 'screen blank' }));
  await state.scene.circle(0, state.map.playerPoint());
  mount(h('div', { class: 'screen loading' }, ballIcon('loading ball-art')));
  const ids = new Set([...Object.keys(C.prompts).map(clip.prompt), ...C.commentary.map((_, i) => clip.commentary(i)), clip.shout]);
  for (const a of S.order) for (const item of S.queues[a]) for (const id of itemClips(C, item)) ids.add(id);
  for (const t of chant.lines.flat()) ids.add(clip.word(t.word));
  await Promise.all([state.audio.prepare([...ids]), loadImages(runImages(player(), world.theme))]);

  const skip = STOPS.map((s, i) => (s.activity && !S.order.includes(s.activity) ? i : -1)).filter(i => i >= 0);
  const followers = state.P.signed.map(k => C.squad.byWord[k]?.piece).filter(Boolean).slice(-3);
  const run = new RunView({ character: player(), kit: kit(), theme: world.theme, skip, followers });
  run.tempo = state.P.settings.tempo;
  state.run = run;
  state.scene.show(run);
  const hud = runHud(run);
  const ctx = activityContext(hud.inner, hud.bottom, mode);
  state.session = S;
  await state.scene.circle(1, run.playerPoint());
  state.audio.prompt('lets-go');

  let item = currentItem(S);
  let current = null;
  let kickoff = true;
  let stop = -1;
  while (item) {
    state.item = item;
    if (item.activity !== current) {
      hud.down();
      if (current) hud.done(stop);
      if (atHalftime(S)) {
        await halftimeShow(run, hud, chant);
        halftime(C, state.P, S);
      }
      stop = stopOf(item.activity);
      hud.here(stop);
      await run.toStop(stop, hud.cardH());
      await run.ballIn(kickoff);
      kickoff = false;
      current = item.activity;
    } else if (run.ball.mode !== 'feet') {
      await run.ballIn();
    }
    hud.inner.classList.add('swap');
    setTimeout(() => hud.inner.classList.remove('swap'), 180);
    let out = null;
    try {
      const running = RUNNERS[item.activity](ctx, item);
      hud.up();
      out = await running;
    } catch (e) {
      // An unexpected error skips this item rather than freezing the match.
      console.error(`${item.activity} failed`, e);
      state.audio.stop();
    }
    if (out) {
      const result = scoreItem(C, state.P, S, item, out, cfg);
      state.P = result.P;
      save(); // after every item
      await showEvents(result.events, run, hud, S, stop);
    }
    item = advance(C, state.P, S);
  }
  hud.down();
  hud.done(stop);
  hud.here(TROPHY_STOP);
  await run.toStop(TROPHY_STOP, hud.cardH());
  await fullTime(S, run, hud);
  hud.done(TROPHY_STOP);
  state.P = finishSession(C, state.P, S);
  save();
  applySettings();

  // Back to the map: a flag on today's level, and he walks on (or through the gate).
  await state.scene.circle(0, run.playerPoint());
  hud.end();
  state.run = null;
  const map = ensureMap({ sync: false });
  map.focus();
  mount(h('div', { class: 'screen blank' }));
  await state.scene.circle(1, map.playerPoint());
  await afterMatch(S);
  const was = worldsBefore.findIndex(w => w.state === 'here');
  const now = map.worlds.findIndex(w => w.state === 'here');
  if (was >= 0 && now > was) {
    state.audio.prompt('new-world');
    await map.openGate(was);
  } else if (now >= 0) {
    await map.walkTo(now, hereLevel(map.worlds[now]));
  }
  state.autoDone = AUTO;
  home();
}

async function showEvents(events, run, hud, S, stop) {
  const goal = events.find(e => e.type === 'goal');
  if (goal) {
    hud.meter(3);
    hud.down();
    await run.goal(stop, hud.cardH(), () => cheer(S));
    hud.goals(goal.goals[0] + goal.goals[1]);
    hud.meter(0);
  } else if (events.some(e => e.type === 'pass')) {
    hud.meter(run.streak + 1);
    await run.pass(stop);
  } else if (events.some(e => e.type === 'miss')) {
    hud.meter(0);
    await run.miss(stop);
  }
  for (const e of events) {
    if (e.type === 'sign') await signing(e, run);
    else if (e.type === 'promote') await promotion(run);
    else if (e.type === 'book') bookFlash();
  }
}

// The commentary on a goal, rotating with his own shout.
function cheer(S) {
  const n = state.P.seasonGoals + S.game.goals[0] + S.game.goals[1];
  const id = n % 2 ? clip.shout : clip.commentary(Math.floor(n / 2) % Math.max(1, state.C.commentary.length));
  state.audio.play(id);
}

async function signing(e, run) {
  state.audio.effect('sign');
  state.audio.prompt('new-player');
  run.sign(e.piece);
  await celebrate(h('div', { class: 'signing card' }, pieceEl(e.piece, { number: e.number, name: cap(e.word) }), h('div', { class: 'plus' }, `+${e.value}`)), {
    ms: 1800, onSkip: () => state.audio.stop(),
  });
}

// Signing the queen is the ceremony for moving up: after the match the gate to the next world opens.
async function promotion(run) {
  state.audio.effect('goal');
  state.audio.prompt('queen');
  run.sign('queen');
  await celebrate(h('div', { class: 'promotion' }, icon('crown', 'crown-art'), pieceEl('queen'), confetti(60)), {
    ms: 3500, cls: 'gold', onSkip: () => state.audio.stop(),
  });
}

function bookFlash() {
  const el = h('div', { class: 'book-flash' }, icon('book'), '+1');
  document.body.append(el);
  setTimeout(() => el.remove(), 1200);
}

// ---- Halftime: the team chant at the show, twice. First each word's clip plays on its beat; then
// only the music plays and he sings. A ball bounces from word to word, and his friends dance.
async function halftimeShow(run, hud, chant) {
  const { audio } = state;
  hud.here(HALFTIME_STOP);
  await run.toStop(HALFTIME_STOP, hud.cardH());
  const words = chant.lines.map(line => line.map(t => h('span', { class: 'cw' }, t.text)));
  const ball = ballIcon('chant-ball');
  const lyrics = h('div', { class: 'lyrics' }, words.map(ws => h('div', { class: 'cline' }, ws)), ball);
  const next = confirmButton();
  hud.inner.replaceChildren(lyrics);
  hud.bottom.replaceChildren(next);
  hud.up();
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
  const sing = async () => {
    run.dancing = true;
    await audio.say(
      () => audio.prompt('halftime'),
      () => playChant(audio, { lines: chant.lines, tune: chant.verse.tune, tempo, clips: true, onWord: bounce }),
      () => audio.prompt('your-turn'),
      () => playChant(audio, { lines: chant.lines, tune: chant.verse.tune, tempo, clips: false, onWord: bounce }),
    );
    run.dancing = false;
  };
  setReplay(sing);
  await sing();
  next.disabled = false;
  if (AUTO) setTimeout(() => next.click(), 500);
  await tapped(next);
  audio.stop();
  run.dancing = false;
  hud.down();
  hud.done(HALFTIME_STOP);
}

// ---- Full time, at the trophy: the two halves as a sum. He taps the total; the answer shows either
// way and goes into his season goals. Then he climbs the podium.
async function fullTime(S, run, hud) {
  const [a, b] = S.game.goals;
  const total = a + b;
  const balls = n => h('div', { class: 'balls' }, Array.from({ length: n }, () => ballIcon()));
  const answer = h('b', { class: 'answer' }, '?');
  const sum = h('div', { class: 'sum' },
    h('div', { class: 'term' }, h('b', {}, a), balls(a)), h('span', { class: 'op' }, '+'),
    h('div', { class: 'term' }, h('b', {}, b), balls(b)), h('span', { class: 'op' }, '='), answer);
  const options = [total - 1, total, total + 1, total + 2].filter(n => n >= 0).slice(0, 3).sort(() => Math.random() - 0.5);
  const choices = options.map(n => [n, h('button', { class: 'card num' }, n)]);
  const confirm = confirmButton();
  hud.inner.replaceChildren(sum, h('div', { class: 'choices row3' }, choices.map(c => c[1])));
  hud.bottom.replaceChildren(confirm);
  hud.up();
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
  hud.bottom.replaceChildren(h('div', { class: 'season' }, ballIcon(), season));
  for (let n = before + 1; n <= before + total; n++) {
    await sleep(Math.max(80, 600 / Math.max(1, total)));
    season.textContent = n;
    state.audio.effect('tap');
  }
  await sleep(900);
  hud.down();
  state.audio.effect('cheer');
  await run.podium();
  await sleep(2600);
}

async function afterMatch(S) {
  if (!S.signed.length && !S.booked.length) return;
  const players = S.signed.map(k => {
    const p = state.C.squad.byWord[k];
    return pieceEl(p.piece, { number: p.number, name: cap(k), small: true });
  });
  await celebrate(h('div', { class: 'after card' }, h('div', { class: 'after-players' }, players),
    S.booked.length > 0 && h('div', { class: 'after-book' }, icon('book'), `+${S.booked.length}`)), {
    ms: 3000,
  });
}

function backHome() {
  const back = h('button', { class: 'confirm back', 'aria-label': 'Home' }, icon('home', 'confirm-ball home-ico'));
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
  screen('album', h('div', { class: 'squad-value' }, icon('rook'), sum),
    [h('div', { class: 'sheet scroll' }, h('div', { class: 'album-row captain' }, pieceEl('king', { number: 1 })), rows)], [backHome()]);
  setReplay(null);
}

// ---- The word book: every real word he has read right on a first try, once.
function book() {
  const { C, P } = state;
  const words = P.wordBook.map(k => {
    const w = C.byWord.get(k);
    return h('button', { class: 'card bword', onclick: () => state.audio.play(clip.word(w.word)) }, w.picture && h('span', { class: 'bpic' }, w.picture), w.word);
  });
  screen('book', h('div', { class: 'squad-value' }, icon('book'), P.wordBook.length), [h('div', { class: 'sheet scroll book-grid' }, words)], [backHome()]);
  setReplay(null);
}

// ---- His letter gems: gold when mastered, blue while learning, "?" until he meets the letter.
// Tapping a found gem plays its sound.
function gems() {
  const { C, P } = state;
  const cells = C.letters.map(l => {
    const st = letterState(P, l);
    const gem = st === 'mastered' ? 'gemYellow' : 'gemBlue';
    const el = h('button', { class: `gemcell ${st}`, 'aria-label': st === 'new' ? 'Not found yet' : l },
      h('img', { src: `art/item/${gem}.png`, alt: '', draggable: 'false' }), h('b', {}, st === 'new' ? '?' : l));
    if (st !== 'new') {
      el.addEventListener('click', () => {
        state.audio.stop();
        state.audio.play(clip.sound(C.letterSound[l]));
      });
    }
    return el;
  });
  const found = C.letters.filter(l => letterState(P, l) !== 'new').length;
  screen('gems', h('div', { class: 'squad-value' }, icon('gem'), found), [h('div', { class: 'sheet scroll gem-grid' }, cells)], [backHome()]);
  setReplay(null);
}

// ---- Playing itself, for testing on this computer: it answers most items right.
function autoPlay() {
  const click = el => el && !el.disabled && el.click();
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    if (state.screen === 'setup' || state.screen === 'placement') {
      busy = true;
      const first = document.querySelector('#app [data-v]:not(.gone)');
      const go = document.querySelector('#app .confirm');
      if (go && !go.disabled) click(go);
      else if (first) click(first);
      await sleep(500);
      busy = false;
      return;
    }
    if (state.screen !== 'run') return;
    const card = document.querySelector('.qcard.up');
    if (!card) return;
    busy = true;
    try {
      const item = state.item;
      const confirm = card.querySelector('.confirm');
      const pbtn = card.querySelector('.pbtn');
      const tiles = [...card.querySelectorAll('.tile:not(.used):not(.gone)')];
      const sum = card.querySelector('.sum');
      if (sum && confirm?.disabled) {
        const total = state.session.game.goals[0] + state.session.game.goals[1];
        click(card.querySelector(`[data-v="${total}"]`));
      } else if (pbtn) click(pbtn);
      else if (item?.activity === 'buildIt' && tiles.length && confirm?.disabled) {
        for (const l of item.letters) {
          click(tiles.find(t => t.textContent === l && !t.classList.contains('used')));
          await sleep(350);
        }
      } else if (card.querySelector('.tappable') && confirm?.disabled) click(card.querySelector('.tappable'));
      else if (confirm && !confirm.disabled) click(confirm);
      else {
        const choices = [...card.querySelectorAll('[data-v]:not(.gone)')];
        if (choices.length && item && 'answer' in item) {
          const right = choices.find(c => c.dataset.v === String(item.answer));
          const wrong = choices.find(c => c !== right);
          click(Math.random() < 0.12 && wrong ? wrong : right);
        }
      }
    } finally {
      await sleep(900);
      busy = false;
    }
  }, 400);
}

// When playing itself, every sound is logged with the wall clock, so a screen recording of the test
// can be given its audio afterward.
function logAudio() {
  const a = state.audio, log = (window.__audio = []);
  const wall = when => Date.now() / 1000 + (when - a.now());
  const wrap = (name, fn) => {
    const orig = a[name].bind(a);
    a[name] = (...args) => {
      fn(...args);
      return orig(...args);
    };
  };
  wrap('at', (id, when) => log.push({ m: 'clip', t: wall(when), id }));
  wrap('tone', (freq, when, dur, type, gain, slideTo) => log.push({ m: 'tone', t: wall(when), freq, dur, type: type ?? 'sine', gain: gain ?? 0.2, slideTo: slideTo ?? null }));
  wrap('noise', (when, dur, opts = {}) => log.push({ m: 'noise', t: wall(when), dur, ...opts }));
  wrap('kick', when => log.push({ m: 'kick', t: wall(when) }));
  wrap('effect', name => { if (name === 'whistle' && a.running) log.push({ m: 'whistle', t: Date.now() / 1000 }); });
  wrap('stop', () => log.push({ m: 'stop', t: Date.now() / 1000 }));
}

// ---- Boot
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
  // A grown-up testing: a small label, so the test player is never left on by mistake.
  if (activePlayer() === 'test') document.body.append(h('div', { class: 'test-badge' }, 'Test player'));
  state.audio = new AudioEngine(state.C);
  state.audio.onCaption = text => caption(text);
  state.audio.getLocal = getAudio;
  state.audio.local = new Set(await listIds()); // clips recorded or made on this device
  applySettings();
  state.scene = new Scene(document.getElementById('world'));
  state.scene.audio = state.audio;
  await Promise.all([state.audio.loadManifest(), loadImages([...mapImages(player()), 'char/grownup/idle']), document.fonts?.load('700 30px Fredoka').catch(() => {})]);
  ensureMap();
  state.scene.start();
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
  kickHints();
  registerServiceWorker();
  if (LOCAL) window.phonics = state; // for poking at a session from the console while testing
  if (AUTO) {
    logAudio();
    autoPlay();
  }
  startScreen();
}

boot();
