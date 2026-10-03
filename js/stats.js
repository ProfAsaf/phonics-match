// Numbers for the parent dashboard (SPEC.md, "Dashboard"). Pure functions of the saved progress.
import { FAMILIES, recId, addDays } from './mastery.js';

export const FAMILY_NAMES = { letterSound: 'Letter sounds', blending: 'Blending', segmenting: 'Segmenting', decoding: 'Decoding' };

export function familyCounts(P) {
  const out = Object.fromEntries(FAMILIES.map(f => [f, { mastered: 0, learning: 0, new: 0 }]));
  for (const r of Object.values(P.records)) out[r.family][r.state]++;
  return out;
}

// The five most frequent letter pairs he mixed up in the last two weeks.
export function topConfusions(P, day, n = 5) {
  const since = addDays(day, -13);
  const counts = new Map();
  for (const r of Object.values(P.records)) {
    if (r.family !== 'letterSound') continue;
    for (const a of r.attempts) {
      if (a.hit || !a.picked || a.day < since) continue;
      const pair = [r.id.slice(3), a.picked].sort().join(' and ');
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([pair, count]) => ({ pair, count }));
}

export function tally(rec) {
  const attempts = rec?.attempts ?? [];
  return { hits: attempts.filter(a => a.hit).length, n: attempts.length };
}

// First-try accuracy on real and nonsense words at the current step. A wide gap means he is
// recognizing words rather than decoding them.
export function realVsNonsense(P) {
  return { real: tally(P.records[recId.dec(P.step, true)]), nonsense: tally(P.records[recId.dec(P.step, false)]) };
}

export function history(P) {
  return {
    days: new Set(P.sessions.map(s => s.day)).size,
    sessions: P.sessions.map(s => ({ day: s.day, accuracy: s.scored ? s.firstTry / s.scored : null })),
  };
}

// One plain sentence about what comes next.
export function nextStep(C, P, day) {
  const step = C.steps[C.stepIndex[P.step]];
  if (P.levelCheckDue) return `Ready for the level ${P.levelCheckDue + 1} check.`;
  const queen = C.squad.players.find(p => p.step === P.step && p.piece === 'queen');
  if (P.queenReady[P.step] && queen && !P.signed.includes(queen.word)) {
    const next = C.steps[C.stepIndex[P.step] + 1];
    return next
      ? `Step ${P.step} is mastered. The queen comes out next match, and signing her moves up to step ${next.step}.`
      : `Step ${P.step} is mastered. Levels 3 and up are not built yet.`;
  }
  if (!P.sessions.length) return 'Play the first match to see where to focus.';
  const since = addDays(day, -6);
  const week = FAMILIES.map(f => {
    let hits = 0;
    let n = 0;
    for (const r of Object.values(P.records)) {
      if (r.family !== f) continue;
      for (const a of r.attempts) if (a.day >= since) { n++; hits += a.hit ? 1 : 0; }
    }
    return { f, n, rate: n ? hits / n : 1 };
  }).filter(x => x.n >= 5).sort((a, b) => a.rate - b.rate);
  if (week[0] && week[0].rate < 0.75) return `${FAMILY_NAMES[week[0].f]} is the weak spot this week.`;
  return `Working on step ${P.step}: short ${step.vowel} words.`;
}
