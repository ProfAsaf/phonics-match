// Chess rules and the computer opponents (no screen code here).
// Squares use the 0x88 layout: index = rank * 16 + file, where rank 0 is White's first rank and
// file 0 is the a-file. Pieces are small numbers: type (1 pawn ... 6 king) plus 8 for Black.
// Moves are packed into one integer: from | to << 7 | promotion type << 14 | flags << 17.

export const WHITE = 0, BLACK = 8;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const F_CAP = 1, F_DOUBLE = 2, F_EP = 4, F_CASTLE_K = 8, F_CASTLE_Q = 16, F_PROMO = 32;
export const colorOf = (p) => p & 8;
export const typeOf = (p) => p & 7;
export const mFrom = (m) => m & 127;
export const mTo = (m) => (m >> 7) & 127;
export const mPromo = (m) => (m >> 14) & 7;
export const mFlags = (m) => (m >> 17) & 63;
const mk = (from, to, flags = 0, promo = 0) => from | (to << 7) | (promo << 14) | (flags << 17);

export const sqName = (sq) => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
export const sqOf = (name) => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const B_OFF = [17, 15, -17, -15];
const R_OFF = [16, 1, -16, -1];
const K_OFF = [17, 15, -17, -15, 16, 1, -16, -1];
const PROMOS = [QUEEN, ROOK, BISHOP, KNIGHT];
const CHARS = ' PNBRQK  pnbrqk';
const FROM_CHAR = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6, p: 9, n: 10, b: 11, r: 12, q: 13, k: 14 };
// Castling rights (1 White short, 2 White long, 4 Black short, 8 Black long) kept when a move
// starts or ends on a square: moving a king or rook, or capturing a rook, loses the right.
const KEEP = new Array(128).fill(15);
KEEP[0x04] = 12; KEEP[0x07] = 14; KEEP[0x00] = 13; KEEP[0x74] = 3; KEEP[0x77] = 11; KEEP[0x70] = 7;

export class Chess {
  constructor(fen = START_FEN) { this.load(fen); }

  load(fen) {
    const [place, turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = String(fen).trim().split(/\s+/);
    const board = new Array(128).fill(0);
    const kings = [-1, -1];
    let rank = 7, file = 0;
    for (const ch of place) {
      if (ch === '/') { rank--; file = 0; continue; }
      if (ch >= '1' && ch <= '8') { file += +ch; continue; }
      const p = FROM_CHAR[ch];
      if (!p || rank < 0 || file > 7) throw new Error('bad position');
      const sq = rank * 16 + file;
      board[sq] = p;
      if (typeOf(p) === KING) kings[p >> 3] = sq;
      file++;
    }
    if (kings[0] < 0 || kings[1] < 0) throw new Error('bad position');
    this.board = board;
    this.kings = kings;
    this.turn = turn === 'b' ? BLACK : WHITE;
    this.castling = (castle.includes('K') ? 1 : 0) | (castle.includes('Q') ? 2 : 0) | (castle.includes('k') ? 4 : 0) | (castle.includes('q') ? 8 : 0);
    this.ep = ep !== '-' && /^[a-h][36]$/.test(ep) ? sqOf(ep) : -1;
    this.half = +half || 0;
    this.full = +full || 1;
    this.hist = [];
  }

  fen() {
    const c = (this.castling & 1 ? 'K' : '') + (this.castling & 2 ? 'Q' : '') + (this.castling & 4 ? 'k' : '') + (this.castling & 8 ? 'q' : '');
    return `${placement(this.board)} ${this.turn === WHITE ? 'w' : 'b'} ${c || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  }
  // The position without the move counters (for spotting repeated positions).
  key() { return this.fen().split(' ').slice(0, 4).join(' '); }

  // Is square sq attacked by side `by`?
  attacked(sq, by) {
    const b = this.board;
    if (by === WHITE) {
      if (!((sq - 15) & 0x88) && b[sq - 15] === PAWN) return true;
      if (!((sq - 17) & 0x88) && b[sq - 17] === PAWN) return true;
    } else {
      if (!((sq + 15) & 0x88) && b[sq + 15] === (BLACK | PAWN)) return true;
      if (!((sq + 17) & 0x88) && b[sq + 17] === (BLACK | PAWN)) return true;
    }
    const kn = by | KNIGHT, ki = by | KING;
    for (const d of N_OFF) { const s = sq + d; if (!(s & 0x88) && b[s] === kn) return true; }
    for (const d of K_OFF) { const s = sq + d; if (!(s & 0x88) && b[s] === ki) return true; }
    const bi = by | BISHOP, ro = by | ROOK, qu = by | QUEEN;
    for (const d of B_OFF) {
      for (let s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (p) { if (p === bi || p === qu) return true; break; } }
    }
    for (const d of R_OFF) {
      for (let s = sq + d; !(s & 0x88); s += d) { const p = b[s]; if (p) { if (p === ro || p === qu) return true; break; } }
    }
    return false;
  }
  inCheck(side = this.turn) { return this.attacked(this.kings[side >> 3], side ^ 8); }

  // Pseudo-legal moves (may leave the king in check). capturesOnly also keeps promotions.
  gen(out = [], capturesOnly = false) {
    const b = this.board, us = this.turn, them = us ^ 8;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p & 8) !== us) continue;
      const t = p & 7;
      if (t === PAWN) {
        const dir = us === WHITE ? 16 : -16;
        const r = sq >> 4;
        const promoting = r === (us === WHITE ? 6 : 1);
        const one = sq + dir;
        if (!b[one] && (!capturesOnly || promoting)) {
          if (promoting) for (const pr of PROMOS) out.push(mk(sq, one, F_PROMO, pr));
          else {
            out.push(mk(sq, one));
            if (r === (us === WHITE ? 1 : 6) && !b[one + dir]) out.push(mk(sq, one + dir, F_DOUBLE));
          }
        }
        for (const d of us === WHITE ? [15, 17] : [-15, -17]) {
          const to = sq + d;
          if (to & 0x88) continue;
          const q = b[to];
          if (q && (q & 8) === them) {
            if (promoting) for (const pr of PROMOS) out.push(mk(sq, to, F_CAP | F_PROMO, pr));
            else out.push(mk(sq, to, F_CAP));
          } else if (to === this.ep) out.push(mk(sq, to, F_CAP | F_EP));
        }
      } else if (t === KNIGHT || t === KING) {
        for (const d of t === KNIGHT ? N_OFF : K_OFF) {
          const to = sq + d;
          if (to & 0x88) continue;
          const q = b[to];
          if (!q) { if (!capturesOnly) out.push(mk(sq, to)); }
          else if ((q & 8) === them) out.push(mk(sq, to, F_CAP));
        }
        if (t === KING && !capturesOnly) this.genCastles(out, sq, us, them);
      } else {
        for (const d of t === BISHOP ? B_OFF : t === ROOK ? R_OFF : K_OFF) {
          for (let to = sq + d; !(to & 0x88); to += d) {
            const q = b[to];
            if (!q) { if (!capturesOnly) out.push(mk(sq, to)); continue; }
            if ((q & 8) === them) out.push(mk(sq, to, F_CAP));
            break;
          }
        }
      }
    }
    return out;
  }
  genCastles(out, sq, us, them) {
    const b = this.board;
    const home = us === WHITE ? 0x04 : 0x74;
    if (sq !== home || !(this.castling & (us === WHITE ? 3 : 12))) return;
    const rook = us | ROOK;
    if ((this.castling & (us === WHITE ? 1 : 4)) && !b[home + 1] && !b[home + 2] && b[home + 3] === rook
      && !this.attacked(home, them) && !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) out.push(mk(home, home + 2, F_CASTLE_K));
    if ((this.castling & (us === WHITE ? 2 : 8)) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook
      && !this.attacked(home, them) && !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) out.push(mk(home, home - 2, F_CASTLE_Q));
  }

  make(m) {
    const b = this.board, from = mFrom(m), to = mTo(m), fl = mFlags(m), us = this.turn;
    const p = b[from];
    let cap = b[to];
    if (fl & F_EP) { const cs = to + (us === WHITE ? -16 : 16); cap = b[cs]; b[cs] = 0; }
    this.hist.push({ m, cap, castling: this.castling, ep: this.ep, half: this.half });
    b[to] = fl & F_PROMO ? us | mPromo(m) : p;
    b[from] = 0;
    if (fl & F_CASTLE_K) { b[from + 1] = b[from + 3]; b[from + 3] = 0; }
    else if (fl & F_CASTLE_Q) { b[from - 1] = b[from - 4]; b[from - 4] = 0; }
    if ((p & 7) === KING) this.kings[us >> 3] = to;
    this.castling &= KEEP[from] & KEEP[to];
    this.ep = fl & F_DOUBLE ? from + (us === WHITE ? 16 : -16) : -1;
    this.half = (p & 7) === PAWN || cap ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = us ^ 8;
  }
  unmake() {
    const h = this.hist.pop();
    if (!h) return;
    const b = this.board, m = h.m, from = mFrom(m), to = mTo(m), fl = mFlags(m);
    const us = this.turn ^ 8;
    this.turn = us;
    if (us === BLACK) this.full--;
    const p = fl & F_PROMO ? us | PAWN : b[to];
    b[from] = p;
    if (fl & F_EP) { b[to] = 0; b[to + (us === WHITE ? -16 : 16)] = h.cap; }
    else b[to] = h.cap;
    if (fl & F_CASTLE_K) { b[from + 3] = b[from + 1]; b[from + 1] = 0; }
    else if (fl & F_CASTLE_Q) { b[from - 4] = b[from - 1]; b[from - 1] = 0; }
    if ((p & 7) === KING) this.kings[us >> 3] = from;
    this.castling = h.castling;
    this.ep = h.ep;
    this.half = h.half;
  }

  legal() {
    const out = [], us = this.turn;
    for (const m of this.gen([])) {
      this.make(m);
      if (!this.attacked(this.kings[us >> 3], us ^ 8)) out.push(m);
      this.unmake();
    }
    return out;
  }
  perft(depth) {
    if (depth === 0) return 1;
    let n = 0;
    const us = this.turn;
    for (const m of this.gen([])) {
      this.make(m);
      if (!this.attacked(this.kings[us >> 3], us ^ 8)) n += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return n;
  }

  // Neither side can possibly checkmate: bare kings, one minor piece, or bishops all on one colour.
  insufficient() {
    const rest = [];
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (p && (p & 7) !== KING) rest.push([p & 7, ((sq >> 4) + (sq & 7)) & 1]);
    }
    if (!rest.length) return true;
    if (rest.length === 1 && (rest[0][0] === KNIGHT || rest[0][0] === BISHOP)) return true;
    return rest.every(([t]) => t === BISHOP) && rest.every(([, shade]) => shade === rest[0][1]);
  }
  // null while the game goes on; otherwise how it ended. repeats = times this position has occurred.
  outcome(repeats = 1) {
    if (!this.legal().length) return this.inCheck() ? { result: 'checkmate', winner: this.turn ^ 8 } : { result: 'stalemate' };
    if (this.insufficient()) return { result: 'insufficient' };
    if (this.half >= 100) return { result: 'fifty' };
    if (repeats >= 3) return { result: 'repetition' };
    return null;
  }

  // Score in centipawns for the side to move: material, piece placement, and (when one side is
  // far ahead in an endgame) a push to drive the lone king to the edge so the game can finish.
  evaluate() {
    const b = this.board;
    let score = 0, phase = 0, wMat = 0, bMat = 0, kmg = 0, keg = 0;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const t = p & 7;
      if (t === KING) {
        if (p & 8) { kmg -= KMG[1][sq]; keg -= KEG[1][sq]; } else { kmg += KMG[0][sq]; keg += KEG[0][sq]; }
        continue;
      }
      phase += PHASE[t];
      if (p & 8) { score -= PSQ[p][sq]; bMat += VAL[t]; } else { score += PSQ[p][sq]; wMat += VAL[t]; }
    }
    const ph = Math.min(24, phase);
    score += (kmg * ph + keg * (24 - ph)) / 24;
    const diff = wMat - bMat;
    if (ph <= 8 && Math.abs(diff) >= 300) {
      const loser = this.kings[diff > 0 ? 1 : 0], winner = this.kings[diff > 0 ? 0 : 1];
      const lr = loser >> 4, lf = loser & 7;
      const edge = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
      const close = 14 - Math.abs((winner >> 4) - lr) - Math.abs((winner & 7) - lf);
      score += (diff > 0 ? 1 : -1) * (12 * edge + 5 * close);
    }
    return this.turn === WHITE ? score : -score;
  }
}

// The piece-placement part of a FEN (rank 8 first).
function placement(board) {
  let s = '';
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[r * 16 + f];
      if (!p) { empty++; continue; }
      if (empty) { s += empty; empty = 0; }
      s += CHARS[p];
    }
    if (empty) s += empty;
    if (r) s += '/';
  }
  return s;
}

// ---------------------------------------------------------------- free play (for the youngest)
// Any of the child's pieces can go to any square that isn't one of their own; landing on an
// animal's piece catches it. The animal only nudges one of its pieces a single step and never
// catches anything, so there is nothing to lose. Catch all 16 to win. Same shape as Chess where
// the game screen needs it.
export class FreeBoard {
  constructor(saved = null) {
    if (saved && Array.isArray(saved.b) && saved.b.length === 64) {
      this.board = new Array(128).fill(0);
      saved.b.forEach((p, i) => { this.board[(i >> 3) * 16 + (i & 7)] = +p || 0; });
      this.turn = saved.t === 'b' ? BLACK : WHITE;
    } else {
      this.board = new Chess().board.slice();
      this.turn = WHITE;
    }
    this.kings = [-1, -1];
  }
  save() {
    const b = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) b.push(this.board[r * 16 + f]);
    return { b, t: this.turn === WHITE ? 'w' : 'b' };
  }
  fen() { return `${placement(this.board)} ${this.turn === WHITE ? 'w' : 'b'}`; }
  inCheck() { return false; }
  count(side) {
    let n = 0;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (this.board[sq] && (this.board[sq] & 8) === side) n++;
    }
    return n;
  }
  legal() {
    const out = [], b = this.board;
    if (this.turn !== WHITE) return out;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (!b[sq] || (b[sq] & 8)) continue;
      for (let to = 0; to < 120; to++) {
        if (to & 0x88) { to += 7; continue; }
        const q = b[to];
        if (q && !(q & 8)) continue; // one of the child's own pieces (or the piece itself)
        out.push(mk(sq, to, q ? F_CAP : 0));
      }
    }
    return out;
  }
  make(m) { const from = mFrom(m), to = mTo(m); this.board[to] = this.board[from]; this.board[from] = 0; this.turn ^= 8; }
  pass() { this.turn ^= 8; }
  // The animal's turn: one of its pieces steps to an empty square next to it (null if none can).
  animalMove(rng = Math.random) {
    const out = [], b = this.board;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      if (!b[sq] || !(b[sq] & 8)) continue;
      for (const d of K_OFF) { const to = sq + d; if (!(to & 0x88) && !b[to]) out.push(mk(sq, to)); }
    }
    return out.length ? out[Math.floor(rng() * out.length)] : null;
  }
  outcome() { return this.count(BLACK) ? null : { result: 'allcaught', winner: WHITE }; }
}

// ---------------------------------------------------------------- evaluation tables
const VAL = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];
// Piece-square tables as seen from White, rank 8 first (the usual "simplified evaluation" values).
const SRC = {
  [PAWN]: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [KNIGHT]: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [BISHOP]: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [ROOK]: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [QUEEN]: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
};
const KING_MG = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
const KING_EG = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const idxFor = (side, sq) => (side === WHITE ? (7 - (sq >> 4)) * 8 + (sq & 7) : (sq >> 4) * 8 + (sq & 7));
const PSQ = [];
for (const side of [WHITE, BLACK]) {
  for (const t of [PAWN, KNIGHT, BISHOP, ROOK, QUEEN]) {
    const tab = (PSQ[side | t] = new Int16Array(128));
    for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88)) tab[sq] = VAL[t] + SRC[t][idxFor(side, sq)];
  }
}
const KMG = [WHITE, BLACK].map((side) => { const a = new Int16Array(128); for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88)) a[sq] = KING_MG[idxFor(side, sq)]; return a; });
const KEG = [WHITE, BLACK].map((side) => { const a = new Int16Array(128); for (let sq = 0; sq < 128; sq++) if (!(sq & 0x88)) a[sq] = KING_EG[idxFor(side, sq)]; return a; });

// ---------------------------------------------------------------- search
const MATE = 30000;
// Captures first (most valuable victim, cheapest attacker), then promotions, then quiet moves.
function ordered(pos, moves) {
  const b = pos.board;
  const keyed = moves.map((m) => {
    const fl = mFlags(m);
    let k = 0;
    if (fl & F_CAP) k = 1000 + 10 * VAL[fl & F_EP ? PAWN : b[mTo(m)] & 7] - VAL[b[mFrom(m)] & 7] / 100;
    if (fl & F_PROMO) k += 900 + VAL[mPromo(m)] / 10;
    return [k, m];
  });
  keyed.sort((x, y) => y[0] - x[0]);
  return keyed.map((x) => x[1]);
}

class Search {
  constructor(pos, deadline, quiesce) { this.pos = pos; this.deadline = deadline; this.useQ = quiesce; this.nodes = 0; this.stop = false; }
  tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stop = true;
    return this.stop;
  }
  qs(alpha, beta, ply) {
    const pos = this.pos;
    const stand = pos.evaluate();
    if (!this.useQ || ply > 30 || this.tick()) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const us = pos.turn;
    for (const m of ordered(pos, pos.gen([], true))) {
      pos.make(m);
      if (pos.attacked(pos.kings[us >> 3], us ^ 8)) { pos.unmake(); continue; }
      const s = -this.qs(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return alpha;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
  ab(depth, alpha, beta, ply) {
    if (depth <= 0) return this.qs(alpha, beta, ply);
    const pos = this.pos;
    if (this.tick()) return 0;
    const us = pos.turn;
    let best = -MATE, legal = 0;
    for (const m of ordered(pos, pos.gen([]))) {
      pos.make(m);
      if (pos.attacked(pos.kings[us >> 3], us ^ 8)) { pos.unmake(); continue; }
      legal++;
      const s = -this.ab(depth - 1, -beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stop) return 0;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    if (!legal) return pos.inCheck() ? -MATE + ply : 0;
    return best;
  }
}

// The animals, weakest first. depth = how many moves ahead they look; noise = how much they
// wobble between good moves (centipawns); blunder = chance of a careless random move.
export const OPPONENTS = [
  { id: 'chick', name: 'Chick', emoji: '🐣', blurb: 'Just learning the moves', level: 1, depth: 0, grab: 0.5 },
  { id: 'turtle', name: 'Turtle', emoji: '🐢', blurb: 'Grabs any piece it can', level: 2, depth: 1, q: false, noise: 60, blunder: 0.25 },
  { id: 'fox', name: 'Fox', emoji: '🦊', blurb: 'Watches out for traps', level: 3, depth: 2, noise: 40, blunder: 0.1 },
  { id: 'owl', name: 'Owl', emoji: '🦉', blurb: 'Thinks a few moves ahead', level: 4, depth: 3, noise: 20, blunder: 0.03, ms: 1200 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', blurb: 'Very tough!', level: 5, depth: 4, noise: 6, blunder: 0, ms: 1200 },
];

// Pick a move for the side to play. seen: positions already reached this game (avoided when
// winning, so a won game doesn't end in a draw by repetition).
export function chooseMove(pos, opp, { rng = Math.random, seen = null } = {}) {
  const legal = pos.legal();
  if (legal.length <= 1) return legal[0] ?? null;
  const anyMove = () => legal[Math.floor(rng() * legal.length)];
  if (!opp.depth) {
    const caps = legal.filter((m) => mFlags(m) & F_CAP);
    return caps.length && rng() < (opp.grab || 0) ? ordered(pos, caps)[0] : anyMove();
  }
  if (rng() < (opp.blunder || 0)) return anyMove();
  const noise = opp.noise || 0, margin = 2 * noise + 1;
  const S = new Search(pos, Date.now() + (opp.ms || 1500), opp.q !== false);
  let order = ordered(pos, legal), done = null;
  for (let d = 1; d <= opp.depth; d++) {
    let best = -Infinity;
    const res = [];
    for (const m of order) {
      pos.make(m);
      const alpha = best === -Infinity ? -MATE - 1 : best - margin;
      // the first pass also spots a mate or stalemate straight away (even the one-move-deep Turtle)
      let s = d === 1 && !pos.legal().length ? (pos.inCheck() ? MATE - 1 : 0) : -S.ab(d - 1, -MATE - 1, -alpha, 1);
      if (seen && s > 50 && seen.has(pos.key())) s -= 60;
      pos.unmake();
      if (S.stop) break;
      res.push([m, s]);
      if (s > best) best = s;
    }
    if (S.stop && done) break;
    res.sort((x, y) => y[1] - x[1]);
    done = res.length ? res : done;
    order = res.map((x) => x[0]);
    if (S.stop) break;
  }
  if (!done) return order[0];
  const top = done[0][1];
  let pick = done[0][0], bv = -Infinity;
  for (const [m, s] of done) {
    if (s < top - margin) break;
    const v = s + (rng() * 2 - 1) * noise;
    if (v > bv) { bv = v; pick = m; }
  }
  return pick;
}
