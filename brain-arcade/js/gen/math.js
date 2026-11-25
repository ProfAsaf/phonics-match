// Math question generators. Each skill makes a question at any difficulty b inside [lo, hi]
// (grade scale, see scale.js). Grade placements follow the Common Core and IXL's grade labels
// for each skill. A generator returns the right option first; the engine shuffles.
import { int, pick, shuffle, chance, lerpT, sample } from '../rng.js';
import * as S from '../svg.js';

export const NAMES = [
  ['Mia', 'she', 'her'], ['Ben', 'he', 'his'], ['Ava', 'she', 'her'], ['Sam', 'he', 'his'], ['Max', 'he', 'his'],
  ['Lily', 'she', 'her'], ['Omar', 'he', 'his'], ['Rosa', 'she', 'her'], ['Kai', 'he', 'his'], ['Nora', 'she', 'her'],
  ['Theo', 'he', 'his'], ['June', 'she', 'her'], ['Eli', 'he', 'his'], ['Ivy', 'she', 'her'], ['Finn', 'he', 'his'], ['Luna', 'she', 'her'],
];
export const OBJS = [
  { one: 'apple', many: 'apples', e: '🍎' }, { one: 'star', many: 'stars', e: '⭐' }, { one: 'shell', many: 'shells', e: '🐚' },
  { one: 'cookie', many: 'cookies', e: '🍪' }, { one: 'balloon', many: 'balloons', e: '🎈' }, { one: 'fish', many: 'fish', e: '🐟' },
  { one: 'car', many: 'cars', e: '🚗' }, { one: 'flower', many: 'flowers', e: '🌸' }, { one: 'ball', many: 'balls', e: '⚽' },
  { one: 'cupcake', many: 'cupcakes', e: '🧁' }, { one: 'ladybug', many: 'ladybugs', e: '🐞' }, { one: 'strawberry', many: 'strawberries', e: '🍓' },
  { one: 'pencil', many: 'pencils', e: '✏️' }, { one: 'duck', many: 'ducks', e: '🦆' }, { one: 'leaf', many: 'leaves', e: '🍁' },
  { one: 'carrot', many: 'carrots', e: '🥕' }, { one: 'frog', many: 'frogs', e: '🐸' }, { one: 'book', many: 'books', e: '📘' },
];
const CONTAINERS = [['bag', 'bags'], ['box', 'boxes'], ['basket', 'baskets'], ['plate', 'plates'], ['row', 'rows'], ['jar', 'jars']];

const fmtN = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(v));
const MINUS = '−';
const nOpts = (b) => (b < -0.4 ? 3 : 4);
const num = (v, extra = {}) => ({ label: fmtN(v), value: v, ...extra });

// Unique numeric options with the answer first.
function numOpts(rng, ans, cands, n, { min = 0, max = Infinity } = {}) {
  const out = [ans];
  const seen = new Set([ans]);
  for (const c of shuffle(rng, cands)) {
    if (out.length >= n) break;
    if (Number.isFinite(c) && c >= min && c <= max && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  for (let d = 1; out.length < n && d < 1000; d++) {
    for (const c of [ans + d, ans - d]) if (out.length < n && c >= min && c <= max && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}
const numItem = (rng, ans, cands, n, o = {}) => numOpts(rng, ans, cands, n, o).map((v) => num(v));
const person = (rng) => { const [name, p, pos] = pick(rng, NAMES); return { name, p, P: p[0].toUpperCase() + p.slice(1), pos }; };
const twoPeople = (rng) => { const [a, b] = sample(rng, NAMES, 2); return [{ name: a[0], p: a[1] }, { name: b[0], p: b[1] }]; };
const deco = (e) => `<div class="deco">${e}</div>`;
const plural = (o, n) => (n === 1 ? o.one : o.many);

const FRAC_WORDS = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'], 100: ['hundredth', 'hundredths'] };
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function fracSay(n, d) {
  const w = FRAC_WORDS[d];
  if (!w) return `${n} over ${d}`;
  if (d === 2 && n === 1) return 'one half';
  return `${NUM_WORDS[n] ?? n} ${n === 1 ? w[0] : w[1]}`;
}
const frac = (n, d, whole = 0) => ({ label: whole ? `${whole} ${n}/${d}` : `${n}/${d}`, frac: [n, d, whole], say: (whole ? `${whole} and ` : '') + fracSay(n, d), value: whole + n / d });
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// Column-wise addition/subtraction "bugs" for distractors.
function noCarrySum(a, b) {
  let r = 0, m = 1;
  while (a > 0 || b > 0) { r += (((a % 10) + (b % 10)) % 10) * m; a = Math.floor(a / 10); b = Math.floor(b / 10); m *= 10; }
  return r;
}
function smallFromLarge(a, b) {
  let r = 0, m = 1;
  while (a > 0 || b > 0) { r += Math.abs((a % 10) - (b % 10)) * m; a = Math.floor(a / 10); b = Math.floor(b / 10); m *= 10; }
  return r;
}
function hasCarry(a, b) { while (a > 0 && b > 0) { if ((a % 10) + (b % 10) >= 10) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); } return false; }
function hasBorrow(a, b) { while (b > 0) { if (a % 10 < b % 10) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); } return false; }
const randDigits = (rng, d) => int(rng, 10 ** (d - 1), 10 ** d - 1);
// numbers with/without regrouping, tries a few times
function pairAdd(rng, da, db, carry) {
  for (let i = 0; i < 60; i++) {
    const a = randDigits(rng, da), b = randDigits(rng, db);
    if (hasCarry(a, b) === carry) return [a, b];
  }
  return [randDigits(rng, da), randDigits(rng, db)];
}
function pairSub(rng, da, db, borrow) {
  for (let i = 0; i < 60; i++) {
    let a = randDigits(rng, da), b = randDigits(rng, db);
    if (b > a) [a, b] = [b, a];
    if (a === b) continue;
    if (hasBorrow(a, b) === borrow) return [a, b];
  }
  const a = randDigits(rng, da), b = int(rng, 1, a - 1);
  return [a, b];
}

const SHAPE_NAMES = {
  circle: 'circle', oval: 'oval', square: 'square', rectangle: 'rectangle', triangle: 'triangle', star: 'star', heart: 'heart',
  hexagon: 'hexagon', pentagon: 'pentagon', rhombus: 'rhombus', trapezoid: 'trapezoid', octagon: 'octagon', parallelogram: 'parallelogram',
};
const randColor = (rng) => pick(rng, S.PAL);

// ================================================================== COUNTING
const count = [
  {
    id: 'count.objects', strand: 'count', name: 'Count objects', lo: -1.2, hi: 0.4,
    gen(b, rng) {
      const t = lerpT(b, -1.2, 0.4);
      const maxN = t < 0.2 ? 3 : t < 0.4 ? 5 : t < 0.7 ? 10 : t < 0.85 ? 15 : 20;
      const n = int(rng, Math.max(1, Math.ceil(maxN * 0.45)), maxN);
      const o = pick(rng, OBJS);
      return {
        prompt: `How many ${o.many}?`, say: `How many ${o.many}?`,
        visual: { html: S.emojiGroupHTML(o.e, n, { cls: n > 10 ? 'rows5 small' : 'rows5' }) },
        options: numItem(rng, n, [n - 1, n + 1, n + 2, n - 2], nOpts(b), { min: 1 }), sortOptions: true,
        why: `Touch and count each one. There ${n === 1 ? 'is 1' : `are ${n}`}.`, key: `co${n}${o.e}`,
      };
    },
  },
  {
    id: 'count.numeral', strand: 'count', name: 'Recognize numbers', lo: -1.1, hi: 0.7,
    gen(b, rng) {
      const t = lerpT(b, -1.1, 0.7);
      const [lo, hi] = t < 0.3 ? [0, 5] : t < 0.55 ? [0, 10] : t < 0.8 ? [11, 20] : [21, 99];
      const n = int(rng, lo, hi);
      const cands = [n + 1, n - 1, n + 2];
      if (n >= 10) cands.push(+String(n).split('').reverse().join(''), n + 10, n - 10);
      if (n === 6) cands.push(9);
      if (n === 9) cands.push(6);
      return {
        prompt: 'Find the number you hear', say: `Find the number ${n}.`, hideSayText: true,
        options: numItem(rng, n, cands, nOpts(b), { min: 0, max: 120 }),
        why: `This is ${n}.`, key: `nu${n}`,
      };
    },
  },
  {
    id: 'count.compare', strand: 'count', name: 'More and fewer', lo: -0.9, hi: 0.6,
    gen(b, rng) {
      const t = lerpT(b, -0.9, 0.6);
      if (t < 0.55) {
        const o = pick(rng, OBJS);
        const gap = t < 0.25 ? int(rng, 3, 4) : t < 0.45 ? 2 : 1;
        const small = int(rng, 1, 7 - gap), big = small + gap;
        const fewer = t > 0.3 && chance(rng, 0.4);
        const ans = fewer ? small : big, other = fewer ? big : small;
        return {
          prompt: `Which group has ${fewer ? 'fewer' : 'more'}?`, say: `Which group has ${fewer ? 'fewer' : 'more'} ${o.many}?`,
          options: [{ label: '', emoji: o.e, count: ans, value: ans }, { label: '', emoji: o.e, count: other, value: other }],
          why: `${ans} is ${fewer ? 'less' : 'more'} than ${other}.`, key: `cg${small}${big}${fewer}`,
        };
      }
      const max = t < 0.8 ? 10 : 20;
      const vals = sample(rng, Array.from({ length: max + 1 }, (_, i) => i), 3);
      const less = chance(rng, 0.35);
      const ans = less ? Math.min(...vals) : Math.max(...vals);
      return {
        prompt: `Which number is ${less ? 'smaller' : 'bigger'}?`, say: `Which number is ${less ? 'smaller' : 'bigger'}?`,
        options: [num(ans), ...vals.filter((v) => v !== ans).map((v) => num(v))],
        why: `${ans} is the ${less ? 'smallest' : 'biggest'}. When you count, ${less ? 'it comes first' : 'it comes last'}.`, key: `cn${vals.join()}${less}`,
      };
    },
  },
  {
    id: 'count.next', strand: 'count', name: 'Counting order', lo: -0.6, hi: 1.0,
    gen(b, rng) {
      const t = lerpT(b, -0.6, 1.0);
      let seq, ans, prompt, say, cands, why;
      if (t < 0.35 || t >= 0.6) {
        if (t < 0.35) { const s = int(rng, 1, 6); seq = [s, s + 1, s + 2]; ans = s + 3; cands = [s + 2, s + 4, s + 5]; }
        else if (t < 0.8) { const s = int(rng, 2, 8) * 10; seq = [s, s + 10, s + 20]; ans = s + 30; cands = [s + 21, s + 40, s + 31]; }
        else { const s = int(rng, 2, 9) * 10 + 6; seq = [s, s + 1, s + 2]; ans = s + 3; cands = [s + 2, s + 13, s - 6, ans + 10]; }
        prompt = 'What number comes next?'; say = `What number comes next? ${seq.join(', ')}`;
        why = `Count on: ${seq.join(', ')}, ${ans}.`;
      } else if (t < 0.48) {
        const s = int(rng, 9, 16); seq = [s, s + 1, s + 2]; ans = s + 3; cands = [s + 2, s + 4, s + 13];
        prompt = 'What number comes next?'; say = `What number comes next? ${seq.join(', ')}`; why = `Count on: ${seq.join(', ')}, ${ans}.`;
      } else {
        const n = int(rng, 5, 20); ans = n - 1; seq = null; cands = [n + 1, n - 2, n];
        prompt = `What number comes just before ${n}?`; say = prompt; why = `Count up: ${ans}, ${n}. So ${ans} comes just before ${n}.`;
        return { prompt, say, visual: { html: S.seqHTML(['?', n]) }, options: numItem(rng, ans, cands, 4, { min: 0 }), sortOptions: true, why, key: `nb${n}` };
      }
      return { prompt, say, visual: { html: S.seqHTML([...seq.map(fmtN), '?']) }, options: numItem(rng, ans, cands, nOpts(b), { min: 0 }), sortOptions: true, why, key: `nx${seq.join()}` };
    },
  },
  {
    id: 'count.tenframe', strand: 'count', name: 'Ten frames', lo: -0.5, hi: 0.5,
    gen(b, rng) {
      const t = lerpT(b, -0.5, 0.5);
      const n = t < 0.6 ? int(rng, 3, 10) : int(rng, 11, 20);
      return {
        prompt: 'How many dots?', say: 'How many dots are in the ten frame?', visual: { svg: S.tenFrameSVG(n, randColor(rng)) },
        options: numItem(rng, n, [n - 1, n + 1, n - 2, n + 2], nOpts(b), { min: 1 }), sortOptions: true,
        why: n > 10 ? `One full frame is 10, plus ${n - 10} more makes ${n}.` : n >= 5 ? `The top row is 5, plus ${n - 5} more makes ${n}.` : `Count them: ${n}.`, key: `tf${n}`,
      };
    },
  },
];

// ================================================================== OPERATIONS & ALGEBRAIC THINKING
function wordAddSub(rng, max, kind) {
  const o = pick(rng, OBJS.filter((x) => x.one !== 'fish'));
  const pp = person(rng);
  let a, b, ans, text, why;
  if (kind === 'join') {
    a = int(rng, 1, max - 1); b = int(rng, 1, max - a); ans = a + b;
    text = `${pp.name} has ${a} ${plural(o, a)}. ${pp.P} gets ${b} more. How many ${o.many} does ${pp.name} have now?`;
    why = `${a} + ${b} = ${ans}`;
  } else if (kind === 'sep') {
    a = int(rng, 3, max); b = int(rng, 1, a - 1); ans = a - b;
    text = `${pp.name} has ${a} ${o.many}. ${pp.P} gives ${b} to a friend. How many ${o.many} does ${pp.name} have left?`;
    why = `${a} ${MINUS} ${b} = ${ans}`;
  } else if (kind === 'put') {
    a = int(rng, 1, max - 1); b = int(rng, 1, max - a); ans = a + b;
    text = `There are ${a} big ${plural(o, a)} and ${b} small ${plural(o, b)}. How many ${o.many} are there in all?`;
    why = `${a} + ${b} = ${ans}`;
  } else if (kind === 'compare') {
    const [p1, p2] = twoPeople(rng);
    b = int(rng, 1, max - 2); a = int(rng, b + 1, max); ans = a - b;
    text = `${p1.name} has ${a} ${o.many}. ${p2.name} has ${b} ${o.many}. How many more ${o.many} does ${p1.name} have than ${p2.name}?`;
    why = `${a} ${MINUS} ${b} = ${ans}`;
  } else if (kind === 'change') {
    a = int(rng, 1, max - 2); const c = int(rng, a + 1, max); ans = c - a;
    text = `${pp.name} had ${a} ${plural(o, a)}. Then ${pp.p} found some more. Now ${pp.p} has ${c}. How many did ${pp.p} find?`;
    why = `${a} + ? = ${c}, so ? = ${c} ${MINUS} ${a} = ${ans}`; a = c; b = a;
  } else { // two-step
    a = int(rng, Math.floor(max / 3), Math.floor(max * 0.6)); b = int(rng, 5, Math.floor(max * 0.4)); const c = int(rng, 2, a + b - 1);
    ans = a + b - c;
    text = `${pp.name} had ${a} ${o.many}. ${pp.P} got ${b} more, then gave away ${c}. How many ${o.many} does ${pp.name} have now?`;
    why = `${a} + ${b} = ${a + b}, then ${a + b} ${MINUS} ${c} = ${ans}`;
  }
  return { o, text, ans, why, a, b };
}

const oa = [
  {
    id: 'oa.addpics', strand: 'oa', name: 'Add with pictures', lo: -0.6, hi: 0.4,
    gen(b, rng) {
      const t = lerpT(b, -0.6, 0.4);
      const max = t < 0.5 ? 5 : 10;
      const a = int(rng, 1, max - 1), c = int(rng, 1, max - a), s = a + c;
      const o = pick(rng, OBJS);
      return {
        prompt: 'How many in all?', say: `${a} ${plural(o, a)} and ${c} more ${plural(o, c)}. How many ${o.many} in all?`,
        visual: { html: S.emojiSumHTML([{ e: o.e, n: a }, '+', { e: o.e, n: c }]) },
        options: numItem(rng, s, [s - 1, s + 1, s + 2], nOpts(b), { min: 1 }), sortOptions: true,
        why: `${a} and ${c} more is ${s}. Count them all!`, key: `ap${a}+${c}`,
      };
    },
  },
  {
    id: 'oa.subpics', strand: 'oa', name: 'Take away with pictures', lo: -0.3, hi: 0.6,
    gen(b, rng) {
      const t = lerpT(b, -0.3, 0.6);
      const a = t < 0.5 ? int(rng, 3, 5) : int(rng, 5, 10), k = int(rng, 1, a - 1), d = a - k;
      const o = pick(rng, OBJS);
      return {
        prompt: 'How many are left?', say: `There are ${a} ${o.many}. ${k} go away. How many are left?`,
        visual: { html: S.emojiGroupHTML(o.e, a, { cross: k, cls: 'rows5' }) },
        options: numItem(rng, d, [d - 1, d + 1, k, a], nOpts(b), { min: 0 }), sortOptions: true,
        why: `${a} take away ${k} leaves ${d}.`, key: `sp${a}-${k}`,
      };
    },
  },
  {
    id: 'oa.add', strand: 'oa', name: 'Addition facts', lo: 0.3, hi: 1.9,
    gen(b, rng) {
      const t = lerpT(b, 0.3, 1.9);
      let x, y, z = 0;
      if (t < 0.18) { x = int(rng, 0, 4); y = int(rng, 1, 5 - x); }
      else if (t < 0.45) { x = int(rng, 2, 8); y = int(rng, 1, 10 - x); }
      else if (t < 0.8) { x = int(rng, 5, 9); y = int(rng, 11 - x, 9); }
      else { x = int(rng, 2, 7); y = int(rng, 2, 7); z = int(rng, 2, 6); }
      const s = x + y + z;
      const disp = z ? `${x} + ${y} + ${z} = ?` : `${x} + ${y} = ?`;
      const why = z ? `${x} + ${y} = ${x + y}, then ${x + y} + ${z} = ${s}.`
        : s > 10 && x >= 5 ? `Make a ten: ${x} + ${10 - x} = 10, then ${y - (10 - x)} more is ${s}.`
          : `Start at ${Math.max(x, y)} and count on ${Math.min(x, y)}: ${s}.`;
      return {
        prompt: disp, say: z ? `What is ${x} plus ${y} plus ${z}?` : `What is ${x} plus ${y}?`, autoSayLevel: 1.2,
        visual: s <= 10 && t < 0.45 ? { html: S.emojiSumHTML([{ e: '🔴', n: x }, '+', { e: '🔵', n: y }]) } : null,
        options: numItem(rng, s, [s - 1, s + 1, s + 2, s - 2, s + 10], nOpts(b), { min: 0 }),
        why, key: `ad${x}+${y}+${z}`,
      };
    },
  },
  {
    id: 'oa.sub', strand: 'oa', name: 'Subtraction facts', lo: 0.5, hi: 2.0,
    gen(b, rng) {
      const t = lerpT(b, 0.5, 2.0);
      let x, y;
      if (t < 0.2) { x = int(rng, 2, 5); y = int(rng, 1, x); }
      else if (t < 0.5) { x = int(rng, 5, 10); y = int(rng, 1, x - 1); }
      else { x = int(rng, 11, 18); y = int(rng, x - 9, 9); }
      const d = x - y;
      return {
        prompt: `${x} ${MINUS} ${y} = ?`, say: `What is ${x} minus ${y}?`, autoSayLevel: 1.2,
        options: numItem(rng, d, [d - 1, d + 1, d + 2, x + y, d - 2], nOpts(b), { min: 0 }),
        why: x > 10 ? `Think addition: ${y} + ${d} = ${x}. So ${x} ${MINUS} ${y} = ${d}.` : `Start at ${x} and count back ${y}: ${d}.`, key: `sb${x}-${y}`,
      };
    },
  },
  {
    id: 'oa.missing', strand: 'oa', name: 'Missing numbers', lo: 1.1, hi: 2.3,
    gen(b, rng) {
      const t = lerpT(b, 1.1, 2.3);
      const tens = t > 0.75;
      const max = t < 0.3 ? 10 : 20;
      let s = tens ? int(rng, 3, 9) * 10 : int(rng, 4, max), x = tens ? int(rng, 1, s / 10 - 1) * 10 : int(rng, 1, s - 1), y = s - x;
      const form = int(rng, 0, 2);
      let disp, say, ans, why;
      if (form === 0) { disp = `${x} + ? = ${s}`; say = `${x} plus what number equals ${s}?`; ans = y; why = `${x} + ${y} = ${s}. Count up from ${x} to ${s}.`; }
      else if (form === 1) { disp = `? + ${y} = ${s}`; say = `What number plus ${y} equals ${s}?`; ans = x; why = `${x} + ${y} = ${s}.`; }
      else { disp = `${s} ${MINUS} ? = ${x}`; say = `${s} minus what number equals ${x}?`; ans = y; why = `${s} ${MINUS} ${y} = ${x}.`; }
      return {
        prompt: disp, say, autoSayLevel: 1.5,
        options: numItem(rng, ans, [s, ans + 1, ans - 1, s + (form === 2 ? x : ans), ans + (tens ? 10 : 2)], 4, { min: 0 }),
        why, key: `ms${disp}`,
      };
    },
  },
  {
    id: 'oa.word', strand: 'oa', name: 'Word problems (+ and −)', lo: 0.4, hi: 3.1,
    gen(b, rng) {
      const t = lerpT(b, 0.4, 3.1);
      const max = t < 0.25 ? 10 : t < 0.45 ? 20 : 100;
      const kinds = t < 0.2 ? ['join', 'sep', 'put'] : t < 0.6 ? ['join', 'sep', 'put', 'compare'] : t < 0.8 ? ['compare', 'change', 'join', 'sep'] : ['two', 'change', 'compare'];
      const kind = pick(rng, kinds);
      const w = wordAddSub(rng, max, kind);
      return {
        prompt: w.text, say: w.text, autoSayLevel: 9, visual: { html: deco(w.o.e) },
        options: numItem(rng, w.ans, [w.ans + 1, w.ans - 1, w.ans + 10, w.a + w.b, Math.abs(w.a - w.b), w.ans - 10], 4, { min: 0 }),
        why: w.why, key: `wp${w.text}`,
      };
    },
  },
  {
    id: 'oa.evenodd', strand: 'oa', name: 'Even and odd', lo: 1.9, hi: 2.7,
    gen(b, rng) {
      const t = lerpT(b, 1.9, 2.7);
      const n = t < 0.5 ? int(rng, 3, 16) : int(rng, 17, 99);
      const even = n % 2 === 0;
      return {
        prompt: `Is ${n} even or odd?`, say: `Is ${n} even or odd?`, autoSayLevel: 9,
        visual: t < 0.5 ? { svg: S.arraySVG(2, Math.ceil(n / 2)).replace(/<circle(?![^>]*)/, '') } : null,
        options: [{ label: even ? 'even' : 'odd' }, { label: even ? 'odd' : 'even' }],
        why: even ? `${n} can make pairs with none left over, so it is even.` : `${n} has one left over after making pairs, so it is odd.`, key: `eo${n}`,
        a: 1.6,
      };
    },
  },
  {
    id: 'oa.groups', strand: 'oa', name: 'Equal groups', lo: 1.8, hi: 3.0,
    gen(b, rng) {
      const t = lerpT(b, 1.8, 3.0);
      const g = int(rng, 2, t < 0.5 ? 4 : 5), k = int(rng, 2, 5), o = pick(rng, OBJS);
      const vis = { html: `<div class="groups">${Array.from({ length: g }, () => `<span class="grp">${S.emojiGroupHTML(o.e, k)}</span>`).join('')}</div>` };
      if (t < 0.45) {
        return {
          prompt: `${g} groups of ${k}. How many in all?`, say: `There are ${g} groups with ${k} ${o.many} in each group. How many ${o.many} in all?`, autoSayLevel: 9,
          visual: vis, options: numItem(rng, g * k, [g + k, g * k + k, g * k - k, g * k + 1], 4, { min: 1 }),
          why: `${Array(g).fill(k).join(' + ')} = ${g * k}`, key: `eg${g}x${k}`,
        };
      }
      if (t > 0.75) {
        const r = int(rng, 2, 5), c = int(rng, 3, 6);
        return {
          prompt: `How many in ${r} rows of ${c}?`, say: `This array has ${r} rows with ${c} in each row. How many in all?`, autoSayLevel: 9,
          visual: { svg: S.arraySVG(r, c) }, options: numItem(rng, r * c, [r + c, r * c + c, r * c - r, r * c + 1], 4, { min: 1 }),
          why: `${Array(r).fill(c).join(' + ')} = ${r * c}`, key: `ar${r}x${c}`,
        };
      }
      const right = Array(g).fill(k).join(' + ');
      const wrong = [Array(g + 1).fill(k).join(' + '), `${g} + ${k}`, Array(Math.max(1, g - 1)).fill(k).join(' + ') + (g - 1 === 1 ? ' + 0' : '')];
      return {
        prompt: 'Which addition sentence matches the groups?', say: `${g} groups of ${k}. Which addition sentence matches?`, autoSayLevel: 9,
        visual: vis, options: [{ label: right }, ...[...new Set(wrong)].filter((w) => w !== right).slice(0, 3).map((l) => ({ label: l }))],
        why: `There are ${g} groups of ${k}, so add ${k} ${g} times: ${right} = ${g * k}.`, key: `es${g}x${k}`,
      };
    },
  },
  {
    id: 'oa.mult', strand: 'oa', name: 'Multiplication facts', lo: 2.7, hi: 4.1,
    gen(b, rng) {
      const t = lerpT(b, 2.7, 4.1);
      let x, y;
      if (t < 0.3) { x = pick(rng, [0, 1, 2, 5, 10]); y = int(rng, 1, 10); }
      else if (t < 0.55) { x = pick(rng, [3, 4]); y = int(rng, 2, 10); }
      else if (t < 0.85) { x = int(rng, 6, 9); y = int(rng, 3, 9); }
      else { x = int(rng, 6, 12); y = int(rng, 6, 12); }
      if (chance(rng, 0.5)) [x, y] = [y, x];
      const p = x * y;
      return {
        prompt: `${x} × ${y} = ?`, say: `What is ${x} times ${y}?`, autoSayLevel: 3.5,
        visual: t < 0.3 && x * y <= 30 && x > 0 && y > 0 ? { svg: S.arraySVG(x, y) } : null,
        options: numItem(rng, p, [x * (y + 1), x * (y - 1), x + y, (x + 1) * y, p + 1, p + 10], 4, { min: 0 }),
        why: x === 0 || y === 0 ? 'Anything times 0 is 0.' : `${x} × ${y} means ${x} groups of ${y}: ${p}.`, key: `mu${Math.min(x, y)}x${Math.max(x, y)}`,
      };
    },
  },
  {
    id: 'oa.div', strand: 'oa', name: 'Division facts', lo: 3.1, hi: 4.2,
    gen(b, rng) {
      const t = lerpT(b, 3.1, 4.2);
      const d = t < 0.3 ? int(rng, 2, 5) : t < 0.7 ? int(rng, 2, 9) : int(rng, 6, 12);
      const q = t < 0.3 ? int(rng, 2, 5) : int(rng, 2, 10), n = d * q;
      const o = pick(rng, OBJS);
      const vis = t < 0.3 ? { html: `<div class="groups">${Array.from({ length: d }, () => `<span class="grp">${S.emojiGroupHTML(o.e, q)}</span>`).join('')}</div>` } : null;
      return {
        prompt: `${n} ÷ ${d} = ?`, say: `What is ${n} divided by ${d}?`, autoSayLevel: 3.6, visual: vis,
        options: numItem(rng, q, [q + 1, q - 1, d, n - d, q + 2], 4, { min: 1 }),
        why: `${d} × ${q} = ${n}, so ${n} ÷ ${d} = ${q}.`, key: `dv${n}/${d}`,
      };
    },
  },
  {
    id: 'oa.multword', strand: 'oa', name: 'Word problems (× and ÷)', lo: 3.2, hi: 4.4,
    gen(b, rng) {
      const t = lerpT(b, 3.2, 4.4);
      const o = pick(rng, OBJS.filter((x) => !['fish', 'leaf'].includes(x.one)));
      const [cOne, cMany] = pick(rng, CONTAINERS);
      const pp = person(rng);
      const g = int(rng, 3, 9), k = int(rng, 3, 9);
      let text, ans, why, cands;
      const kind = t < 0.4 ? pick(rng, ['mul', 'div']) : pick(rng, ['mul', 'div', 'two', 'two']);
      if (kind === 'mul') {
        text = `${pp.name} has ${g} ${cMany} with ${k} ${o.many} in each ${cOne}. How many ${o.many} does ${pp.name} have in all?`;
        ans = g * k; why = `${g} × ${k} = ${ans}`; cands = [g + k, g * k + k, g * (k - 1), ans + 10];
      } else if (kind === 'div') {
        text = `${pp.name} puts ${g * k} ${o.many} into ${g} ${cMany}, the same number in each. How many ${o.many} go in each ${cOne}?`;
        ans = k; why = `${g * k} ÷ ${g} = ${k}`; cands = [g, k + 1, k - 1, g * k - g];
      } else {
        const extra = int(rng, 2, 9);
        text = `${pp.name} buys ${g} ${cMany} of ${o.many} with ${k} in each ${cOne}. Then ${pp.p} gives away ${extra}. How many ${o.many} are left?`;
        ans = g * k - extra; why = `${g} × ${k} = ${g * k}, then ${g * k} ${MINUS} ${extra} = ${ans}`; cands = [g * k, g * k + extra, g + k - extra, ans - 1];
      }
      return { prompt: text, say: text, autoSayLevel: 9, visual: { html: deco(o.e) }, options: numItem(rng, ans, cands, 4, { min: 0 }), why, key: `mw${text}` };
    },
  },
  {
    id: 'oa.mult10', strand: 'oa', name: 'Multiply by multiples of 10', lo: 3.3, hi: 3.9,
    gen(b, rng) {
      const x = int(rng, 2, 9), y = int(rng, 2, 9) * 10, p = x * y;
      return {
        prompt: `${x} × ${y} = ?`, say: `What is ${x} times ${y}?`, autoSayLevel: 3.5,
        options: numItem(rng, p, [x * y / 10, p * 10, x + y, p + 10], 4, { min: 1 }),
        why: `${x} × ${y / 10} = ${p / 10}, so ${x} × ${y} = ${p / 10} tens = ${p}.`, key: `m10${x}x${y}`,
      };
    },
  },
  {
    id: 'oa.factors', strand: 'oa', name: 'Factors and multiples', lo: 3.9, hi: 4.8,
    gen(b, rng) {
      const t = lerpT(b, 3.9, 4.8);
      const kind = t < 0.4 ? 'multiple' : t < 0.75 ? 'factor' : 'prime';
      if (kind === 'multiple') {
        const k = int(rng, 3, 9), ans = k * int(rng, 3, 9);
        const wrong = [];
        while (wrong.length < 3) { const w = int(rng, 10, 90); if (w % k && !wrong.includes(w)) wrong.push(w); }
        return { prompt: `Which number is a multiple of ${k}?`, say: `Which number is a multiple of ${k}?`, options: [num(ans), ...wrong.map((w) => num(w))], why: `${k} × ${ans / k} = ${ans}.`, key: `mlt${k}-${ans}` };
      }
      if (kind === 'factor') {
        const n = pick(rng, [12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48]);
        const fs = []; for (let i = 2; i < n; i++) if (n % i === 0) fs.push(i);
        const ans = pick(rng, fs);
        const wrong = []; for (let i = 2; i <= 12 && wrong.length < 6; i++) if (n % i) wrong.push(i);
        return { prompt: `Which number is a factor of ${n}?`, say: `Which number is a factor of ${n}?`, options: [num(ans), ...sample(rng, wrong, 3).map((w) => num(w))], why: `${ans} × ${n / ans} = ${n}.`, key: `fct${n}-${ans}` };
      }
      const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
      const comps = [4, 6, 8, 9, 10, 12, 14, 15, 21, 25, 27, 33, 35, 39, 49, 51];
      const ans = pick(rng, primes.slice(3));
      return { prompt: 'Which number is prime?', say: 'Which number is prime?', options: [num(ans), ...sample(rng, comps, 3).map((w) => num(w))], why: `${ans} has only two factors: 1 and ${ans}.`, key: `prm${ans}` };
    },
  },
  {
    id: 'oa.pattern', strand: 'oa', name: 'Patterns', lo: -0.7, hi: 3.6,
    gen(b, rng) {
      const t = lerpT(b, -0.7, 3.6);
      if (t < 0.19) {
        const sets = [['🍎', '🍌', '🍇'], ['🔴', '🔵', '🟡'], ['⭐', '🌙', '☀️'], ['🐶', '🐱', '🐭'], ['🚗', '🚌', '🚲'], ['🟥', '🟦', '🟩']];
        const set = shuffle(rng, pick(rng, sets));
        const units = t < 0.08 ? ['AB'] : ['AB', 'AAB', 'ABB', 'ABC', 'AABB'];
        const unit = pick(rng, units).split('').map((ch) => set['ABC'.indexOf(ch)]);
        const len = unit.length * 2 + int(rng, 1, unit.length);
        const seq = Array.from({ length: len + 1 }, (_, i) => unit[i % unit.length]);
        const ans = seq.pop();
        const opts = [...new Set([ans, ...set])].slice(0, 3);
        return {
          prompt: 'What comes next?', say: 'What comes next in the pattern?', visual: { html: S.seqHTML([...seq, '?']) },
          options: opts.map((e) => ({ label: '', emoji: e })), why: `The pattern repeats: ${unit.join(' ')}.`, key: `pt${seq.join('')}`,
        };
      }
      let step, start, n = 4, kind = 'next';
      if (t < 0.45) { step = pick(rng, [1, 2, 5, 10]); start = step * int(rng, 0, 4) + (step === 1 ? int(rng, 1, 9) : 0); }
      else if (t < 0.7) { step = pick(rng, [2, 5, 10, 100, -10, -2]); start = step === 100 ? int(rng, 1, 5) * 100 + int(rng, 1, 9) * 10 : int(rng, 11, 60) + (step < 0 ? 50 : 0); }
      else { step = pick(rng, [3, 4, 6, 7, 9, 11, 25, -3, -5]); start = int(rng, 1, 40) + (step < 0 ? 60 : 0); kind = t > 0.85 && chance(rng, 0.5) ? 'rule' : 'next'; }
      const seq = Array.from({ length: n }, (_, i) => start + i * step);
      const ans = start + n * step;
      if (kind === 'rule') {
        const rule = (s) => (s > 0 ? `add ${s}` : `subtract ${-s}`);
        const opts = [rule(step), rule(step + 1), rule(-step), rule(step - 1 || step + 2)];
        return { prompt: `What is the rule? ${seq.join(', ')}`, say: `What is the rule for this pattern? ${seq.join(', ')}`, autoSayLevel: 9, options: [...new Set(opts)].map((l) => ({ label: l })), why: `Each number is ${Math.abs(step)} ${step > 0 ? 'more' : 'less'} than the one before.`, key: `pr${seq.join()}` };
      }
      return {
        prompt: 'What number comes next?', say: `What number comes next? ${seq.join(', ')}`, autoSayLevel: 1.5, visual: { html: S.seqHTML([...seq.map(fmtN), '?']) },
        options: numItem(rng, ans, [ans + 1, ans - 1, ans + step, ans - step, ans + 10], 4, { min: 0 }),
        why: `Each number is ${Math.abs(step)} ${step > 0 ? 'more' : 'less'}. ${fmtN(seq[n - 1])} ${step > 0 ? '+' : MINUS} ${Math.abs(step)} = ${fmtN(ans)}.`, key: `pn${seq.join()}`,
      };
    },
  },
];

// ================================================================== BASE TEN
const nbt = [
  {
    id: 'nbt.tensones', strand: 'nbt', name: 'Tens and ones', lo: 0.7, hi: 1.5,
    gen(b, rng) {
      const t = lerpT(b, 0.7, 1.5);
      const tens = t < 0.4 ? 1 : int(rng, 2, 9), ones = int(rng, 0, 9), n = tens * 10 + ones;
      const cands = [ones * 10 + tens, n + 10, n - 10, tens + ones, n + 1];
      return {
        prompt: t < 0.4 ? `10 and ${ones} more is?` : 'What number do the blocks show?',
        say: t < 0.4 ? `Ten and ${ones} more makes what number?` : `Each long block is ten. Each small block is one. What number is this?`,
        visual: { svg: S.blocksSVG({ t: tens, o: ones }) },
        options: numItem(rng, n, cands, 4, { min: 1 }),
        why: `${tens} ten${tens > 1 ? 's' : ''} and ${ones} one${ones === 1 ? '' : 's'} make ${n}.`, key: `to${n}`,
      };
    },
  },
  {
    id: 'nbt.place', strand: 'nbt', name: 'Place value', lo: 1.2, hi: 4.3,
    gen(b, rng) {
      const t = lerpT(b, 1.2, 4.3);
      if (t < 0.2) {
        const n = int(rng, 21, 98), tens = Math.floor(n / 10), ones = n % 10;
        if (tens === ones) return this.gen(b, rng);
        return { prompt: `How many tens are in ${n}?`, say: `How many tens are in ${n}?`, options: numItem(rng, tens, [ones, n, tens * 10, tens + 1], 4, { min: 0 }), why: `${n} is ${tens} tens and ${ones} ones.`, key: `pv${n}` };
      }
      if (t < 0.4) {
        const n = int(rng, 102, 987), dg = String(n).split('').map(Number);
        const place = pick(rng, ['hundreds', 'tens', 'ones']), i = ['hundreds', 'tens', 'ones'].indexOf(place);
        if (new Set(dg).size < 3) return this.gen(b, rng);
        return { prompt: `Which digit is in the ${place} place in ${n}?`, say: `Which digit is in the ${place} place in ${n}?`, options: [num(dg[i]), ...dg.filter((_, j) => j !== i).map((d) => num(d)), num((dg[i] + 1) % 10 === dg[0] || (dg[i] + 1) % 10 === dg[1] || (dg[i] + 1) % 10 === dg[2] ? (dg[i] + 5) % 10 : (dg[i] + 1) % 10)].slice(0, 4), why: `In ${n}: ${dg[0]} hundreds, ${dg[1]} tens, ${dg[2]} ones.`, key: `pd${n}${place}` };
      }
      const digits = t < 0.6 ? 3 : t < 0.8 ? 4 : int(rng, 5, 6);
      let n, s, i;
      for (let k = 0; k < 30; k++) { n = randDigits(rng, digits); s = String(n); i = int(rng, 0, digits - 2); if (s[i] !== '0' && s.split('').filter((c) => c === s[i]).length === 1) break; }
      const d = +s[i], val = d * 10 ** (digits - 1 - i);
      return {
        prompt: `What is the value of the ${d} in ${fmtN(n)}?`, say: `What is the value of the ${d} in ${fmtN(n)}?`,
        options: numItem(rng, val, [d, val * 10, val / 10, d * 10 ** (digits - 2 - i) || d * 100], 4, { min: 1 }),
        why: `The ${d} is in the ${['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'][digits - 1 - i]} place, so it is worth ${fmtN(val)}.`, key: `pval${n}`,
      };
    },
  },
  {
    id: 'nbt.compare', strand: 'nbt', name: 'Compare numbers', lo: 1.3, hi: 4.3,
    gen(b, rng) {
      const t = lerpT(b, 1.3, 4.3);
      const digits = t < 0.25 ? 2 : t < 0.5 ? 3 : t < 0.72 ? 4 : int(rng, 5, 6);
      if (chance(rng, 0.5)) {
        let a = randDigits(rng, digits), c;
        const r = rng();
        if (r < 0.15) c = a;
        else { const s = String(a).split(''); const i = int(rng, 0, s.length - 1); s[i] = String((+s[i] + int(rng, 1, 8)) % 10); if (i === 0 && s[0] === '0') s[0] = '1'; c = +s.join(''); }
        if (c === a && r >= 0.15) c = a + 1;
        const sym = a > c ? '>' : a < c ? '<' : '=';
        const say = { '>': 'is greater than', '<': 'is less than', '=': 'equals' };
        return {
          prompt: `${fmtN(a)} ○ ${fmtN(c)}`, say: `Which symbol goes in the circle? ${fmtN(a)}, ${fmtN(c)}.`,
          options: [{ label: sym, say: say[sym] }, ...['>', '<', '='].filter((x) => x !== sym).map((x) => ({ label: x, say: say[x] }))],
          why: a === c ? 'They are the same number, so use =.' : `${fmtN(a)} ${say[sym]} ${fmtN(c)}. The open side faces the bigger number.`, key: `cs${a}-${c}`,
        };
      }
      const base = String(randDigits(rng, digits)).split('');
      const vals = new Set();
      while (vals.size < 4) { const s = shuffle(rng, base); if (s[0] !== '0') vals.add(+s.join('')); else if (vals.size === 0) vals.add(+base.join('')); if (vals.size < 4 && new Set(base).size < 3) vals.add(randDigits(rng, digits)); }
      const arr = [...vals];
      const least = chance(rng, 0.35);
      const ans = least ? Math.min(...arr) : Math.max(...arr);
      return {
        prompt: `Which number is the ${least ? 'least' : 'greatest'}?`, say: `Which number is the ${least ? 'least' : 'greatest'}?`,
        options: [num(ans), ...arr.filter((v) => v !== ans).map((v) => num(v))],
        why: 'Compare the biggest place first, then the next place.', key: `cl${arr.join()}`,
      };
    },
  },
  {
    id: 'nbt.add', strand: 'nbt', name: 'Add multi-digit numbers', lo: 1.4, hi: 4.4,
    gen(b, rng) {
      const t = lerpT(b, 1.4, 4.4);
      let x, y;
      if (t < 0.07) [x, y] = pairAdd(rng, 2, 1, false);
      else if (t < 0.13) { if (chance(rng, 0.5)) { x = randDigits(rng, 2); y = int(rng, 1, 9 - Math.floor(x / 10)) * 10; if (y < 10) y = 10; } else [x, y] = pairAdd(rng, 2, 1, true); }
      else if (t < 0.23) [x, y] = pairAdd(rng, 2, 2, false);
      else if (t < 0.37) [x, y] = pairAdd(rng, 2, 2, true);
      else if (t < 0.5) [x, y] = pairAdd(rng, 3, int(rng, 2, 3), false);
      else if (t < 0.67) [x, y] = pairAdd(rng, 3, 3, true);
      else if (t < 0.83) [x, y] = pairAdd(rng, 4, int(rng, 3, 4), true);
      else [x, y] = pairAdd(rng, int(rng, 5, 6), int(rng, 4, 5), true);
      const s = x + y;
      return {
        prompt: `${fmtN(x)} + ${fmtN(y)} = ?`, say: `What is ${fmtN(x)} plus ${fmtN(y)}?`, autoSayLevel: 2.2,
        visual: t >= 0.23 ? { html: S.vertMathHTML(fmtN(x), fmtN(y), '+') } : null,
        options: numItem(rng, s, [noCarrySum(x, y), s + 10, s - 10, s + 1, s + 100, s - 1], 4, { min: 0 }),
        why: 'Line up the places. Add the ones, then the tens, then the hundreds. Carry a 1 when a place makes 10 or more.', key: `na${x}+${y}`,
      };
    },
  },
  {
    id: 'nbt.sub', strand: 'nbt', name: 'Subtract multi-digit numbers', lo: 1.5, hi: 4.4,
    gen(b, rng) {
      const t = lerpT(b, 1.5, 4.4);
      let x, y;
      if (t < 0.1) [x, y] = pairSub(rng, 2, 1, false);
      else if (t < 0.22) [x, y] = pairSub(rng, 2, 2, false);
      else if (t < 0.38) [x, y] = pairSub(rng, 2, int(rng, 1, 2), true);
      else if (t < 0.52) [x, y] = pairSub(rng, 3, int(rng, 2, 3), false);
      else if (t < 0.7) [x, y] = pairSub(rng, 3, 3, true);
      else if (t < 0.85) [x, y] = pairSub(rng, 4, int(rng, 3, 4), true);
      else [x, y] = pairSub(rng, int(rng, 5, 6), int(rng, 4, 5), true);
      const d = x - y;
      return {
        prompt: `${fmtN(x)} ${MINUS} ${fmtN(y)} = ?`, say: `What is ${fmtN(x)} minus ${fmtN(y)}?`, autoSayLevel: 2.2,
        visual: t >= 0.22 ? { html: S.vertMathHTML(fmtN(x), fmtN(y), MINUS) } : null,
        options: numItem(rng, d, [smallFromLarge(x, y), d + 10, d - 10, d + 1, d + 100, x + y], 4, { min: 0 }),
        why: 'Line up the places and start with the ones. If the top digit is smaller, regroup: borrow 1 from the next place.', key: `ns${x}-${y}`,
      };
    },
  },
  {
    id: 'nbt.tenmore', strand: 'nbt', name: '10 more, 10 less', lo: 1.5, hi: 2.5,
    gen(b, rng) {
      const t = lerpT(b, 1.5, 2.5);
      const hundred = t > 0.5;
      const n = hundred ? int(rng, 120, 880) : int(rng, 12, 88);
      const step = hundred ? 100 : 10, more = chance(rng, 0.55), ans = more ? n + step : n - step;
      return {
        prompt: `What is ${step} ${more ? 'more' : 'less'} than ${n}?`, say: `What is ${step} ${more ? 'more' : 'less'} than ${n}?`,
        options: numItem(rng, ans, [n + (more ? 1 : -1), more ? n - step : n + step, n + (more ? step / 10 : -step / 10), ans + 1], 4, { min: 0 }),
        why: `Only the ${hundred ? 'hundreds' : 'tens'} digit changes: ${n} → ${ans}.`, key: `tm${n}${more}${step}`,
      };
    },
  },
  {
    id: 'nbt.expanded', strand: 'nbt', name: 'Expanded form', lo: 1.8, hi: 3.0,
    gen(b, rng) {
      const h = int(rng, 1, 9), tt = int(rng, 1, 9), o = int(rng, 1, 9);
      const n = h * 100 + tt * 10 + o;
      if (chance(rng, 0.5)) {
        return {
          prompt: `${h * 100} + ${tt * 10} + ${o} = ?`, say: `What number is ${h * 100} plus ${tt * 10} plus ${o}?`,
          options: numItem(rng, n, [h * 1000 + tt * 100 + o, o * 100 + tt * 10 + h, h * 100 + o * 10 + tt, h + tt + o], 4, { min: 1 }),
          why: `${h} hundreds, ${tt} tens and ${o} ones make ${n}.`, key: `ex${n}`,
        };
      }
      const right = `${h * 100} + ${tt * 10} + ${o}`;
      return {
        prompt: `Which shows ${n} in expanded form?`, say: `Which shows ${n} in expanded form?`,
        options: [{ label: right }, { label: `${h} + ${tt} + ${o}` }, { label: `${h * 100} + ${tt} + ${o}` }, { label: `${h * 10} + ${tt * 10} + ${o}` }],
        why: `${n} = ${right}.`, key: `ef${n}`,
      };
    },
  },
  {
    id: 'nbt.round', strand: 'nbt', name: 'Rounding', lo: 2.9, hi: 4.0,
    gen(b, rng) {
      const t = lerpT(b, 2.9, 4.0);
      const to = t < 0.35 ? 10 : t < 0.7 ? 100 : 1000;
      let n = to === 10 ? int(rng, 12, 98) : to === 100 ? int(rng, 110, 990) : int(rng, 1100, 9900);
      if (n % to === 0) n += Math.floor(to / 3);
      const ans = Math.round(n / to) * to;
      const other = ans > n ? ans - to : ans + to;
      const vis = to <= 100 && t < 0.6 ? { svg: S.numberLineSVG({ min: 0, max: 1, div: 10, labels: 'none', points: [{ v: (n % to) / to, label: String(n) }], tickLabelFn: (v, i) => (i === 0 ? String(Math.floor(n / to) * to) : i === 10 ? String(Math.floor(n / to) * to + to) : null) }) } : null;
      return {
        prompt: `Round ${fmtN(n)} to the nearest ${to}.`, say: `Round ${fmtN(n)} to the nearest ${to === 1000 ? 'thousand' : to === 100 ? 'hundred' : 'ten'}.`, visual: vis,
        options: numItem(rng, ans, [other, Math.round(n / (to * 10)) * to * 10 || n + to, Math.floor(n / (to / 10 || 1)) * (to / 10 || 1), ans + to], 4, { min: 0 }),
        why: `${fmtN(n)} is closer to ${fmtN(ans)} than to ${fmtN(other)}.`, key: `rd${n}-${to}`,
      };
    },
  },
  {
    id: 'nbt.mult', strand: 'nbt', name: 'Multi-digit multiplication', lo: 3.8, hi: 4.8,
    gen(b, rng) {
      const t = lerpT(b, 3.8, 4.8);
      let x, y;
      if (t < 0.3) { x = int(rng, 2, 9); y = int(rng, 11, 19); }
      else if (t < 0.55) { x = int(rng, 3, 9); y = int(rng, 21, 99); }
      else if (t < 0.8) { x = int(rng, 3, 9); y = int(rng, 102, 999); }
      else { x = int(rng, 11, 49); y = int(rng, 11, 49); }
      const p = x * y, tens = Math.floor(y / 10) * 10, ones = y % 10;
      const vis = t < 0.3 ? { html: `<div class="gridmult"><div class="gm" style="--c:${tens}">${x} × ${tens} = ${x * tens}</div><div class="gm o" style="--c:${ones}">${x} × ${ones} = ${x * ones}</div></div>` } : null;
      return {
        prompt: `${fmtN(x)} × ${fmtN(y)} = ?`, say: `What is ${fmtN(x)} times ${fmtN(y)}?`, autoSayLevel: 4, visual: vis,
        options: numItem(rng, p, [x * tens + ones, x * tens, p + 10, p - x, p + x * 10], 4, { min: 1 }),
        why: x < 10 ? `${x} × ${tens} = ${x * tens} and ${x} × ${ones} = ${x * ones}. Add them: ${p}.` : `Break it apart: ${x} × ${tens} + ${x} × ${ones} = ${p}.`, key: `mm${x}x${y}`,
      };
    },
  },
  {
    id: 'nbt.div', strand: 'nbt', name: 'Long division', lo: 4.2, hi: 5.0,
    gen(b, rng) {
      const t = lerpT(b, 4.2, 5.0);
      const d = int(rng, 2, 9), q = int(rng, 12, t < 0.5 ? 40 : 120), r = t < 0.5 ? 0 : int(rng, 1, d - 1), n = d * q + r;
      const lab = (qq, rr) => (rr ? `${qq} R${rr}` : String(qq));
      const opts = [lab(q, r), lab(q + 1, r), lab(q - 1, r + (r ? 0 : 1)), lab(q, (r + 1) % d || 1), lab(q + 10, r)];
      return {
        prompt: `${n} ÷ ${d} = ?`, say: `What is ${n} divided by ${d}?`, autoSayLevel: 4,
        options: [...new Set(opts)].slice(0, 4).map((l) => ({ label: l })),
        why: `${d} × ${q} = ${d * q}${r ? `, and ${r} is left over` : ''}. So ${n} ÷ ${d} = ${lab(q, r)}.`, key: `ld${n}/${d}`,
      };
    },
  },
];

// ================================================================== FRACTIONS
const nf = [
  {
    id: 'nf.equalparts', strand: 'nf', name: 'Equal parts (halves, fourths, thirds)', lo: 1.0, hi: 2.4,
    gen(b, rng) {
      const t = lerpT(b, 1.0, 2.4);
      const n = t < 0.4 ? 2 : t < 0.7 ? 4 : 3;
      const word = { 2: 'halves', 3: 'thirds', 4: 'fourths' }[n];
      const shape = pick(rng, n === 3 ? ['rect', 'circle'] : ['rect', 'circle']);
      const col = randColor(rng);
      const unequal = { 2: [[1, 2], [2, 3]], 3: [[1, 1, 2], [1, 2, 3]], 4: [[1, 1, 1, 2], [1, 2, 2, 3]] }[n];
      const others = [{ parts: pick(rng, unequal) }, { parts: n === 2 ? 3 : n === 3 ? 4 : 3 }, { parts: n === 2 ? 4 : 2 }];
      return {
        prompt: `Which shape shows ${word}?`, say: `Which shape is cut into ${word}, ${n} equal parts?`,
        options: [{ label: '', svg: S.fractionSVG({ shape, parts: n, shaded: 0, color: col }) }, ...others.slice(0, 3).map((o) => ({ label: '', svg: S.fractionSVG({ shape, parts: o.parts, shaded: 0, color: col }) }))],
        why: `${word[0].toUpperCase() + word.slice(1)} means ${n} parts that are all the same size.`, key: `eq${n}${shape}`,
      };
    },
  },
  {
    id: 'nf.name', strand: 'nf', name: 'Name the fraction', lo: 2.2, hi: 3.4,
    gen(b, rng) {
      const t = lerpT(b, 2.2, 3.4);
      const n = pick(rng, t < 0.5 ? [2, 3, 4] : [3, 4, 6, 8]), k = t < 0.5 ? 1 : int(rng, 1, n - 1);
      const shape = pick(rng, ['rect', 'circle', 'bar']);
      const opts = [frac(k, n), frac(n - k === k ? (k + 1) % n || 1 : n - k, n), frac(k, n + 1 === 5 ? 6 : n + 1), frac(Math.max(1, n - k), Math.max(2, k === n - k ? n + 2 : n))];
      if (k !== n - k && n - k > 0) opts.push(frac(k, n - k));
      const seen = new Set(); const uniq = opts.filter((o) => (seen.has(o.label) ? false : seen.add(o.label)));
      return {
        prompt: 'What fraction is shaded?', say: 'What fraction of the shape is shaded?', visual: { svg: S.fractionSVG({ shape, parts: n, shaded: k, color: randColor(rng) }) },
        options: uniq.slice(0, 4), why: `${k} of the ${n} equal parts ${k === 1 ? 'is' : 'are'} shaded: ${k}/${n}.`, key: `fn${k}/${n}${shape}`,
      };
    },
  },
  {
    id: 'nf.numberline', strand: 'nf', name: 'Fractions on a number line', lo: 3.0, hi: 3.8,
    gen(b, rng) {
      const t = lerpT(b, 3.0, 3.8);
      const n = pick(rng, [2, 3, 4, 6, 8]), k = t < 0.45 ? 1 : int(rng, 1, n - 1);
      const opts = [frac(k, n), frac(k, n + 1), frac(Math.min(k + 1, n), n === k + 1 ? n + 1 : n), frac(n - k === k ? k + 1 : n - k, n)];
      const seen = new Set(); const uniq = opts.filter((o) => (seen.has(o.label) || o.frac[0] === 0 ? false : seen.add(o.label)));
      while (uniq.length < 3) { const extra = frac(1, uniq.length + 6); if (!seen.has(extra.label)) { seen.add(extra.label); uniq.push(extra); } }
      return {
        prompt: 'What fraction is at the dot?', say: 'What fraction is at the dot on the number line?',
        visual: { svg: S.numberLineSVG({ min: 0, max: 1, div: n, labels: 'whole', points: [{ v: k / n }] }) },
        options: uniq.slice(0, 4), why: `From 0 to 1 is cut into ${n} equal parts. The dot is ${k} part${k > 1 ? 's' : ''} from 0: ${k}/${n}.`, key: `fl${k}/${n}`,
      };
    },
  },
  {
    id: 'nf.equiv', strand: 'nf', name: 'Equivalent fractions', lo: 3.2, hi: 4.2,
    gen(b, rng) {
      const t = lerpT(b, 3.2, 4.2);
      const base = pick(rng, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]);
      const m = pick(rng, [2, 3, 4].filter((x) => base[1] * x <= 12));
      const [n0, d0] = base, n1 = n0 * m, d1 = d0 * m;
      if (t < 0.6) {
        const wrong = [frac(n0 + 1 < d0 ? n0 + 1 : n0, d1), frac(n1 + 1 < d1 ? n1 + 1 : n1 - 1, d1), frac(n0, d0 + 1), frac(n1, d0 + m)];
        const seen = new Set([`${n1}/${d1}`]);
        const ws = wrong.filter((w) => w.frac[0] > 0 && Math.abs(w.value - n0 / d0) > 1e-9 && !seen.has(w.label) && seen.add(w.label));
        return {
          prompt: `Which fraction is equal to ${n0}/${d0}?`, say: `Which fraction is equal to ${fracSay(n0, d0)}?`,
          visual: t < 0.35 ? { svg: S.stripsSVG([{ n: d0, k: n0, color: S.PAL[0] }, { n: d1, k: n1, color: S.PAL[4] }]) } : null,
          options: [frac(n1, d1), ...ws.slice(0, 3)], why: `${n0}/${d0} = ${n1}/${d1}: multiply the top and bottom by ${m}.`, key: `qe${n0}/${d0}=${n1}/${d1}`,
        };
      }
      return {
        prompt: `${n0}/${d0} = ?/${d1}`, say: `${fracSay(n0, d0)} equals how many ${FRAC_WORDS[d1]?.[1] ?? 'parts'}?`,
        options: numItem(rng, n1, [n0, n1 + 1, d1 - n1, n1 - 1, d0], 4, { min: 1 }), why: `Multiply the top and bottom by ${m}: ${n0} × ${m} = ${n1}.`, key: `qm${n0}/${d0}=${n1}/${d1}`,
      };
    },
  },
  {
    id: 'nf.compare', strand: 'nf', name: 'Compare fractions', lo: 3.3, hi: 4.5,
    gen(b, rng) {
      const t = lerpT(b, 3.3, 4.5);
      let a, c, why;
      if (t < 0.3) { const d = pick(rng, [3, 4, 5, 6, 8]); const [x, y] = sample(rng, Array.from({ length: d - 1 }, (_, i) => i + 1), 2); a = [x, d]; c = [y, d]; why = 'Same size parts, so more parts is greater.'; }
      else if (t < 0.55) { const nn = int(rng, 1, 3); const [x, y] = sample(rng, [3, 4, 5, 6, 8].filter((d) => d > nn), 2); a = [nn, x]; c = [nn, y]; why = 'Same number of parts, so the bigger parts (smaller bottom number) is greater.'; }
      else if (t < 0.8) {
        const big = pick(rng, [[3, 4], [2, 3], [5, 6], [4, 5], [5, 8], [3, 5]]), small = pick(rng, [[1, 3], [1, 4], [2, 5], [3, 8], [1, 6], [2, 6]]);
        const ans = frac(...big), others = [frac(...small), frac(...pick(rng, [[1, 5], [2, 8], [1, 8]])), frac(1, 4)];
        const seen = new Set([ans.label]); const o2 = others.filter((o) => !seen.has(o.label) && seen.add(o.label));
        return { prompt: 'Which fraction is greater than 1/2?', say: 'Which fraction is greater than one half?', options: [ans, ...o2.slice(0, 3)], why: `${ans.label} is more than half: its top number is more than half of its bottom number.`, key: `cb${ans.label}` };
      } else { const pairs = [[[2, 3], [3, 4]], [[3, 5], [1, 2]], [[5, 6], [3, 4]], [[2, 5], [1, 3]], [[3, 8], [1, 4]], [[4, 6], [3, 4]]]; [a, c] = shuffle(rng, pick(rng, pairs)); why = 'Make the bottom numbers the same, then compare the tops.'; }
      const ga = a[0] / a[1] > c[0] / c[1] ? a : c, le = ga === a ? c : a;
      const less = chance(rng, 0.3);
      const ans = less ? le : ga, other = less ? ga : le;
      return { prompt: `Which fraction is ${less ? 'less' : 'greater'}?`, say: `Which fraction is ${less ? 'less' : 'greater'}: ${fracSay(...a)} or ${fracSay(...c)}?`, options: [frac(...ans), frac(...other)], why, key: `fc${a}${c}${less}`, a: 1.8 };
    },
  },
  {
    id: 'nf.add', strand: 'nf', name: 'Add and subtract fractions', lo: 4.0, hi: 4.9,
    gen(b, rng) {
      const t = lerpT(b, 4.0, 4.9);
      const d = pick(rng, [4, 5, 6, 8, 10, 12]);
      if (t < 0.5) {
        const sub = chance(rng, 0.4);
        let x = int(rng, 1, d - 2), y = int(rng, 1, d - 1 - x);
        if (sub) { const s = x + y; x = s; }
        const r = sub ? x - y : x + y;
        if (r <= 0) return this.gen(b, rng);
        const opts = [frac(r, d), frac(r, sub ? 0 || d : d * 2), frac(r + 1, d), frac(Math.max(1, r - 1), d)].filter((o) => o.frac[1] > 0);
        const seen = new Set(); const u = opts.filter((o) => !seen.has(o.label) && seen.add(o.label));
        return { prompt: `${x}/${d} ${sub ? MINUS : '+'} ${y}/${d} = ?`, say: `What is ${fracSay(x, d)} ${sub ? 'minus' : 'plus'} ${fracSay(y, d)}?`, autoSayLevel: 5, options: u.slice(0, 4), why: `Keep the bottom number. ${x} ${sub ? MINUS : '+'} ${y} = ${r}, so ${r}/${d}.`, key: `fa${x}${sub}${y}/${d}` };
      }
      const w = int(rng, 2, 6), n = int(rng, 1, d - 1), p = w * n;
      return { prompt: `${w} × ${n}/${d} = ?`, say: `What is ${w} times ${fracSay(n, d)}?`, autoSayLevel: 5, options: [frac(p, d), frac(p, d * w), frac(n, d * w), frac(w + n, d)].filter((o, i, arr) => arr.findIndex((z) => z.label === o.label) === i), why: `${w} groups of ${n}/${d} is ${p}/${d}.`, key: `fw${w}x${n}/${d}` };
    },
  },
  {
    id: 'nf.decimal', strand: 'nf', name: 'Decimals', lo: 4.2, hi: 5.0,
    gen(b, rng) {
      const t = lerpT(b, 4.2, 5.0);
      if (t < 0.5) {
        const k = int(rng, 1, 9);
        return { prompt: `Which decimal equals ${k}/10?`, say: `Which decimal equals ${fracSay(k, 10)}?`, options: [{ label: `0.${k}` }, { label: `0.0${k}` }, { label: `${k}.10` }, { label: `${k}.0` }], why: `${k} tenths is written 0.${k}.`, key: `dc${k}` };
      }
      const a = int(rng, 11, 89) / 100, c = int(rng, 1, 9) / 10;
      if (Math.abs(a - c) < 0.001) return this.gen(b, rng);
      const ans = a > c ? a : c, other = a > c ? c : a;
      return { prompt: 'Which decimal is greater?', say: `Which decimal is greater: ${a} or ${c}?`, options: [{ label: String(ans) }, { label: String(other) }], why: `Compare tenths first: ${ans.toFixed(2)} > ${other.toFixed(2)}.`, key: `dg${a}${c}`, a: 1.8 };
    },
  },
];

// ================================================================== MEASUREMENT & DATA
const time = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
const nh = (h, d) => ((h - 1 + d + 12) % 12) + 1;
const md = [
  {
    id: 'md.compare', strand: 'md', name: 'Compare size and length', lo: -0.9, hi: 0.4,
    gen(b, rng) {
      const t = lerpT(b, -0.9, 0.4);
      if (t < 0.4) {
        const pairs = [['🐘', '🐭', 'bigger', 'The elephant is much bigger than the mouse.'], ['🐳', '🐟', 'bigger', 'The whale is bigger.'], ['🦒', '🐢', 'taller', 'The giraffe is taller.'], ['🏠', '🐕', 'bigger', 'The house is bigger.'], ['🐭', '🐻', 'smaller', 'The mouse is smaller.'], ['🐜', '🐄', 'smaller', 'The ant is smaller.']];
        const [big, small, word, why] = pick(rng, pairs);
        const ans = word === 'smaller' ? big : big;
        return { prompt: `Which one is ${word}?`, say: `Which one is ${word}?`, options: [{ label: '', emoji: ans }, { label: '', emoji: small }], why, key: `sz${big}${small}` };
      }
      const max = 8, lens = sample(rng, [2, 3, 4, 5, 6, 7, 8], 3);
      const kind = pick(rng, ['pencil', 'crayon', 'ribbon', 'worm']);
      const longest = chance(rng, 0.6);
      const ans = longest ? Math.max(...lens) : Math.min(...lens);
      return {
        prompt: `Which ${kind} is the ${longest ? 'longest' : 'shortest'}?`, say: `Which ${kind} is the ${longest ? 'longest' : 'shortest'}?`,
        options: [ans, ...lens.filter((l) => l !== ans)].map((l) => ({ label: '', svg: S.lengthSVG(l, max, kind), value: l })),
        why: `Line them up at one end and look at the other end.`, key: `ln${lens.join()}${longest}`,
      };
    },
  },
  {
    id: 'md.sort', strand: 'md', name: 'Sort and classify', lo: -0.7, hi: 0.3,
    gen(b, rng) {
      const cats = [
        ['fruit', ['🍎', '🍌', '🍇', '🍓', '🍐', '🍊', '🍉']], ['animals', ['🐶', '🐱', '🐮', '🐷', '🐸', '🐵', '🐰']], ['things that go', ['🚗', '🚌', '🚲', '🚂', '✈️', '🚀', '🚜']],
        ['clothes', ['👕', '👖', '🧦', '🧢', '👗', '🧤', '👟']], ['sea animals', ['🐟', '🐙', '🦀', '🐬', '🐳', '🦈', '🐠']], ['bugs', ['🐞', '🐝', '🦋', '🐜', '🐛', '🦗', '🕷️']],
      ];
      const [ci, oi] = sample(rng, [0, 1, 2, 3, 4, 5], 2);
      const three = sample(rng, cats[ci][1], 3), odd = pick(rng, cats[oi][1]);
      return { prompt: 'Which one does not belong?', say: 'Which one does not belong?', options: [{ label: '', emoji: odd }, ...three.map((e) => ({ label: '', emoji: e }))], why: `The others are all ${cats[ci][0]}.`, key: `so${odd}${three.join('')}` };
    },
  },
  {
    id: 'md.measure', strand: 'md', name: 'Measure length', lo: 0.8, hi: 2.7,
    gen(b, rng) {
      const t = lerpT(b, 0.8, 2.7);
      const kind = pick(rng, ['pencil', 'crayon', 'ribbon', 'straw']);
      if (t < 0.35) {
        const n = int(rng, 2, 8);
        return { prompt: `How many cubes long is the ${kind}?`, say: `How many cubes long is the ${kind}?`, visual: { svg: S.cubesMeasureSVG({ n, len: n, kind }) }, options: numItem(rng, n, [n + 1, n - 1, n + 2], 4, { min: 1 }), sortOptions: true, why: `Count the cubes under the ${kind}: ${n}.`, key: `mc${n}${kind}` };
      }
      const unit = t < 0.8 ? 'in' : pick(rng, ['in', 'cm']);
      const units = unit === 'in' ? 6 : 10;
      const offset = t < 0.65 ? 0 : int(rng, 1, 3);
      const len = int(rng, 1, units - offset);
      const name = unit === 'in' ? 'inch' : 'centimeter';
      const L = (v) => ({ label: `${v} ${unit}`, say: `${v} ${name}${v === 1 ? '' : 'es'.slice(unit === 'in' ? 0 : 1)}`, value: v });
      const opts = numOpts(rng, len, [len + offset, len + 1, len - 1, offset || len + 2], 4, { min: 1 });
      return {
        prompt: `How long is the ${kind}?`, say: `Use the ruler. How many ${name}${unit === 'in' ? 'es' : 's'} long is the ${kind}?`, visual: { svg: S.rulerSVG({ units, unit, start: offset, end: offset + len, kind }) },
        options: opts.map(L), sortOptions: true,
        why: offset ? `It starts at ${offset} and ends at ${offset + len}: ${offset + len} ${MINUS} ${offset} = ${len}.` : `It starts at 0 and ends at ${len}.`, key: `mr${unit}${offset}-${len}`,
      };
    },
  },
  {
    id: 'md.time', strand: 'md', name: 'Tell time', lo: 0.9, hi: 3.4,
    gen(b, rng) {
      const t = lerpT(b, 0.9, 3.4);
      const h = int(rng, 1, 12);
      let m, cands;
      if (t < 0.12) { m = 0; cands = [time(nh(h, 1), 0), time(nh(h, -1), 0), time(12, h * 5 % 60)]; }
      else if (t < 0.28) { m = 30; cands = [time(nh(h, 1), 30), time(h, 0), time(6, (h * 5) % 60)]; }
      else if (t < 0.48) { m = pick(rng, [15, 45]); cands = [time(h, m === 15 ? 45 : 15), time(h, m / 5), time(nh(h, 1), m)]; }
      else if (t < 0.68) { m = pick(rng, [5, 10, 20, 25, 35, 40, 50, 55]); cands = [time(h, m / 5), time(h, (m + 5) % 60), time(nh(h, 1), m), time(h, Math.abs(m - 5))]; }
      else { m = int(rng, 1, 59); if (m % 5 === 0) m += 2; cands = [time(h, (m + 1) % 60), time(h, Math.max(0, m - 1)), time(nh(h, 1), m), time(h, (m + 5) % 60)]; }
      const ans = time(h, m);
      const uniq = [...new Set(cands)].filter((c) => c !== ans);
      if (t > 0.3 && chance(rng, 0.3)) {
        const parse = (s) => s.split(':').map(Number);
        return { prompt: `Which clock shows ${ans}?`, say: `Which clock shows ${ans}?`, options: [ans, ...uniq.slice(0, 2)].map((s) => ({ label: '', svg: S.clockSVG(...parse(s)) })), why: `At ${ans} the short hand is near ${h} and the long hand points to ${m === 0 ? 12 : m / 5 === Math.floor(m / 5) ? m / 5 : 'the minute mark'}.`, key: `ck${ans}` };
      }
      return {
        prompt: 'What time is it?', say: 'What time does the clock show?', visual: { svg: S.clockSVG(h, m) },
        options: [ans, ...uniq.slice(0, 3)].map((s) => ({ label: s })),
        why: m === 0 ? `The long hand is on 12 and the short hand is on ${h}: ${ans}.` : `The short hand shows the hour (${h}). The long hand shows the minutes (${m}).`, key: `tm${ans}`,
      };
    },
  },
  {
    id: 'md.elapsed', strand: 'md', name: 'Elapsed time', lo: 3.2, hi: 4.3,
    gen(b, rng) {
      const t = lerpT(b, 3.2, 4.3);
      const h = int(rng, 1, 10), m = pick(rng, [0, 10, 15, 20, 30, 40, 45]);
      const dur = t < 0.4 ? pick(rng, [15, 30, 45, 60]) : pick(rng, [25, 35, 45, 50, 75, 90, 105]);
      const end = h * 60 + m + dur, eh = nh(Math.floor(end / 60), 0), em = end % 60;
      const ans = time(eh, em);
      const act = pick(rng, ['The movie', 'Soccer practice', 'The art class', 'The bike ride', 'The baking project']);
      const cands = [time(eh, (em + 10) % 60), time(nh(eh, -1), em), time(nh(eh, 1), em), time(h, (m + dur) % 60)];
      return {
        prompt: `${act} starts at ${time(h, m)} and lasts ${dur} minutes. When does it end?`, say: `${act} starts at ${time(h, m)} and lasts ${dur} minutes. What time does it end?`, autoSayLevel: 9,
        visual: { svg: S.clockSVG(h, m) }, options: [ans, ...[...new Set(cands)].filter((c) => c !== ans).slice(0, 3)].map((s) => ({ label: s })),
        why: `${time(h, m)} plus ${dur} minutes is ${ans}.`, key: `el${h}${m}${dur}`,
      };
    },
  },
  {
    id: 'md.money', strand: 'md', name: 'Money', lo: 0.9, hi: 3.6,
    gen(b, rng) {
      const t = lerpT(b, 0.9, 3.6);
      const cents = (c) => (c >= 100 ? `$${(c / 100).toFixed(2)}` : `${c}¢`);
      const csay = (c) => (c >= 100 ? `${Math.floor(c / 100)} dollar${c >= 200 ? 's' : ''} and ${c % 100} cents` : `${c} cents`);
      const C = (c) => ({ label: cents(c), say: csay(c), value: c });
      if (t < 0.15) {
        const types = ['p', 'n', 'd', 'q'];
        if (chance(rng, 0.5)) {
          const ty = pick(rng, types), name = S.COIN_INFO[ty].name;
          return { prompt: `Which coin is a ${name}?`, say: `Which coin is a ${name}?`, options: [ty, ...types.filter((x) => x !== ty)].map((x) => ({ label: '', svg: S.coinsSVG([x], { labeled: false }) })), why: { p: 'A penny is the copper coin.', n: 'A nickel is big and silver, smaller than a quarter.', d: 'A dime is the smallest coin.', q: 'A quarter is the biggest coin.' }[ty], key: `cn${ty}` };
        }
        const ty = pick(rng, types), v = { p: 1, n: 5, d: 10, q: 25 }[ty];
        return { prompt: `How much is a ${S.COIN_INFO[ty].name} worth?`, say: `How much is a ${S.COIN_INFO[ty].name} worth?`, visual: { svg: S.coinsSVG([ty], { labeled: false }) }, options: [C(v), ...[1, 5, 10, 25].filter((x) => x !== v).map(C)], sortOptions: true, why: `A ${S.COIN_INFO[ty].name} is worth ${v} cent${v > 1 ? 's' : ''}.`, key: `cv${ty}` };
      }
      if (t < 0.85) {
        const pool = t < 0.37 ? ['d', 'n', 'p'] : t < 0.6 ? ['q', 'd', 'n', 'p'] : ['q', 'd', 'n', 'p'];
        const k = t < 0.37 ? int(rng, 3, 5) : int(rng, 4, 7);
        let coins = Array.from({ length: k }, () => pick(rng, pool));
        coins.sort((a, c) => 'qdnp'.indexOf(a) - 'qdnp'.indexOf(c));
        let bills = [];
        if (t >= 0.6) bills = Array.from({ length: int(rng, 1, 3) }, () => ({ bill: 1 }));
        const v = coins.reduce((s, c) => s + { p: 1, n: 5, d: 10, q: 25 }[c], 0) + bills.length * 100;
        return { prompt: 'How much money is this?', say: 'How much money is shown?', visual: { svg: S.coinsSVG([...bills, ...coins], { labeled: true }) }, options: numOpts(rng, v, [v + 5, v - 5, v + 10, v - 1, v + 1, v - 10], 4, { min: 1 }).map(C), why: 'Start with the biggest coins and count on.', key: `mc${coins.join('')}${bills.length}` };
      }
      const price = int(rng, 11, 95), paid = 100, ch = paid - price;
      const item = pick(rng, ['a toy car', 'a snack', 'a pencil', 'a sticker book', 'a bouncy ball']);
      return { prompt: `You buy ${item} for ${cents(price)}. You pay $1.00. How much change do you get?`, say: `You buy ${item} for ${price} cents. You pay one dollar. How much change do you get?`, autoSayLevel: 9, options: numOpts(rng, ch, [ch + 10, ch - 10, price, ch + 5], 4, { min: 1 }).map(C), why: `Count up from ${cents(price)} to $1.00: ${ch}¢.`, key: `ch${price}` };
    },
  },
  {
    id: 'md.graph', strand: 'md', name: 'Graphs', lo: 0.7, hi: 3.6,
    gen(b, rng) {
      const t = lerpT(b, 0.7, 3.6);
      const themes = [
        { title: 'Favorite fruit', items: [['🍎', 'apples'], ['🍌', 'bananas'], ['🍇', 'grapes'], ['🍓', 'strawberries']], unit: 'kids' },
        { title: 'Pets in our class', items: [['🐶', 'dogs'], ['🐱', 'cats'], ['🐟', 'fish'], ['🐰', 'bunnies']], unit: 'pets' },
        { title: 'Weather this month', items: [['☀️', 'sunny days'], ['🌧️', 'rainy days'], ['☁️', 'cloudy days'], ['❄️', 'snowy days']], unit: 'days' },
        { title: 'Bugs we found', items: [['🐞', 'ladybugs'], ['🐜', 'ants'], ['🦋', 'butterflies'], ['🐝', 'bees']], unit: 'bugs' },
      ];
      const th = pick(rng, themes);
      const k = t < 0.3 ? 3 : 4;
      const scale = t < 0.7 ? 1 : pick(rng, [2, 5]);
      const maxV = t < 0.3 ? 6 : 10;
      const cats = th.items.slice(0, k);
      let vals;
      do { vals = cats.map(() => int(rng, 1, maxV) * scale); } while (new Set(vals).size < k);
      const rows = cats.map(([e], i) => ({ emoji: e, value: vals[i], icon: t < 0.3 ? e : '⭐' }));
      const visual = t < 0.3 || (t >= 0.7 && chance(rng, 0.5))
        ? { html: S.picGraphHTML({ rows: rows.map((r) => ({ ...r, icon: t < 0.3 ? r.emoji : '🟦' })), key: scale, keyEmoji: '🟦' }) }
        : { svg: S.barGraphSVG({ bars: rows, max: Math.max(...vals) + scale, step: scale, title: th.title }) };
      let i = int(rng, 0, k - 1);
      let j = (i + int(rng, 1, k - 1)) % k;
      const q = t < 0.2 ? pick(rng, ['count', 'most']) : t < 0.45 ? pick(rng, ['count', 'most', 'least', 'more']) : pick(rng, ['more', 'total', 'count', 'more']);
      if (q === 'count') return { prompt: `How many ${cats[i][1]}?`, say: `Look at the graph. How many ${cats[i][1]} are there?`, autoSayLevel: 9, visual, options: numItem(rng, vals[i], [...vals.filter((v, x) => x !== i), vals[i] + scale, vals[i] - scale], 4, { min: 0 }), sortOptions: true, why: `The ${cats[i][0]} row shows ${vals[i]}.`, key: `gc${th.title}${vals}${i}` };
      if (q === 'most' || q === 'least') {
        const target = q === 'most' ? Math.max(...vals) : Math.min(...vals), ti = vals.indexOf(target);
        return { prompt: `Which has the ${q}?`, say: `Look at the graph. Which one has the ${q}?`, visual, options: [cats[ti], ...cats.filter((_, x) => x !== ti)].map(([e]) => ({ label: '', emoji: e })), why: `${cats[ti][1][0].toUpperCase() + cats[ti][1].slice(1)}: ${target}. That is the ${q === 'most' ? 'biggest' : 'smallest'} number.`, key: `gm${th.title}${vals}${q}` };
      }
      if (q === 'more') {
        if (vals[i] < vals[j]) [i, j] = [j, i];
        const d = vals[i] - vals[j];
        return { prompt: `How many more ${cats[i][1]} than ${cats[j][1]}?`, say: `How many more ${cats[i][1]} than ${cats[j][1]}?`, autoSayLevel: 9, visual, options: numItem(rng, d, [vals[i], vals[j], vals[i] + vals[j], d + scale, d - scale], 4, { min: 0 }), why: `${vals[i]} ${MINUS} ${vals[j]} = ${d}.`, key: `gd${th.title}${vals}${i}${j}` };
      }
      const s = vals[i] + vals[j];
      return { prompt: `How many ${cats[i][1]} and ${cats[j][1]} in all?`, say: `How many ${cats[i][1]} and ${cats[j][1]} are there in all?`, autoSayLevel: 9, visual, options: numItem(rng, s, [Math.abs(vals[i] - vals[j]), s + scale, s - scale, vals[i]], 4, { min: 0 }), why: `${vals[i]} + ${vals[j]} = ${s}.`, key: `gt${th.title}${vals}${i}${j}` };
    },
  },
  {
    id: 'md.area', strand: 'md', name: 'Area and perimeter', lo: 2.8, hi: 4.2,
    gen(b, rng) {
      const t = lerpT(b, 2.8, 4.2);
      if (t < 0.3) {
        const r = int(rng, 2, 4), c = int(rng, 2, 5);
        const cells = []; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) cells.push([i, j]);
        if (chance(rng, 0.4)) { const extra = int(rng, 1, 3); for (let j = 0; j < extra; j++) cells.push([r, j]); }
        const a = cells.length;
        return { prompt: 'What is the area?', say: 'Each square is one square unit. What is the area of the shape?', visual: { svg: S.gridAreaSVG(cells, { color: randColor(rng) }) }, options: numItem(rng, a, [a + 1, a - 1, a + 2, r + c], 4, { min: 1 }).map((o) => ({ ...o, label: `${o.value} sq units`, say: `${o.value} square units` })), sortOptions: true, why: `Count the squares: ${a}.`, key: `ag${cells.length}${r}${c}` };
      }
      const w = int(rng, 3, 12), h = int(rng, 2, 9);
      if (w === h) return this.gen(b, rng);
      const unit = pick(rng, ['cm', 'm', 'in', 'ft']);
      if (t < 0.62) {
        const a = w * h;
        return { prompt: `What is the area of the rectangle?`, say: `What is the area of a rectangle that is ${w} ${unit} long and ${h} ${unit} wide?`, visual: { svg: S.rectDimSVG(w, h, unit) }, options: numItem(rng, a, [2 * (w + h), w + h, a + w, a - h], 4, { min: 1 }).map((o) => ({ ...o, label: `${o.value} sq ${unit}` })), why: `Area = length × width = ${w} × ${h} = ${a} square ${unit}.`, key: `ar${w}x${h}` };
      }
      if (t < 0.85) {
        const p = 2 * (w + h);
        return { prompt: `What is the perimeter of the rectangle?`, say: `What is the perimeter of a rectangle that is ${w} ${unit} long and ${h} ${unit} wide?`, visual: { svg: S.rectDimSVG(w, h, unit) }, options: numItem(rng, p, [w * h, w + h, 2 * w + h, p + 2], 4, { min: 1 }).map((o) => ({ ...o, label: `${o.value} ${unit}` })), why: `Add all four sides: ${w} + ${h} + ${w} + ${h} = ${p} ${unit}.`, key: `pr${w}x${h}` };
      }
      const a = w * h;
      return { prompt: `A rectangle has an area of ${a} sq ${unit}. One side is ${w} ${unit}. How long is the other side?`, say: `A rectangle has an area of ${a} square ${unit}. One side is ${w} ${unit}. How long is the other side?`, autoSayLevel: 9, options: numItem(rng, h, [a - w, h + 1, h - 1, w], 4, { min: 1 }).map((o) => ({ ...o, label: `${o.value} ${unit}` })), why: `${w} × ? = ${a}, so the other side is ${h} ${unit}.`, key: `ms${w}x${h}` };
    },
  },
  {
    id: 'md.units', strand: 'md', name: 'Units and conversions', lo: 2.2, hi: 4.5,
    gen(b, rng) {
      const t = lerpT(b, 2.2, 4.5);
      if (t < 0.35) {
        const qs = [
          ['How long is a real school bus?', '40 feet', ['40 inches', '40 miles', '4 inches']], ['How long is a pencil?', '7 inches', ['7 feet', '7 miles', '70 feet']],
          ['How tall is a door?', '7 feet', ['7 inches', '7 miles', '70 feet']], ['How far is it across a big city?', '10 miles', ['10 inches', '10 feet', '10 pounds']],
          ['How heavy is a big dog?', '60 pounds', ['60 ounces', '6 ounces', '600 pounds']], ['How much water fits in a bathtub?', '40 gallons', ['40 cups', '4 cups', '40 inches']],
          ['How long does it take to brush your teeth?', '2 minutes', ['2 hours', '2 days', '2 seconds']], ['How long is a soccer game?', '90 minutes', ['90 seconds', '90 hours', '9 seconds']],
          ['How long is a paper clip?', '3 centimeters', ['3 meters', '3 kilometers', '30 meters']], ['How heavy is an apple?', '200 grams', ['200 kilograms', '2 grams', '20 kilograms']],
        ];
        const [q, a, w] = pick(rng, qs);
        return { prompt: q, say: `${q} Pick the best estimate.`, options: [{ label: a }, ...w.map((x) => ({ label: x }))], why: `${a} makes the most sense.`, key: `un${q}` };
      }
      const conv = t < 0.7
        ? [['feet', 'inches', 12], ['yards', 'feet', 3], ['hours', 'minutes', 60], ['minutes', 'seconds', 60], ['weeks', 'days', 7], ['meters', 'centimeters', 100], ['days', 'hours', 24]]
        : [['kilograms', 'grams', 1000], ['kilometers', 'meters', 1000], ['gallons', 'quarts', 4], ['pounds', 'ounces', 16], ['quarts', 'pints', 2], ['liters', 'milliliters', 1000]];
      const [big, small, f] = pick(rng, conv);
      const n = int(rng, 2, t < 0.7 ? 5 : 9), ans = n * f;
      return { prompt: `${n} ${big} = ? ${small}`, say: `${n} ${big} equals how many ${small}?`, autoSayLevel: 9, options: numItem(rng, ans, [n + f, Number.isInteger(ans / 10) ? ans / 10 : n * (f + 1), ans + f, ans - f, n * 10], 4, { min: 1 }), why: `1 ${big.replace(/s$/, '')} = ${f} ${small}, so ${n} ${big} = ${n} × ${f} = ${fmtN(ans)} ${small}.`, key: `cv${n}${big}` };
    },
  },
];

// ================================================================== GEOMETRY
const geo = [
  {
    id: 'geo.match', strand: 'geo', name: 'Match shapes', lo: -1.3, hi: -0.6,
    gen(b, rng) {
      const kinds = shuffle(rng, ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle']);
      const col = randColor(rng);
      return {
        prompt: 'Find the same shape', say: 'Find the shape that is the same as this one.', visual: { svg: S.shapeSVG(kinds[0], { color: col }) },
        options: kinds.slice(0, 3).map((k) => ({ label: '', svg: S.shapeSVG(k, { color: col }) })), why: `They are both ${SHAPE_NAMES[kinds[0]]}s.`, key: `sm${kinds[0]}`,
      };
    },
  },
  {
    id: 'geo.name2d', strand: 'geo', name: 'Name flat shapes', lo: -1.2, hi: 0.8,
    gen(b, rng) {
      const t = lerpT(b, -1.2, 0.8);
      const pool = t < 0.3 ? ['circle', 'square', 'triangle'] : t < 0.6 ? ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart', 'oval'] : ['hexagon', 'rhombus', 'trapezoid', 'pentagon', 'rectangle', 'oval', 'octagon'];
      const near = { square: ['rectangle', 'rhombus'], rectangle: ['square', 'parallelogram'], circle: ['oval'], oval: ['circle'], hexagon: ['pentagon', 'octagon'], pentagon: ['hexagon'], rhombus: ['square', 'kite'], trapezoid: ['parallelogram', 'triangle'], octagon: ['hexagon', 'circle'] };
      const target = pick(rng, pool);
      const n = t < 0.3 ? 3 : 4;
      const dist = shuffle(rng, [...(near[target] || []), ...pool].filter((k, i, a) => k !== target && a.indexOf(k) === i)).slice(0, n - 1);
      return {
        prompt: `Find the ${target}`, say: `Find the ${target}.`, hideSayText: false,
        options: [target, ...dist].map((k) => ({ label: '', svg: S.shapeSVG(k, { color: randColor(rng), rot: t > 0.5 ? pick(rng, [0, 15, -20, 30]) : 0 }) })),
        why: { circle: 'A circle is perfectly round.', square: 'A square has 4 equal sides.', triangle: 'A triangle has 3 sides.', rectangle: 'A rectangle has 4 sides and 4 square corners.', star: 'A star has 5 points.', heart: 'This is a heart.', oval: 'An oval is like a stretched circle.', hexagon: 'A hexagon has 6 sides.', rhombus: 'A rhombus has 4 equal sides, like a tilted square.', trapezoid: 'A trapezoid has 4 sides and one pair of parallel sides.', pentagon: 'A pentagon has 5 sides.', octagon: 'An octagon has 8 sides, like a stop sign.' }[target],
        key: `n2${target}${dist.join()}`,
      };
    },
  },
  {
    id: 'geo.name3d', strand: 'geo', name: 'Name solid shapes', lo: 0.0, hi: 1.3,
    gen(b, rng) {
      const kinds = ['cube', 'sphere', 'cylinder', 'cone', 'pyramid', 'prism'];
      const names = { cube: 'cube', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', pyramid: 'pyramid', prism: 'rectangular prism' };
      const real = { cube: 'like a dice', sphere: 'like a ball', cylinder: 'like a can', cone: 'like an ice cream cone', pyramid: 'with a square bottom and triangle sides', prism: 'like a box' };
      const tgt = pick(rng, kinds);
      const dist = sample(rng, kinds.filter((k) => k !== tgt), 3);
      return { prompt: `Find the ${names[tgt]}`, say: `Find the ${names[tgt]}.`, options: [tgt, ...dist].map((k) => ({ label: '', svg: S.solidSVG(k, randColor(rng)) })), why: `A ${names[tgt]} looks ${real[tgt]}.`, key: `n3${tgt}` };
    },
  },
  {
    id: 'geo.sides', strand: 'geo', name: 'Sides and corners', lo: 0.6, hi: 2.3,
    gen(b, rng) {
      const t = lerpT(b, 0.6, 2.3);
      const kinds = t < 0.5 ? [['triangle', 3], ['square', 4], ['rectangle', 4], ['hexagon', 6], ['pentagon', 5]] : [['poly3', 3], ['poly4', 4], ['poly5', 5], ['poly6', 6], ['octagon', 8], ['trapezoid', 4], ['poly7', 7]];
      const [k, n] = pick(rng, kinds);
      const what = t < 0.5 ? 'sides' : pick(rng, ['sides', 'corners', 'vertices']);
      return {
        prompt: `How many ${what} does this shape have?`, say: `How many ${what} does this shape have?`, visual: { svg: S.shapeSVG(k, { color: randColor(rng), seed: int(rng, 1, 999) }) },
        options: numItem(rng, n, [n + 1, n - 1, n + 2], 4, { min: 3 }), sortOptions: true,
        why: `Count them all the way around: ${n}. A shape has as many ${what === 'sides' ? 'corners' : 'sides'} as ${what}.`, key: `sd${k}${what}`,
      };
    },
  },
  {
    id: 'geo.polygons', strand: 'geo', name: 'Polygons (pentagons, hexagons...)', lo: 1.9, hi: 2.9,
    gen(b, rng) {
      const names = [['triangle', 3], ['quadrilateral', 4], ['pentagon', 5], ['hexagon', 6], ['octagon', 8]];
      const [name, n] = pick(rng, names.slice(1));
      if (chance(rng, 0.5)) {
        const others = sample(rng, names.filter((x) => x[1] !== n), 3);
        return {
          prompt: `Which shape is a ${name}?`, say: `Which shape is a ${name}?`,
          options: [[name, n], ...others].map(([, s]) => ({ label: '', svg: S.shapeSVG(`poly${s}`, { color: randColor(rng), seed: int(rng, 1, 999), rot: int(rng, 0, 40) }) })),
          why: `A ${name} has ${n} sides. Count the sides of each shape.`, key: `pg${name}`,
        };
      }
      return {
        prompt: 'What is the name of this shape?', say: 'What is the name of this shape?', visual: { svg: S.shapeSVG(`poly${n}`, { color: randColor(rng), seed: int(rng, 1, 999) }) },
        options: [name, ...sample(rng, names.filter((x) => x[0] !== name).map((x) => x[0]), 3)].map((l) => ({ label: l })), why: `It has ${n} sides, so it is a ${name}.`, key: `pn${name}`,
      };
    },
  },
  {
    id: 'geo.quads', strand: 'geo', name: 'Quadrilaterals', lo: 2.9, hi: 4.0,
    gen(b, rng) {
      const t = lerpT(b, 2.9, 4.0);
      const defs = { rhombus: '4 equal sides', trapezoid: 'exactly one pair of parallel sides', parallelogram: '2 pairs of parallel sides', square: '4 equal sides and 4 right angles', rectangle: '4 right angles' };
      if (t < 0.6) {
        const tgt = pick(rng, ['rhombus', 'trapezoid', 'parallelogram', 'rectangle']);
        const pool = ['rhombus', 'trapezoid', 'parallelogram', 'rectangle', 'kite', 'triangle', 'pentagon'].filter((k) => k !== tgt && !(tgt === 'parallelogram' && ['rhombus', 'rectangle'].includes(k)));
        return { prompt: `Which shape is a ${tgt}?`, say: `Which shape is a ${tgt}?`, options: [tgt, ...sample(rng, pool, 3)].map((k) => ({ label: '', svg: S.shapeSVG(k, { color: randColor(rng) }) })), why: `A ${tgt} has ${defs[tgt]}.`, key: `qd${tgt}` };
      }
      const qs = [
        ['A square is always a ___.', 'rectangle', ['triangle', 'pentagon', 'circle'], 'A square has 4 right angles, so it is a rectangle too.'],
        ['A square is always a ___.', 'rhombus', ['trapezoid', 'hexagon', 'circle'], 'A square has 4 equal sides, so it is a rhombus too.'],
        ['Which shape is NOT a quadrilateral?', 'pentagon', ['square', 'rhombus', 'trapezoid'], 'A quadrilateral has 4 sides. A pentagon has 5.'],
        ['Which shape always has 4 right angles?', 'rectangle', ['rhombus', 'trapezoid', 'kite'], 'Rectangles (and squares) have 4 right angles.'],
        ['A rhombus always has ___.', '4 equal sides', ['4 right angles', '3 sides', 'no parallel sides'], 'Every rhombus has 4 equal sides.'],
      ];
      const [q, a, w, why] = pick(rng, qs);
      return { prompt: q, say: q.replace('___', 'blank'), autoSayLevel: 9, options: [{ label: a }, ...w.map((x) => ({ label: x }))], why, key: `qq${q}${a}` };
    },
  },
  {
    id: 'geo.symmetry', strand: 'geo', name: 'Lines of symmetry', lo: 3.6, hi: 4.5,
    gen(b, rng) {
      const pairs = [['heart', 'v', ['h', 'd', 'off']], ['triangle', 'v', ['h', 'd', 'off']], ['rectangle', 'h', ['d', 'off', 'd2']], ['star', 'v', ['h', 'off', 'd']], ['pentagon', 'v', ['h', 'off', 'd']]];
      const [k, good, bad] = pick(rng, pairs);
      const col = randColor(rng);
      return { prompt: 'Which shows a line of symmetry?', say: 'Which picture shows a line of symmetry?', options: [good, ...bad].map((l) => ({ label: '', svg: S.symmetrySVG(k, l, col) })), why: 'A line of symmetry cuts a shape into two halves that match exactly when folded.', key: `sy${k}` };
    },
  },
  {
    id: 'geo.angles', strand: 'geo', name: 'Angles', lo: 3.8, hi: 4.7,
    gen(b, rng) {
      const kind = pick(rng, ['right', 'acute', 'obtuse', 'straight']);
      const deg = { right: 90, acute: int(rng, 25, 70), obtuse: int(rng, 110, 160), straight: 180 }[kind];
      return { prompt: 'What kind of angle is this?', say: 'What kind of angle is this?', visual: { svg: S.angleSVG(deg) }, options: [kind, ...['right', 'acute', 'obtuse', 'straight'].filter((k) => k !== kind)].map((l) => ({ label: l })), why: { right: 'A right angle is a square corner (90°).', acute: 'An acute angle is smaller than a right angle.', obtuse: 'An obtuse angle is bigger than a right angle.', straight: 'A straight angle is a straight line (180°).' }[kind], key: `an${kind}${deg}` };
    },
  },
];

export const MATH_SKILLS = [...count, ...oa, ...nbt, ...nf, ...md, ...geo];
