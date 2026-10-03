// Checks the files in content/ against SPEC.md's content rules. Run: node tools/check-content.mjs
// Exits non-zero if anything is wrong; prints a summary of counts per step either way.
import { loadContent, stepOf, isVowel } from './content.mjs';

const c = loadContent();
const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);
const idx = s => c.stepIndex[s];

const KINDS = ['vowel', 'continuous', 'stop', 'quick'];
const ENDINGS = ['b', 'd', 'g', 'm', 'n', 'p', 't'];
const SIGHT_WORDS = ['the', 'a', 'I', 'is', 'his', 'to'];
const STARTER_PICTURES = 'cat bat rat hat map pan can van bag cap pig pin six dog fox box pot log sun bus bug cup nut tub bed hen pen net leg web jet ten'.split(' ');
const ORAL_EXTRAS = ['sock', 'duck', 'rock', 'lock', 'bell'];
// One word per note in each line of the tune; js/music.js holds the melodies.
const TUNE_LINES = {
  'Hot Cross Buns': [3, 3, 8, 3],
  'Twinkle, Twinkle, Little Star': [7, 7],
  'Bingo': [8, 7],
  'Rain, Rain, Go Away': [5, 7],
  'Old MacDonald Had a Farm': [7, 5],
};

// Sounds and letters.
const soundIds = new Set(c.sounds.sounds.map(s => s.id));
if (c.sounds.sounds.length !== 24) err(`sounds.json has ${c.sounds.sounds.length} sounds; the spec needs 24`);
if (soundIds.size !== c.sounds.sounds.length) err('sounds.json repeats a sound id');
for (const s of c.sounds.sounds) if (!KINDS.includes(s.kind)) err(`sound ${s.id}: unknown kind ${s.kind}`);
for (const [l, s] of Object.entries(c.sounds.letters)) if (!soundIds.has(s)) err(`letter ${l} maps to missing sound ${s}`);
for (const id of soundIds) if (!Object.values(c.sounds.letters).includes(id)) err(`sound ${id} has no letter`);

// Levels and steps.
const introduced = c.steps.flatMap(s => s.letters);
for (const l of Object.keys(c.sounds.letters)) {
  const n = introduced.filter(x => x === l).length;
  if (n !== 1) err(`letter ${l} is introduced ${n} times in levels.json`);
}
for (const s of c.steps) {
  if (!s.letters.includes(s.vowel)) err(`step ${s.step} does not introduce its vowel ${s.vowel}`);
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
  if (w.letters.join('') !== lower) err(`${where}: letters spell ${w.letters.join('')}`);
  if (w.letters.length !== w.sounds.length) err(`${where}: ${w.letters.length} letters but ${w.sounds.length} sounds`);
  for (const s of w.sounds) if (!soundIds.has(s)) err(`${where}: no clip for sound ${s}`);
  if (!w.oralOnly) {
    w.letters.forEach((l, i) => {
      if (!(l in c.sounds.letters)) err(`${where}: letter ${l} is not taught in levels 1-2`);
      else if (c.sounds.letters[l] !== w.sounds[i]) err(`${where}: ${l} should say /${c.sounds.letters[l]}/, not /${w.sounds[i]}/`);
    });
  }
  const step = stepOf(w, c);
  if (w.step !== step) err(`${where}: step is ${w.step}, but its ${w.oralOnly ? 'sounds' : 'letters'} make it ${step}`);
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
for (const p of ORAL_EXTRAS) if (!byWord.get(p)?.picture || !byWord.get(p).oralOnly) err(`oral-only extra ${p} is missing, unpictured, or printable`);

// Nonsense-word rules.
for (const w of c.nonsense) {
  const where = `nonsense.json: ${w.word}`;
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
for (const s of c.steps) {
  const play = c.nonsense.filter(w => w.step === s.step && !w.levelCheck).length;
  if (play !== 10) warn(`step ${s.step} has ${play} nonsense play words; the spec asks for 10 (one per squad player)`);
}
for (const l of c.levels.filter(l => l.steps.length)) {
  const n = c.nonsense.filter(w => w.levelCheck && c.steps[idx(w.step)].level === l.level).length;
  if (n !== 5) err(`level ${l.level} has ${n} level-check words; the spec asks for 5`);
}

// Sentences and chants: every word is a sight word or a printed word from words.json at the step or earlier.
const { sightWords, sentences, chants } = c.sentences;
if (sightWords.join() !== SIGHT_WORDS.join()) err(`sight words should be ${SIGHT_WORDS.join(', ')}`);

function checkText(text, step, where, act = []) {
  const tokens = text.split(/\s+/);
  let start = true;
  let latest = c.steps[0].step;
  for (const raw of tokens) {
    const t = raw.replace(/[,.!?]+$/, '');
    const isName = t === '{Name}' || (byWord.get(t.toLowerCase())?.name && byWord.get(t.toLowerCase()).word === t);
    const capital = /^[A-Z]/.test(t) || t === '{Act}' || t === '{Name}';
    if (start && !capital) err(`${where}: "${t}" starts a sentence without a capital`);
    if (!start && capital && !isName && t !== 'I') err(`${where}: "${t}" has a capital mid-sentence`);
    const options = t.toLowerCase() === '{act}' ? act : t === '{Name}' ? [] : [start && !isName && t !== 'I' ? t.toLowerCase() : t];
    if (t.toLowerCase() === '{act}' && !act.length) err(`${where}: {act} slot but no act words`);
    for (const o of options) {
      if (SIGHT_WORDS.includes(o)) continue;
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
for (const sw of SIGHT_WORDS) {
  if (!sentences.some(s => s.text.split(/\s+/).some(t => t.replace(/[,.!?]+$/, '') === sw || t === sw[0].toUpperCase() + sw.slice(1)))) warn(`sight word "${sw}" is not used in any sentence`);
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
  if (n !== 4) warn(`step ${s.step} has ${n} sentences; the spec asks for four`);
  const v = chants.filter(x => x.step === s.step).length;
  if (v !== 1) err(`step ${s.step} has ${v} chant verses; the spec asks for one`);
}

// Parent's custom headlines: report the first step each one can be read at, or the words that block it.
for (const s of c.custom) {
  const where = `custom sentence "${s.text}"`;
  const unknown = s.text.split(/\s+/).map(t => t.replace(/[,.!?]+$/, ''))
    .filter(t => !SIGHT_WORDS.includes(t) && !SIGHT_WORDS.includes(t.toLowerCase()) && !byWord.get(t.toLowerCase())?.real);
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
    'oral only': real.filter(w => w.oralOnly).length,
    'nonsense play': c.nonsense.filter(w => w.step === s.step && !w.levelCheck).length,
    'level check': c.nonsense.filter(w => w.step === s.step && w.levelCheck).length,
    sentences: sentences.filter(x => x.step === s.step).length,
  };
});
console.table(rows);
const clips = c.words.length + c.nonsense.length + sightWords.length + sentences.length + c.custom.length;
const other = c.prompts.prompts.length + c.prompts.commentary.length + 1;
console.log(`Audio clips needed: ${c.sounds.sounds.length} sounds, ${clips} words and sentences (${c.words.length} real, ${c.nonsense.length} nonsense, ${sightWords.length} sight words, ${sentences.length + c.custom.length} sentences), and ${other} prompts, commentary lines, and his goal shout.`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(errors.length ? `${errors.length} errors` : 'Content OK.');
process.exit(errors.length ? 1 : 0);
