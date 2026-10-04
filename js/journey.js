// The season map on the home screen: each level is a world, each step a row of its players (the
// queen at the end is the promotion), each letter-sound an ore block, and the level check the cup
// match that opens the next world. Pure: everything is derived from the content and his progress.
import { letterState } from './choose.js';
import { isVowel } from './content.js';

// Levels 3 to 6 show as locked worlds until their content exists.
export const WORLDS = [
  { level: 1, biome: 'grass', name: 'Grasslands' },
  { level: 2, biome: 'forest', name: 'Forest' },
  { level: 3, biome: 'desert', name: 'Desert' },
  { level: 4, biome: 'snow', name: 'Snowy peaks' },
  { level: 5, biome: 'cave', name: 'Caves' },
  { level: 6, biome: 'sky', name: 'Sky islands' },
];

export function journey(C, P) {
  const here = C.stepIndex[P.step];
  const worlds = WORLDS.map(w => {
    const stepsHere = C.steps.filter(s => s.level === w.level);
    const steps = stepsHere.map(s => {
      const at = C.stepIndex[s.step];
      const players = C.squad.players.filter(p => p.step === s.step)
        .map(p => ({ word: p.word, piece: p.piece, number: p.number, signed: P.signed.includes(p.word) }));
      return {
        step: s.step,
        vowel: s.letters.find(isVowel) ?? null,
        status: at < here ? 'done' : at === here ? 'current' : 'ahead',
        players,
        signed: players.filter(p => p.signed).length,
        queenReady: !!P.queenReady[s.step],
      };
    });
    const letters = stepsHere.flatMap(s => s.letters).map(l => ({ letter: l, sound: C.letterSound[l], state: letterState(P, l) }));
    const built = steps.length > 0;
    const status = !built ? 'later'
      : steps.some(s => s.status === 'current') ? 'current'
        : steps.every(s => s.status === 'done') ? 'done' : 'ahead';
    return { ...w, built, steps, letters, check: { due: P.levelCheckDue === w.level, passed: !!P.levelPassed[w.level] }, status };
  });
  return { worlds, current: worlds.find(w => w.status === 'current') ?? worlds.find(w => w.built) };
}

// The next slot to fill in a step: the first player not yet signed, in the order they line up.
export const nextSlot = step => step.players.findIndex(p => !p.signed);

// For the parent dashboard: where he is and what comes next, in plain words.
export function whereHeIs(C, P) {
  const { current } = journey(C, P);
  const step = current.steps.find(s => s.status === 'current') ?? current.steps.at(-1);
  const count = state => current.letters.filter(l => l.state === state).length;
  const lines = [
    `World ${current.level} (${current.name}), step ${step.step}${step.vowel ? `, short ${step.vowel}` : ''}: ${step.signed} of ${step.players.length} players signed.`,
    `Letter sounds in this world: ${count('mastered')} mastered, ${count('learning')} learning, ${count('new')} not started.`,
  ];
  if (current.check.due) lines.push(`The level ${current.level} check (the cup match) is due: run it from Settings.`);
  else if (step.queenReady) lines.push('The queen is ready: signing her moves him up to the next step.');
  else lines.push('The queen comes out when this step\'s real and nonsense words are both mastered.');
  return lines;
}
