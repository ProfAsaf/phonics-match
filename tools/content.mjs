// Shared loading and step rules for the content tools in this folder. Node only.
import { readFileSync, existsSync } from 'node:fs';

export const contentDir = new URL('../content/', import.meta.url);

export function readJson(name) {
  return JSON.parse(readFileSync(new URL(name, contentDir), 'utf8'));
}

export function loadContent() {
  const sounds = readJson('sounds.json');
  const levels = readJson('levels.json').levels;
  const steps = levels.flatMap(l => l.steps.map(s => ({ ...s, level: l.level })));
  const stepIndex = Object.fromEntries(steps.map((s, i) => [s.step, i]));

  // The step that introduces each letter, and the first step at which each sound has a letter.
  const letterStep = {};
  for (const s of steps) for (const l of s.letters) letterStep[l] = s.step;
  const soundStep = {};
  for (const [letter, sound] of Object.entries(sounds.letters)) {
    const st = letterStep[letter];
    if (st && (!soundStep[sound] || stepIndex[st] < stepIndex[soundStep[sound]])) soundStep[sound] = st;
  }

  const words = readJson('words.json').words;
  const optional = name => (existsSync(new URL(name, contentDir)) ? readJson(name) : null);
  const nonsense = optional('nonsense.json')?.words ?? [];
  const sentences = readJson('sentences.json');
  const prompts = optional('prompts.json') ?? { prompts: [], commentary: [] };
  const custom = optional('custom-sentences.json')?.sentences ?? [];
  return { sounds, levels, steps, stepIndex, letterStep, soundStep, words, nonsense, sentences, prompts, custom };
}

// The first step by which every letter of a word has been introduced. An oral-only word is
// never printed, so its sounds decide instead. Undefined if a unit is not taught in levels 1-2.
export function stepOf(entry, c) {
  const units = entry.oralOnly ? entry.sounds.map(s => c.soundStep[s]) : entry.letters.map(l => c.letterStep[l]);
  if (units.some(u => u === undefined)) return undefined;
  return units.reduce((a, b) => (c.stepIndex[b] > c.stepIndex[a] ? b : a));
}

export const isVowel = letter => 'aeiou'.includes(letter);
