// The windowed mastery tally (SPEC.md, "Mastery model"). Pure functions: no DOM, clock, or randomness.
import { CONFIG } from './config.js';

export const recId = {
  letter: l => `ls:${l}`,
  blend: shape => `bl:${shape}`,
  seg: pos => `sg:${pos}`,
  dec: (step, real) => `dec:${step}:${real ? 'real' : 'nonsense'}`,
};

export const FAMILIES = ['letterSound', 'blending', 'segmenting', 'decoding'];

export function familyOf(id) {
  if (id.startsWith('ls:')) return 'letterSound';
  if (id.startsWith('bl:')) return 'blending';
  if (id.startsWith('sg:')) return 'segmenting';
  return 'decoding';
}

export function newRecord(id) {
  return { id, family: familyOf(id), state: 'new', attempts: [], confusions: {}, reviewDue: null, reviewStage: 0, assisted: 0 };
}

export function ruleFor(id, cfg = CONFIG) {
  if (id.endsWith(':real')) return cfg.mastery.real;
  if (id.endsWith(':nonsense')) return cfg.mastery.nonsense;
  return cfg.mastery.small;
}

// Mastered when enough of the last attempts are hits, and they span enough different days.
export function windowMastered(attempts, rule, minDays) {
  if (attempts.length < rule.window) return false;
  const last = attempts.slice(-rule.window);
  return last.filter(a => a.hit).length >= rule.hits && new Set(last.map(a => a.day)).size >= minDays;
}

export function isDue(rec, day) {
  return rec?.state === 'mastered' && rec.reviewDue != null && day >= rec.reviewDue;
}

export function isMastered(P, id) {
  return P.records[id]?.state === 'mastered';
}

// How well he knows it: a mastered record counts as 1; otherwise the share of recent hits, pulled
// toward a half so one lucky hit doesn't look mastered.
export function hitRate(rec, n = 6) {
  if (!rec) return 0.5;
  if (rec.state === 'mastered') return 1;
  const last = rec.attempts.slice(-n);
  return (last.filter(a => a.hit).length + 1) / (last.length + 2);
}

// Records one first attempt. An assisted answer is counted but never tallied (ground rule 6).
export function applyAttempt(rec, { day, hit, activity, picked = null, assisted = false }, cfg = CONFIG) {
  const r = { ...rec, attempts: [...rec.attempts], confusions: { ...rec.confusions } };
  if (assisted) {
    r.assisted = (r.assisted ?? 0) + 1;
    return r;
  }
  const attempt = { day, hit, activity };
  if (!hit && picked != null) {
    attempt.picked = picked;
    r.confusions[picked] = (r.confusions[picked] ?? 0) + 1;
  }
  r.attempts = [...r.attempts, attempt].slice(-cfg.mastery.keep);
  const days = cfg.mastery.reviewDays;

  if (r.state !== 'mastered') {
    if (windowMastered(r.attempts, ruleFor(r.id, cfg), cfg.mastery.minDays)) {
      r.state = 'mastered';
      r.reviewStage = 0;
      r.reviewDue = addDays(day, days[0]);
    } else {
      r.state = 'learning';
    }
    return r;
  }

  // Mastered: two misses among the last four attempts send it back to learning.
  const recent = r.attempts.slice(-cfg.mastery.relapse.of);
  if (recent.filter(a => !a.hit).length >= cfg.mastery.relapse.misses) {
    r.state = 'learning';
    r.reviewDue = null;
    r.reviewStage = 0;
    return r;
  }
  // A review that comes due: a hit stretches the gap (2, 4, 8, then 16 days); a miss starts over.
  if (isDue(r, day)) {
    r.reviewStage = hit ? Math.min(r.reviewStage + 1, days.length - 1) : 0;
    r.reviewDue = addDays(day, days[r.reviewStage]);
  }
  return r;
}

// ---- Days are local calendar dates, 'YYYY-MM-DD'.
export function today(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const t = s => Date.UTC(...s.split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((t(b) - t(a)) / 86400000);
}
