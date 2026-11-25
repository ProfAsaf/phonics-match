// Reading question generators: letters, phonemic awareness, phonics/decoding, sight words,
// vocabulary, comprehension and spelling. They draw on content/*.json (set with setContent).
// Questions that test reading never speak the text being read; listening questions always speak.
import { int, pick, shuffle, chance, lerpT, sample } from '../rng.js';
import * as S from '../svg.js';

let C = null;
export function setContent(content) { C = prepare(content); }
export const contentReady = () => !!C;
export const milestonesFor = (strandId) => C?.milestones?.[strandId] || null;

// Kindergarten–1st grade phonics steps (from the Phonics Match word bank) on the grade scale.
export const STEP_G = {
  '1A': 0.35, '1B': 0.45, '2A': 0.55, '2B': 0.65, '2C': 0.75, '3A': 0.95, '3B': 1.0, '3C': 1.05, '3D': 1.15,
  '4A': 1.2, '4B': 1.25, '4C': 1.3, '5A': 1.4, '5B': 1.45, '5C': 1.5, '6A': 1.6, '6B': 1.65, '6C': 1.7, '6D': 1.75, '6E': 1.8,
  '7A': 1.55, '7B': 1.7, '7C': 1.9,
};
const BAD_KEYWORDS = new Set(['infinity', 'igloo']);
const QTYPE_BUMP = { detail: 0, sequence: 0.1, vocab: 0.15, inference: 0.25, 'main-idea': 0.25, cause: 0.15, character: 0.1, compare: 0.2 };

function prepare(raw) {
  const c = { ...raw };
  const p1 = (raw.phonics1?.words || []).filter((w) => w.real && !w.name);
  const non = raw.nonsense1?.words || [];
  c.bank = [];
  for (const w of p1) c.bank.push({ word: w.word, g: STEP_G[w.step] ?? 1.5, step: w.step, picture: w.picture, sounds: w.sounds.join(' '), src: 1 });
  for (const p of raw.phonics2?.patterns || []) for (const w of p.words) c.bank.push({ word: w.word, g: p.g, picture: w.picture, distractors: w.distractors, pattern: p.name, src: 2 });
  c.realSet = new Set(c.bank.map((w) => w.word));
  for (const w of raw.sightwords?.words || []) c.realSet.add(w.word.toLowerCase());
  c.nonsense = non.map((w) => ({ word: w.word, g: STEP_G[w.step] ?? 1, step: w.step, sounds: w.sounds.join(' ') }));
  c.soundsOf = new Map([...p1.map((w) => [w.word, w.sounds.join(' ')]), ...non.map((w) => [w.word, w.sounds.join(' ')])]);
  c.paWords = raw.pa?.words || [];
  c.paByWord = new Map(c.paWords.map((w) => [w.word, w]));
  // Report milestones: concrete patterns and word lists, ordered by grade.
  const early = [
    ['Short a and i words (cat, pig)', 0.3, 0.5], ['Short o, u and e words (hot, bug, bed)', 0.5, 0.8], ['sh, ch, th, wh (ship, chin)', 0.9, 1.05],
    ['ck, ff, ll, ss, qu, ng, nk (duck, ring)', 1.0, 1.2], ['Blends (stop, frog, hand)', 1.15, 1.35], ['Silent e (make, bike, home)', 1.35, 1.55],
    ['Endings -s, -es, -ing, -ed', 1.5, 1.75], ['Vowel teams ee, ea, ai, ay, oa, ow', 1.55, 1.75], ['ar, or, er, ir, ur', 1.7, 1.85], ['Two-syllable words (sunset)', 1.85, 2.0],
  ];
  c.milestones = {
    phonics: [...early, ...(raw.phonics2?.patterns || []).map((p) => [p.name, p.g - 0.05, p.g + 0.15])].map(([name, lo, hi]) => ({ name, lo, hi })),
    sight: Object.entries((raw.sightwords?.words || []).reduce((acc, w) => { (acc[w.list] ||= []).push(w.g); return acc; }, {}))
      .map(([list, gs]) => ({ name: { upper: 'Harder high-frequency words (because, though)', first: 'Dolch 1st-grade words', second: 'Dolch 2nd-grade words', third: 'Dolch 3rd-grade words' }[list] || `Dolch ${list} words`, lo: Math.min(...gs), hi: Math.max(...gs) }))
      .sort((a, b) => a.lo - b.lo),
  };
  c.letters = {};
  for (const [L, list] of Object.entries(raw.letters?.letters || {})) c.letters[L] = list.filter((k) => !BAD_KEYWORDS.has(k.word));
  return c;
}

// Pick a content entry near difficulty b, avoiding recently seen keys.
function nearest(list, b, rng, recent, keyOf, { spread = 0.35, gOf = (x) => x.g } = {}) {
  if (!list.length) return null;
  const sorted = list.map((x) => ({ x, d: Math.abs(gOf(x) - b) })).sort((a, c) => a.d - c.d);
  const close = sorted.filter((s) => s.d <= spread);
  const pool = (close.length >= 3 ? close : sorted.slice(0, 6)).map((s) => s.x);
  const fresh = pool.filter((x) => !recent?.has(keyOf(x)));
  return pick(rng, fresh.length ? fresh : pool);
}

const big = (s, cls = 'read') => S.bigTextHTML(s, cls);
const emo = (e, cls = '') => `<div class="bigemoji ${cls}">${e}</div>`;
const pic = (w) => ({ label: '', emoji: w.emoji ?? w.picture, say: w.word, word: w.word });
const wordOpt = (w) => ({ label: w, read: true });
const hamming = (a, b) => (a.length !== b.length ? 99 : [...a].reduce((s, ch, i) => s + (ch !== b[i]), 0));
function oneEditAway(a, b) {
  if (a === b) return false;
  if (a.length === b.length) return hamming(a, b) === 1;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  if (l.length - s.length !== 1) return false;
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

// ================================================================== LETTERS
const UPPER_ORDER = 'OXABSMTCEDPHLRFIKNGWUJYZVQ'.split('');
const LOWER_ORDER = 'osxcmtaeiplrhfnkuwvzgyjbdq'.split('');
const CONFUSE = {
  E: 'FB', F: 'EP', M: 'WN', W: 'MV', N: 'MZ', P: 'RB', R: 'PB', B: 'PRD', O: 'QCG', Q: 'OG', C: 'GO', G: 'CQ', U: 'VJ', V: 'UW', I: 'LT', L: 'IT', T: 'IL', K: 'XR', X: 'KY',
  b: 'dpq', d: 'bpq', p: 'qbd', q: 'pdg', m: 'nw', n: 'mhu', h: 'nb', i: 'lj', l: 'it', j: 'ig', u: 'nv', a: 'eo', e: 'ac', o: 'ac', f: 't', t: 'f', g: 'qy', y: 'gv', v: 'wy', w: 'vm',
};
function letterOpts(rng, target, order, t, n) {
  const conf = (CONFUSE[target] || '').split('').filter(Boolean);
  const pool = order.filter((l) => l !== target);
  const pickFrom = t > 0.5 ? [...shuffle(rng, conf), ...shuffle(rng, pool)] : shuffle(rng, pool);
  return [target, ...[...new Set(pickFrom)].filter((l) => l !== target).slice(0, n - 1)];
}
// Sound class so "Which picture starts with C?" never offers a K picture.
const SOUND_OF = { c: 'k', k: 'k', q: 'k' };
const soundOf = (l) => SOUND_OF[l] || l;
const SOUND_ORDER = 'msflrnbtpdhcgjwkvyzaioueqx'.split('');

const letters = [
  {
    id: 'letters.upper', strand: 'letters', name: 'Capital letter names', lo: -1.2, hi: -0.3,
    gen(b, rng) {
      const t = lerpT(b, -1.2, -0.3);
      const L = UPPER_ORDER[Math.min(25, Math.floor(t * 20 + rng() * 6))];
      const opts = letterOpts(rng, L, UPPER_ORDER, t, t < 0.3 ? 3 : 4);
      return { prompt: 'Find the letter you hear', say: `Find the letter ${L}.`, listen: true, options: opts.map((l) => ({ label: l, read: true, say: l })), why: `This is the letter ${L}.`, key: `lu${L}` };
    },
  },
  {
    id: 'letters.lower', strand: 'letters', name: 'Small letter names', lo: -0.6, hi: 0.4,
    gen(b, rng) {
      const t = lerpT(b, -0.6, 0.4);
      const L = LOWER_ORDER[Math.min(25, Math.floor(t * 20 + rng() * 6))];
      const opts = letterOpts(rng, L, LOWER_ORDER, t, 4);
      return { prompt: 'Find the small letter you hear', say: `Find the small letter ${L.toUpperCase()}.`, listen: true, options: opts.map((l) => ({ label: l, read: true })), why: `This is a small ${L.toUpperCase()}.`, key: `ll${L}` };
    },
  },
  {
    id: 'letters.match', strand: 'letters', name: 'Match capital and small letters', lo: -0.5, hi: 0.2,
    gen(b, rng) {
      const t = lerpT(b, -0.5, 0.2);
      const L = LOWER_ORDER[Math.min(25, Math.floor(t * 18 + rng() * 8))];
      const opts = letterOpts(rng, L, LOWER_ORDER, t + 0.3, 4);
      return { prompt: `Find the small letter that matches`, say: `Find the small letter that goes with this big ${L.toUpperCase()}.`, visual: { html: big(L.toUpperCase(), 'read letter') }, options: opts.map((l) => ({ label: l, read: true })), why: `Big ${L.toUpperCase()} and small ${L} are the same letter.`, key: `lm${L}` };
    },
  },
  {
    id: 'letters.sound', strand: 'letters', name: 'Letter sounds (first letter of a word)', lo: -0.4, hi: 0.9,
    gen(b, rng, ctx) {
      const t = lerpT(b, -0.4, 0.9);
      const idx = Math.min(SOUND_ORDER.length - 1, Math.floor(t * 20 + rng() * 6));
      const L = SOUND_ORDER[idx];
      const kws = C.letters[L] || [];
      if (!kws.length) return null;
      const kw = pick(rng, kws);
      const end = kw.position === 'end';
      const pool = SOUND_ORDER.filter((x) => soundOf(x) !== soundOf(L));
      const near = { b: 'pd', p: 'bt', d: 'tb', t: 'dp', f: 'v', v: 'f', s: 'z', z: 's', m: 'n', n: 'm', g: 'kj', k: 'g', a: 'eiou', e: 'ia', i: 'e', o: 'u', u: 'o' }[L] || '';
      const cand = t > 0.5 ? [...near.split(''), ...shuffle(rng, pool)] : shuffle(rng, pool);
      const opts = [L, ...[...new Set(cand)].filter((x) => x && x !== L && soundOf(x) !== soundOf(L)).slice(0, 3)];
      return {
        prompt: `What letter does it ${end ? 'end' : 'start'} with?`, say: `What letter does ${kw.word} ${end ? 'end' : 'start'} with?`, listen: true,
        visual: { html: emo(kw.emoji) }, options: opts.map((l) => ({ label: l, read: true })),
        why: `${kw.word[0].toUpperCase() + kw.word.slice(1)} ${end ? 'ends' : 'starts'} with ${L.toUpperCase()}.`, key: `ls${kw.word}`,
      };
    },
  },
  {
    id: 'letters.picture', strand: 'letters', name: 'Pictures that start with a letter', lo: -0.2, hi: 0.8,
    gen(b, rng) {
      const t = lerpT(b, -0.2, 0.8);
      const L = SOUND_ORDER.slice(0, 23)[Math.min(22, Math.floor(t * 17 + rng() * 6))];
      const kws = (C.letters[L] || []).filter((k) => !k.position);
      if (!kws.length) return null;
      const kw = pick(rng, kws);
      const others = shuffle(rng, Object.keys(C.letters).filter((x) => soundOf(x) !== soundOf(L) && !'aeiouxq'.includes(x)));
      const dist = others.slice(0, 2).map((x) => pick(rng, C.letters[x].filter((k) => !k.position))).filter(Boolean);
      if (dist.length < 2) return null;
      return {
        prompt: `Which one starts with ${L}?`, say: `Which picture starts with the letter ${L.toUpperCase()}?`, listen: true, sayOptions: true,
        visual: { html: big(`${L.toUpperCase()} ${L}`, 'read letter') },
        options: [kw, ...dist].map((k) => ({ label: '', emoji: k.emoji, say: k.word })), why: `${kw.word} starts with ${L.toUpperCase()}.`, key: `lp${kw.word}`,
      };
    },
  },
];

// ================================================================== PHONEMIC AWARENESS
const VOW = new Set(['a', 'e', 'i', 'o', 'u', 'ay', 'ee', 'ie', 'oa', 'oo', 'uu', 'ow', 'oy', 'aw', 'ar', 'or', 'er']);
const pa = [
  {
    id: 'pa.rhyme', strand: 'pa', name: 'Rhyming words', lo: -0.9, hi: 0.1,
    gen(b, rng, ctx) {
      const t = lerpT(b, -0.9, 0.1);
      const sets = (C.pa?.rhymeSets || []).filter((s) => s.every((w) => C.paByWord.has(w)));
      if (!sets.length) return null;
      const set = pick(rng, sets);
      const [tw, cw] = sample(rng, set, 2).map((w) => C.paByWord.get(w));
      const used = new Set(set);
      let dist = shuffle(rng, C.paWords.filter((w) => !used.has(w.word) && w.syllables === 1 && w.sounds.slice(-2).join() !== tw.sounds.slice(-2).join()));
      if (t > 0.5) dist.sort((a, c) => (c.sounds[0] === tw.sounds[0]) - (a.sounds[0] === tw.sounds[0])); // same first sound: a tempting foil
      dist = dist.filter((w, i, arr) => arr.findIndex((z) => z.emoji === w.emoji) === i && w.emoji !== tw.emoji && w.emoji !== cw.emoji).slice(0, 2);
      return {
        prompt: 'Which one rhymes?', say: `Which one rhymes with ${tw.word}?`, listen: true, sayOptions: true,
        visual: { html: emo(tw.emoji) }, options: [pic(cw), ...dist.map(pic)],
        why: `${tw.word} and ${cw.word} rhyme. They end the same way.`, key: `rh${tw.word}${cw.word}`,
      };
    },
  },
  {
    id: 'pa.syllables', strand: 'pa', name: 'Syllables (clap the parts)', lo: -0.6, hi: 0.4,
    gen(b, rng, ctx) {
      const t = lerpT(b, -0.6, 0.4);
      const want = t < 0.35 ? [1, 2] : t < 0.7 ? [2, 3] : [3, 4];
      const pool = (C.pa?.syllableWords || []).filter((w) => want.includes(w.syllables));
      const w = nearest(pool, 0, rng, ctx?.recent, (x) => `sy${x.word}`, { gOf: () => 0 });
      if (!w) return null;
      const n = w.syllables;
      const opts = (t < 0.35 ? [1, 2, 3] : [1, 2, 3, 4]).map((k) => ({ label: String(k), value: k, sub: '👏'.repeat(k) }));
      return {
        prompt: 'How many claps?', say: `Clap the parts. How many claps in ${w.word}?`, listen: true,
        visual: { html: emo(w.emoji) }, options: [opts[n - 1], ...opts.filter((o) => o.value !== n)], sortOptions: true,
        why: `${w.word} has ${n} part${n > 1 ? 's' : ''}. Clap it: ${'👏 '.repeat(n).trim()}`, key: `sy${w.word}`,
      };
    },
  },
  ...['first', 'last', 'middle'].map((pos) => ({
    id: `pa.${pos}`, strand: 'pa', name: { first: 'First sounds', last: 'Last sounds', middle: 'Middle (vowel) sounds' }[pos],
    lo: { first: -0.5, last: 0.1, middle: 0.6 }[pos], hi: { first: 0.4, last: 0.8, middle: 1.3 }[pos],
    gen(b, rng) {
      const t = lerpT(b, this.lo, this.hi);
      const at = (w) => (pos === 'first' ? w.sounds[0] : pos === 'last' ? w.sounds[w.sounds.length - 1] : w.sounds[1]);
      let pool = C.paWords.filter((w) => w.syllables === 1);
      if (pos === 'middle') pool = pool.filter((w) => w.sounds.length === 3 && VOW.has(w.sounds[1]) && ['a', 'e', 'i', 'o', 'u'].includes(w.sounds[1]));
      if (pos === 'first' && t < 0.5) pool = pool.filter((w) => !VOW.has(w.sounds[0]));
      for (let tries = 0; tries < 30; tries++) {
        const tw = pick(rng, pool);
        const same = pool.filter((w) => w.word !== tw.word && at(w) === at(tw) && w.emoji !== tw.emoji && w.sounds.slice(-2).join() !== tw.sounds.slice(-2).join());
        if (!same.length) continue;
        const cw = pick(rng, same);
        let diff = pool.filter((w) => at(w) !== at(tw) && w.emoji !== tw.emoji && w.emoji !== cw.emoji);
        if (pos !== 'first') diff = diff.filter((w) => w.sounds[0] !== tw.sounds[0] || t > 0.5);
        const dist = sample(rng, diff, 6).filter((w, i, a) => a.findIndex((z) => z.emoji === w.emoji) === i).slice(0, 2);
        if (dist.length < 2) continue;
        const word = { first: 'starts', last: 'ends', middle: 'has the same middle sound' }[pos];
        return {
          prompt: pos === 'middle' ? 'Same middle sound?' : `Which one ${word} the same?`,
          say: pos === 'middle' ? `Which one has the same middle sound as ${tw.word}?` : `Which one ${word} with the same sound as ${tw.word}?`,
          listen: true, sayOptions: true, visual: { html: emo(tw.emoji) }, options: [pic(cw), ...dist.map(pic)],
          why: `${tw.word} and ${cw.word} have the same ${pos} sound.`, key: `p${pos[0]}${tw.word}${cw.word}`,
        };
      }
      return null;
    },
  })),
  {
    id: 'pa.count', strand: 'pa', name: 'Count the sounds in a word', lo: 0.5, hi: 1.5,
    gen(b, rng, ctx) {
      const diff = (w) => ({ 2: 0.5, 3: 0.75, 4: 1.1, 5: 1.35 }[w.sounds.length] ?? 1.4) + (w.word.length !== w.sounds.length ? 0.15 : 0);
      const pool = C.paWords.filter((w) => w.syllables === 1 && w.sounds.length >= 2 && w.sounds.length <= 5);
      const w = nearest(pool, b, rng, ctx?.recent, (x) => `pc${x.word}`, { gOf: diff, spread: 0.2 });
      if (!w) return null;
      const n = w.sounds.length;
      const opts = [2, 3, 4, 5].map((k) => ({ label: String(k), value: k, sub: '🟦'.repeat(k) }));
      return {
        prompt: 'How many sounds?', say: `Say it slowly. How many sounds do you hear in ${w.word}?`, listen: true,
        visual: { html: emo(w.emoji) }, options: [opts[n - 2], ...opts.filter((o) => o.value !== n)], sortOptions: true,
        why: `Stretch it out: ${w.word} has ${n} sounds.`, key: `pc${w.word}`, b: diff(w),
      };
    },
  },
  {
    id: 'pa.change', strand: 'pa', name: 'Change a sound to make a new word', lo: 1.1, hi: 2.0,
    gen(b, rng) {
      const t = lerpT(b, 1.1, 2.0);
      const pos = t < 0.35 ? 0 : t < 0.7 ? 2 : 1;
      const simple = C.paWords.filter((w) => w.word.length === 3 && w.sounds.length === 3 && ['a', 'e', 'i', 'o', 'u'].includes(w.sounds[1]));
      for (let tries = 0; tries < 40; tries++) {
        const tw = pick(rng, simple);
        const outs = simple.filter((w) => w.word !== tw.word && hamming(w.word, tw.word) === 1 && w.word[pos] !== tw.word[pos] && w.emoji !== tw.emoji);
        if (!outs.length) continue;
        const cw = pick(rng, outs);
        const others = simple.filter((w) => w !== cw && w !== tw && w.emoji !== cw.emoji && w.emoji !== tw.emoji && hamming(w.word, tw.word) <= 2);
        const fill = shuffle(rng, others.length >= 2 ? others : simple.filter((w) => w !== cw && w !== tw && w.emoji !== cw.emoji));
        const dist = fill.filter((w, i, a) => a.findIndex((z) => z.emoji === w.emoji) === i).slice(0, 2);
        const where = ['first', 'middle', 'last'][pos];
        return {
          prompt: `Change one sound in "${tw.word}"`, say: `Say ${tw.word}. Change the ${where} sound, ${tw.word[pos].toUpperCase()}, to ${cw.word[pos].toUpperCase()}. What new word do you get?`, listen: true, sayOptions: true,
          visual: { html: emo(tw.emoji) }, options: [pic(cw), ...dist.map(pic)],
          why: `${tw.word} with ${cw.word[pos]} instead of ${tw.word[pos]} makes ${cw.word}.`, key: `ch${tw.word}${cw.word}`,
        };
      }
      return null;
    },
  },
];

// ================================================================== PHONICS / DECODING
function decodeDistractors(rng, w, n) {
  if (w.distractors?.length) return shuffle(rng, w.distractors).slice(0, n);
  const snd = w.sounds;
  const pool = [...C.bank.filter((x) => x.src === 1), ...C.nonsense].filter((x) => x.word !== w.word && oneEditAway(x.word, w.word) && (!snd || C.soundsOf.get(x.word) !== snd));
  const vowelSwap = pool.filter((x) => x.word.length === w.word.length && [...x.word].some((ch, i) => ch !== w.word[i] && 'aeiou'.includes(ch)));
  const out = [...new Set([...shuffle(rng, vowelSwap).slice(0, 1), ...shuffle(rng, pool)].map((x) => x.word))].slice(0, n);
  return out;
}
const phonics = [
  {
    id: 'phonics.readpic', strand: 'phonics', name: 'Read a word, find its picture', lo: 0.3, hi: 2.5,
    gen(b, rng, ctx) {
      const pool = C.bank.filter((w) => w.picture);
      const w = nearest(pool, b, rng, ctx?.recent, (x) => `rp${x.word}`);
      if (!w) return null;
      const scored = pool.filter((x) => x.word !== w.word && x.picture !== w.picture)
        .map((x) => ({ x, s: (x.word[0] === w.word[0]) + (x.word.slice(-2) === w.word.slice(-2)) + (Math.abs(x.word.length - w.word.length) <= 1) + rng() }))
        .sort((a, c) => c.s - a.s).map((z) => z.x);
      const dist = scored.filter((x, i, a) => a.findIndex((z) => z.picture === x.picture) === i).slice(0, 3);
      return {
        prompt: 'Read the word. Tap its picture.', say: 'Read the word, then tap its picture.', readingTest: true,
        visual: { html: big(w.word) }, options: [{ label: '', emoji: w.picture }, ...dist.map((x) => ({ label: '', emoji: x.picture }))],
        why: `This word says "${w.word}".`, whySay: `This word says ${w.word}.`, key: `rp${w.word}`, b: w.g,
      };
    },
  },
  {
    id: 'phonics.heard', strand: 'phonics', name: 'Find the word you hear', lo: 0.3, hi: 4.3,
    gen(b, rng, ctx) {
      for (let k = 0; k < 6; k++) {
        const w = nearest(C.bank, b, rng, ctx?.recent, (x) => `hw${x.word}`);
        if (!w) return null;
        const d = decodeDistractors(rng, w, 3);
        if (d.length < 2) continue;
        return {
          prompt: 'Tap the word you hear', say: `Tap the word: ${w.word}.`, listen: true, hideSayText: true,
          options: [wordOpt(w.word), ...d.map(wordOpt)], why: `The word was "${w.word}".`, whySay: `The word was ${w.word}.`,
          key: `hw${w.word}`, b: w.g + 0.05,
        };
      }
      return null;
    },
  },
  {
    id: 'phonics.real', strand: 'phonics', name: 'Real word or made-up word?', lo: 0.6, hi: 2.0,
    gen(b, rng, ctx) {
      const real = nearest(C.bank.filter((w) => w.src === 1), b, rng, ctx?.recent, (x) => `rw${x.word}`);
      if (!real) return null;
      const near = C.nonsense.filter((x) => Math.abs(x.g - real.g) <= 0.15 && !C.realSet.has(x.word));
      const fakes = sample(rng, near.length >= 2 ? near : C.nonsense, 2);
      return {
        prompt: 'Which one is a real word?', say: 'Read them. Which one is a real word?', readingTest: true,
        options: [wordOpt(real.word), ...fakes.map((f) => wordOpt(f.word))], why: `"${real.word}" is a real word. The others are made up.`,
        key: `rw${real.word}`, b: real.g + 0.15, a: 1.8,
      };
    },
  },
];

// ================================================================== SIGHT WORDS
const sight = [
  {
    id: 'sight.heard', strand: 'sight', name: 'Sight words', lo: 0.0, hi: 4.2,
    gen(b, rng, ctx) {
      const w = nearest(C.sightwords?.words || [], b, rng, ctx?.recent, (x) => `sw${x.word}`, { spread: 0.25 });
      if (!w) return null;
      return {
        prompt: 'Tap the word you hear', say: `Tap the word: ${w.word}.`, listen: true, hideSayText: true,
        options: [wordOpt(w.word), ...w.distractors.slice(0, 3).map(wordOpt)], why: `The word was "${w.word}".`, whySay: `The word was ${w.word}.`,
        key: `sw${w.word}`, b: w.g, timed: true,
      };
    },
  },
];

// ================================================================== VOCABULARY
const vocab = [
  {
    id: 'vocab.item', strand: 'vocab', name: 'Word meanings', lo: -1.0, hi: 4.5,
    gen(b, rng, ctx) {
      const it = nearest(C.vocab?.items || [], b, rng, ctx?.recent, (x) => `vo${x.id}`, { spread: 0.3 });
      if (!it) return null;
      const opts = it.options.map((o) => (o.emoji ? { label: '', emoji: o.emoji, say: o.label } : { label: o.label, say: o.label }));
      const correct = opts[it.answer];
      return {
        prompt: it.prompt, context: it.context, say: it.say || it.prompt, sayOptions: !!it.sayOptions || opts.some((o) => o.emoji),
        listen: it.g < 0.8, autoSayLevel: 2.6,
        options: [correct, ...opts.filter((_, i) => i !== it.answer)], why: it.why, key: `vo${it.id}`, b: it.g,
        vocabType: it.type,
      };
    },
  },
];

// ================================================================== COMPREHENSION
const comp = [
  {
    id: 'comp.listen', strand: 'comp', name: 'Listening comprehension', lo: -1.0, hi: 0.8,
    gen(b, rng, ctx) {
      const st = nearest(C.listening?.stories || [], b, rng, ctx?.recent, (x) => `ls${x.id}`, { spread: 0.3 });
      if (!st) return null;
      const passage = { id: st.id, title: st.title, text: st.text, emoji: st.questions[0].options[st.questions[0].answer].emoji, mode: 'listen' };
      const items = st.questions.map((q, i) => {
        const opts = q.options.map((o) => ({ label: '', emoji: o.emoji, say: o.label }));
        return { passage, prompt: q.q, say: q.q, listen: true, sayOptions: true, options: [opts[q.answer], ...opts.filter((_, j) => j !== q.answer)], why: q.why, key: `ls${st.id}`, b: st.g + i * 0.15 };
      });
      return { ...items[0], followUps: items.slice(1) };
    },
  },
  {
    id: 'comp.sentpic', strand: 'comp', name: 'Read a sentence, find the picture', lo: 0.3, hi: 2.0,
    gen(b, rng, ctx) {
      const it = nearest(C.sentpic?.items || [], b, rng, ctx?.recent, (x) => `sp${x.id}`, { spread: 0.3 });
      if (!it) return null;
      const opts = it.options.map((o) => ({ label: '', emoji: o.emoji, say: o.label }));
      return {
        prompt: 'Read it. Tap the picture.', say: 'Read the sentence, then tap the picture it tells about.', readingTest: true,
        visual: { html: big(it.text, 'read sentence') }, options: [opts[it.answer], ...opts.filter((_, i) => i !== it.answer)],
        why: it.why, key: `sp${it.id}`, b: it.g,
      };
    },
  },
  {
    id: 'comp.truefalse', strand: 'comp', name: 'True or silly? (sentence reading)', lo: 0.3, hi: 4.0,
    gen(b, rng, ctx) {
      const it = nearest(C.truefalse?.items || [], b, rng, ctx?.recent, (x) => `tf${x.id}`, { spread: 0.25 });
      if (!it) return null;
      const yes = { label: 'True', emoji: '👍', say: 'true' }, no = { label: 'Silly', emoji: '👎', say: 'silly' };
      return {
        prompt: 'True or silly?', say: 'Read it. Is it true, or silly?', readingTest: true,
        visual: { html: big(it.text, 'read sentence') }, options: it.answer ? [yes, no] : [no, yes], fixedOrder: true,
        why: it.answer ? 'That sentence is true.' : 'That sentence is silly. It could not really happen.', key: `tf${it.id}`, b: it.g, a: 1.6, timed: true,
      };
    },
  },
  {
    id: 'comp.maze', strand: 'comp', name: 'Pick the word that makes sense', lo: 0.8, hi: 4.5,
    gen(b, rng, ctx) {
      const it = nearest(C.maze?.items || [], b, rng, ctx?.recent, (x) => `mz${x.id}`, { spread: 0.3 });
      if (!it) return null;
      const html = `<div class="bigtext read sentence">${S.escapeHTML(it.text).replace('___', '<span class="blank">?</span>')}</div>`;
      return {
        prompt: 'Which word fits?', say: 'Read it. Which word makes sense in the blank?', readingTest: true,
        visual: { html }, options: [wordOpt(it.options[it.answer]), ...it.options.filter((_, i) => i !== it.answer).map(wordOpt)],
        why: it.why, key: `mz${it.id}`, b: it.g,
      };
    },
  },
  {
    id: 'comp.passage', strand: 'comp', name: 'Read a story or article', lo: 0.8, hi: 4.8,
    gen(b, rng, ctx) {
      const p = nearest(C.passages?.passages || [], b, rng, ctx?.recent, (x) => `ps${x.id}`, { spread: 0.35 });
      if (!p) return null;
      const passage = { id: p.id, title: p.title, text: p.text, emoji: p.emoji, mode: 'read' };
      const qs = p.questions.slice(0, 3);
      const items = qs.map((q) => ({
        passage, prompt: q.q, say: q.q, readingTest: true,
        options: [{ label: q.options[q.answer] }, ...q.options.filter((_, i) => i !== q.answer).map((l) => ({ label: l }))],
        why: q.why, key: `ps${p.id}`, b: p.g + (QTYPE_BUMP[q.type] ?? 0.1), qtype: q.type,
      }));
      return { ...items[0], followUps: items.slice(1) };
    },
  },
];

// ================================================================== SPELLING
const spell = [
  {
    id: 'spell.build', strand: 'spell', name: 'Spell words with letter tiles', lo: 0.4, hi: 2.0,
    gen(b, rng, ctx) {
      const pool = C.bank.filter((w) => w.src === 1 && w.word.length >= 2 && w.word.length <= 6 && /^[a-z]+$/.test(w.word));
      const w = nearest(pool, b - 0.15, rng, ctx?.recent, (x) => `sb${x.word}`, { spread: 0.25 });
      if (!w) return null;
      const extra = [];
      const vowels = 'aeiou'.split('').filter((v) => !w.word.includes(v));
      extra.push(pick(rng, vowels));
      const cons = 'bdfgklmnprst'.split('').filter((c) => !w.word.includes(c));
      extra.push(pick(rng, cons));
      if (w.word.length >= 4) extra.push(pick(rng, cons.filter((c) => !extra.includes(c))));
      const tiles = shuffle(rng, [...w.word.split(''), ...extra]);
      return {
        kind: 'spell', answerText: w.word, tiles, prompt: 'Spell the word you hear', say: `Spell ${w.word}.`, listen: true, hideSayText: true,
        visual: w.picture ? { html: emo(w.picture, 'small') } : null, options: [],
        why: `${w.word} is spelled ${w.word.toUpperCase().split('').join(' - ')}.`, whySay: `${w.word} is spelled ${w.word.split('').join(', ')}.`,
        key: `sb${w.word}`, b: w.g + 0.15, c: 0.02,
      };
    },
  },
  {
    id: 'spell.choose', strand: 'spell', name: 'Which spelling is right?', lo: 0.8, hi: 4.5,
    gen(b, rng, ctx) {
      const w = nearest(C.spelling?.words || [], b, rng, ctx?.recent, (x) => `sc${x.word}`, { spread: 0.3 });
      if (!w) return null;
      return {
        prompt: 'Which spelling is right?', say: `${w.word}. ${w.sentence} Which spelling of ${w.word} is right?`, listen: true, hideSayText: true,
        options: [wordOpt(w.word), ...w.misspellings.slice(0, 3).map(wordOpt)], why: `"${w.word}" is spelled ${w.word.toUpperCase().split('').join('-')}.`,
        whySay: `${w.word} is spelled ${w.word.split('').join(', ')}.`, key: `sc${w.word}`, b: w.g,
      };
    },
  },
];

export const READING_SKILLS = [...letters, ...pa, ...phonics, ...sight, ...vocab, ...comp, ...spell];
