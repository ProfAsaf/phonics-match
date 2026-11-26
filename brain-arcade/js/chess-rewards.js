// What a child unlocks in Chess (no screen code here):
// - each animal opens up once the child has beaten the one before it (Chick is always open);
// - new board colours come with the stars earned from right answers;
// - Dragon's rating follows the child's results, so it keeps pace as they improve.
import { OPPONENTS, RATING_MIN, RATING_MAX } from './chess.js';

// Dragon starts at 1200. A win moves it up and a loss down; a streak makes the steps bigger
// (60, 90, 135, up to 160) so it catches up quickly with a strong player, and after the first
// few games the base step shrinks to 40 so it settles where the child wins about half the time.
export const DRAGON_START = 1200;
export function dragonAfter(prev, score) {
  const d = { r: DRAGON_START, step: 60, dir: 0, n: 0, hist: [], ...prev };
  const dir = score > 0.5 ? 1 : score < 0.5 ? -1 : 0;
  const base = d.n < 6 ? 60 : 40;
  if (dir) {
    d.step = d.dir === dir ? Math.min(160, Math.round(d.step * 1.5)) : base;
    d.dir = dir;
    d.r = Math.max(RATING_MIN + 100, Math.min(RATING_MAX, d.r + dir * d.step));
  } else { d.step = base; d.dir = 0; }
  d.n++;
  d.hist = [...(d.hist || []).slice(-39), d.r];
  return d;
}

// For the grown-up report: games, wins by animal, and Dragon's rating.
export function chessSummary(state) {
  const rec = state?.rec || {};
  const all = OPPONENTS.map((o) => ({ o, ...{ w: 0, l: 0, d: 0, ...rec[o.id] } }));
  const tot = all.reduce((a, x) => ({ w: a.w + x.w, l: a.l + x.l, d: a.d + x.d }), { w: 0, l: 0, d: 0 });
  return { ...tot, games: tot.w + tot.l + tot.d, animals: all, dragon: state?.dragon || null, freeGames: state?.freeGames || 0 };
}

export const BOARDS = [
  { id: 'wood', name: 'Wood', emoji: '🪵', stars: 0, l: '#f0d9b5', d: '#b58863', frame: '#6f4a2a', bg1: '#fbf3e4', bg2: '#e2cba3' },
  { id: 'ocean', name: 'Ocean', emoji: '🌊', stars: 25, l: '#dff1fb', d: '#5fa8d3', frame: '#1d5c8a', bg1: '#effaff', bg2: '#b5dcf3' },
  { id: 'candy', name: 'Candy', emoji: '🍬', stars: 75, l: '#ffe4f0', d: '#ef8fb9', frame: '#a8336b', bg1: '#fff3f8', bg2: '#f6c6dc' },
  { id: 'forest', name: 'Forest', emoji: '🌲', stars: 150, l: '#e8f4d6', d: '#76a957', frame: '#33602a', bg1: '#f3faea', bg2: '#c8e2b0' },
  { id: 'space', name: 'Space', emoji: '🚀', stars: 250, l: '#d6d0fa', d: '#6553b8', frame: '#1f1754', bg1: '#3a2f80', bg2: '#140f36' },
  { id: 'gold', name: 'Gold', emoji: '👑', stars: 400, l: '#fff3c4', d: '#d4a22a', frame: '#7a5600', bg1: '#fffbe6', bg2: '#f1d78a' },
];

// Is the i-th animal open for a child with this win record ({ chick: { w, l, d }, ... })?
export const isUnlocked = (rec, i) => i <= 0 || (rec?.[OPPONENTS[i - 1]?.id]?.w || 0) > 0;
export const boardsOpen = (stars) => BOARDS.filter((b) => (stars || 0) >= b.stars);
// The board to show: the one picked, if it's open; otherwise the plain wooden one.
export const boardFor = (pickedId, stars) => boardsOpen(stars).find((b) => b.id === pickedId) || BOARDS[0];
