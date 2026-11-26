// Thinks for the computer animals off the main thread, so the screen stays smooth while the
// engine looks ahead (up to about 2 seconds at the top level).
import { Chess, chooseMove } from './chess.js';

self.onmessage = (e) => {
  const { id, fen, params, seen } = e.data || {};
  let m = null;
  try { m = chooseMove(new Chess(fen), params, { seen: new Set(seen || []) }); } catch { m = null; }
  self.postMessage({ id, m });
};
