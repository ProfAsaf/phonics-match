// The day's trip and his season, for the world map (SPEC.md, "Changes after version 1"). Each day
// his player walks past six levels, one per activity in the session's fixed order, with the
// halftime show after the first three and the trophy at full time. Each step he moves up is a new
// world with its own scenery. Pure: everything is derived from the content and his progress.
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

// How each stop looks on the map: done, the next one, still ahead, or skipped today.
export function stopStates(order, done, next) {
  return STOPS.map((s, i) => (done.has(i) ? 'done' : i === next ? 'next' : s.activity && !order.includes(s.activity) ? 'skip' : 'ahead'));
}

// Each step is a world: meadow, river, forest, snow, beach, and around again.
export const WORLD_THEMES = ['meadow', 'river', 'forest', 'snow', 'beach'];
export function worldFor(C, step) {
  const i = C.stepIndex[step] ?? 0;
  return { number: i + 1, theme: WORLD_THEMES[i % WORLD_THEMES.length] };
}

// For the parent dashboard: where he is and what comes next, in plain words.
export function whereHeIs(C, P) {
  const step = C.steps[C.stepIndex[P.step]];
  const world = worldFor(C, P.step);
  const players = C.squad.players.filter(p => p.step === P.step);
  const signed = players.filter(p => P.signed.includes(p.word)).length;
  const levelLetters = C.steps.filter(s => s.level === step.level).flatMap(s => s.letters);
  const count = state => levelLetters.filter(l => letterState(P, l) === state).length;
  const vowel = step.letters.find(isVowel);
  const lines = [
    `World ${world.number} (the ${world.theme}), step ${step.step}${vowel ? `, short ${vowel}` : ''}: ${signed} of ${players.length} players signed.`,
    `Letter sounds in level ${step.level}: ${count('mastered')} mastered, ${count('learning')} learning, ${count('new')} not started.`,
  ];
  if (P.levelCheckDue === step.level) lines.push(`The level ${step.level} check is due: run it from Settings.`);
  else if (P.queenReady[P.step]) lines.push('The queen is ready: signing her moves him up to the next world.');
  else lines.push("The queen comes out when this step's real and nonsense words are both mastered; then he moves to the next world.");
  return lines;
}
