// The ability model: for each child and strand (e.g. "Fractions", "Phonemic awareness") we keep
// a posterior over their level theta on the grade scale (see scale.js), on a fine grid.
//
// A question has a difficulty b (also on the grade scale). The chance of answering right is
//   P(correct | theta) = c + (1 - c - slip) * sigmoid(a * (theta - b))
// c = chance of guessing (1 / number of options), slip = careless taps, a = how sharply success
// falls off per grade. Each answer multiplies the posterior by that likelihood; between answers
// (and between days) the posterior is blurred a little, so the estimate follows a child who is
// learning instead of averaging over their whole history.

import { G_MIN, G_MAX } from './scale.js';

export const STEP = 0.05;
export const N = Math.round((G_MAX - G_MIN) / STEP) + 1;
export const GRID = Float64Array.from({ length: N }, (_, i) => G_MIN + i * STEP);
export const DEFAULT_A = 2.2;
export const SLIP = 0.05;

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export function prior(mean, sd) {
  const lp = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const z = (GRID[i] - mean) / sd;
    lp[i] = -0.5 * z * z;
  }
  return lp;
}

export function pCorrectAt(theta, b, { a = DEFAULT_A, c = 0, slip = SLIP } = {}) {
  return c + (1 - c - slip) * sigmoid(a * (theta - b));
}

function normalizeLog(lp) {
  let m = -Infinity;
  for (let i = 0; i < N; i++) if (lp[i] > m) m = lp[i];
  for (let i = 0; i < N; i++) lp[i] = Math.max(-60, lp[i] - m);
}

export function observe(lp, b, correct, opts = {}) {
  for (let i = 0; i < N; i++) {
    const p = pCorrectAt(GRID[i], b, opts);
    lp[i] += Math.log(correct ? p : 1 - p);
  }
  normalizeLog(lp);
}

export function toProbs(lp) {
  const p = new Float64Array(N);
  let s = 0;
  for (let i = 0; i < N; i++) { p[i] = Math.exp(lp[i]); s += p[i]; }
  for (let i = 0; i < N; i++) p[i] /= s;
  return p;
}

// Blur the posterior by a Gaussian of this sd (learning / forgetting since the last look).
export function drift(lp, sd) {
  if (!(sd > 0.005)) return;
  const p = toProbs(lp);
  const k = Math.max(1, Math.ceil((3 * sd) / STEP));
  const w = [];
  let ws = 0;
  for (let j = -k; j <= k; j++) { const x = Math.exp(-0.5 * ((j * STEP) / sd) ** 2); w.push(x); ws += x; }
  const q = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (p[i] < 1e-12) continue;
    for (let j = -k; j <= k; j++) {
      const t = Math.min(N - 1, Math.max(0, i + j));
      q[t] += (p[i] * w[j + k]) / ws;
    }
  }
  for (let i = 0; i < N; i++) lp[i] = Math.log(Math.max(q[i], 1e-26));
  normalizeLog(lp);
}

export function summarize(lp) {
  const p = toProbs(lp);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += p[i] * GRID[i];
  let v = 0;
  for (let i = 0; i < N; i++) v += p[i] * (GRID[i] - mean) ** 2;
  const q = (target) => {
    let c = 0;
    for (let i = 0; i < N; i++) { c += p[i]; if (c >= target) return GRID[i]; }
    return GRID[N - 1];
  };
  return { mean, sd: Math.sqrt(v), q10: q(0.1), median: q(0.5), q90: q(0.9) };
}

export function probAbove(lp, x) {
  const p = toProbs(lp);
  let s = 0;
  for (let i = 0; i < N; i++) if (GRID[i] >= x) s += p[i];
  return s;
}

export function probBetween(lp, lo, hi) {
  const p = toProbs(lp);
  let s = 0;
  for (let i = 0; i < N; i++) if (GRID[i] >= lo && GRID[i] <= hi) s += p[i];
  return s;
}

// The difficulty b at which a child with level ~ N(mean, sd) answers right with chance targetP.
export function targetB(mean, sd, targetP, { a = DEFAULT_A, c = 0, slip = SLIP } = {}) {
  const q = Math.min(0.97, Math.max(0.03, (targetP - c) / (1 - c - slip)));
  const aEff = a / Math.sqrt(1 + (Math.PI * a * a * sd * sd) / 8);
  return mean - Math.log(q / (1 - q)) / aEff;
}

// The most informative difficulty in [lo, hi]: the b that minimizes the expected posterior
// variance after one more answer (used by the placement check).
export function bestB(lp, lo, hi, opts = {}) {
  const p = toProbs(lp);
  let best = lo, bestV = Infinity;
  for (let b = lo; b <= hi + 1e-9; b += 0.1) {
    let p1 = 0, m1 = 0, s1 = 0, m0 = 0, s0 = 0;
    for (let i = 0; i < N; i++) {
      if (p[i] < 1e-9) continue;
      const q = pCorrectAt(GRID[i], b, opts), g = GRID[i];
      const w1 = p[i] * q, w0 = p[i] * (1 - q);
      p1 += w1; m1 += w1 * g; s1 += w1 * g * g; m0 += w0 * g; s0 += w0 * g * g;
    }
    const p0 = 1 - p1;
    const v1 = p1 > 1e-9 ? s1 / p1 - (m1 / p1) ** 2 : 0;
    const v0 = p0 > 1e-9 ? s0 / p0 - (m0 / p0) ** 2 : 0;
    const ev = p1 * v1 + p0 * v0;
    if (ev < bestV - 1e-9) { bestV = ev; best = b; }
  }
  return best;
}

// Expected chance of a right answer, averaging over the posterior.
export function expectedP(lp, b, opts) {
  const p = toProbs(lp);
  let s = 0;
  for (let i = 0; i < N; i++) if (p[i] > 1e-9) s += p[i] * pCorrectAt(GRID[i], b, opts);
  return s;
}

// Compact storage: tenths of a nat, relative to the peak.
export const pack = (lp) => Array.from(lp, (x) => Math.max(-600, Math.round(x * 10)));
export function unpack(arr) {
  const lp = new Float64Array(N);
  if (!arr || arr.length !== N) return null;
  for (let i = 0; i < N; i++) lp[i] = arr[i] / 10;
  return lp;
}
