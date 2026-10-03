// Item choice for each activity (SPEC.md, "Activities" and "Mastery model" rules 2-4).
// Pure: progress P, session S, and a seeded rng come in; plain item objects come out.
import { recId, isDue, hitRate } from './mastery.js';
import { clip, isVowel, diffPositions, neighbors, scopeLetters, stepLE, tokenize } from './content.js';

export const POSITIONS = ['first', 'last', 'middle']; // Find the sound asks them in this order
export const positionName = (i, n) => (i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle');

// ---- What he knows
export const letterState = (P, l) => P.records[recId.letter(l)]?.state ?? 'new';
// Letters this session introduces count as known when planning, since Sound match comes first.
export const knowsLetter = (P, S, l) => letterState(P, l) !== 'new' || S.newLetters.includes(l);
export const isQueenWord = (C, key) => C.squad.byWord[key]?.piece === 'queen';

// Level-check words never appear in play. A queen stays hidden until her step is ready.
export function withheld(C, P, w) {
  if (w.levelCheck) return true;
  return isQueenWord(C, w.key) && !P.queenReady[w.step] && !P.signed.includes(w.key);
}

// Rule 3: a printed word is from his step or an earlier one, and he has met every letter in it.
export function printable(C, P, S, w) {
  return !w.oralOnly && stepLE(C, w.step, P.step) && w.letters.every(l => knowsLetter(P, S, l)) && !withheld(C, P, w);
}

const wordAudio = (S, w) => S.audioOK(clip.word(w.word)) && w.sounds.every(s => S.audioOK(clip.sound(s)));
export const eligibleReal = (C, P, S) => C.real.filter(w => printable(C, P, S, w) && wordAudio(S, w));
export const eligibleNonsense = (C, P, S) => C.nonsense.filter(w => printable(C, P, S, w) && wordAudio(S, w));

// The ready, unsigned queen of his current step, if he can read her name.
export function readyQueen(C, P, S) {
  if (!P.queenReady[P.step]) return null;
  const player = C.squad.players.find(p => p.step === P.step && p.piece === 'queen');
  const w = player && C.byWord.get(player.word);
  return w && !P.signed.includes(w.key) && printable(C, P, S, w) && wordAudio(S, w) ? w : null;
}

// New letter-sounds enter through Sound match, at most two a session (rule 2): the step's own vowel
// first, then a ready queen's letters, then the letters whose names mislead, then teaching order.
export function chooseNewLetters(C, P, cfg, audioOK = () => true) {
  const step = C.steps[C.stepIndex[P.step]];
  const queen = C.squad.players.find(p => p.step === P.step && p.piece === 'queen');
  const queenLetters = P.queenReady[P.step] && queen ? [...queen.word] : [];
  const rank = l => (l === step.vowel ? 0 : queenLetters.includes(l) ? 1 : cfg.priorityLetters.includes(l) ? 2 : 3);
  return scopeLetters(C, P.step)
    .filter(l => letterState(P, l) === 'new' && audioOK(clip.sound(C.letterSound[l])))
    .sort((a, b) => rank(a) - rank(b) || C.letters.indexOf(a) - C.letters.indexOf(b))
    .slice(0, cfg.newLettersPerSession);
}

// ---- Buckets for rule 4: about 70% learning, 20% mastered and due for review, 10% new.
export function stateBucket(rec, day) {
  if (!rec || rec.state === 'new') return 'new';
  if (rec.state === 'learning') return 'learning';
  return isDue(rec, day) ? 'review' : 'mastered';
}

function wordBucket(P, S, w, decId) {
  if (w.letters.some(l => S.newLetters.includes(l))) return 'new';
  const recs = [decId, ...w.letters.map(recId.letter)].map(id => id && P.records[id]).filter(Boolean);
  if (recs.some(r => r.state !== 'mastered')) return 'learning';
  return recs.some(r => isDue(r, S.day)) ? 'review' : 'mastered';
}

function wordEase(P, w, decId) {
  const rates = w.letters.map(l => hitRate(P.records[recId.letter(l)]));
  if (decId) rates.push(hitRate(P.records[decId]));
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

// Picks n candidates. Each candidate has a key and a group (its mastery record). Forced ones go
// first (a recycled miss, a new letter, the queen). In easy mode, the best-known material wins
// (rule 7). Otherwise buckets fill by the mix, round-robin across records, and short buckets
// fall back to the others. A small pool repeats rather than runs short.
export function pickMix(cands, n, rng, cfg, opts = {}) {
  const { bucket = () => 'learning', rank = () => 0, ease = () => 0, recent = new Set(), distinct = c => c.key,
    force = [], easy = false, newCount } = opts;
  const out = [];
  const used = new Set();
  const push = c => {
    out.push(c);
    used.add(distinct(c));
  };
  const take = (list, k) => {
    const queues = new Map();
    for (const c of list) {
      if (used.has(distinct(c))) continue;
      if (!queues.has(c.group)) queues.set(c.group, []);
      queues.get(c.group).push(c);
    }
    let taken = 0;
    while (taken < k && [...queues.values()].some(q => q.length)) {
      for (const q of queues.values()) {
        while (q.length && used.has(distinct(q[0]))) q.shift();
        if (!q.length || taken >= k) continue;
        push(q.shift());
        taken++;
      }
    }
    return taken;
  };

  for (const c of force) if (out.length < n && !used.has(distinct(c))) push(c);
  if (easy) {
    take(rng.shuffle(cands).sort((a, b) => ease(b) - ease(a)), n - out.length);
  } else {
    const buckets = { learning: [], review: [], new: [], mastered: [] };
    for (const c of rng.shuffle(cands)) buckets[bucket(c)].push(c);
    for (const list of Object.values(buckets)) list.sort((a, b) => (recent.has(a.key) - recent.has(b.key)) || (rank(b) - rank(a)));
    const left = n - out.length;
    const want = { new: newCount ?? Math.round(left * cfg.mix.new), review: Math.round(left * cfg.mix.review) };
    want.learning = Math.max(0, left - want.new - want.review);
    let short = 0;
    for (const k of ['learning', 'review', 'new']) short += want[k] - take(buckets[k], want[k]);
    for (const k of ['learning', 'review', 'mastered', 'new']) if (short > 0) short -= take(buckets[k], short);
  }
  const pool = rng.shuffle(cands.length ? cands : force);
  for (let j = 0; out.length < n && pool.length && j < 10 * n + pool.length; j++) {
    const c = pool[j % pool.length];
    if (pool.length > 1 && out.length && distinct(out[out.length - 1]) === distinct(c)) continue;
    out.push(c);
  }
  return out;
}

const uniqByKey = list => list.filter((x, i) => list.findIndex(y => y.key === x.key) === i);

// ---- 1. Sound match
export function buildSoundMatch(C, P, S, rng, n, cfg, opts = {}) {
  const cands = scopeLetters(C, P.step)
    .filter(l => knowsLetter(P, S, l) && S.audioOK(clip.sound(C.letterSound[l])))
    .map(l => ({ key: l, group: l, letter: l }));
  const byKey = new Map(cands.map(c => [c.key, c]));
  const fresh = S.newLetters.filter(l => byKey.has(l) && !S.introduced.has(l));
  const force = opts.easy ? [] : [...fresh, ...(opts.recycled ?? [])].map(k => byKey.get(k)).filter(Boolean);
  const rate = c => hitRate(P.records[recId.letter(c.letter)]);
  const picks = pickMix(cands, n, rng, cfg, {
    force, easy: opts.easy, recent: opts.recent, newCount: 0,
    bucket: c => stateBucket(P.records[recId.letter(c.letter)], S.day),
    rank: c => (cfg.priorityLetters.includes(c.letter) ? 1 : 0) + (1 - rate(c)),
    ease: rate,
  });
  const order = rng.shuffle(picks);
  const first = order.findIndex(c => !fresh.includes(c.letter)); // warm up on a letter he knows
  if (first > 0) order.unshift(...order.splice(first, 1));
  const introduced = new Set();
  return order.map((c, i) => {
    const intro = fresh.includes(c.letter) && !introduced.has(c.letter);
    if (intro) introduced.add(c.letter);
    // The reverse form, every other item; a brand-new letter is always met forward first.
    return soundMatchItem(C, P, S, rng, c.letter, intro || i % 2 === 0 ? 'forward' : 'reverse', cfg, intro);
  });
}

// Wrong choices: letters he has confused before, then look-alikes and sound-alikes, then letters he
// knows. Never two letters with the same sound, so c and k never appear together.
function letterDistractors(C, P, S, letter, count, rng, cfg) {
  const pool = scopeLetters(C, P.step);
  const out = [];
  const add = x => {
    if (out.length >= count || x === letter || out.includes(x) || !pool.includes(x)) return;
    const sound = C.letterSound[x];
    if (sound === C.letterSound[letter] || out.some(y => C.letterSound[y] === sound)) return;
    out.push(x);
  };
  const confused = Object.entries(P.records[recId.letter(letter)]?.confusions ?? {}).sort((a, b) => b[1] - a[1]).map(([x]) => x);
  confused.forEach(add);
  for (const g of [...cfg.lookAlikes, ...cfg.soundAlikes]) if (g.includes(letter)) rng.shuffle(g).forEach(add);
  rng.shuffle(pool.filter(x => knowsLetter(P, S, x))).forEach(add);
  rng.shuffle(pool).forEach(add);
  return out;
}

export function soundMatchItem(C, P, S, rng, letter, form, cfg, intro = false) {
  const sound = C.letterSound[letter];
  const base = { activity: 'soundMatch', form, key: letter, letter, sound, record: recId.letter(letter), intro };
  if (form === 'forward') {
    return { ...base, choices: rng.shuffle([letter, ...letterDistractors(C, P, S, letter, 3, rng, cfg)]), answer: letter };
  }
  const sounds = letterDistractors(C, P, S, letter, 6, rng, cfg).map(l => C.letterSound[l]);
  const others = [...new Set(sounds)].filter(s => s !== sound).slice(0, 2);
  return { ...base, choices: rng.shuffle([sound, ...others]), answer: sound };
}

// ---- 2. Blend it: any pictured word, since nothing is printed (SPEC.md, "Word bank").
export function buildBlendIt(C, P, S, rng, n, cfg, opts = {}) {
  const cands = C.pictured.filter(w => wordAudio(S, w)).map(w => ({ key: w.key, group: recId.blend(w.shape), w }));
  const byKey = new Map(cands.map(c => [c.key, c]));
  const picks = pickMix(cands, n, rng, cfg, {
    force: opts.easy ? [] : (opts.recycled ?? []).map(k => byKey.get(k)).filter(Boolean),
    easy: opts.easy, recent: opts.recent,
    bucket: c => stateBucket(P.records[c.group], S.day),
    ease: c => hitRate(P.records[c.group]),
  });
  // Words that start with a sound he can stretch come first.
  picks.sort((a, b) => (a.w.shape === 'continuous' ? 0 : 1) - (b.w.shape === 'continuous' ? 0 : 1));
  return picks.map(c => blendItem(C, rng, c.w));
}

// Wrong pictures share the first sound where possible, so one sound alone never gives the answer.
export function blendItem(C, rng, w) {
  const others = C.pictured.filter(x => x.key !== w.key);
  const ds = uniqByKey([
    ...rng.shuffle(others.filter(x => x.sounds[0] === w.sounds[0])),
    ...rng.shuffle(neighbors(w, others, 'sounds')),
    ...rng.shuffle(others),
  ]).slice(0, 2);
  return {
    activity: 'blendIt', key: w.key, word: w.key, shape: w.shape, record: recId.blend(w.shape),
    choices: rng.shuffle([w.key, ...ds.map(x => x.key)]), answer: w.key,
  };
}

// ---- 3. Find the sound: three different sounds, and no x (SPEC.md, "The letter x").
export function buildFindSound(C, P, S, rng, n, cfg, opts = {}) {
  const words = C.oral.filter(w => w.sounds.length === 3 && new Set(w.sounds).size === 3 && !w.sounds.includes('ks') && wordAudio(S, w));
  const cands = words.flatMap(w => [0, 1, 2].map(i => {
    const pos = positionName(i, 3);
    return { key: `${w.key}:${pos}`, group: recId.seg(pos), w, index: i, pos };
  }));
  const byKey = new Map(cands.map(c => [c.key, c]));
  const picks = pickMix(cands, n, rng, cfg, {
    force: opts.easy ? [] : (opts.recycled ?? []).map(k => byKey.get(k)).filter(Boolean),
    easy: opts.easy, recent: opts.recent,
    distinct: c => c.w.key,
    bucket: c => stateBucket(P.records[c.group], S.day),
    ease: c => hitRate(P.records[c.group]),
  });
  picks.sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos));
  return picks.map(c => findItem(rng, c.w, c.index));
}

// Wrong choices are the word's other two sounds, so the task tests position.
export function findItem(rng, w, index) {
  const pos = positionName(index, w.sounds.length);
  return {
    activity: 'findSound', key: `${w.key}:${pos}`, word: w.key, position: pos, index, record: recId.seg(pos),
    choices: rng.shuffle(w.sounds), answer: w.sounds[index],
  };
}

// ---- 4. Build it
export function buildBuildIt(C, P, S, rng, n, cfg, opts = {}) {
  const cands = eligibleReal(C, P, S).filter(w => w.letters.length === 3).map(w => ({ key: w.key, group: w.key, w }));
  const byKey = new Map(cands.map(c => [c.key, c]));
  const picks = pickMix(cands, n, rng, cfg, {
    force: opts.easy ? [] : (opts.recycled ?? []).map(k => byKey.get(k)).filter(Boolean),
    easy: opts.easy, recent: opts.recent,
    bucket: c => wordBucket(P, S, c.w, null),
    ease: c => wordEase(P, c.w, null),
  });
  return picks.map(c => buildItem(C, P, S, rng, c.w, cfg));
}

// The tray: the word's letters plus two or three extras, always including one other vowel.
export function buildItem(C, P, S, rng, w, cfg) {
  const known = scopeLetters(C, P.step).filter(l => knowsLetter(P, S, l));
  const vowel = w.letters.find(isVowel);
  const otherVowels = known.filter(l => isVowel(l) && l !== vowel);
  // Before he knows a second vowel, the extra vowel is the next one he will meet.
  const extras = [otherVowels.length ? rng.pick(otherVowels) : C.letters.find(l => isVowel(l) && l !== vowel)];
  const hasK = w.letters.some(l => C.letterSound[l] === 'k');
  const similar = w.letters.flatMap(l => [...cfg.lookAlikes, ...cfg.soundAlikes].filter(g => g.includes(l)).flat());
  const confused = w.letters.flatMap(l => Object.keys(P.records[recId.letter(l)]?.confusions ?? {}));
  const total = 2 + rng.int(2);
  for (const l of [...rng.shuffle(similar), ...rng.shuffle(confused), ...rng.shuffle(known)]) {
    if (extras.length >= total) break;
    if (!l || isVowel(l) || w.letters.includes(l) || extras.includes(l) || !known.includes(l)) continue;
    if (C.letterSound[l] === 'k' && (hasK || extras.some(x => C.letterSound[x] === 'k'))) continue; // never c and k together
    extras.push(l);
  }
  const tray = rng.shuffle([...w.letters, ...extras.filter(Boolean)]).map((letter, id) => ({ id, letter }));
  return { activity: 'buildIt', key: w.key, word: w.key, letters: [...w.letters], tray, answer: [...w.letters] };
}

// ---- 5. Read and find: four real, two nonsense.
export function buildReadFind(C, P, S, rng, n, cfg, opts = {}) {
  return mixRealAndNonsense(C, P, S, rng, n, cfg, opts, 'readFind', w => readFindItem(C, P, S, rng, w), true);
}

export function readFindItem(C, P, S, rng, w) {
  if (w.real) {
    // He reads the word and taps its picture; wrong pictures are neighbors, else share the first sound.
    const others = C.pictured.filter(x => x.key !== w.key);
    const ds = uniqByKey([
      ...rng.shuffle(neighbors(w, others, 'letters')),
      ...rng.shuffle(others.filter(x => x.sounds[0] === w.sounds[0])),
      ...rng.shuffle(others),
    ]).slice(0, 2);
    return {
      activity: 'readFind', kind: 'real', key: w.key, word: w.key, record: recId.dec(w.step, true),
      choices: rng.shuffle([w.key, ...ds.map(x => x.key)]), answer: w.key,
    };
  }
  // He hears a nonsense word and taps its printed form from four. One wrong choice differs in each
  // position where the bank allows, and every choice is decodable at his step (ground rule 5).
  const pool = [...eligibleReal(C, P, S), ...eligibleNonsense(C, P, S)]
    .filter(x => x.key !== w.key && x.letters.length === w.letters.length);
  const ds = [];
  for (const i of rng.shuffle([...w.letters.keys()])) {
    const options = pool.filter(x => !ds.includes(x) && diffPositions(w.letters, x.letters).join() === String(i));
    if (options.length) ds.push(rng.pick(options));
  }
  for (const x of rng.shuffle(pool)) if (ds.length < 3 && !ds.includes(x)) ds.push(x);
  return {
    activity: 'readFind', kind: 'nonsense', key: w.key, word: w.key, record: recId.dec(w.step, false),
    choices: rng.shuffle([w.key, ...ds.map(x => x.key)]), answer: w.key,
  };
}

// ---- 6. Read aloud: four real words, two nonsense, then one sentence, the match's headline.
export function buildReadAloud(C, P, S, rng, n, cfg, opts = {}) {
  const items = mixRealAndNonsense(C, P, S, rng, n, cfg, opts, 'readAloud', w => readAloudItem(w), false);
  const sentence = pickSentence(C, P, S);
  if (sentence) items.push(sentence);
  return items;
}

export function readAloudItem(w) {
  return { activity: 'readAloud', kind: w.real ? 'real' : 'nonsense', key: w.key, word: w.key, record: recId.dec(w.step, w.real), shape: w.shape };
}

function mixRealAndNonsense(C, P, S, rng, n, cfg, opts, activity, makeItem, pictured) {
  const realPool = eligibleReal(C, P, S).filter(w => !pictured || w.picture);
  const nonPool = eligibleNonsense(C, P, S);
  const queen = readyQueen(C, P, S);
  const recycled = (opts.recycled ?? []).map(k => C.byWord.get(k)).filter(Boolean);
  const pick = (pool, k, real, force) => {
    const cands = pool.map(w => ({ key: w.key, group: recId.dec(w.step, real), w }));
    const keys = new Set(cands.map(c => c.key));
    return pickMix(cands, k, rng, cfg, {
      force: opts.easy ? [] : force.filter(w => keys.has(w.key)).map(w => ({ key: w.key, group: recId.dec(w.step, real), w })),
      easy: opts.easy, recent: opts.recent,
      bucket: c => wordBucket(P, S, c.w, c.group),
      ease: c => wordEase(P, c.w, c.group),
    }).map(c => c.w);
  };
  // A ready queen is in the nonsense pool already; forcing her in makes her name come up this match.
  const nNon = !nonPool.length ? 0 : realPool.length ? Math.round(n * cfg.nonsenseShare[activity]) : n;
  const non = pick(nonPool, nNon, false, [...(queen ? [queen] : []), ...recycled.filter(w => !w.real)]);
  const real = pick(realPool, n - non.length, true, recycled.filter(w => w.real));
  const items = real.map(makeItem);
  // Nonsense words go in among the real ones, never first.
  for (const w of non) items.splice(1 + rng.int(items.length || 1), 0, makeItem(w));
  return items.slice(0, Math.max(n, non.length));
}

// The headline: a sentence he can read now, the newest step's first, least recently used.
export function pickSentence(C, P, S) {
  const readable = [...C.custom, ...C.sentences]
    .filter(s => S.audioOK(clip.sentence(s.text)))
    .map(s => ({ s, tokens: tokenize(C, s.text) }))
    .filter(({ tokens }) => tokens.every(t => t.sight || (t.entry?.real && !t.entry.oralOnly && stepLE(C, t.entry.step, P.step)
      && t.entry.letters.every(l => knowsLetter(P, S, l)))));
  if (!readable.length) return null;
  const stepOf = ({ tokens }) => Math.max(0, ...tokens.map(t => (t.entry ? C.stepIndex[t.entry.step] : 0)));
  const used = x => P.headlines[x.s.text] ?? '';
  readable.sort((a, b) => (used(a) ? 1 : 0) - (used(b) ? 1 : 0) || stepOf(b) - stepOf(a) || used(a).localeCompare(used(b)));
  const { s, tokens } = readable[0];
  const sight = [...new Set(tokens.filter(t => t.sight).map(t => t.sight))];
  return {
    activity: 'readAloud', kind: 'sentence', key: s.text, text: s.text, emoji: s.emoji, custom: s.custom,
    tokens: tokens.map(t => ({ text: t.raw, sight: t.sight, word: t.entry?.key ?? null })),
    newSight: sight.filter(x => !P.sightIntroduced.includes(x)),
  };
}

// ---- Shared
const BUILDERS = {
  soundMatch: buildSoundMatch, blendIt: buildBlendIt, findSound: buildFindSound,
  buildIt: buildBuildIt, readFind: buildReadFind, readAloud: buildReadAloud,
};

export function buildActivity(activity, C, P, S, rng, n, cfg, opts = {}) {
  return BUILDERS[activity](C, P, S, rng, n, cfg, opts);
}

// The same target again with fresh choices, for an item that comes back later (correction step 4).
export function remake(C, P, S, rng, item, cfg) {
  const w = item.word && C.byWord.get(item.word);
  switch (item.activity) {
    case 'soundMatch': return soundMatchItem(C, P, S, rng, item.letter, item.form, cfg);
    case 'blendIt': return blendItem(C, rng, w);
    case 'findSound': return findItem(rng, w, item.index);
    case 'buildIt': return buildItem(C, P, S, rng, w, cfg);
    case 'readFind': return readFindItem(C, P, S, rng, w);
    default: return { ...item };
  }
}

// Every clip an item can play, so a session decodes its audio up front.
export function itemClips(C, item) {
  const ids = [];
  const wordClips = key => {
    const w = C.byWord.get(key);
    if (!w) return;
    ids.push(clip.word(w.word), ...w.sounds.map(clip.sound));
  };
  if (item.sound) ids.push(clip.sound(item.sound));
  if (item.letter) ids.push(clip.sound(C.letterSound[item.letter]));
  if (item.word) wordClips(item.word);
  for (const ch of item.choices ?? []) {
    if (C.soundById[ch]) ids.push(clip.sound(ch));
    else wordClips(ch);
  }
  for (const t of item.tray ?? []) ids.push(clip.sound(C.letterSound[t.letter]));
  if (item.kind === 'sentence') {
    ids.push(clip.sentence(item.text));
    for (const t of item.tokens) {
      if (t.sight) ids.push(clip.word(t.sight));
      else if (t.word) wordClips(t.word);
    }
  }
  return ids;
}
