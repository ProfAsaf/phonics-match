// The check-up as he sees it: a cup match in the night stadium (SPEC.md, "Check-ups"). Each part's
// items rise on the card, and the grown-up scores from the gray strip along its bottom edge: the part,
// a small clock, and the buttons. He sees the items, his player, and the ball, never a score or a
// clock (ground rule 7). Every answer is a keepy-up, right or wrong; each part ends with a goal; after
// the four parts, and the level check when it is due, his player climbs the podium with the cup.
import { CONFIG as cfg } from './config.js';
import { clip, tokenize, spelling } from './content.js';
import { PARTS, PART_NAMES, checkupPlan, scoreLetters, scoreSegmenting, scoreNonsense, scoreStory, applyCheckup } from './checkup.js';
import { RunView, runImages, CUP_START } from './run.js';
import { loadImages } from './art.js';
import { worldFor } from './journey.js';
import { h, mount, icon, ballIcon, replayButton, celebrate, confetti } from './ui.js';

const NIGHT = 6, PODIUM = 7;
const PROMPTS = { letters: 'cup-letters', segmenting: 'cup-segment', nonsense: 'cup-nonsense', story: 'cup-story' };
const ART = { letters: 'gem', segmenting: 'ear', nonsense: 'rook', story: 'book' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// What the grown-up does in each part, on the strip.
const HOW = {
  letters: n => `${cap(n)} says the sound of each letter. Tap ✓ or ✗ for each one. After 3 seconds with no answer, say the sound and tap ✗.`,
  segmenting: n => `The game says a word, and ${n} says each sound in it. Tap each sound said on its own, then Next. All right: every sound was right.`,
  nonsense: n => `${cap(n)} reads each made-up word, sound by sound or all at once. Read it: the whole word came out right, even after sounding it out. Otherwise tap the letters said right, then Next.`,
  story: n => `${cap(n)} reads the story aloud. Tap "Missed a word" for each word missed or skipped, or that you had to say after 3 seconds. When time is up, tap the last word read.`,
};

export async function cupMatch(state, env) {
  const { C, audio, scene } = state;
  const name = state.P.settings.childName || 'your child';
  const plan = checkupPlan(C, state.P, { day: state.day, audioOK: id => audio.available(id) });
  const parts = PARTS.filter(p => (p === 'story' ? plan.story : plan[p].length));
  const seconds = env.seconds ?? cfg.checkup.seconds;

  // Into the stadium: the circle closes on his player while the clips load.
  audio.stop();
  env.setReplay(null);
  mount(h('div', { class: 'screen blank' }));
  await scene.circle(0, state.map.playerPoint());
  mount(h('div', { class: 'screen loading' }, ballIcon('loading ball-art')));
  const world = worldFor(C, state.P.step);
  const ids = [...Object.values(PROMPTS), 'cup-match', 'cup-won', 'level-check'].map(clip.prompt);
  for (const key of plan.segmenting) ids.push(clip.word(C.byWord.get(key).word));
  C.commentary.forEach((_, i) => ids.push(clip.commentary(i)));
  await Promise.all([audio.prepare(ids), loadImages(runImages(env.player(), world.theme))]);
  const followers = state.P.signed.map(k => C.squad.byWord[k]?.piece).filter(Boolean).slice(-3);
  const run = new RunView({ character: env.player(), kit: env.kit(), theme: world.theme, skip: [0, 1, 2, 3, 4, 5], followers, startX: CUP_START, look: env.look, gear: env.gear });
  run.tempo = state.P.settings.tempo;
  scene.show(run);
  const ui = cupScreen(run, env);
  state.screen = 'cup';
  state.cup = { plan, ui };
  await scene.circle(1, run.playerPoint());
  audio.prompt('cup-match');
  await run.toStop(NIGHT, ui.cardH());
  await run.ballIn(true);

  const ctx = { C, audio, run, ui, name, seconds, setReplay: env.setReplay };
  const record = { day: state.day, step: plan.step, level: plan.level, parts: {}, levelCheck: plan.levelCheck ? { level: plan.levelCheck.level } : null, partial: false };
  let levelResults = null;
  let goals = 0;
  const all = [...parts, ...(plan.levelCheck ? ['levelCheck'] : [])];
  for (const [i, part] of all.entries()) {
    if (run.ball.mode !== 'feet') await run.ballIn(); // after a goal, a teammate passes in a new ball
    const out = part === 'levelCheck'
      ? await levelCheck(ctx, plan.levelCheck)
      : await runPart(ctx, plan, part, i + 1, all.length);
    if (part === 'levelCheck') levelResults = out.results;
    else if (out.result) record.parts[part] = out.result;
    if (out.end) {
      record.partial = true;
      break;
    }
    // Each part ends with a goal.
    ui.down();
    await scene.until(() => run.ball.mode !== 'juggle');
    if (run.ball.mode !== 'feet') await run.ballIn();
    await run.goal(NIGHT, ui.cardH(), () => audio.play(clip.commentary(goals++ % Math.max(1, C.commentary.length))));
  }

  if (!record.partial) {
    // Full time: he climbs the podium and lifts the cup.
    ui.down();
    env.setReplay(null);
    audio.effect('whistle');
    await run.toStop(PODIUM, ui.cardH());
    audio.prompt('cup-won');
    await run.podium();
    await celebrate(h('div', { class: 'cupwin' }, icon('trophy', 'cup-art'), confetti(60)), { ms: 3200, cls: 'clear', onSkip: () => audio.stop() });
  }
  if (Object.keys(record.parts).length || levelResults) {
    state.P = applyCheckup(C, state.P, record, { levelResults });
    env.save();
  }

  // Back to the map, with a new cup beside his level.
  await scene.circle(0, run.playerPoint());
  ui.end();
  state.cup = null;
  const map = env.ensureMap();
  map.focus();
  mount(h('div', { class: 'screen blank' }));
  await scene.circle(1, map.playerPoint());
  env.home();
}

// ---- The screen: the replay button, a gold cup in the middle, and the card with the strip.
function cupScreen(run, env) {
  const inner = h('div', { class: 'stage inner cup-inner' });
  const title = h('b', { class: 'ptitle' });
  const clock = h('span', { class: 'pclock' });
  const more = h('button', { class: 'pmore', 'aria-label': 'More choices' }, '•••');
  const hint = h('div', { class: 'phint' });
  const chips = h('div', { class: 'pchips' });
  const buttons = h('div', { class: 'pbtns' });
  const strip = h('div', { class: 'pstrip' }, h('div', { class: 'prow' }, title, clock, more), hint, chips, buttons);
  const card = h('section', { class: 'qcard cup' }, inner, strip);
  mount(h('div', { class: 'screen cupmatch' },
    h('div', { class: 'top' }, replayButton(env.replay), h('div', { class: 'top-mid' }, icon('trophy', 'cup-badge')), h('span', { class: 'top-space' })),
    card));
  const observer = new ResizeObserver(() => {
    if (run.at === NIGHT && run.view.mode === 'frame' && !run.cheering && card.classList.contains('up')) run.frame(NIGHT, card.offsetHeight);
  });
  observer.observe(card);

  // The strip's buttons: ask() shows a row and resolves with the value tapped. "•••" swaps in skip
  // and end, which resolve whatever is waiting with 'skip' or 'end'.
  let pending = null;
  let row = [];
  const render = list => buttons.replaceChildren(...list.map(([label, value, cls]) => h('button', { class: `pbtn ${cls ?? ''}`, onclick: () => settle(value) }, label)));
  const settle = value => {
    if (value === 'back') return render(row);
    const resolve = pending;
    pending = null;
    resolve?.(value);
  };
  more.addEventListener('click', () => {
    if (pending) render([['Keep going', 'back', ''], ['Skip this part', 'skip', ''], ['End the check-up', 'end', 'danger']]);
  });
  return {
    inner,
    cardH: () => card.offsetHeight || 420,
    up() {
      card.classList.add('up');
      if (run.at >= 0) run.frame(run.at, card.offsetHeight);
    },
    down() { card.classList.remove('up'); },
    show(el) { inner.replaceChildren(el); },
    head(t, c = '') {
      title.textContent = t;
      clock.textContent = c;
    },
    clock(t) { clock.textContent = t; },
    hint(t) { hint.textContent = t; },
    // Toggle chips for the sounds or letters in an item; returns the live on/off list.
    chips(labels = []) {
      const on = labels.map(() => false);
      chips.replaceChildren(...labels.map((l, k) => {
        const b = h('button', { class: 'pchip' }, l);
        b.addEventListener('click', () => {
          on[k] = !on[k];
          b.classList.toggle('on', on[k]);
        });
        return b;
      }));
      return on;
    },
    ask(list) {
      row = list;
      render(list);
      return new Promise(resolve => { pending = resolve; });
    },
    end() { observer.disconnect(); },
  };
}

// One minute on the strip's clock. At zero the whistle blows.
function startClock(ctx, onUp) {
  const t0 = performance.now();
  let up = false;
  const elapsed = () => Math.min(ctx.seconds, (performance.now() - t0) / 1000);
  const tick = () => {
    if (up) return;
    const left = Math.ceil(ctx.seconds - (performance.now() - t0) / 1000);
    if (left > 0) return ctx.ui.clock(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    up = true;
    ctx.ui.clock('Time');
    ctx.audio.effect('whistle');
    onUp?.();
  };
  tick();
  const timer = setInterval(tick, 200);
  return { get up() { return up; }, elapsed, stop() { clearInterval(timer); } };
}

// ---- A part: the intro (his instructions are spoken; the grown-up's are on the strip), then the
// minute. Returns { result, end }.
async function runPart(ctx, plan, part, n, total) {
  const { ui, audio } = ctx;
  ui.head(`${n} of ${total} · ${PART_NAMES[part]}`, `${Math.floor(ctx.seconds / 60)}:${String(ctx.seconds % 60).padStart(2, '0')}`);
  ui.hint(HOW[part](ctx.name));
  ui.chips();
  ui.show(h('div', { class: 'cup-intro' }, icon(ART[part], 'ico')));
  const say = () => audio.say(() => audio.prompt(PROMPTS[part]));
  ctx.setReplay(say);
  ui.up();
  say();
  const go = await ui.ask([['Start the minute', 'go', 'go']]);
  audio.stop();
  if (go === 'end') return { result: null, end: true };
  if (go === 'skip') return { result: null };
  const run = { letters, segmenting, nonsense, story }[part];
  return run(ctx, plan);
}

async function letters(ctx, plan) {
  const { ui } = ctx;
  const results = [];
  const clock = startClock(ctx, () => ui.hint('Time! Score the letter on the card, and the part ends.'));
  let i = 0;
  let stop = null;
  while (i < plan.letters.length) {
    const g = plan.letters[i];
    ui.show(h('div', { class: 'cup-letter' }, g));
    const v = await ui.ask([['✗', false, 'no'], ['✓', true, 'yes'], ...(results.length && !clock.up ? [['Undo', 'undo', 'small']] : [])]);
    if (v === 'skip' || v === 'end') {
      stop = v;
      break;
    }
    if (v === 'undo') {
      results.pop();
      i--;
      continue;
    }
    results.push({ g, hit: v });
    ctx.run.touch();
    i++;
    if (clock.up) break;
  }
  clock.stop();
  return { result: results.length ? scoreLetters(results, Math.round(clock.elapsed())) : null, end: stop === 'end' };
}

async function segmenting(ctx, plan) {
  const { ui, audio, C } = ctx;
  const results = [];
  const clock = startClock(ctx, () => ui.hint('Time! Score this word, and the part ends.'));
  let stop = null;
  for (const key of plan.segmenting) {
    const w = C.byWord.get(key);
    const say = () => {
      audio.stop();
      audio.play(clip.word(w.word));
    };
    ui.show(h('button', { class: 'cup-ear', 'aria-label': 'Hear the word', onclick: say }, icon('ear', 'ico')));
    ctx.setReplay(say);
    say();
    const on = ui.chips(w.letters); // one chip per sound, spelled as in the word
    const v = await ui.ask([['Next', 'next', ''], ['All right', 'all', 'yes']]);
    if (v === 'skip' || v === 'end') {
      stop = v;
      break;
    }
    results.push({ word: w.key, got: v === 'all' ? w.sounds.length : on.filter(Boolean).length, of: w.sounds.length });
    ctx.run.touch();
    if (clock.up) break;
  }
  clock.stop();
  ui.chips();
  return { result: results.length ? scoreSegmenting(results, Math.round(clock.elapsed())) : null, end: stop === 'end' };
}

async function nonsense(ctx, plan) {
  const { ui, C } = ctx;
  const results = [];
  const clock = startClock(ctx, () => ui.hint('Time! Score this word, and the part ends.'));
  let stop = null;
  for (const key of plan.nonsense) {
    const w = C.byWord.get(key);
    ui.show(h('div', { class: 'cup-word' }, spelling(w)));
    const on = ui.chips(w.letters);
    const v = await ui.ask([['Next', 'next', ''], ['Read it', 'whole', 'yes']]);
    if (v === 'skip' || v === 'end') {
      stop = v;
      break;
    }
    const whole = v === 'whole';
    results.push({ word: w.key, sounds: whole ? w.letters.length : on.filter(Boolean).length, of: w.letters.length, whole });
    ctx.run.touch();
    if (clock.up) break;
  }
  clock.stop();
  ui.chips();
  // Every word read before the minute was up: the count is scaled to a minute.
  const finished = !stop && !clock.up && results.length === plan.nonsense.length;
  return { result: results.length ? scoreNonsense(results, Math.round(clock.elapsed()), { finished }) : null, end: stop === 'end' };
}

async function story(ctx, plan) {
  const { ui, C } = ctx;
  const p = C.passages.find(x => x.id === plan.story);
  const words = tokenize(C, p.text);
  const spans = words.map(t => h('span', { class: 'sw' }, t.raw));
  const text = h('p', { class: 'cup-text' }, spans.flatMap((s, i) => (i ? [' ', s] : [s])));
  ui.show(h('div', { class: 'cup-story' }, p.emoji && h('div', { class: 'cup-emoji' }, p.emoji), text));
  ui.up();
  let timeUp;
  const up = new Promise(resolve => { timeUp = resolve; });
  const clock = startClock(ctx, () => timeUp('time'));
  let errors = 0;
  let finished = false;
  let stop = null;
  for (;;) {
    const v = await Promise.race([ui.ask([
      [errors ? `Missed a word (${errors})` : 'Missed a word', 'miss', ''],
      ...(errors ? [['−1', 'unmiss', 'small']] : []),
      ['Read it all', 'all', 'yes'],
    ]), up]);
    if (v === 'miss') errors++;
    else if (v === 'unmiss') errors = Math.max(0, errors - 1);
    else if (v === 'all') {
      finished = true;
      break;
    } else if (v === 'time') break;
    else if (v === 'skip' || v === 'end') {
      stop = v;
      break;
    }
  }
  const elapsed = Math.round(clock.elapsed());
  clock.stop();
  if (stop) return { result: null, end: stop === 'end' };
  let last = words.length - 1;
  if (!finished) {
    // Time: the grown-up taps the last word he read, then Done.
    last = -1;
    ui.hint('Time! Tap the last word read, then Done.');
    spans.forEach((s, i) => s.addEventListener('click', () => {
      last = i;
      spans.forEach((x, k) => {
        x.classList.toggle('last', k === i);
        x.classList.toggle('after', k > i);
      });
    }));
    for (;;) {
      const v = await ui.ask([['Read it all', 'all', ''], ['Done', 'done', 'yes']]);
      if (v === 'all') last = words.length - 1;
      if (v === 'skip' || v === 'end') return { result: null, end: v === 'end' };
      if (last >= 0) break;
      ui.hint('Tap the last word read first, then Done.');
    }
  }
  return { result: scoreStory(C, p.id, { last, errors, seconds: finished ? Math.max(1, elapsed) : ctx.seconds, finished }) };
}

// The level check, when it is due: ten words, five real and five held back, with no clock.
async function levelCheck(ctx, check) {
  const { ui, audio, C } = ctx;
  const next = check.level + 1;
  ui.head(`Level ${next} check`, '');
  ui.hint(`Five real and five made-up words, with no clock. ${cfg.levelCheck.pass} read right unlocks level ${next}.`);
  ui.chips();
  ui.show(h('div', { class: 'cup-intro' }, icon('crown', 'ico')));
  const say = () => audio.say(() => audio.prompt('level-check'));
  ctx.setReplay(say);
  ui.up();
  say();
  const go = await ui.ask([['Start', 'go', 'go']]);
  audio.stop();
  if (go === 'end') return { results: null, end: true };
  if (go === 'skip') return { results: null };
  const results = [];
  for (const [i, key] of check.words.entries()) {
    ui.head(`Level ${next} check · ${i + 1} of ${check.words.length}`, '');
    ui.hint('Did the word come out right?');
    ui.show(h('div', { class: 'cup-word' }, spelling(C.byWord.get(key))));
    const v = await ui.ask([['Missed it', false, 'no'], ['Read it', true, 'yes']]);
    if (v === 'skip' || v === 'end') return { results: null, end: v === 'end' };
    results.push(v);
    ctx.run.touch();
  }
  return { results };
}
