// What a child unlocks in Chess (no screen code here):
// - each animal opens up once the child has beaten the one before it (Chick is always open);
// - new board colours come with the stars earned from right answers.
import { OPPONENTS } from './chess.js';

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
