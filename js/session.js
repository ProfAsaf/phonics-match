// One match from plan to full time: which items, how each answer is scored, and the game layer
// (SPEC.md "Session flow", "Game layer", "Mastery model"). Pure: no DOM or clock, and the only
// randomness is the session's seeded rng, so the tests can script whole seasons.
import { CONFIG, defaultSettings } from './config.js';
import { makeRng } from './rng.js';
import { applyAttempt, newRecord, recId, isMastered } from './mastery.js';
import { buildActivity, remake, chooseNewLetters, positionName, letterState } from './choose.js';
import { diffPositions } from './content.js';

export function newProgress(C, day) {
  const progress = {
    version: 1, created: day, settings: defaultSettings(), team: null, placementDone: false,
    step: C.steps[0].step, records: {}, sessions: [], sessionCount: 0, recycle: [], seasonGoals: 0,
    wordBook: [], signed: [], queenReady: {}, levelPassed: {}, levelCheckDue: null, levelChecks: [],
    sightIntroduced: [], headlines: {}, lastUsed: {}, lastSessionDay: null, character: null,
  };
  return upgradeProgress(C, progress);
}

// Fills in any field or record a newer version of the game or its content expects.
export function upgradeProgress(C, P) {
  const fresh = { settings: defaultSettings(), recycle: [], wordBook: [], signed: [], queenReady: {}, levelPassed: {},
    levelChecks: [], sightIntroduced: [], headlines: {}, lastUsed: {}, sessions: [], records: {} };
  for (const [k, v] of Object.entries(fresh)) P[k] ??= v;
  P.settings = { ...defaultSettings(), ...P.settings };
  P.settings.items = { ...defaultSettings().items, ...P.settings.items };
  P.settings.enabled = { ...defaultSettings().enabled, ...P.settings.enabled };
  const ids = [
    ...C.letters.map(recId.letter),
    recId.blend('continuous'), recId.blend('stop'),
    recId.seg('first'), recId.seg('last'), recId.seg('middle'),
    ...C.steps.flatMap(s => [recId.dec(s.step, true), recId.dec(s.step, false)]),
  ];
  for (const id of ids) P.records[id] ??= newRecord(id);
  if (!(P.step in C.stepIndex)) P.step = C.steps[0].step;
  return P;
}

// ---- Planning
export function planSession(C, P, { day, mode = 'solo', seed, audioOK = () => true }, cfg = CONFIG) {
  const rng = makeRng(seed ?? `${day}#${P.sessionCount}`);
  const enabled = cfg.activities.filter(a => P.settings.enabled[a] !== false && (P.settings.items[a] ?? cfg.items[a]) > 0);
  const S = {
    day, mode, rng, audioOK, step: P.step,
    newLetters: enabled.includes('soundMatch') ? chooseNewLetters(C, P, cfg, audioOK) : [],
    introduced: new Set(),
    order: [], queues: {}, act: 0, idx: 0, half: 1,
    game: { streak: 0, goals: [0, 0] },
    stats: { scored: [0, 0], firstTry: [0, 0] },
    missesInRow: 0,
    presented: new Set(),
    signed: [], booked: [],
  };
  for (const a of enabled) {
    const items = buildActivity(a, C, P, S, rng, P.settings.items[a] ?? cfg.items[a], cfg, {
      recycled: P.recycle.filter(r => r.activity === a).map(r => r.key),
      recent: new Set(P.lastUsed?.[a] ?? []),
    });
    if (items.length) {
      S.order.push(a);
      S.queues[a] = items;
    }
  }
  return S;
}

export const currentActivity = S => S.order[S.act] ?? null;
export const currentItem = S => S.queues[currentActivity(S)]?.[S.idx] ?? null;
export const halfOf = (activity, cfg = CONFIG) => (cfg.firstHalf.includes(activity) ? 1 : 2);
export const halfTotal = (S, half, cfg = CONFIG) =>
  S.order.filter(a => halfOf(a, cfg) === half).reduce((n, a) => n + S.queues[a].length, 0);

// Moves to the next item. After two misses in a row the next item is mastered material (rule 7).
export function advance(C, P, S, cfg = CONFIG) {
  S.idx++;
  if (S.idx >= (S.queues[currentActivity(S)]?.length ?? 0)) {
    S.act++;
    S.idx = 0;
  }
  const item = currentItem(S);
  if (item && S.missesInRow >= cfg.winnable.missesInRow && item.kind !== 'sentence') {
    const easy = buildActivity(item.activity, C, P, S, S.rng, 1, cfg, { easy: true })[0];
    // The stand-in keeps the item's "returned" mark, so nothing comes back more than once.
    if (easy && easy.kind !== 'sentence') S.queues[item.activity][S.idx] = { ...easy, returned: item.returned };
  }
  return item && currentItem(S);
}

// True when the next activity opens the second half (halftime comes first).
export function atHalftime(S, cfg = CONFIG) {
  const a = currentActivity(S);
  return S.idx === 0 && S.half === 1 && a && halfOf(a, cfg) === 2 && S.order.slice(0, S.act).some(x => halfOf(x, cfg) === 1);
}

// Halftime: below 60% first-try accuracy, the second half is all mastered material (rule 7).
export function halftime(C, P, S, cfg = CONFIG) {
  S.half = 2;
  const [scored, firstTry] = [S.stats.scored[0], S.stats.firstTry[0]];
  const easy = scored > 0 && firstTry / scored < cfg.winnable.halftimeAccuracy;
  if (easy) {
    for (const a of S.order.slice(S.act)) {
      const words = S.queues[a].filter(i => i.kind !== 'sentence').length;
      const rebuilt = buildActivity(a, C, P, S, S.rng, words, cfg, { easy: true });
      if (rebuilt.length) S.queues[a] = rebuilt;
    }
  }
  return easy;
}

// ---- Scoring one item. `out` is what happened on screen:
//   soundMatch, blendIt, findSound: { correct, picked }       correct means right on the first try
//   buildIt: { correct, firstTiles }                           the first letter placed in each box
//   readFind: { correct, picked, helpLetters }                 letters whose sounds the ear button played
//   readAloud: { unscored } | { verdict: 'read' | 'blend' | 'sound', marked } | sentence: { missed }
export function scoreItem(C, P0, S, item, out, cfg = CONFIG) {
  const P = structuredClone(P0);
  const events = [];
  const update = (id, hit, picked = null, assisted = false) => {
    P.records[id] = applyAttempt(P.records[id] ?? newRecord(id), { day: S.day, hit, activity: item.activity, picked, assisted }, cfg);
  };
  const addBook = key => {
    if (P.wordBook.includes(key)) return;
    P.wordBook.push(key);
    S.booked.push(key);
    events.push({ type: 'book', word: key, count: P.wordBook.length });
    if (cfg.wordBookMilestones.includes(P.wordBook.length)) events.push({ type: 'milestone', count: P.wordBook.length });
  };
  // A correct first try on a real word goes in the word book; on a nonsense word it signs the player.
  const reward = w => {
    if (w.real) return addBook(w.key);
    const player = C.squad.byWord[w.key];
    if (!player || P.signed.includes(w.key)) return;
    if (player.piece === 'queen' && !P.queenReady[w.step]) return;
    P.signed.push(w.key);
    S.signed.push(w.key);
    events.push({ type: 'sign', word: w.key, piece: player.piece, number: player.number, value: cfg.pieceValues[player.piece] });
    if (player.piece === 'queen') {
      // Signing the queen is the ceremony for moving up.
      const next = C.steps[C.stepIndex[w.step] + 1];
      events.push({ type: 'promote', from: w.step, to: next?.step ?? null });
      if (next && w.step === P.step) P.step = next.step;
    }
  };

  S.presented.add(`${item.activity}|${item.key}`);
  if (item.intro) S.introduced.add(item.letter);
  const w = item.word ? C.byWord.get(item.word) : null;
  let pass = false;
  let scored = true; // counts toward first-try accuracy
  let neutral = false; // neither a pass nor a miss: right, but with help

  switch (item.activity) {
    case 'soundMatch': {
      const picked = out.correct ? null : item.form === 'forward' ? out.picked : C.soundLetter[out.picked] ?? out.picked;
      update(item.record, out.correct, picked);
      pass = out.correct;
      break;
    }
    case 'blendIt':
    case 'findSound':
      update(item.record, out.correct, out.correct ? null : out.picked);
      pass = out.correct;
      break;
    case 'buildIt':
      // The first tile in each box: a wrong one counts against the letter-sound until it is
      // mastered, and against segmenting at that position after.
      item.letters.forEach((target, i) => {
        const tile = out.firstTiles?.[i] ?? null;
        const pos = positionName(i, item.letters.length);
        if (tile === target) {
          update(recId.letter(target), true);
          update(recId.seg(pos), true);
        } else if (isMastered(P, recId.letter(target))) {
          update(recId.seg(pos), false, tile);
        } else {
          update(recId.letter(target), false, tile);
        }
      });
      pass = out.correct;
      break;
    case 'readFind': {
      const help = [...new Set(out.helpLetters ?? [])];
      for (const l of help) update(recId.letter(l), false); // each sound the ear button played
      if (out.correct && help.length) {
        update(item.record, true, null, true); // assisted
        neutral = true;
        scored = false;
      } else if (out.correct) {
        update(item.record, true);
        for (const l of w.letters) update(recId.letter(l), true);
        reward(w);
        pass = true;
      } else {
        update(item.record, false, out.picked);
        // The letter-sound in the position that differed, when exactly one did.
        const p = C.byWord.get(out.picked);
        const d = p && p.letters.length === w.letters.length ? diffPositions(w.letters, p.letters) : [];
        if (d.length === 1) update(recId.letter(w.letters[d[0]]), false, p.letters[d[0]]);
      }
      break;
    }
    case 'readAloud': {
      if (out.unscored) {
        pass = true; // unscored items count as passes
        scored = false;
        break;
      }
      if (item.kind === 'sentence') {
        const missed = new Set(out.missed ?? []);
        item.tokens.forEach((t, i) => {
          const e = t.word && C.byWord.get(t.word);
          if (!missed.has(i) && e?.real && !e.name) addBook(e.key);
        });
        pass = missed.size === 0;
        break;
      }
      if (out.verdict === 'read') {
        update(item.record, true);
        for (const l of w.letters) update(recId.letter(l), true);
        reward(w);
        pass = true;
      } else if (out.verdict === 'blend') {
        update(item.record, false);
        update(recId.blend(w.shape), false);
      } else {
        update(item.record, false);
        for (const i of out.marked ?? []) update(recId.letter(w.letters[i]), false);
      }
      break;
    }
  }
  if (item.record?.startsWith('dec:')) checkStep(C, P, events, cfg);

  // The game layer: every first-try correct answer is a pass; three in a row make a goal.
  if (pass) {
    S.game.streak++;
    events.push({ type: 'pass' });
    if (S.game.streak >= cfg.goalPasses) {
      S.game.streak = 0;
      S.game.goals[S.half - 1]++;
      events.push({ type: 'goal', goals: [...S.game.goals] });
    }
  } else if (!neutral) {
    S.game.streak = 0; // a miss ends the move and costs nothing
    events.push({ type: 'miss' });
  }
  if (scored) {
    S.stats.scored[S.half - 1]++;
    if (pass) S.stats.firstTry[S.half - 1]++;
    S.missesInRow = pass ? 0 : S.missesInRow + 1;
  }
  if (scored && !pass && item.kind !== 'sentence') {
    if (!item.returned) requeue(C, P, S, item, cfg);
    recycle(P, item, cfg);
  }
  return { P, events, pass };
}

// Correction step 4: the item comes back once more, at least three items later, in this activity.
function requeue(C, P, S, item, cfg) {
  const queue = S.queues[item.activity];
  const copy = { ...remake(C, P, S, S.rng, item, cfg), returned: true };
  const end = queue.at(-1)?.kind === 'sentence' ? queue.length - 1 : queue.length;
  queue.splice(Math.min(S.idx + cfg.returnAfter, end), 0, copy);
}

// Rule 6: a missed item also returns in each of the next two sessions.
function recycle(P, item, cfg) {
  const found = P.recycle.find(r => r.activity === item.activity && r.key === item.key);
  if (found) Object.assign(found, { remaining: cfg.recycleSessions, since: P.sessionCount });
  else P.recycle.push({ activity: item.activity, key: item.key, remaining: cfg.recycleSessions, since: P.sessionCount });
}

// Steps advance when the step's real and nonsense decoding are both mastered: the queen comes out,
// and signing her moves him up. Moving to a new level waits for the parent's level check.
export function checkStep(C, P, events, cfg = CONFIG) {
  const step = P.step;
  if (P.queenReady[step] || !isMastered(P, recId.dec(step, true)) || !isMastered(P, recId.dec(step, false))) return;
  const cur = C.steps[C.stepIndex[step]];
  const next = C.steps[C.stepIndex[step] + 1];
  if (next && next.level !== cur.level && !P.levelPassed[cur.level]) {
    if (P.levelCheckDue !== cur.level) {
      P.levelCheckDue = cur.level;
      events.push({ type: 'levelCheckDue', level: cur.level });
    }
    return;
  }
  P.queenReady[step] = true;
  events.push({ type: 'queenReady', step });
}

export function introduceSightWords(P0, words) {
  const P = structuredClone(P0);
  for (const w of words) if (!P.sightIntroduced.includes(w)) P.sightIntroduced.push(w);
  return P;
}

// ---- Full time
export function finishSession(C, P0, S) {
  const P = structuredClone(P0);
  P.seasonGoals += S.game.goals[0] + S.game.goals[1];
  const scored = S.stats.scored[0] + S.stats.scored[1];
  const firstTry = S.stats.firstTry[0] + S.stats.firstTry[1];
  // The step he started the match in: the match is a level in that world on the map.
  P.sessions.push({ day: S.day, mode: S.mode, step: S.step ?? P0.step, scored, firstTry, goals: [...S.game.goals], items: S.presented.size });
  for (const r of P.recycle) {
    if (r.since < P.sessionCount && S.presented.has(`${r.activity}|${r.key}`)) r.remaining--;
  }
  P.recycle = P.recycle.filter(r => r.remaining > 0);
  P.lastUsed = Object.fromEntries(S.order.map(a => [a, S.queues[a].map(i => i.key)]));
  const sentence = S.queues.readAloud?.find(i => i.kind === 'sentence');
  if (sentence) P.headlines[sentence.text] = S.day;
  P.sessionCount++;
  P.lastSessionDay = S.day;
  return P;
}

// ---- Placement: a one-time Sound match sweep over every letter in levels 1 and 2 (rule 1).
export function placementItems(C, seed) {
  const rng = makeRng(seed);
  return rng.shuffle(C.letters).map(letter => {
    const sound = C.letterSound[letter];
    const others = [];
    for (const x of rng.shuffle(C.letters)) {
      if (others.length === 3) break;
      if (x !== letter && C.letterSound[x] !== sound && !others.some(o => C.letterSound[o] === C.letterSound[x])) others.push(x);
    }
    return { activity: 'placement', key: letter, letter, sound, choices: rng.shuffle([letter, ...others]), answer: letter };
  });
}

// Letters he gets right start as learning; the rest stay new, except the few that always start
// as learning so there are words from the first session.
export function applyPlacement(C, P0, results, day, cfg = CONFIG) {
  const P = structuredClone(P0);
  for (const l of C.letters) {
    const id = recId.letter(l);
    if (results[l]) P.records[id] = applyAttempt(P.records[id], { day, hit: true, activity: 'placement' }, cfg);
    else if (cfg.placementAlwaysLearning.includes(l) && P.records[id].state === 'new') P.records[id] = { ...P.records[id], state: 'learning' };
  }
  P.placementDone = true;
  return P;
}

// ---- The level check: the parent hears five real and five held-back nonsense words.
export function levelCheckWords(C, level, seed, cfg = CONFIG) {
  const rng = makeRng(seed);
  const steps = C.steps.filter(s => s.level === level).map(s => s.step);
  const real = rng.shuffle(C.real.filter(w => steps.includes(w.step) && w.letters.length === 3)).slice(0, cfg.levelCheck.real);
  const nonsense = rng.shuffle(C.nonsense.filter(w => w.levelCheck && steps.includes(w.step))).slice(0, cfg.levelCheck.nonsense);
  return rng.shuffle([...real, ...nonsense]).map(w => w.key);
}

export function applyLevelCheck(C, P0, level, results, day, cfg = CONFIG) {
  const P = structuredClone(P0);
  const score = results.filter(Boolean).length;
  const pass = score >= cfg.levelCheck.pass;
  P.levelChecks.push({ day, level, score, of: results.length, pass });
  if (pass) {
    P.levelPassed[level] = true;
    if (P.levelCheckDue === level) P.levelCheckDue = null;
    const last = C.steps.filter(s => s.level === level).at(-1).step;
    if (P.step === last) P.queenReady[last] = true;
  }
  return { P, score, pass };
}

// The verse for this match: the newest one unlocked, with a player's name and an action word that
// change every match so he has to read the line (SPEC.md, "The team chant").
export function chantFor(C, P, matchNumber) {
  const verses = C.chants.filter(v => C.stepIndex[v.step] <= C.stepIndex[P.step]);
  const verse = verses.at(-1) ?? C.chants[0];
  // Signed players first; otherwise any player whose letters he has met (ground rule 5).
  const reachable = C.squad.players.filter(p => C.stepIndex[p.step] <= C.stepIndex[P.step]);
  const readable = p => [...p.word].every(l => letterState(P, l) !== 'new');
  const signed = reachable.filter(p => P.signed.includes(p.word));
  const known = reachable.filter(p => readable(p) && (p.piece !== 'queen' || P.queenReady[p.step]));
  const pool = signed.length ? signed : known.length ? known : reachable.filter(readable);
  const name = (pool.length ? pool : reachable)[matchNumber % (pool.length || reachable.length)]?.word ?? '';
  const act = verse.act ? verse.act[matchNumber % verse.act.length] : null;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const lines = verse.lines.map(line => line.split(/\s+/).map(token => {
    const m = token.match(/^\{(Name|act|Act)\}(.*)$/);
    if (!m) return { text: token, word: token.replace(/[^A-Za-z]/g, '').toLowerCase() };
    const value = m[1] === 'Name' ? name : act;
    return { text: (m[1] === 'act' ? value : cap(value)) + m[2], word: value };
  }));
  return { verse, lines, name, act };
}
