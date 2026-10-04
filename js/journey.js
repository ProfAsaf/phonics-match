// The day's run and his season on the world map (SPEC.md, "Changes after version 1"). Each day his
// player runs past six activity stops in the session's fixed order, with the halftime show after the
// first three and the trophy at full time. On the map each match is one level, and each step he
// moves up is a new world with its own scenery. Pure: everything comes from the content and his
// progress, so the tests can check it.
import { letterState } from './choose.js';
import { isVowel } from './content.js';

export const STOPS = [
  { kind: 'stadium', activity: 'soundMatch' },
  { kind: 'castle', activity: 'blendIt' },
  { kind: 'mine', activity: 'findSound' },
  { kind: 'show' }, // halftime: the chant
  { kind: 'workshop', activity: 'buildIt' },
  { kind: 'islands', activity: 'readFind' },
  { kind: 'night', activity: 'readAloud' },
  { kind: 'trophy' }, // full time
];
export const HALFTIME_STOP = 3;
export const TROPHY_STOP = 7;
export const stopOf = activity => STOPS.findIndex(s => s.activity === activity);

// Each step is a world: meadow, river, forest, snow, beach, and around again.
export const WORLD_THEMES = ['meadow', 'river', 'forest', 'snow', 'beach'];
export function worldFor(C, step) {
  const i = C.stepIndex[step] ?? 0;
  return { number: i + 1, theme: WORLD_THEMES[i % WORLD_THEMES.length] };
}

// ---- The map. A world holds this many levels (matches) before its gate. If he needs more matches
// than that in a step, he keeps playing on the last level until the gate opens.
export const LEVELS_PER_WORLD = 10;

// Matches played in each step. Matches saved before steps were recorded count for the current step.
export function playsByStep(C, P) {
  const counts = {};
  for (const s of P.sessions ?? []) {
    const step = s.step && s.step in C.stepIndex ? s.step : P.step;
    counts[step] = (counts[step] ?? 0) + 1;
  }
  return counts;
}

// Every world on the map, in order: one per step, then a locked one for each later level whose steps
// aren't written yet. `gate` is what stands at the world's far end: a plain gate, or the castle where
// the grown-up's level check unlocks the next level.
export function mapWorlds(C, P) {
  const counts = playsByStep(C, P);
  const cur = C.stepIndex[P.step] ?? 0;
  const worlds = C.steps.map((s, i) => {
    const next = C.steps[i + 1];
    const levelEnd = !next || next.level !== s.level;
    return {
      step: s.step, level: s.level, number: i + 1, theme: WORLD_THEMES[i % WORLD_THEMES.length],
      state: i < cur ? 'done' : i === cur ? 'here' : 'ahead',
      played: counts[s.step] ?? 0,
      gate: levelEnd ? 'castle' : 'gate',
      queen: i === cur && !!P.queenReady?.[s.step],
      check: levelEnd && P.levelCheckDue === s.level,
    };
  });
  const later = [...new Set((C.levels ?? []).filter(l => !l.steps?.length).map(l => l.level))];
  for (const level of later) {
    const i = worlds.length;
    worlds.push({ step: null, level, number: i + 1, theme: WORLD_THEMES[i % WORLD_THEMES.length], state: 'later', played: 0, gate: 'castle', queen: false, check: false });
  }
  return worlds;
}

// The level his player stands on in the current world: today's, before he plays it; tomorrow's after.
export const hereLevel = world => Math.min(world.played, LEVELS_PER_WORLD - 1);
// Levels with a flag: one for each match played in the world.
export const flagged = world => Math.min(world.played, LEVELS_PER_WORLD);

// Map geometry, in map units: x runs across, y up the screen (negative is higher). World i fills a band
// MAP_WORLD tall, with level k on a winding path and its gate at the top.
export const MAP_WORLD = 1000;
export function levelSpot(i, k) {
  const y = -i * MAP_WORLD - 120 - (k * (MAP_WORLD - 300)) / (LEVELS_PER_WORLD - 1);
  const x = 118 * Math.sin(k * 1.05 + i * 1.9);
  return { x, y };
}
export const gateSpot = i => ({ x: 0, y: -(i + 1) * MAP_WORLD + 70 });

// For the parent dashboard: where he is and what comes next, in plain words.
export function whereHeIs(C, P) {
  const step = C.steps[C.stepIndex[P.step]];
  const world = worldFor(C, P.step);
  const players = C.squad.players.filter(p => p.step === P.step);
  const signed = players.filter(p => P.signed.includes(p.word)).length;
  const levelLetters = C.steps.filter(s => s.level === step.level).flatMap(s => s.letters);
  const count = state => levelLetters.filter(l => letterState(P, l) === state).length;
  const vowel = step.letters.find(isVowel);
  const played = playsByStep(C, P)[P.step] ?? 0;
  const lines = [
    `World ${world.number} (the ${world.theme}), step ${step.step}${vowel ? `, short ${vowel}` : ''}: ${played} ${played === 1 ? 'match' : 'matches'} played here, ${signed} of ${players.length} players signed.`,
    `Letter sounds in level ${step.level}: ${count('mastered')} mastered, ${count('learning')} learning, ${count('new')} not started.`,
  ];
  if (P.levelCheckDue === step.level) lines.push(`The level ${step.level} check is due: run it from Settings.`);
  else if (P.queenReady[P.step]) lines.push('The queen is ready: signing her opens the gate to the next world.');
  else lines.push("The queen comes out when this step's real and nonsense words are both mastered; signing her opens the gate to the next world.");
  return lines;
}
