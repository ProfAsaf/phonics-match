// Checks the files in content/ against SPEC.md's content rules. Run: node tools/check-content.mjs
// Exits non-zero if anything is wrong; prints a summary of counts per step either way.
import { loadContent, stepOf, isVowel } from './content.mjs';
import { spell } from '../js/content.js';

const c = loadContent();
const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);
const idx = s => c.stepIndex[s];
const level = s => c.steps[idx(s)]?.level;

const KINDS = ['vowel', 'continuous', 'stop', 'quick'];
const ENDINGS = ['b', 'd', 'g', 'm', 'n', 'p', 't'];
const STARTER_PICTURES = 'cat bat rat hat map pan can van bag cap pig pin six dog fox box pot log sun bus bug cup nut tub bed hen pen net leg web jet ten'.split(' ');
// One word per note in each line of the tune; js/music.js holds the melodies.
const TUNE_LINES = {
  'Hot Cross Buns': [3, 3, 8, 3],
  'Twinkle, Twinkle, Little Star': [7, 7],
  'Bingo': [8, 7],
  'Rain, Rain, Go Away': [5, 7],
  'Old MacDonald Had a Farm': [7, 5],
};

// Sounds and letters (a letter is a letter or a letter group taught as one sound).
const soundIds = new Set(c.sounds.sounds.map(s => s.id));
if (soundIds.size !== c.sounds.sounds.length) err('sounds.json repeats a sound id');
for (const s of c.sounds.sounds) if (!KINDS.includes(s.kind)) err(`sound ${s.id}: unknown kind ${s.kind}`);
for (const [l, s] of Object.entries(c.sounds.letters)) if (!soundIds.has(s)) err(`letter ${l} maps to missing sound ${s}`);
const alternates = c.sounds.alternates ?? {};
for (const [l, alts] of Object.entries(alternates)) {
  if (!(l in c.sounds.letters)) err(`alternate sounds for unknown letter ${l}`);
  for (const [s, st] of Object.entries(alts)) {
    if (!soundIds.has(s)) err(`letter ${l}: alternate ${s} is not a sound`);
    if (!(st in c.stepIndex)) err(`letter ${l}: alternate ${s} from unknown step ${st}`);
  }
}
const used = new Set([...Object.values(c.sounds.letters), ...Object.values(alternates).flatMap(a => Object.keys(a))]);
for (const id of soundIds) if (!used.has(id)) err(`sound ${id} has no letter`);
// May letter l say sound s in a word at step st?
const saysOK = (l, s, st) => c.sounds.letters[l] === s || (alternates[l]?.[s] && idx(alternates[l][s]) <= idx(st));

// Levels and steps.
const introduced = c.steps.flatMap(s => s.letters);
for (const l of Object.keys(c.sounds.letters)) {
  const n = introduced.filter(x => x === l).length;
  if (n !== 1) err(`letter ${l} is introduced ${n} times in levels.json`);
}
for (const s of c.steps) {
  if (!s.name) err(`step ${s.step} has no name`);
  if (s.vowel && !s.letters.includes(s.vowel)) err(`step ${s.step} does not introduce its vowel ${s.vowel}`);
  for (const l of s.letters) if (!(l in c.sounds.letters)) err(`step ${s.step} introduces ${l}, which has no sound`);
}

// Word bank and nonsense words.
const all = [...c.words.map(w => ({ ...w, file: 'words.json' })), ...c.nonsense.map(w => ({ ...w, file: 'nonsense.json' }))];
const byWord = new Map();
const emojiSeen = new Map();
for (const w of all) {
  const where = `${w.file}: ${w.word}`;
  const lower = w.word.toLowerCase();
  if (byWord.has(lower)) err(`${where} appears twice`);
  byWord.set(lower, w);
  if (w.name ? w.word !== lower[0].toUpperCase() + lower.slice(1) : w.word !== lower) err(`${where}: wrong capitals`);
  if (!(w.step in c.stepIndex)) { err(`${where}: unknown step ${w.step}`); continue; }
  const spelled = spell(w).map(p => p.text).join('');
  if (spelled !== lower) err(`${where}: letters spell ${spelled}`);
  if (w.letters.length !== w.sounds.length) err(`${where}: ${w.letters.length} letters but ${w.sounds.length} sounds`);
  for (const s of w.sounds) if (!soundIds.has(s)) err(`${where}: no clip for sound ${s}`);
  if (!w.oralOnly) {
    w.letters.forEach((l, i) => {
      if (!(l in c.sounds.letters)) err(`${where}: letter ${l} is not taught`);
      else if (!saysOK(l, w.sounds[i], w.step)) err(`${where}: ${l} should say /${c.sounds.letters[l]}/, not /${w.sounds[i]}/`);
    });
  }
  const step = stepOf(w, c);
  if (!step) err(`${where}: uses something no step teaches`);
  else if (idx(w.step) < idx(step)) err(`${where}: step is ${w.step}, but its ${w.oralOnly ? 'sounds' : 'letters'} need ${step}`);
  else if (level(w.step) <= 2 && w.step !== step) err(`${where}: step is ${w.step}, but its letters make it ${step}`);
  if (w.split != null && (w.split < 1 || w.split >= w.letters.length)) err(`${where}: split ${w.split} is outside the word`);
  if (w.real !== (w.file === 'words.json')) err(`${where}: real should be ${w.file === 'words.json'}`);
  if (w.picture) {
    if (w.file !== 'words.json' || w.name) err(`${where}: only real words get pictures`);
    const bad = emojiProblem(w.picture);
    if (bad) err(`${where}: add U+FE0F after U+${bad.codePointAt(0).toString(16).toUpperCase()} so it shows as an emoji`);
    if (emojiSeen.has(w.picture)) err(`${where}: same picture as ${emojiSeen.get(w.picture)}`);
    emojiSeen.set(w.picture, w.word);
  }
}
for (const p of STARTER_PICTURES) if (!byWord.get(p)?.picture || byWord.get(p).oralOnly) err(`starter picture word ${p} is missing or has no picture`);

// Nonsense words. Levels 1 and 2 follow the consonant-vowel-consonant rules; later ones were hand-picked.
for (const w of c.nonsense) {
  const where = `nonsense.json: ${w.word}`;
  if (w.levelCheck && w.checkup) err(`${where}: held back for both the level check and the check-ups`);
  if (level(w.step) > 2) continue;
  const [onset, vowel, coda] = w.letters;
  const stepVowel = c.steps[idx(w.step)].vowel;
  if (w.letters.length !== 3 || isVowel(onset) || !isVowel(vowel) || isVowel(coda)) err(`${where}: not consonant-vowel-consonant`);
  if (vowel !== stepVowel) err(`${where}: vowel ${vowel} is not step ${w.step}'s vowel ${stepVowel}`);
  if (!ENDINGS.includes(coda)) err(`${where}: ends in ${coda}`);
  if (onset === 'c' && !'aou'.includes(vowel)) err(`${where}: c before ${vowel}`);
  if (onset === 'k' && !'ei'.includes(vowel)) err(`${where}: k before ${vowel}`);
  if (onset === 'g' && 'ei'.includes(vowel)) err(`${where}: g before ${vowel}`);
  if (onset === 'w' && vowel === 'a') err(`${where}: a after w`);
  if (onset === 'x') err(`${where}: starts with x`);
  if (!w.rhyme || w.rhyme === w.word || !w.rhyme.endsWith(w.word.slice(1))) err(`${where}: rhyme hint "${w.rhyme}" does not rhyme`);
}
const isPlay = w => !w.levelCheck && !w.checkup;
for (const s of c.steps) {
  const play = c.nonsense.filter(w => w.step === s.step && isPlay(w)).length;
  if (play !== 10) warn(`step ${s.step} has ${play} nonsense play words; the spec asks for 10 (one per squad player)`);
}
for (const l of c.levels.filter(l => l.steps.length)) {
  const n = c.nonsense.filter(w => w.levelCheck && level(w.step) === l.level).length;
  if (n !== 5) err(`level ${l.level} has ${n} level-check words; the spec asks for 5`);
}

// Sight words: each from a step on, and never also a word in the bank.
const { sightWords: sightList, sentences, chants } = c.sentences;
const sight = new Map(sightList.map(s => (typeof s === 'string' ? [s, c.steps[0].step] : [s.word, s.step])));
for (const [word, step] of sight) {
  if (!(step in c.stepIndex)) err(`sight word "${word}": unknown step ${step}`);
  if (byWord.has(word.toLowerCase()) && byWord.get(word.toLowerCase()).real) err(`sight word "${word}" is also in words.json`);
}
const sightAt = (word, step) => {
  const st = sight.get(word) ?? sight.get(word.toLowerCase());
  return st != null && idx(st) <= idx(step) ? st : null;
};

// Text: every word is a sight word taught by then, or a printed word from words.json at the step or earlier.
function checkText(text, step, where, act = []) {
  const tokens = text.split(/\s+/);
  let start = true;
  let latest = c.steps[0].step;
  for (const raw of tokens) {
    const t = raw.replace(/[,.!?]+$/, '');
    // Mom and Dad take a capital when they are used as names (Plug it in, Dad!).
    const isName = t === '{Name}' || t === 'Mom' || t === 'Dad' || (byWord.get(t.toLowerCase())?.name && byWord.get(t.toLowerCase()).word === t);
    const capital = /^[A-Z]/.test(t) || t === '{Act}' || t === '{Name}';
    if (start && !capital) err(`${where}: "${t}" starts a sentence without a capital`);
    if (!start && capital && !isName && t !== 'I') err(`${where}: "${t}" has a capital mid-sentence`);
    const options = t.toLowerCase() === '{act}' ? act : t === '{Name}' ? [] : [start && !isName && t !== 'I' ? t.toLowerCase() : t];
    if (t.toLowerCase() === '{act}' && !act.length) err(`${where}: {act} slot but no act words`);
    for (const o of options) {
      if (sight.has(o) || sight.has(o.toLowerCase())) {
        const st = sightAt(o, step);
        if (!st) err(`${where}: sight word "${o}" is taught after ${step}`);
        else if (idx(st) > idx(latest)) latest = st;
        continue;
      }
      const w = byWord.get(o.toLowerCase());
      if (!w || !w.real || w.oralOnly || (w.name && w.word !== o)) err(`${where}: "${o}" is not a printable word in words.json`);
      else if (idx(w.step) > idx(step)) err(`${where}: "${o}" is step ${w.step}, after ${step}`);
      else if (idx(w.step) > idx(latest)) latest = w.step;
    }
    start = /[.!?]$/.test(raw);
  }
  if (!start) err(`${where}: does not end with . ! or ?`);
  return latest;
}

for (const s of sentences) {
  const where = `sentence "${s.text}"`;
  const latest = checkText(s.text, s.step, where);
  if (latest !== s.step) err(`${where}: listed at ${s.step} but readable from ${latest}`);
  const bad = emojiProblem(s.emoji);
  if (bad) err(`${where}: add U+FE0F after U+${bad.codePointAt(0).toString(16).toUpperCase()} in its emoji`);
}
for (const ch of chants) {
  const where = `${ch.step} chant`;
  checkText(ch.lines.join(' '), ch.step, where, ch.act ?? []);
  const beats = TUNE_LINES[ch.tune];
  if (!beats) err(`${where}: unknown tune ${ch.tune}`);
  else if (ch.lines.map(l => l.split(/\s+/).length).join() !== beats.join()) {
    err(`${where}: words per line ${ch.lines.map(l => l.split(/\s+/).length).join('/')} do not fit ${ch.tune} (${beats.join('/')})`);
  }
  if (ch.act && !ch.lines.some(l => /\{act\}/i.test(l))) err(`${where}: act words but no {act} slot`);
}
for (const s of c.steps) {
  const n = sentences.filter(x => x.step === s.step).length;
  if (n < 4) warn(`step ${s.step} has ${n} sentences; the spec asks for at least four`);
  const v = chants.filter(x => x.step === s.step).length;
  if (v < 1) err(`step ${s.step} has no chant verse`);
}

// The check-up stories: decodable at their step, long enough for most of a minute.
const storyIds = new Set();
for (const p of c.passages) {
  const where = `story "${p.id}"`;
  if (storyIds.has(p.id)) err(`${where} appears twice`);
  storyIds.add(p.id);
  if (!(p.step in c.stepIndex)) err(`${where}: unknown step ${p.step}`);
  else checkText(p.text, p.step, where);
  const n = p.text.split(/\s+/).length;
  if (n < 40) warn(`${where}: only ${n} words; a fast reader finishes before the minute is up`);
  const bad = emojiProblem(p.emoji ?? '');
  if (bad) err(`${where}: add U+FE0F after U+${bad.codePointAt(0).toString(16).toUpperCase()} in its emoji`);
}
for (const s of c.steps) {
  if (!c.passages.some(p => p.step === s.step)) warn(`step ${s.step} has no check-up story; check-ups there use the last step's`);
}

// Parent's custom headlines: report the first step each one can be read at, or the words that block it.
for (const s of c.custom) {
  const where = `custom sentence "${s.text}"`;
  const unknown = s.text.split(/\s+/).map(t => t.replace(/[,.!?]+$/, ''))
    .filter(t => !sight.has(t) && !sight.has(t.toLowerCase()) && !byWord.get(t.toLowerCase())?.real);
  if (unknown.length) warn(`${where}: not in the word bank yet: ${unknown.join(', ')}`);
  else {
    const latest = checkText(s.text, c.steps.at(-1).step, where);
    console.log(`${where}: readable from step ${latest}`);
  }
  const bad = emojiProblem(s.emoji ?? '');
  if (bad) err(`${where}: add U+FE0F after U+${bad.codePointAt(0).toString(16).toUpperCase()} in its emoji`);
}

// Prompts.
const promptIds = new Set();
for (const p of c.prompts.prompts) {
  if (!/^[a-z-]+$/.test(p.id)) err(`prompt id "${p.id}" should be lowercase letters and dashes`);
  if (promptIds.has(p.id)) err(`prompt ${p.id} appears twice`);
  promptIds.add(p.id);
  if (!p.text) err(`prompt ${p.id} has no text`);
}

// A pictograph that defaults to text style needs U+FE0F after it, or iOS may draw it as plain text.
function emojiProblem(s) {
  const cps = [...s];
  return cps.find((ch, i) => /\p{Extended_Pictographic}/u.test(ch) && !/\p{Emoji_Presentation}/u.test(ch) && cps[i + 1] !== '️');
}

// Summary.
const rows = c.steps.map(s => {
  const real = c.words.filter(w => w.step === s.step);
  return {
    step: s.step,
    'real words': real.filter(w => !w.oralOnly && !w.name).length,
    pictured: real.filter(w => w.picture && !w.oralOnly).length,
    'nonsense play': c.nonsense.filter(w => w.step === s.step && isPlay(w)).length,
    'level check': c.nonsense.filter(w => w.step === s.step && w.levelCheck).length,
    'check-up': c.nonsense.filter(w => w.step === s.step && w.checkup).length,
    'sight words': [...sight.values()].filter(st => st === s.step).length,
    sentences: sentences.filter(x => x.step === s.step).length,
    chants: chants.filter(x => x.step === s.step).length,
    stories: c.passages.filter(p => p.step === s.step).length,
  };
});
console.table(rows);
const heard = c.nonsense.filter(w => !w.checkup).length; // check-up words are only read
const clips = c.words.length + heard + sight.size + sentences.length + c.custom.length;
const other = c.prompts.prompts.length + c.prompts.commentary.length + 1;
console.log(`Audio clips needed: ${c.sounds.sounds.length} sounds, ${clips} words and sentences (${c.words.length} real, ${heard} nonsense, ${sight.size} sight words, ${sentences.length + c.custom.length} sentences), and ${other} prompts, commentary lines, and his goal shout.`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(errors.length ? `${errors.length} errors` : 'Content OK.');
process.exit(errors.length ? 1 : 0);
