// Chess pieces drawn as simple chunky SVGs (the same on every device, unlike font symbols).
// Colours come from app.css: .pw = white pieces, .pb = black pieces; .dt = detail lines.
import { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './chess.js';

const BASE = '<path d="M22 91h56a4 4 0 0 0 4-4v-3a7 7 0 0 0-7-7H25a7 7 0 0 0-7 7v3a4 4 0 0 0 4 4z"/>';
const SHAPES = {
  [PAWN]: '<path d="M32 78c1-12 6-19 12-23h12c6 4 11 11 12 23z"/><circle cx="50" cy="34" r="14"/><rect x="34" y="48" width="32" height="9" rx="4.5"/>' + BASE,
  [ROOK]: '<path d="M30 78l4-32h32l4 32z"/><path d="M26 48V25h12v8h6v-8h12v8h6v-8h12v23z"/><path class="dt" d="M34 58h32"/>' + BASE,
  [BISHOP]: '<path d="M34 78c1-10 5-16 10-20h12c5 4 9 10 10 20z"/><circle cx="50" cy="14" r="5.5"/><path d="M50 19c13 9 19 21 15 29-2 5-8 7-15 7s-13-2-15-7c-4-8 2-20 15-29z"/><rect x="33" y="53" width="34" height="8" rx="4"/><path class="dt" d="M57 29L46 40"/>' + BASE,
  [KNIGHT]: '<path d="M29 78c0-10 6-17 12-23-6 1-11 3-16 1-5-2-7-8-4-12 6-9 14-16 18-24l2-9 7 7c13 3 25 15 27 34 1 9 0 18-3 26z"/><path class="dt" d="M53 26c8 5 14 14 16 25"/><circle class="eye" cx="40" cy="31" r="3.4"/><circle class="eye" cx="24" cy="48" r="1.8"/>' + BASE,
  [QUEEN]: '<circle cx="22" cy="35" r="5"/><circle cx="36.5" cy="26" r="5"/><circle cx="50" cy="22" r="5.5"/><circle cx="63.5" cy="26" r="5"/><circle cx="78" cy="35" r="5"/><path d="M31 78L22 38l11 14 4-22 7 18 6-22 6 22 7-18 4 22 11-14-9 40z"/><path class="dt" d="M30 67c13 4 27 4 40 0"/>' + BASE,
  [KING]: '<path d="M46 9h8v8h8v8h-8v24h-8V25h-8v-8h8z"/><path d="M31 78c-9-15-9-30 4-33 7-2 12 3 15 9 3-6 8-11 15-9 13 3 13 18 4 33z"/><path class="dt" d="M31 67c13 4 25 4 38 0"/>' + BASE,
};

export function pieceSVG(p, cls = '') {
  return `<svg viewBox="0 0 100 100" class="pc ${p & 8 ? 'pb' : 'pw'}${cls ? ' ' + cls : ''}" aria-hidden="true">${SHAPES[p & 7]}</svg>`;
}
