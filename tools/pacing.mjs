// How long the whole curriculum takes: a simulated child plays one match a day through every step,
// with the grown-up running each level check when it comes due. Prints matches per step for a few
// skill levels, so the pace can be checked against the school year.
//   node tools/pacing.mjs            (prints the table)
// The same simulation runs in the tests (test/logic.test.js) with one profile.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildIndex } from '../js/content.js';
import { CONFIG } from '../js/config.js';
import { addDays } from '../js/mastery.js';
import { makeRng } from '../js/rng.js';
import { newProgress, planSession, scoreItem, advance, currentItem, atHalftime, halftime, finishSession, applyPlacement, levelCheckWords, applyLevelCheck } from '../js/session.js';

export function loadIndex() {
  const read = n => JSON.parse(readFileSync(new URL(`../content/${n}.json`, import.meta.url), 'utf8'));
  return buildIndex(Object.fromEntries(['sounds', 'levels', 'words', 'nonsense', 'sentences', 'prompts', 'custom-sentences', 'passages'].map(n => [n, read(n)])));
}

// skill: the chance of a right first try on each kind of item.
export function season(C, skill, { start = '2026-10-05', maxDays = 400, seed = 'pace' } = {}) {
  const placement = Object.fromEntries(C.letters.map(l => [l, true]));
  let P = applyPlacement(C, newProgress(C, start), placement, start);
  P.team = { word: 'fox', color: '#e63946' };
  const firstDay = {};
  const last = C.steps.at(-1).step;
  for (let d = 0; d < maxDays; d++) {
    const day = addDays(start, d);
    firstDay[P.step] ??= d;
    const S = planSession(C, P, { day, mode: 'parent', seed: `${seed}${d}` });
    const rng = makeRng(`${seed}answers${d}`);
    const hit = p => rng.next() < p;
    let item = currentItem(S);
    while (item) {
      if (atHalftime(S)) halftime(C, P, S);
      const wrong = () => item.choices?.find(c => c !== item.answer);
      let out;
      switch (item.activity) {
        case 'soundMatch': { const ok = hit(skill.letter); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'blendIt': { const ok = hit(skill.blend); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'findSound': { const ok = hit(skill.seg); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        case 'buildIt': {
          const spare = item.tray.find(t => !item.letters.includes(t.letter))?.letter ?? null;
          const tiles = item.letters.map(l => (hit(skill.letter) ? l : spare));
          out = { correct: tiles.join() === item.letters.join(), firstTiles: tiles };
          break;
        }
        case 'readFind': { const ok = hit(item.kind === 'real' ? skill.real : skill.nonsense); out = { correct: ok, picked: ok ? item.answer : wrong() }; break; }
        default:
          if (item.kind === 'sentence') out = { missed: hit(skill.real) ? [] : [1] };
          else out = hit(item.kind === 'real' ? skill.real : skill.nonsense) ? { verdict: 'read' } : { verdict: 'sound', marked: [0] };
      }
      P = scoreItem(C, P, S, item, out, CONFIG).P;
      item = advance(C, P, S);
    }
    P = finishSession(C, P, S);
    // The grown-up runs the level check once it comes due (a few days later, in a check-up).
    if (P.levelCheckDue != null) {
      const words = levelCheckWords(C, P.levelCheckDue, `${seed}check${d}`);
      P = applyLevelCheck(C, P, P.levelCheckDue, words.map(() => hit((skill.real + skill.nonsense) / 2)), day).P;
    }
    // Done when the last step's queen is signed.
    const queen = C.squad.players.find(p => p.step === last && p.piece === 'queen');
    if (P.step === last && queen && P.signed.includes(queen.word)) return { days: d + 1, firstDay, P, finished: true };
  }
  return { days: maxDays, firstDay, P, finished: false };
}

export const PROFILES = {
  strong: { letter: 0.95, blend: 0.95, seg: 0.95, real: 0.95, nonsense: 0.92 },
  steady: { letter: 0.9, blend: 0.9, seg: 0.88, real: 0.9, nonsense: 0.85 },
  working: { letter: 0.85, blend: 0.85, seg: 0.82, real: 0.85, nonsense: 0.8 },
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const C = loadIndex();
  const rows = {};
  const totals = {};
  for (const [name, skill] of Object.entries(PROFILES)) {
    const r = season(C, skill);
    totals[name] = r.finished ? `${r.days} matches` : `not done in ${r.days}`;
    C.steps.forEach((s, i) => {
      const next = C.steps[i + 1];
      const a = r.firstDay[s.step], b = next ? r.firstDay[next.step] ?? (r.finished ? r.days : undefined) : r.finished ? r.days : undefined;
      (rows[s.step] ??= { step: s.step, name: s.name })[name] = a != null && b != null ? b - a : '–';
    });
  }
  console.table(Object.values(rows));
  console.log('Whole curriculum:', totals);
  console.log('A school year from October to June is about 170 school days.');
}
