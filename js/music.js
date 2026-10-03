// The halftime chant's music, made with Web Audio: a drum beat and a public-domain nursery tune,
// with no music files (SPEC.md, "The team chant"). One note per word; the last word of each line
// is held for two beats.
import { clip } from './content.js';

export const TUNES = {
  'Hot Cross Buns': [['E4', 'D4', 'C4'], ['E4', 'D4', 'C4'], ['C4', 'C4', 'C4', 'C4', 'D4', 'D4', 'D4', 'D4'], ['E4', 'D4', 'C4']],
  'Twinkle, Twinkle, Little Star': [['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'], ['F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4']],
  'Bingo': [['D4', 'G4', 'G4', 'D4', 'D4', 'E4', 'E4', 'D4'], ['D4', 'G4', 'G4', 'A4', 'A4', 'B4', 'G4']],
  'Rain, Rain, Go Away': [['G4', 'E4', 'G4', 'G4', 'E4'], ['G4', 'G4', 'E4', 'E4', 'D4', 'D4', 'C4']],
  'Old MacDonald Had a Farm': [['G4', 'G4', 'G4', 'D4', 'E4', 'E4', 'D4'], ['B4', 'B4', 'A4', 'A4', 'G4']],
};

const SEMITONES = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export const frequency = note => 440 * 2 ** ((SEMITONES[note[0]] + (Number(note.at(-1)) - 4) * 12) / 12);

// When each word falls, in seconds from the first word.
export function timeline(lines, tempo) {
  const beat = 60 / tempo;
  const events = [];
  let t = 0;
  lines.forEach((line, li) => line.forEach((word, wi) => {
    const beats = wi === line.length - 1 ? 2 : 1;
    events.push({ line: li, index: wi, word, t, beats });
    t += beats * beat;
  }));
  return { events, length: t, beat };
}

// Plays the verse once. With clips, each word's recording plays on its beat; without, only the
// music plays and he sings. onWord(line, index) fires on each word's beat.
export async function playChant(audio, { lines, tune, tempo, clips, onWord }) {
  const words = lines.map(line => line.map(t => t.word));
  const notes = TUNES[tune] ?? TUNES['Twinkle, Twinkle, Little Star'];
  const { events, length, beat } = timeline(words, tempo);
  if (clips) await audio.prepare(events.map(e => clip.word(e.word)));
  const start = audio.now() + 0.15 + 4 * beat;
  for (let i = 0; i < 4; i++) audio.tone(1320, start - (4 - i) * beat, 0.05, 'square', 0.05); // count-in
  for (let b = 0; b < Math.round(length / beat); b++) {
    const t = start + b * beat;
    if (b % 2 === 0) audio.kick(t);
    else audio.snare(t);
    audio.hat(t + beat / 2);
  }
  for (const e of events) {
    const note = notes[e.line]?.[e.index] ?? 'C4';
    audio.tone(frequency(note), start + e.t, e.beats * beat * 0.92, 'triangle', clips ? 0.1 : 0.18);
    if (clips) audio.at(clip.word(e.word), start + e.t);
    audio.later(start + e.t, () => onWord?.(e.line, e.index));
  }
  await audio.until(start + length);
}
