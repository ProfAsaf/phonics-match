// The six activities and the correction routine (SPEC.md, "Activities"). Each runner shows one
// item, waits for his answer, coaches a miss, and returns what happened for scoring.
//
// ctx: { C, cfg, audio, stage, bottom, setReplay(fn), mode, childName, sessions, onSight(words) }
import { clip } from './content.js';
import { h, sleep, flash, pick, confirmButton, speakerButton, tapped, icon } from './ui.js';

const entry = (ctx, key) => ctx.C.byWord.get(key);
const PRAISE = ['nice', 'yes', 'great'];

// Letters with a dot under each. A touched dot lights up silently, unless onDot plays its sound.
function lettersWithDots(letters, onDot) {
  return letters.map((l, i) => {
    const dot = onDot === false ? null : h('span', { class: 'dot' });
    dot?.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      flash(dot, 500);
      onDot?.(i, l);
    });
    // Touching a dot is part of reading, not tapping the word, except while a parent marks letters.
    dot?.addEventListener('click', e => {
      if (!dot.closest('.marking')) e.stopPropagation();
    });
    return h('span', { class: 'col' }, h('span', { class: 'letter' }, l), dot);
  });
}

function wordView(ctx, key, onDot) {
  const cols = lettersWithDots(entry(ctx, key).letters, onDot);
  return { el: h('div', { class: 'word' }, cols), cols };
}

function boxesFor(n) {
  const boxes = Array.from({ length: n }, () => h('span', { class: 'box' }));
  return { el: h('div', { class: 'boxes' }, boxes), boxes };
}

// Each sound while its letter or box lights up, then the whole word (correction step 1).
function showThePlay(ctx, w, els) {
  return ctx.audio.say(
    () => ctx.audio.sequence(w.sounds.map(clip.sound), { gap: ctx.cfg.gaps.coach, onStart: i => flash(els[i], 600) }),
    () => ctx.audio.play(clip.word(w.word)),
  );
}

// The sounds again with shrinking gaps, 0.7 seconds then 0.3, then the word (correction step 3).
function slowThenFast(ctx, w, els) {
  const sounds = w.sounds.map(clip.sound);
  const lit = i => flash(els[i], 500);
  return ctx.audio.say(
    () => ctx.audio.sequence(sounds, { gap: ctx.cfg.gaps.slow, onStart: lit }),
    () => ctx.audio.sequence(sounds, { gap: ctx.cfg.gaps.fast, onStart: lit }),
    () => ctx.audio.play(clip.word(w.word)),
  );
}

async function good(ctx, el) {
  el?.classList.add('right');
  ctx.audio.effect('pass');
  if (Math.random() < 0.3) await ctx.audio.prompt(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  else await sleep(500);
}

// The shared pattern: choices and a confirm button. A first-try miss gets no buzzer, only the
// correction routine: (1) the coach shows the play, (2) the wrong choice goes and he answers again,
// (3) on a second miss the sounds replay slower then faster and the answer shows. Step 4, bringing
// the item back later, is the session's job.
async function runChoice(ctx, { choices, confirm, answer, onSelect, coach, slow }) {
  const { audio } = ctx;
  const els = new Map(choices);
  const select = v => {
    audio.stop();
    onSelect?.(v);
  };
  const first = await pick(choices, confirm, select);
  if (first === answer) {
    await good(ctx, els.get(answer));
    return { correct: true, picked: first };
  }
  audio.stop();
  await audio.say(() => audio.prompt('watch'), coach);
  const wrong = els.get(first);
  wrong.disabled = true;
  wrong.classList.add('gone');
  await audio.say(() => audio.prompt('try-again'));
  const second = await pick(choices.filter(([v]) => v !== first), confirm, select);
  if (second === answer) {
    els.get(answer).classList.add('right');
    audio.effect('tap');
    await sleep(600);
  } else {
    els.get(second).disabled = true;
    els.get(second).classList.add('gone');
    await audio.say(() => audio.prompt('here-it-is'), slow);
    els.get(answer).classList.add('right');
    await sleep(900);
  }
  return { correct: false, picked: first };
}

function setUp(ctx, stageKids, replay) {
  const confirm = confirmButton();
  ctx.stage.replaceChildren(...stageKids);
  ctx.bottom.replaceChildren(confirm);
  ctx.setReplay(replay);
  return confirm;
}

// ---- 1. Sound match
export async function soundMatch(ctx, item) {
  const { audio } = ctx;
  const sound = clip.sound(item.sound);
  if (item.intro) await meetLetter(ctx, item.letter, sound);
  const again = () => audio.sequence([sound, sound, sound], { gap: [ctx.cfg.gaps.slow, ctx.cfg.gaps.fast] });

  if (item.form === 'forward') {
    // He hears a sound and taps its letter. The letters stay silent: hearing them would give it away.
    const choices = item.choices.map(l => [l, h('button', { class: 'card letter-card' }, l)]);
    const answerEl = choices.find(([l]) => l === item.answer)[1];
    const play = full => audio.say(() => audio.prompt('sound-match', { full }), () => audio.play(sound));
    const confirm = setUp(ctx, [h('div', { class: 'target speaker-target' }, icon('speaker', 'ico spk-target')), h('div', { class: 'choices grid4' }, choices.map(c => c[1]))], () => play(true));
    await play(false);
    return runChoice(ctx, {
      choices, confirm, answer: item.answer,
      coach: async () => {
        answerEl.classList.add('lit');
        await audio.play(sound);
        answerEl.classList.remove('lit');
      },
      slow: again,
    });
  }
  // Reverse: he sees a letter and picks its sound from three speakers, the direction reading uses.
  const target = h('div', { class: 'target card big-letter' }, item.letter);
  const choices = item.choices.map((s, i) => [s, speakerButton(i)]);
  const play = full => audio.say(() => audio.prompt('sound-match-rev', { full }));
  const confirm = setUp(ctx, [target, h('div', { class: 'choices row3' }, choices.map(c => c[1]))], () => play(true));
  await play(false);
  return runChoice(ctx, {
    choices, confirm, answer: item.answer,
    onSelect: s => audio.play(clip.sound(s)),
    coach: async () => {
      target.classList.add('lit');
      await audio.play(sound);
      target.classList.remove('lit');
    },
    slow: again,
  });
}

// A new letter-sound enters: he sees the letter and hears it twice before his first try.
async function meetLetter(ctx, letter, sound) {
  const { audio } = ctx;
  const card = h('div', { class: 'target card big-letter new' }, letter);
  const next = confirmButton();
  ctx.stage.replaceChildren(card);
  ctx.bottom.replaceChildren(next);
  const play = () => audio.say(
    () => audio.prompt('new-letter'),
    () => { flash(card, 800); return audio.play(sound); },
    () => sleep(350),
    () => { flash(card, 800); return audio.play(sound); },
  );
  ctx.setReplay(play);
  await play();
  next.disabled = false;
  await tapped(next);
  audio.stop();
}

// ---- 2. Blend it: separate sounds, no print; he taps the picture they make.
export async function blendIt(ctx, item) {
  const { audio, cfg } = ctx;
  const w = entry(ctx, item.word);
  const { el: row, boxes } = boxesFor(w.sounds.length);
  const choices = item.choices.map(k => [k, h('button', { class: 'card pic' }, entry(ctx, k).picture)]);
  const sounds = () => audio.sequence(w.sounds.map(clip.sound), { gap: cfg.gaps.blend, onStart: i => flash(boxes[i], 600) });
  const play = full => audio.say(() => audio.prompt('blend', { full }), sounds);
  const confirm = setUp(ctx, [row, h('div', { class: 'choices row3' }, choices.map(c => c[1]))], () => play(true));
  await play(false);
  return runChoice(ctx, {
    choices, confirm, answer: item.answer,
    onSelect: k => audio.play(clip.word(entry(ctx, k).word)), // a picture always says its name
    coach: () => showThePlay(ctx, w, boxes),
    slow: () => slowThenFast(ctx, w, boxes),
  });
}

// ---- 3. Find the sound: a spoken word, three boxes, one glowing; he picks that box's sound.
export async function findSound(ctx, item) {
  const { audio } = ctx;
  const w = entry(ctx, item.word);
  const { el: row, boxes } = boxesFor(3);
  boxes[item.index].classList.add('glow');
  const choices = item.choices.map((s, i) => [s, speakerButton(i)]);
  const play = full => audio.say(() => audio.prompt(item.position, { full }), () => audio.play(clip.word(w.word)));
  const confirm = setUp(ctx, [row, h('div', { class: 'choices row3' }, choices.map(c => c[1]))], () => play(true));
  await play(false);
  return runChoice(ctx, {
    choices, confirm, answer: item.answer,
    onSelect: s => audio.play(clip.sound(s)),
    coach: () => showThePlay(ctx, w, boxes),
    slow: () => slowThenFast(ctx, w, boxes),
  });
}

// ---- 4. Build it, styled as crafting: letter blocks go in a row and a right word crafts its picture.
export async function buildIt(ctx, item) {
  const { C, audio } = ctx;
  const w = entry(ctx, item.word);
  const n = item.letters.length;
  const slots = Array.from({ length: n }, () => h('button', { class: 'slot block', 'aria-label': 'Box' }));
  const product = h('div', { class: 'product' });
  const tiles = item.tray.map(t => ({ ...t, el: h('button', { class: 'tile block' }, t.letter) }));
  const confirm = confirmButton();
  const placed = Array(n).fill(null);
  const firstTiles = Array(n).fill(null); // what is scored: the first tile placed in each box
  const refresh = () => { confirm.disabled = placed.some(p => !p); };
  const place = t => {
    const i = placed.indexOf(null);
    if (i < 0 || t.el.classList.contains('used') || t.el.classList.contains('gone')) return;
    placed[i] = t;
    firstTiles[i] ??= t.letter;
    t.el.classList.add('used');
    slots[i].textContent = t.letter;
    slots[i].classList.add('filled');
    audio.stop();
    audio.play(clip.sound(C.letterSound[t.letter])); // a placed tile plays its sound
    refresh();
  };
  const unplace = i => {
    const t = placed[i];
    if (!t) return;
    placed[i] = null;
    t.el.classList.remove('used');
    slots[i].textContent = '';
    slots[i].classList.remove('filled');
    refresh();
  };
  tiles.forEach(t => t.el.addEventListener('click', () => place(t)));
  slots.forEach((s, i) => s.addEventListener('click', () => unplace(i)));
  const play = full => audio.say(() => audio.prompt('build', { full }), () => audio.play(clip.word(w.word)));
  ctx.stage.replaceChildren(
    h('div', { class: 'craft' }, h('div', { class: 'craft-row' }, slots), h('span', { class: 'arrow' }, '➜'), product),
    h('div', { class: 'tray' }, tiles.map(t => t.el)));
  ctx.bottom.replaceChildren(confirm);
  ctx.setReplay(() => play(true));
  await play(false);

  const submit = () => new Promise(resolve => {
    const go = () => {
      if (confirm.disabled) return;
      confirm.removeEventListener('click', go);
      confirm.disabled = true;
      resolve(placed.map(p => p.letter).join(''));
    };
    confirm.addEventListener('click', go);
  });
  // The tiles slide together, the word is spoken, and its picture is crafted if it has one.
  const craft = async () => {
    slots.forEach(s => s.classList.add('joined'));
    if (w.picture) {
      product.textContent = w.picture;
      product.classList.add('made');
    }
    audio.effect('pass');
    await audio.play(clip.word(w.word));
    await sleep(500);
  };

  if (await submit() === item.letters.join('')) {
    await craft();
    return { correct: true, firstTiles };
  }
  audio.stop();
  await audio.say(() => audio.prompt('watch'), () => showThePlay(ctx, w, slots));
  // Take out the wrong blocks; any letter the word doesn't use leaves the tray.
  placed.forEach((t, i) => {
    if (t && t.letter !== item.letters[i]) {
      unplace(i);
      if (!item.letters.includes(t.letter)) t.el.classList.add('gone');
    }
  });
  await audio.say(() => audio.prompt('try-again'));
  if (await submit() !== item.letters.join('')) {
    item.letters.forEach((l, i) => {
      unplace(i);
      slots[i].textContent = l;
      slots[i].classList.add('filled');
    });
    await audio.say(() => audio.prompt('here-it-is'), () => slowThenFast(ctx, w, slots));
  }
  await craft();
  return { correct: false, firstTiles };
}

// ---- 5. Read and find
export async function readFind(ctx, item) {
  const { audio } = ctx;
  const w = entry(ctx, item.word);
  if (item.kind === 'real') {
    // He reads a printed word and taps its picture. The word is not spoken until he answers.
    // The ear button makes the dots play their sounds, and each sound played is logged as help.
    const help = new Set();
    let ear = false;
    const view = wordView(ctx, w.key, (i, l) => {
      if (!ear) return;
      help.add(l);
      audio.stop();
      audio.play(clip.sound(w.sounds[i]));
    });
    const earButton = h('button', { class: 'ear', 'aria-label': 'Hear the sounds' }, icon('ear'));
    earButton.addEventListener('click', () => {
      ear = true;
      earButton.classList.add('on');
    });
    const choices = item.choices.map(k => [k, h('button', { class: 'card pic' }, entry(ctx, k).picture)]);
    const play = full => audio.say(() => audio.prompt('read-find', { full }));
    const confirm = setUp(ctx, [h('div', { class: 'target read-target' }, view.el, earButton), h('div', { class: 'choices row3' }, choices.map(c => c[1]))], () => play(true));
    await play(false);
    const result = await runChoice(ctx, {
      choices, confirm, answer: item.answer,
      onSelect: k => audio.play(clip.word(entry(ctx, k).word)),
      coach: () => showThePlay(ctx, w, view.cols),
      slow: () => slowThenFast(ctx, w, view.cols),
    });
    if (result.correct) await audio.play(clip.word(w.word));
    return { ...result, helpLetters: [...help] };
  }
  // A nonsense word: he hears it and taps its printed form. The printed choices stay silent.
  const choices = item.choices.map(k => [k, h('button', { class: 'card word-card' }, entry(ctx, k).letters.join(''))]);
  const coachCard = h('div', { class: 'coach-card' });
  const play = full => audio.say(() => audio.prompt('hear-find', { full }), () => audio.play(clip.word(w.word)));
  const confirm = setUp(ctx, [h('div', { class: 'target speaker-target' }, icon('speaker', 'ico spk-target'), coachCard), h('div', { class: 'choices grid4' }, choices.map(c => c[1]))], () => play(true));
  await play(false);
  const spell = () => {
    const cols = lettersWithDots(w.letters, false);
    coachCard.replaceChildren(h('div', { class: 'word' }, cols));
    coachCard.classList.add('show');
    return cols;
  };
  return runChoice(ctx, {
    choices, confirm, answer: item.answer,
    coach: async () => {
      await showThePlay(ctx, w, spell());
      await sleep(400);
      coachCard.classList.remove('show');
    },
    slow: async () => {
      await slowThenFast(ctx, w, spell());
      coachCard.classList.remove('show');
    },
  });
}

// ---- 6. Read aloud: scored by the parent's tap, or not at all.
export async function readAloud(ctx, item) {
  if (item.kind === 'sentence') return headline(ctx, item);
  const { audio } = ctx;
  const w = entry(ctx, item.word);
  const view = wordView(ctx, w.key); // he touches each dot while he says its sound
  ctx.stage.replaceChildren(h('div', { class: 'target read-target' }, view.el));
  const solo = ctx.mode === 'solo';
  const play = full => audio.say(() => audio.prompt('read-aloud', { full }), () => (solo ? audio.prompt('check-word') : null));
  ctx.setReplay(() => play(true));

  if (solo) {
    // Just me: he says the word, then taps it to hear it and check himself. Nothing is scored.
    const next = confirmButton();
    ctx.bottom.replaceChildren(next);
    view.el.classList.add('tappable');
    view.el.addEventListener('click', () => {
      audio.stop();
      audio.play(clip.word(w.word));
      next.disabled = false;
    });
    play(false);
    await tapped(next);
    audio.stop();
    return { unscored: true };
  }

  // With a grown-up: three small gray buttons along the bottom edge.
  play(false);
  const verdict = await parentChoice(ctx, parentHint(ctx), [['read', 'Read it'], ['blend', 'Sounds right, blend wrong'], ['sound', 'Sound wrong']]);
  audio.stop();
  let marked = [];
  if (verdict === 'sound') {
    view.el.classList.add('marking');
    view.cols.forEach(col => col.addEventListener('click', () => col.classList.toggle('marked')));
    await parentChoice(ctx, 'Tap the letters that were wrong, then Done.', [['done', 'Done']]);
    marked = view.cols.flatMap((col, i) => (col.classList.contains('marked') ? [i] : []));
  }
  if (verdict === 'read') {
    view.el.classList.add('right');
    audio.effect('pass');
    await audio.play(clip.word(w.word));
    return { verdict, marked };
  }
  // A miss: the coach shows the play, and he reads it once more.
  view.cols.forEach(col => col.classList.remove('marked'));
  await audio.say(() => audio.prompt('watch'), () => showThePlay(ctx, w, view.cols));
  await parentChoice(ctx, `Let ${ctx.childName || 'your child'} try it once more.`, [['next', 'Next']]);
  return { verdict, marked };
}

function parentHint(ctx) {
  if (ctx.sessions >= ctx.cfg.parentHintSessions) return null;
  return `Ask ${ctx.childName || 'your child'} to touch each letter and say its sound, then say the word.`;
}

function parentChoice(ctx, hint, options) {
  return new Promise(resolve => {
    const buttons = options.map(([value, label]) => h('button', { class: 'pbtn', onclick: () => resolve(value) }, label));
    ctx.bottom.replaceChildren(h('div', { class: 'parent-bar' }, hint && h('div', { class: 'parent-hint' }, hint), h('div', { class: 'pbtns' }, buttons)));
  });
}

// The match's closing sentence: a silly headline, shown with its emoji once he has read it. Sight
// words he hasn't met are shown and spoken first, and carry no sound dots.
async function headline(ctx, item) {
  const { audio } = ctx;
  for (const s of item.newSight) await sightCard(ctx, s);
  if (item.newSight.length) ctx.onSight(item.newSight);
  const tokens = item.tokens.map(t => {
    if (t.sight || !t.word) return h('span', { class: 'tok sight' }, t.text);
    const letters = [...t.text.replace(/[^A-Za-z]/g, '')];
    return h('span', { class: 'tok' }, h('span', { class: 'word inline' }, lettersWithDots(letters)), t.text.replace(/[A-Za-z']/g, ''));
  });
  const sentence = h('div', { class: 'sentence' }, tokens);
  const emoji = h('div', { class: 'headline-emoji' }, item.emoji);
  ctx.stage.replaceChildren(h('div', { class: 'target headline' }, emoji, sentence));
  const play = full => audio.say(() => audio.prompt('read-sentence', { full }));
  ctx.setReplay(() => play(true));
  const reveal = async () => {
    emoji.classList.add('show');
    audio.effect('sign');
    await audio.play(clip.sentence(item.text));
  };

  if (ctx.mode === 'solo') {
    const next = confirmButton();
    ctx.bottom.replaceChildren(next);
    sentence.classList.add('tappable');
    sentence.addEventListener('click', () => {
      audio.stop();
      reveal();
      next.disabled = false;
    });
    play(false);
    await tapped(next);
    audio.stop();
    return { unscored: true };
  }
  play(false);
  sentence.classList.add('marking');
  tokens.forEach(t => t.addEventListener('click', () => t.classList.toggle('marked')));
  await parentChoice(ctx, 'Tap any word that was missed, then Done.', [['done', 'Done']]);
  const missed = tokens.flatMap((t, i) => (t.classList.contains('marked') ? [i] : []));
  sentence.classList.remove('marking');
  audio.stop();
  await reveal();
  await sleep(600);
  return { missed };
}

async function sightCard(ctx, word) {
  const { audio } = ctx;
  const card = h('div', { class: 'target card sight-card' }, word);
  const next = confirmButton();
  ctx.stage.replaceChildren(card);
  ctx.bottom.replaceChildren(next);
  const play = () => audio.say(() => audio.prompt('sight-word'), () => { flash(card, 900); return audio.play(clip.word(word)); });
  ctx.setReplay(play);
  await play();
  next.disabled = false;
  await tapped(next);
  audio.stop();
}

// ---- The one-time placement sweep: Sound match, forward, with no coaching.
export async function placementItem(ctx, item) {
  const choices = item.choices.map(l => [l, h('button', { class: 'card letter-card' }, l)]);
  const play = () => ctx.audio.play(clip.sound(item.sound));
  const confirm = setUp(ctx, [h('div', { class: 'target speaker-target' }, icon('speaker', 'ico spk-target')), h('div', { class: 'choices grid4' }, choices.map(c => c[1]))], play);
  play();
  const picked = await pick(choices, confirm, () => ctx.audio.stop());
  ctx.audio.effect('tap');
  return picked === item.answer;
}

export const RUNNERS = { soundMatch, blendIt, findSound, buildIt, readFind, readAloud };
