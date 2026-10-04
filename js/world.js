// The block world (SPEC.md, "The block world"): after a match he places the blocks his goals
// earned in a saved grid with sky and ground. Every pictured word in his word book is a kind of
// block, picked from a palette of printed words, and blocks can be moved at any time. Pure:
// placing and moving return a new world.
import { CONFIG } from './config.js';

export const emptyWorld = () => ({ cells: {} });

// The world grows at each word-book milestone: 8 by 6 to start, 16 by 10 at 100 words.
export function worldSize(words, milestones = CONFIG.wordBookMilestones) {
  const grown = milestones.filter(m => words >= m).length;
  return { cols: 8 + 2 * grown, rows: 6 + grown };
}

// The kinds of block he can use: the pictured words in his word book.
export const blockKinds = (C, P) => P.wordBook.filter(k => C.byWord.get(k)?.picture);

export const placedCount = W => Object.keys(W.cells).length;

// Every goal of his season is one block; moving a block costs nothing.
export const blocksLeft = P => Math.max(0, P.seasonGoals - placedCount(P.world));

const key = (x, y) => `${x},${y}`;
const inside = (size, x, y) => x >= 0 && y >= 0 && x < size.cols && y < size.rows;

// Puts a block in an empty cell; returns the world unchanged if it can't go there.
export function place(W, size, x, y, kind) {
  if (!inside(size, x, y) || W.cells[key(x, y)]) return W;
  return { ...W, cells: { ...W.cells, [key(x, y)]: kind } };
}

export function move(W, size, from, to) {
  const kind = W.cells[key(from.x, from.y)];
  if (!kind || !inside(size, to.x, to.y) || W.cells[key(to.x, to.y)]) return W;
  const cells = { ...W.cells };
  delete cells[key(from.x, from.y)];
  cells[key(to.x, to.y)] = kind;
  return { ...W, cells };
}

export const blockAt = (W, x, y) => W.cells[key(x, y)] ?? null;
