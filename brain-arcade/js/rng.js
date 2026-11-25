// Small random helpers. Everything takes an rng function (() => [0,1)) so tests can seed it.

export function seeded(seed = 1) {
  let a = seed >>> 0;
  return function mulberry32() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const chance = (rng, p) => rng() < p;
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sample(rng, arr, k) {
  return shuffle(rng, arr).slice(0, k);
}
// Standard normal (Box-Muller).
export function normal(rng, mean = 0, sd = 1) {
  const u = Math.max(rng(), 1e-12), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
// Weighted pick: items [{w, ...}] or parallel weights.
export function weighted(rng, items, weightOf = (x) => x.w) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightOf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
// Linear interpolation of b within [lo, hi] -> t in [0,1]
export const lerpT = (b, lo, hi) => Math.max(0, Math.min(1, (b - lo) / (hi - lo)));
