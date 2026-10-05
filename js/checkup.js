// The check-ups (SPEC.md, "Check-ups"): every two weeks and at each level check, about five minutes,
// run by a grown-up. Four one-minute parts mirror the first-grade DIBELS measures with the game's own
// items: letter sounds, the sounds in a spoken word, made-up words, and a short story. The grown-up
// scores what he says (ground rule 1); he sees a cup match with no score and no clock (ground rule 7).
// Results are his own trend lines, with no benchmarks or comparisons. Pure: the items come from a
// seeded rng, and every score is a count.
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';
import { clip, tokenize, stepLE, levelOf } from './content.js';
import { addDays } from './mastery.js';
import { letterState } from './choose.js';
import { playsByStep } from './journey.js';
import { applyLevelCheck, levelCheckWords } from './session.js';

export const PARTS = ['letters', 'segmenting', 'nonsense', 'story'];
export const PART_NAMES = {
  letters: 'Letter sounds', segmenting: 'Sounds in a word', nonsense: 'Made-up words', story: 'Reading a story',
};

const known = (P, w) => w.letters.every(l => letterState(P, l) !== 'new');
const completed = P => (P.checkups ?? []).filter(c => !c.partial);

// The level check is due and hasn't been tried since it came due, on its own or in a check-up.
function levelCheckWaiting(P) {
  if (P.levelCheckDue == null) return false;
  const since = P.levelCheckDueDay ?? '0000-00-00';
  return !P.levelChecks.some(c => c.level === P.levelCheckDue && c.day >= since);
}

// Whether a check-up is due today, and when the next one is.
//   why: 'level' (the level check is waiting), 'first' (none yet), or 'weeks' (two weeks since the last)
export function checkupDue(C, P, day, cfg = CONFIG) {
  const last = completed(P).at(-1);
  const next = last ? addDays(last.day, cfg.checkup.everyDays) : null;
  const level = levelCheckWaiting(P) ? P.levelCheckDue : null;
  if (level != null) return { due: true, why: 'level', level, next };
  if (!last) return { due: P.sessionCount >= cfg.checkup.afterMatches, why: 'first', level: null, next };
  return { due: day >= next, why: 'weeks', level: null, next };
}

// ---- The items for one check-up. Single letters can be anything taught through the end of level 2
// (or his level, once he is past it), so the trend compares like with like; everything printed as a
// word uses only letters he has met (ground rule 5).
export function checkupPlan(C, P, { day, seed, audioOK = () => true }, cfg = CONFIG) {
  const rng = makeRng(seed ?? `${day}:checkup:${(P.checkups ?? []).length}`);
  const level = levelOf(C, P.step);
  const top = Math.max(level, 2);
  const waiting = levelCheckWaiting(P);
  return {
    day, step: P.step, level,
    letters: letterItems(C, rng, top),
    segmenting: segmentItems(C, rng, top, audioOK),
    nonsense: nonsenseItems(C, P, rng, cfg),
    story: storyFor(C, P),
    levelCheck: waiting ? { level: P.levelCheckDue, words: levelCheckWords(C, P.levelCheckDue, `${day}:check:${P.levelChecks.length}`, cfg) } : null,
  };
}

// More than anyone reads in a minute, with no letter twice in a row.
export function letterItems(C, rng, top, n = 90) {
  const pool = C.letters.filter(l => levelOf(C, C.letterStep[l]) <= top);
  const out = [];
  while (out.length < n) {
    const batch = rng.shuffle(pool);
    if (out.length && batch[0] === out.at(-1)) batch.push(batch.shift());
    out.push(...batch);
  }
  return out.slice(0, n);
}

// Spoken words of three sounds or more, from any step through `top`: nothing is printed, so spelling
// doesn't matter. Words with x are left out, as in Find the sound.
export function segmentItems(C, rng, top, audioOK = () => true, n = 30) {
  const pool = C.oral.filter(w => w.sounds.length >= 3 && !w.sounds.includes('ks') && levelOf(C, w.step) <= top && audioOK(clip.word(w.word)));
  return rng.shuffle(pool).slice(0, n).map(w => w.key);
}

// The made-up words held back for check-ups, from his step and earlier. Step 1A has none to spare,
// so short lists are topped up with play words: players he hasn't signed first, never a hidden queen.
export function nonsenseItems(C, P, rng, cfg = CONFIG) {
  const ok = w => stepLE(C, w.step, P.step) && known(P, w);
  const out = rng.shuffle(C.nonsense.filter(w => w.checkup && ok(w))).map(w => w.key);
  if (out.length < cfg.checkup.nonsenseAtLeast) {
    const play = C.nonsense.filter(w => !w.checkup && !w.levelCheck && ok(w) && C.squad.byWord[w.key]?.piece !== 'queen');
    const fresh = rng.shuffle(play.filter(w => !P.signed.includes(w.key)));
    const signed = rng.shuffle(play.filter(w => P.signed.includes(w.key)));
    for (const w of [...fresh, ...signed]) {
      if (out.length >= cfg.checkup.nonsenseAtLeast) break;
      out.push(w.key);
    }
  }
  return out;
}

// The story: one he can read every word of, from his step or the nearest earlier one, taking turns
// with the step's other story. None yet if he hasn't met the letters of even the first story.
export function storyFor(C, P) {
  const readable = p => tokenize(C, p.text).every(t => t.sight || (t.entry && t.entry.real && !t.entry.oralOnly && known(P, t.entry)));
  const fit = (C.passages ?? []).filter(p => stepLE(C, p.step, P.step) && readable(p));
  if (!fit.length) return null;
  const best = fit.reduce((a, b) => (C.stepIndex[b.step] > C.stepIndex[a.step] ? b : a)).step;
  const lastRead = id => (P.checkups ?? []).filter(c => c.parts?.story?.passage === id).at(-1)?.day ?? '';
  return fit.filter(p => p.step === best).sort((a, b) => lastRead(a.id).localeCompare(lastRead(b.id)))[0].id;
}

// ---- Scoring. A part ends when the minute is up, or early when he finishes the story or runs out of
// made-up words (then the count is scaled to a minute), or when the grown-up stops it (then it isn't).
const perMinute = (n, seconds, finished) => (finished && seconds > 0 ? Math.round((n * 60) / seconds) : n);

// results: [{ g, hit }]
export function scoreLetters(results, seconds, { finished = false } = {}) {
  const correct = results.filter(r => r.hit).length;
  return { correct, tried: results.length, seconds, perMinute: perMinute(correct, seconds, finished), items: results };
}

// results: [{ word, got, of }], got = sounds said right, each on its own
export function scoreSegmenting(results, seconds, { finished = false } = {}) {
  const correct = results.reduce((n, r) => n + r.got, 0);
  return { correct, words: results.length, seconds, perMinute: perMinute(correct, seconds, finished), items: results };
}

// results: [{ word, sounds, of, whole }]: letter sounds said right, and whether the whole word came
// out right (sounded out first is fine)
export function scoreNonsense(results, seconds, { finished = false } = {}) {
  const sounds = results.reduce((n, r) => n + r.sounds, 0);
  const whole = results.filter(r => r.whole).length;
  return {
    sounds, whole, words: results.length, seconds, finished,
    perMinute: perMinute(sounds, seconds, finished), wholePerMinute: perMinute(whole, seconds, finished), items: results,
  };
}

// The story: words up to the last one he read, less the ones he missed. Finishing early scales to a
// minute, as in DIBELS.
export function scoreStory(C, passageId, { last, errors = 0, seconds, finished = false }) {
  const p = C.passages.find(x => x.id === passageId);
  const read = Math.min(last + 1, tokenize(C, p.text).length);
  const right = Math.max(0, read - errors);
  return {
    passage: passageId, read, errors: read - right, right, seconds, finished,
    wcpm: perMinute(right, seconds, finished),
    accuracy: read ? Math.round((100 * right) / read) : 0,
  };
}

// Saves a check-up. With the level check's answers, the level check is scored too.
export function applyCheckup(C, P0, record, { levelResults = null } = {}, cfg = CONFIG) {
  let P = structuredClone(P0);
  const rec = structuredClone(record);
  rec.played = playsByStep(C, P)[rec.step] ?? 0;
  if (rec.levelCheck && levelResults?.length) {
    const out = applyLevelCheck(C, P, rec.levelCheck.level, levelResults, rec.day, cfg);
    P = out.P;
    rec.levelCheck = { level: rec.levelCheck.level, score: out.score, of: levelResults.length, pass: out.pass };
  } else {
    rec.levelCheck = null;
  }
  P.checkups = [...(P.checkups ?? []), rec];
  return P;
}

// One line per part for the parent's trend lines: his own numbers over time.
export function checkupSeries(P) {
  const rows = P.checkups ?? [];
  const pick = (part, key) => rows.filter(c => c.parts?.[part]).map(c => ({ day: c.day, step: c.step, value: c.parts[part][key] }));
  return {
    letters: pick('letters', 'perMinute'),
    segmenting: pick('segmenting', 'perMinute'),
    nonsense: pick('nonsense', 'perMinute'),
    whole: pick('nonsense', 'wholePerMinute'),
    story: pick('story', 'wcpm'),
  };
}
