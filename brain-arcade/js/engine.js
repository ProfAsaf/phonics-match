// The adaptive engine: starting levels (from grade and school scores), the placement check,
// choosing each next question, scoring answers, and the numbers the parent report shows.
import { SUBJECTS, STRANDS, SKILL, skillsOf } from './curriculum.js';
import { milestonesFor } from './gen/reading.js';
import * as M from './model.js';
import { expectedNow, schoolYearFraction } from './scale.js';
import { shuffle, weighted, normal, pick } from './rng.js';

const DAY = 86400000;
const STATUS_OFFSET = { above: 0.5, at: 0.1, below: -0.4, wellbelow: -0.9 };
export const PLACEMENT_MAX = (player) => (player.grade < 0 ? 14 : player.grade === 0 ? 20 : 30);
export const roundLength = (player, settings) => settings?.roundLength || (player.grade <= 0 ? 8 : 10);
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayNum = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / DAY);

// ---------------------------------------------------------------- starting levels
function monthsSince(dateStr, now) {
  if (!dateStr) return 0;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? Math.max(0, Math.min(12, (now - t) / (30.4 * DAY))) : 0;
}
export function schoolPrior(player, strandId, now = Date.now()) {
  const st = STRANDS[strandId];
  const sc = player.school || {};
  if (st.subject === 'math' && sc.ixl) {
    const own = st.ixl ? sc.ixl[st.ixl] : null;
    const lvl = Number.isFinite(own) ? own : sc.ixl.overall;
    if (!Number.isFinite(lvl)) return null;
    return { mean: lvl / 100 + monthsSince(sc.ixl.date, now) * 0.08, sd: Number.isFinite(own) ? 0.4 : 0.6 };
  }
  if (st.subject === 'reading' && sc.dibels) {
    const d = sc.dibels;
    let status = st.dibels ? d[st.dibels] : null, sd = 0.5;
    if (!status && strandId === 'comp' && d.orf) { status = d.orf; sd = 0.7; }
    if (!status || !(status in STATUS_OFFSET)) return null;
    const grade = Number.isFinite(d.grade) ? d.grade : player.grade;
    const at = Date.parse(d.date) || now;
    const expAt = grade + schoolYearFraction(new Date(at));
    return { mean: expAt + STATUS_OFFSET[status] + monthsSince(d.date, now) * 0.08, sd };
  }
  return null;
}
export function priorFor(player, strandId, now = Date.now()) {
  return schoolPrior(player, strandId, now) || { mean: expectedNow(player.grade, new Date(now)), sd: player.grade < 0 ? 0.75 : 1.15, generic: true };
}

export function ensureSubject(player, subject, now = Date.now()) {
  player.subjects ||= {};
  const sub = (player.subjects[subject] ||= { placed: false, rounds: 0, placement: { n: 0, strands: {} }, strands: {} });
  for (const id of SUBJECTS[subject].strands) {
    if (!sub.strands[id]) {
      const p = priorFor(player, id, now);
      sub.strands[id] = { lp: M.pack(M.prior(p.mean, p.sd)), n: 0, last: now, generic: !!p.generic };
    }
  }
  return sub;
}
// Re-seed priors after school scores change, for strands with no answers yet.
export function reseed(player, now = Date.now()) {
  for (const subject of Object.keys(SUBJECTS)) {
    const sub = ensureSubject(player, subject, now);
    for (const id of SUBJECTS[subject].strands) {
      if (sub.strands[id].n === 0) {
        const p = priorFor(player, id, now);
        sub.strands[id] = { lp: M.pack(M.prior(p.mean, p.sd)), n: 0, last: now, generic: !!p.generic };
      }
    }
  }
}

const st8 = (player, strandId) => player.subjects[STRANDS[strandId].subject].strands[strandId];
const lpOf = (ss) => M.unpack(ss.lp) || M.prior(1, 1);

export function strandInfo(player, strandId) {
  const st = STRANDS[strandId];
  ensureSubject(player, st.subject);
  const ss = st8(player, strandId);
  const lp = lpOf(ss);
  const s = M.summarize(lp);
  const pAbove = M.probAbove(lp, st.hi);
  const pBelow = 1 - M.probAbove(lp, st.lo);
  const pIn = M.probBetween(lp, st.lo - 0.3, st.hi + 0.2);
  let state = 'level';
  if (pAbove > 0.8) state = 'mastered';
  else if (pBelow > 0.8) state = 'notyet';
  else if (ss.n < 3 && s.sd > 0.45) state = 'measuring';
  return { id: strandId, ...s, n: ss.n, pAbove, pBelow, pIn, state, last: ss.last, generic: ss.generic && ss.n === 0 };
}

// IXL-style overall level: precision-weighted mean of the strands the child is working inside.
export function overallLevel(player, subject) {
  const infos = SUBJECTS[subject].strands.map((id) => strandInfo(player, id));
  const active = infos.filter((i) => i.state === 'level' || i.state === 'measuring');
  const use = active.length ? active : infos;
  let w = 0, s = 0, v = 0;
  for (const i of use) { const wi = 1 / (i.sd * i.sd + 0.04); w += wi; s += wi * i.mean; }
  const mean = s / w;
  for (const i of use) v += (1 / (i.sd * i.sd + 0.04)) * ((i.mean - mean) ** 2 + i.sd * i.sd);
  return { mean, sd: Math.sqrt(v / w) / Math.sqrt(Math.max(1, use.length / 2)), n: infos.reduce((a, i) => a + i.n, 0) };
}

// Is the child a fluent reader yet? (Used to decide when to read questions aloud.)
export function readingLevel(player) {
  ensureSubject(player, 'reading');
  const p = strandInfo(player, 'phonics'), s = strandInfo(player, 'sight');
  return Math.min(p.mean, s.mean);
}

// ---------------------------------------------------------------- placement
function strandPlacementDone(player, strandId) {
  const sub = player.subjects[STRANDS[strandId].subject];
  const k = sub.placement.strands[strandId] || 0;
  const i = strandInfo(player, strandId);
  if (i.pIn < 0.25 && k === 0) return true; // far outside this child's range
  if (k >= 8 || (k >= 6 && i.sd < 0.5)) return true;
  if (k >= 3 && i.sd < 0.32) return true;
  if (k >= 2 && (i.pAbove > 0.9 || i.pBelow > 0.9)) return true;
  return false;
}
export function placementDone(player, subject) {
  const sub = ensureSubject(player, subject);
  if (sub.placed) return true;
  if (sub.placement.n >= PLACEMENT_MAX(player)) return true;
  return SUBJECTS[subject].strands.every((id) => strandPlacementDone(player, id));
}
export function placementProgress(player, subject) {
  const sub = ensureSubject(player, subject);
  return { n: sub.placement.n, max: PLACEMENT_MAX(player) };
}
// The level check comes in rounds of 10: 3 rounds from 1st grade up, 2 for Pre-K and K.
export function placementRounds(player, subject) {
  const { n, max } = placementProgress(player, subject);
  const of = Math.ceil(max / 10);
  return { done: Math.min(of, Math.floor(n / 10)), of };
}

// Before a strand's first placement question, borrow what the other strands already show.
function borrowPrior(player, subject, strandId) {
  const ss = st8(player, strandId);
  if (ss.n > 0 || !ss.generic) return;
  const measured = SUBJECTS[subject].strands.filter((id) => id !== strandId && st8(player, id).n >= 3).map((id) => strandInfo(player, id));
  if (!measured.length) return;
  const mean = measured.reduce((a, i) => a + i.mean, 0) / measured.length;
  ss.lp = M.pack(M.prior(mean, 0.75));
  ss.generic = false;
}

// ---------------------------------------------------------------- sessions
export function newSession(player, subject, { rng = Math.random, settings = {}, now = Date.now(), placement = null } = {}) {
  const sub = ensureSubject(player, subject, now);
  // Learning (and forgetting) since the last visit: blur each strand a little.
  for (const id of SUBJECTS[subject].strands) {
    const ss = sub.strands[id];
    const days = Math.max(0, (now - (ss.last || now)) / DAY);
    if (days > 0.5) { const lp = lpOf(ss); M.drift(lp, 0.035 * Math.sqrt(days)); ss.lp = M.pack(lp); ss.last = now; }
  }
  const isPlacement = placement ?? !placementDone(player, subject);
  return {
    player, subject, rng, settings, placement: isPlacement, started: now,
    length: isPlacement ? Math.min(10, Math.max(4, PLACEMENT_MAX(player) - sub.placement.n)) : roundLength(player, settings),
    i: 0, queue: [], keys: new Set(), results: [], strandsUsed: [], skillsUsed: {}, stars: 0,
  };
}

// Placement measures strands two at a time, core strands first, so later strands can start
// from what the earlier ones showed.
const PLACEMENT_ORDER = {
  math: { young: ['count', 'geo', 'md', 'oa', 'nbt', 'nf'], older: ['oa', 'nbt', 'md', 'geo', 'nf', 'count'] },
  reading: { young: ['letters', 'pa', 'vocab', 'comp', 'phonics', 'sight', 'spell'], older: ['phonics', 'comp', 'sight', 'vocab', 'spell', 'pa', 'letters'] },
};
function chooseStrand(sess) {
  const { player, subject, rng } = sess;
  const ids = SUBJECTS[subject].strands;
  if (sess.placement) {
    const order = PLACEMENT_ORDER[subject][player.grade <= 0 ? 'young' : 'older'];
    const open = order.filter((id) => !strandPlacementDone(player, id));
    if (open.length) {
      const k = (id) => player.subjects[subject].placement.strands[id] || 0;
      const early = open.filter((id) => k(id) < 3);
      const pool = (early.length ? early : [...open].sort((a, b) => strandInfo(player, b).sd - strandInfo(player, a).sd)).slice(0, 2);
      const last = sess.strandsUsed[sess.strandsUsed.length - 1];
      return pool.length > 1 && pool[0] === last ? pool[1] : pool[0];
    }
  }
  const focus = sess.settings.focus?.[player.id] || {};
  const recent = sess.strandsUsed.slice(-2);
  const cands = ids.map((id) => {
    const i = strandInfo(player, id);
    let w = i.pIn * (1 + 1.5 * Math.min(i.sd, 1));
    if (i.state === 'mastered') w = 0.04;
    if (i.state === 'notyet') w = i.pIn > 0.25 ? 0.05 : 0;
    if (focus[id]) w *= 2.5;
    if (recent[1] === id) w *= 0.15; else if (recent[0] === id) w *= 0.5;
    if (Date.now() - (i.last || 0) > 3 * DAY) w *= 1.3;
    return { id, w };
  });
  return weighted(rng, cands).id;
}

function targetDifficulty(sess, strandId) {
  const st = STRANDS[strandId];
  const i = strandInfo(sess.player, strandId);
  const { rng } = sess;
  let b;
  if (sess.placement) b = M.bestB(lpOf(st8(sess.player, strandId)), st.lo, st.hi, { c: 0.25, slip: 0.06 }) + normal(rng, 0, 0.05);
  else {
    const r = rng();
    let target = r < 0.15 ? 0.93 : r < 0.35 ? 0.6 : 0.8;
    const last2 = sess.results.slice(-2);
    if (last2.length === 2 && last2.every((x) => !x.correct)) target = Math.max(target, 0.9); // two misses: ease off
    const streak = sess.results.slice(-4);
    if (streak.length === 4 && streak.every((x) => x.correct) && target === 0.8) target = 0.7;
    b = M.targetB(i.mean, Math.min(i.sd, 0.6), target, { c: 0.25 }) + normal(rng, 0, 0.1);
  }
  return Math.max(st.lo, Math.min(st.hi, b));
}

// Two-choice questions say little about a child's level, so the level check uses them sparingly.
const LOW_INFO = new Set(['comp.truefalse', 'oa.evenodd', 'nf.compare', 'nf.decimal']);
function chooseSkill(sess, strandId, b) {
  const skills = skillsOf(strandId);
  let fits = skills.filter((s) => b >= s.lo - 0.05 && b <= s.hi + 0.05);
  if (!fits.length) fits = [...skills].sort((x, y) => Math.min(Math.abs(b - x.lo), Math.abs(b - x.hi)) - Math.min(Math.abs(b - y.lo), Math.abs(b - y.hi))).slice(0, 1);
  const lastSkill = sess.results[sess.results.length - 1]?.skill;
  const stats = sess.player.skills || {};
  return weighted(sess.rng, fits.map((s) => ({ s, w: (s.id === lastSkill && fits.length > 1 ? 0.2 : 1) * (sess.placement && LOW_INFO.has(s.id) ? 0.25 : 1) / (1 + (sess.skillsUsed[s.id] || 0)) / (1 + Math.min(3, (stats[s.id]?.n || 0) / 30)) })), (x) => x.w).s;
}

function layoutOf(options) {
  if (options.some((o) => o.svg || o.emoji)) return 'picture';
  const len = Math.max(...options.map((o) => String(o.label).length));
  return len <= 5 ? 'short' : len <= 12 ? 'word' : 'long';
}

let itemSeq = 0;
function finishItem(sess, skill, item, b) {
  item.skill = skill.id;
  item.strand = skill.strand;
  item.subject = sess.subject;
  item.b = Number.isFinite(item.b) ? item.b : b;
  item.kind ||= 'choice';
  item.id = ++itemSeq;
  if (item.kind === 'choice') {
    const right = item.options[0];
    let opts = item.options;
    if (item.sortOptions) opts = [...opts].sort((x, y) => (x.value ?? 0) - (y.value ?? 0));
    else if (!item.fixedOrder) opts = shuffle(sess.rng, opts);
    item.options = opts;
    item.answer = opts.indexOf(right);
    item.c ??= 1 / opts.length;
    item.layout = layoutOf(opts);
  } else {
    item.c ??= 0.02;
    item.layout = 'spell';
  }
  return item;
}

export function nextItem(sess) {
  if (sess.i >= sess.length && !sess.queue.length) return null;
  let item = sess.queue.shift();
  if (!item) {
    const seen = new Set([...(sess.player.seen || []).slice(-150), ...sess.keys]);
    for (let attempt = 0; attempt < 8 && !item; attempt++) {
      const strandId = chooseStrand(sess);
      if (sess.placement) borrowPrior(sess.player, sess.subject, strandId);
      const b = targetDifficulty(sess, strandId);
      const skill = chooseSkill(sess, strandId, b);
      const bb = Math.max(skill.lo, Math.min(skill.hi, b));
      let made = null;
      for (let k = 0; k < 4 && !made; k++) {
        const it = skill.gen(bb, sess.rng, { recent: seen, player: sess.player });
        if (it && !(sess.keys.has(it.key) && k < 3)) made = it;
      }
      if (made) {
        item = finishItem(sess, skill, made, bb);
        if (made.followUps?.length) {
          // a passage's questions travel together; the level check asks only two of them
          const fu = made.followUps.slice(0, sess.placement ? 1 : 9).map((f) => finishItem(sess, skill, { ...f }, bb));
          sess.queue.push(...fu);
          sess.length = Math.max(sess.length, sess.i + 1 + fu.length);
        }
        delete item.followUps;
      }
    }
    if (!item) return null;
  }
  sess.keys.add(item.key);
  sess.i++;
  sess.strandsUsed.push(item.strand);
  sess.skillsUsed[item.skill] = (sess.skillsUsed[item.skill] || 0) + 1;
  item.shownAt = Date.now();
  return item;
}

// Score the first try at an item. response: { choice, text, dontKnow, ms }
export function answer(sess, item, response, now = Date.now()) {
  const correct = !response.dontKnow && (item.kind === 'spell' ? response.text === item.answerText : response.choice === item.answer);
  if (item.scored) return { correct, scored: false };
  item.scored = true;
  const { player } = sess;
  const ss = st8(player, item.strand);
  const lp = lpOf(ss);
  M.drift(lp, 0.04);
  const slip = player.grade < 1 ? 0.08 : 0.05;
  M.observe(lp, item.b, correct, { a: item.a ?? M.DEFAULT_A, c: response.dontKnow ? 0 : item.c, slip });
  ss.lp = M.pack(lp);
  ss.n++;
  ss.last = now;
  ss.generic = false;
  // per-skill record
  player.skills ||= {};
  const sk = (player.skills[item.skill] ||= { n: 0, ok: 0, recent: [] });
  sk.n++; sk.ok += correct ? 1 : 0; sk.last = now;
  sk.recent = [...sk.recent.slice(-7), correct ? 1 : 0];
  // what was asked, so content isn't repeated soon
  player.seen = [...(player.seen || []).slice(-299), item.key];
  // daily activity
  player.days ||= {};
  const d = (player.days[dayKey(now)] ||= { q: 0, ok: 0, ms: 0, math: 0, reading: 0 });
  d.q++; d.ok += correct ? 1 : 0; d.ms += Math.min(response.ms || 0, 60000);
  // placement counters
  const sub = player.subjects[sess.subject];
  if (sess.placement) {
    sub.placement.n++;
    sub.placement.strands[item.strand] = (sub.placement.strands[item.strand] || 0) + 1;
  }
  // a short answer log (for the parent's "recent answers")
  player.log = [...(player.log || []).slice(-199), { t: now, s: item.skill, b: Math.round(item.b * 100) / 100, ok: correct ? 1 : 0, ms: response.ms | 0, dk: response.dontKnow ? 1 : 0 }];
  const star = sess.placement || correct ? 1 : 0;
  sess.stars += star;
  player.stars = (player.stars || 0) + star;
  sess.results.push({ correct, skill: item.skill, strand: item.strand, b: item.b, ms: response.ms, dontKnow: !!response.dontKnow });
  return { correct, scored: true, star };
}

export const STICKER_EVERY = 12;
export function finishRound(sess, stickerPool, now = Date.now()) {
  const { player, subject } = sess;
  const sub = player.subjects[subject];
  sub.rounds++;
  const d = (player.days ||= {})[dayKey(now)] ||= { q: 0, ok: 0, ms: 0, math: 0, reading: 0 };
  d[subject] = (d[subject] || 0) + 1;
  // history: one point per strand per day
  player.history ||= {};
  for (const id of new Set(sess.strandsUsed)) {
    const i = strandInfo(player, id);
    const h = (player.history[id] ||= []);
    const pt = [dayNum(now), Math.round(i.mean * 100), Math.round(i.sd * 100)];
    if (h.length && h[h.length - 1][0] === pt[0]) h[h.length - 1] = pt; else h.push(pt);
  }
  let finishedPlacement = false;
  if (sess.placement && placementDone(player, subject) && !sub.placed) { sub.placed = true; sub.placedAt = now; finishedPlacement = true; }
  // stickers
  const newStickers = [];
  player.stickers ||= [];
  const due = Math.floor((player.stars || 0) / STICKER_EVERY);
  while (player.stickers.length < due) {
    const left = stickerPool.filter((s) => !player.stickers.includes(s));
    if (!left.length) break;
    const s = pick(sess.rng, left);
    player.stickers.push(s);
    newStickers.push(s);
  }
  player.lastSubject = subject;
  return { newStickers, finishedPlacement, correct: sess.results.filter((r) => r.correct).length, total: sess.results.length, stars: sess.stars };
}

// Start a fresh level check for a subject (keeps the history; widens the current estimates).
export function restartPlacement(player, subject) {
  const sub = ensureSubject(player, subject);
  sub.placed = false;
  sub.placement = { n: 0, strands: {} };
  for (const id of SUBJECTS[subject].strands) { const ss = sub.strands[id]; const lp = lpOf(ss); M.drift(lp, 0.45); ss.lp = M.pack(lp); }
}

// For the report: where each skill stands relative to the child's level in its strand.
export function skillStatus(player, strandId) {
  const i = strandInfo(player, strandId);
  const list = milestonesFor(strandId) || skillsOf(strandId);
  return list.map((s) => {
    const rec = player.skills?.[s.id];
    let status = i.mean >= s.hi - 0.05 ? 'mastered' : i.mean >= s.lo ? 'working' : i.mean >= s.lo - 0.5 ? 'next' : 'later';
    const acc = rec?.recent?.length ? rec.recent.reduce((a, x) => a + x, 0) / rec.recent.length : null;
    return { id: s.id, name: s.name, lo: s.lo, hi: s.hi, status, n: rec?.n || 0, acc };
  });
}

export { SKILL };
