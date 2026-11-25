// Oral reading fluency: the read-aloud passages and published norms.
// Norms: Hasbrouck & Tindal (2017), words correct per minute at the 50th percentile.
const NORMS = {
  1: { fall: 12, winter: 29, spring: 60 }, // no published fall norm for 1st grade; 12 is a rough placeholder
  2: { fall: 50, winter: 84, spring: 100 },
  3: { fall: 83, winter: 97, spring: 112 },
  4: { fall: 94, winter: 120, spring: 133 },
  5: { fall: 121, winter: 133, spring: 146 },
  6: { fall: 132, winter: 145, spring: 146 },
};
let cache = null;
export async function loadFluency() {
  if (!cache) cache = (await (await fetch('content/fluency.json')).json()).passages;
  return cache;
}
export function seasonOf(date = new Date()) {
  const m = date.getMonth();
  return m >= 7 && m <= 10 ? 'fall' : m === 11 || m <= 1 ? 'winter' : 'spring';
}
// The typical score for a grade at this time of year (on grade-level text).
export function fluencyNorm(grade, date = new Date()) {
  const n = NORMS[Math.max(1, Math.min(6, grade))];
  if (!n || grade < 1) return null;
  const season = seasonOf(date);
  return { season, median: n[season] };
}
// "Reads this passage like a typical student at grade level ..." using the passage's grade norms.
export function fluencyGE(wcpm, passageG) {
  const G = Math.max(1, Math.min(6, Math.floor(passageG)));
  const n = NORMS[G];
  const pts = [[G + 0.15, n.fall], [G + 0.45, n.winter], [G + 0.8, n.spring]];
  if (wcpm <= pts[0][1]) { const slope = (pts[1][1] - pts[0][1]) / 0.3; return Math.max(G - 0.6, pts[0][0] - (pts[0][1] - wcpm) / slope); }
  for (let i = 0; i < 2; i++) if (wcpm <= pts[i + 1][1]) return pts[i][0] + ((wcpm - pts[i][1]) / (pts[i + 1][1] - pts[i][1])) * (pts[i + 1][0] - pts[i][0]);
  const slope = (pts[2][1] - pts[1][1]) / 0.35;
  return Math.min(G + 1.4, pts[2][0] + (wcpm - pts[2][1]) / slope);
}
