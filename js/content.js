// The content index: loads content/*.json and derives what the game needs: steps and letters,
// each word's blend shape, decodability, neighbors, the squad, and the list of every audio clip.
export const VOWELS = ['a', 'e', 'i', 'o', 'u'];
export const isVowel = letter => VOWELS.includes(letter);

const FILES = ['sounds', 'levels', 'words', 'nonsense', 'sentences', 'prompts', 'custom-sentences'];

export async function loadContent(base = 'content/') {
  const raw = {};
  await Promise.all(FILES.map(async name => {
    try {
      const res = await fetch(`${base}${name}.json`, { cache: 'no-cache' });
      raw[name] = res.ok ? await res.json() : null;
    } catch {
      raw[name] = null;
    }
  }));
  return buildIndex(raw);
}

export function buildIndex(raw) {
  const C = {};
  C.sounds = raw.sounds.sounds;
  C.soundById = Object.fromEntries(C.sounds.map(s => [s.id, s]));
  C.letterSound = raw.sounds.letters;
  C.levels = raw.levels.levels;
  C.steps = C.levels.flatMap(l => l.steps.map(s => ({ ...s, level: l.level })));
  C.stepIndex = Object.fromEntries(C.steps.map((s, i) => [s.step, i]));
  C.letterStep = {};
  for (const s of C.steps) for (const l of s.letters) C.letterStep[l] = s.step;
  C.letters = C.steps.flatMap(s => s.letters); // teaching order
  C.soundLetter = {}; // the first letter taught for each sound: k -> c, ks -> x
  for (const l of C.letters) C.soundLetter[C.letterSound[l]] ??= l;

  const shape = sounds => (['vowel', 'continuous'].includes(C.soundById[sounds[0]]?.kind) ? 'continuous' : 'stop');
  C.words = [...raw.words.words, ...(raw.nonsense?.words ?? [])]
    .map(w => ({ ...w, key: w.word.toLowerCase(), shape: shape(w.sounds) }));
  C.byWord = new Map(C.words.map(w => [w.key, w]));
  C.real = C.words.filter(w => w.real && !w.oralOnly && !w.name); // printable real words
  C.oral = C.words.filter(w => w.real && !w.name); // any real word can be said aloud
  C.pictured = C.words.filter(w => w.picture);
  C.nonsense = C.words.filter(w => !w.real);

  C.sightWords = raw.sentences.sightWords;
  C.sentences = raw.sentences.sentences.map(s => ({ ...s, custom: false }));
  C.custom = (raw['custom-sentences']?.sentences ?? []).map(s => ({ ...s, custom: true }));
  C.chants = raw.sentences.chants;
  C.prompts = Object.fromEntries((raw.prompts?.prompts ?? []).map(p => [p.id, p]));
  C.commentary = raw.prompts?.commentary ?? [];
  C.squad = buildSquad(C);
  C.clips = clipList(C);
  C.clipText = Object.fromEntries(C.clips.map(c => [c.id, c.caption ?? c.text]));
  return C;
}

export const stepLE = (C, a, b) => C.stepIndex[a] <= C.stepIndex[b];
export const scopeLetters = (C, step) => C.letters.filter(l => stepLE(C, C.letterStep[l], step));
export const levelOf = (C, step) => C.steps[C.stepIndex[step]]?.level;

export function diffPositions(a, b) {
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

// Words that differ from w in exactly one position, by letters or by sounds.
export function neighbors(w, pool, by = 'letters') {
  return pool.filter(x => x.key !== w.key && x[by].length === w[by].length && diffPositions(w[by], x[by]).length === 1);
}

// A sentence split into words: each is a sight word, a word-bank entry, or unknown (entry null).
export function sightOf(C, bare) {
  if (C.sightWords.includes(bare)) return bare;
  const lower = bare.toLowerCase();
  return lower !== 'i' && C.sightWords.includes(lower) ? lower : null;
}

export function tokenize(C, text) {
  return text.split(/\s+/).filter(Boolean).map(raw => {
    const bare = raw.replace(/[^A-Za-z']/g, '');
    const sight = sightOf(C, bare);
    const entry = sight ? null : C.byWord.get(bare.toLowerCase()) ?? null;
    const named = entry?.name ? entry.word === bare : true;
    return { raw, bare, sight, entry: named ? entry : null };
  });
}

// ---- Squad: each step's ten nonsense words are its players (SPEC.md, "The squad").
export const PIECES = ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'knight', 'bishop', 'rook', 'queen'];
// The filled chess symbols, forced to text style so iOS does not swap in emoji.
export const PIECE_SYMBOL = {
  king: '♚︎', queen: '♛︎', rook: '♜︎',
  bishop: '♝︎', knight: '♞︎', pawn: '♟︎',
};

function buildSquad(C) {
  const players = [];
  C.steps.forEach((s, si) => {
    const words = C.nonsense.filter(w => w.step === s.step && !w.levelCheck).map(w => w.key).sort();
    // The last word is the queen; with fewer than ten words, pawns are dropped first.
    const pieces = words.length >= PIECES.length
      ? [...Array(words.length - PIECES.length).fill('pawn'), ...PIECES]
      : PIECES.slice(PIECES.length - words.length);
    words.forEach((word, i) => players.push({ word, step: s.step, piece: pieces[i], number: si * 10 + i + 2 }));
  });
  return { players, byWord: Object.fromEntries(players.map(p => [p.word, p])) };
}

// ---- Audio clips. Every clip is a file in audio/, named by its id.
export const slug = text => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
export const clip = {
  sound: id => `s-${id}`,
  word: word => `w-${word.toLowerCase()}`,
  sentence: text => `t-${slug(text)}`,
  prompt: id => `p-${id}`,
  commentary: i => `c-${String(i + 1).padStart(2, '0')}`,
  shout: 'shout',
};

const HOW_TO_SAY = {
  vowel: 'Hold it for one second.',
  continuous: 'Hold it for one second: "mmm," not "muh."',
  stop: 'Short and clipped, with as little "uh" as possible.',
};

export function soundHint(s) {
  if (s.id === 'h') return 'Just a breath, with no vowel after. As in hat.';
  if (s.id === 'w' || s.id === 'y') return `Quick, with no vowel after. As in ${s.example}.`;
  if (s.id === 'ks') return 'Short, like the end of box.';
  return `${HOW_TO_SAY[s.kind] ?? HOW_TO_SAY.stop} ${s.kind === 'vowel' ? `${s.id} as in ${s.example}` : `As in ${s.example}`}.`;
}

export function clipList(C) {
  const list = [];
  const seen = new Set();
  const add = (id, group, text, extra = {}) => {
    if (seen.has(id)) return;
    seen.add(id);
    list.push({ id, group, text, ...extra });
  };
  for (const s of C.sounds) {
    const letters = Object.keys(C.letterSound).filter(l => C.letterSound[l] === s.id);
    add(clip.sound(s.id), 'Sounds', `/${s.id}/`, { kind: 'sound', hint: `${soundHint(s)} Letter: ${letters.join(', ')}.` });
  }
  for (const p of Object.values(C.prompts)) add(clip.prompt(p.id), 'Prompts', p.text, { kind: 'prompt' });
  C.commentary.forEach((t, i) => add(clip.commentary(i), 'Goal commentary', t, { kind: 'commentary' }));
  add(clip.shout, 'Goal commentary', 'His own goal shout', { kind: 'shout', hint: 'Let him record this one himself, any shout he likes.', caption: 'goal shout' });
  for (const sw of C.sightWords) add(clip.word(sw), 'Sight words', sw, { kind: 'sight' });
  for (const s of C.steps) {
    for (const w of C.words.filter(x => x.step === s.step)) {
      const hint = w.real
        ? (w.oralOnly ? 'Spoken only; never printed.' : '')
        : `Nonsense word: rhymes with ${w.rhyme}.${w.levelCheck ? ' Held back for the level check.' : ''}`;
      add(clip.word(w.word), `Step ${s.step} words`, w.word, { kind: w.real ? 'word' : 'nonsense', step: s.step, hint });
    }
    for (const t of C.sentences.filter(x => x.step === s.step)) {
      add(clip.sentence(t.text), `Step ${s.step} sentences`, t.text, { kind: 'sentence', step: s.step });
    }
  }
  for (const t of C.custom) add(clip.sentence(t.text), 'Your sentences', t.text, { kind: 'sentence' });
  return list;
}
