// Chess rules and the computer opponents (no screen code here).
// Squares use the 0x88 layout: index = rank * 16 + file, where rank 0 is White's first rank and
// file 0 is the a-file. Pieces are small numbers: type (1 pawn ... 6 king) plus 8 for Black.
// Moves are packed into one integer: from | to << 7 | promotion type << 14 | flags << 17.
//
// The animals (except Chick, who moves at random) share one engine: an alpha-beta search with
// iterative deepening, a transposition table, null-move pruning, late-move reductions, killer and
// history move ordering, check extensions and a quiescence search, over a hand-written
// evaluation. It plays at a chosen rating (strengthFor) by limiting how deep and how long it
// looks and by choosing among its candidate moves with odds that favour the better ones: the
// same idea as the rated bots on chess sites and the skill levels of the big engines.

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

// Zobrist hashing (two 32-bit halves): a fingerprint of the position, updated move by move, so
// the search can recognise positions it has already looked at.
let seed = 0x2545f491;
const rnd32 = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
const ZP_LO = new Int32Array(16 * 128), ZP_HI = new Int32Array(16 * 128);
for (let i = 0; i < ZP_LO.length; i++) { ZP_LO[i] = rnd32(); ZP_HI[i] = rnd32(); }
const ZC_LO = new Int32Array(16), ZC_HI = new Int32Array(16);
for (let i = 0; i < 16; i++) { ZC_LO[i] = rnd32(); ZC_HI[i] = rnd32(); }
const ZE_LO = new Int32Array(8), ZE_HI = new Int32Array(8);
for (let i = 0; i < 8; i++) { ZE_LO[i] = rnd32(); ZE_HI[i] = rnd32(); }
const ZS_LO = rnd32(), ZS_HI = rnd32();

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
    this.rehash();
  }
  rehash() {
    let lo = 0, hi = 0;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.board[sq];
      if (p) { lo ^= ZP_LO[p * 128 + sq]; hi ^= ZP_HI[p * 128 + sq]; }
    }
    lo ^= ZC_LO[this.castling]; hi ^= ZC_HI[this.castling];
    if (this.ep >= 0) { lo ^= ZE_LO[this.ep & 7]; hi ^= ZE_HI[this.ep & 7]; }
    if (this.turn === BLACK) { lo ^= ZS_LO; hi ^= ZS_HI; }
    this.hlo = lo;
    this.hhi = hi;
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
    let cap = b[to], capSq = to;
    if (fl & F_EP) { capSq = to + (us === WHITE ? -16 : 16); cap = b[capSq]; b[capSq] = 0; }
    this.hist.push({ m, cap, castling: this.castling, ep: this.ep, half: this.half, hlo: this.hlo, hhi: this.hhi });
    let lo = this.hlo ^ ZP_LO[p * 128 + from], hi = this.hhi ^ ZP_HI[p * 128 + from];
    if (cap) { lo ^= ZP_LO[cap * 128 + capSq]; hi ^= ZP_HI[cap * 128 + capSq]; }
    const placed = fl & F_PROMO ? us | mPromo(m) : p;
    b[to] = placed;
    b[from] = 0;
    lo ^= ZP_LO[placed * 128 + to]; hi ^= ZP_HI[placed * 128 + to];
    if (fl & (F_CASTLE_K | F_CASTLE_Q)) {
      const rf = fl & F_CASTLE_K ? from + 3 : from - 4, rt = fl & F_CASTLE_K ? from + 1 : from - 1, r = b[rf];
      b[rt] = r; b[rf] = 0;
      lo ^= ZP_LO[r * 128 + rf] ^ ZP_LO[r * 128 + rt]; hi ^= ZP_HI[r * 128 + rf] ^ ZP_HI[r * 128 + rt];
    }
    if ((p & 7) === KING) this.kings[us >> 3] = to;
    const nc = this.castling & KEEP[from] & KEEP[to];
    if (nc !== this.castling) { lo ^= ZC_LO[this.castling] ^ ZC_LO[nc]; hi ^= ZC_HI[this.castling] ^ ZC_HI[nc]; this.castling = nc; }
    if (this.ep >= 0) { lo ^= ZE_LO[this.ep & 7]; hi ^= ZE_HI[this.ep & 7]; }
    this.ep = fl & F_DOUBLE ? from + (us === WHITE ? 16 : -16) : -1;
    if (this.ep >= 0) { lo ^= ZE_LO[this.ep & 7]; hi ^= ZE_HI[this.ep & 7]; }
    this.half = (p & 7) === PAWN || cap ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = us ^ 8;
    this.hlo = lo ^ ZS_LO;
    this.hhi = hi ^ ZS_HI;
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
    this.hlo = h.hlo;
    this.hhi = h.hhi;
  }
  // Pass the move (for null-move pruning in the search only).
  makeNull() {
    this.hist.push({ m: 0, cap: 0, castling: this.castling, ep: this.ep, half: this.half, hlo: this.hlo, hhi: this.hhi });
    let lo = this.hlo ^ ZS_LO, hi = this.hhi ^ ZS_HI;
    if (this.ep >= 0) { lo ^= ZE_LO[this.ep & 7]; hi ^= ZE_HI[this.ep & 7]; }
    this.ep = -1;
    this.half++;
    this.turn ^= 8;
    this.hlo = lo;
    this.hhi = hi;
  }
  unmakeNull() {
    const h = this.hist.pop();
    this.turn ^= 8;
    this.ep = h.ep;
    this.half = h.half;
    this.hlo = h.hlo;
    this.hhi = h.hhi;
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

  // Score in centipawns for the side to move: material and piece placement, piece mobility,
  // pawn structure (doubled, isolated and passed pawns), the bishop pair, rooks on open files,
  // the pawn shield in front of the king, and (when one side is far ahead in an endgame) a push
  // to drive the lone king to the edge so the game can finish.
  evaluate() {
    const b = this.board;
    let score = 0, phase = 0, kmg = 0, keg = 0, wMat = 0, bMat = 0, wB = 0, bB = 0, np = 0, nr = 0;
    WPF.fill(0); BPF.fill(0); WMIN.fill(8); BMAX.fill(-1);
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const t = p & 7, black = p & 8;
      if (t === KING) {
        if (black) { kmg -= KMG[1][sq]; keg -= KEG[1][sq]; } else { kmg += KMG[0][sq]; keg += KEG[0][sq]; }
        continue;
      }
      phase += PHASE[t];
      if (black) { score -= PSQ[p][sq]; bMat += VAL[t]; } else { score += PSQ[p][sq]; wMat += VAL[t]; }
      if (t === PAWN) {
        PAWNS[np++] = sq;
        const f = sq & 7, r = sq >> 4;
        if (black) { BPF[f]++; if (r > BMAX[f]) BMAX[f] = r; } else { WPF[f]++; if (r < WMIN[f]) WMIN[f] = r; }
        continue;
      }
      if (t === BISHOP) { if (black) bB++; else wB++; }
      if (t === ROOK) ROOKS[nr++] = sq;
      let n = 0;
      if (t === KNIGHT) {
        for (const d of N_OFF) { const s = sq + d; if (!(s & 0x88) && (!b[s] || (b[s] & 8) !== black)) n++; }
      } else {
        for (const d of t === BISHOP ? B_OFF : t === ROOK ? R_OFF : K_OFF) {
          for (let s = sq + d; !(s & 0x88); s += d) { const q = b[s]; if (!q) { n++; continue; } if ((q & 8) !== black) n++; break; }
        }
      }
      const mob = (n - MOB_BASE[t]) * MOB[t];
      score += black ? -mob : mob;
    }
    const ph = Math.min(24, phase);
    score += (kmg * ph + keg * (24 - ph)) / 24;
    // pawns
    const egw = 1 + (24 - ph) / 24; // passed pawns matter more as pieces come off
    for (let i = 0; i < np; i++) {
      const sq = PAWNS[i], f = sq & 7, r = sq >> 4, black = b[sq] & 8;
      const own = black ? BPF : WPF;
      let v = 0;
      if (own[f] > 1) v -= 10;
      if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) v -= 12;
      let passed = true;
      for (let g = f > 0 ? f - 1 : 0; g <= (f < 7 ? f + 1 : 7); g++) {
        if (black ? WMIN[g] < r : BMAX[g] > r) { passed = false; break; }
      }
      if (passed) v += PASSED[black ? 7 - r : r] * egw;
      score += black ? -v : v;
    }
    // rooks on open and half-open files
    for (let i = 0; i < nr; i++) {
      const sq = ROOKS[i], f = sq & 7, black = b[sq] & 8;
      const v = !WPF[f] && !BPF[f] ? 20 : !(black ? BPF[f] : WPF[f]) ? 10 : 0;
      score += black ? -v : v;
    }
    if (wB >= 2) score += 30;
    if (bB >= 2) score -= 30;
    // king shelter (only while there are pieces around to attack it)
    if (ph > 8) {
      const shelter = (side) => {
        const k = this.kings[side >> 3], kf = k & 7, kr = k >> 4, dir = side === WHITE ? 16 : -16, pawn = side | PAWN;
        let v = 0;
        for (let g = kf > 0 ? kf - 1 : 0; g <= (kf < 7 ? kf + 1 : 7); g++) {
          const s1 = kr * 16 + g + dir, s2 = s1 + dir;
          if (!(s1 & 0x88) && b[s1] === pawn) v += 12;
          else if (!(s2 & 0x88) && b[s2] === pawn) v += 6;
        }
        if (!(side === WHITE ? WPF : BPF)[kf]) v -= 15;
        return v;
      };
      score += ((shelter(WHITE) - shelter(BLACK)) * ph) / 24;
    }
    // a lone king should be driven to the edge
    const diff = wMat - bMat;
    if (ph <= 8 && Math.abs(diff) >= 300) {
      const loser = this.kings[diff > 0 ? 1 : 0], winner = this.kings[diff > 0 ? 0 : 1];
      const lr = loser >> 4, lf = loser & 7;
      const edge = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
      const close = 14 - Math.abs((winner >> 4) - lr) - Math.abs((winner & 7) - lf);
      score += (diff > 0 ? 1 : -1) * (12 * edge + 5 * close);
    }
    score = Math.round(score);
    return (this.turn === WHITE ? score : -score) + 8; // a small bonus for having the move
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
const MOB = [0, 0, 4, 3, 2, 1, 0]; // centipawns per square a piece can reach
const MOB_BASE = [0, 0, 4, 6, 6, 12, 0]; // a typical count, so a normal piece scores about zero
const PASSED = [0, 10, 15, 25, 45, 75, 120, 0]; // by rank reached
const WPF = new Int8Array(8), BPF = new Int8Array(8), WMIN = new Int8Array(8), BMAX = new Int8Array(8);
const PAWNS = new Int16Array(64), ROOKS = new Int16Array(64);
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
const INF = 32000, MATE = 30000, MATE_BOUND = 29000;
const TT_SIZE = 1 << 18, TT_MASK = TT_SIZE - 1;
const TT_HI = new Int32Array(TT_SIZE), TT_MOVE = new Int32Array(TT_SIZE), TT_SCORE = new Int16Array(TT_SIZE);
const TT_DEPTH = new Int8Array(TT_SIZE), TT_FLAG = new Uint8Array(TT_SIZE);
const EXACT = 1, LOWER = 2, UPPER = 3;
const HISTORY = new Int32Array(2 * 128 * 128);
const KILLERS = new Int32Array(2 * 128);
const MAX_PLY = 100;

// Bring the best-scored remaining move to position i (a lazy selection sort: most nodes stop early).
function pick(moves, sc, i) {
  let bi = i;
  for (let j = i + 1; j < moves.length; j++) if (sc[j] > sc[bi]) bi = j;
  if (bi !== i) {
    const m = moves[i]; moves[i] = moves[bi]; moves[bi] = m;
    const s = sc[i]; sc[i] = sc[bi]; sc[bi] = s;
  }
  return moves[i];
}

class Search {
  constructor(pos, deadline, quiesce) {
    this.pos = pos;
    this.deadline = deadline;
    this.useQ = quiesce;
    this.nodes = 0;
    this.stop = false;
    TT_FLAG.fill(0);
    HISTORY.fill(0);
    KILLERS.fill(0);
  }
  tick() {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stop = true;
    return this.stop;
  }
  // Same position earlier in the line being searched (with the same side to move)?
  repeated() {
    const pos = this.pos, h = pos.hist, end = Math.max(0, h.length - pos.half);
    for (let i = h.length - 2; i >= end; i -= 2) if (h[i].hlo === pos.hlo && h[i].hhi === pos.hhi) return true;
    return false;
  }
  hasPieces(side) {
    const b = this.pos.board;
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (p && (p & 8) === side && (p & 7) !== PAWN && (p & 7) !== KING) return true;
    }
    return false;
  }
  // Move order: the remembered best move, then captures (most valuable victim, cheapest
  // attacker), promotions, the two "killer" quiet moves of this depth, then quiet moves by history.
  scores(moves, ttMove, ply) {
    const b = this.pos.board, sc = new Int32Array(moves.length), side = (this.pos.turn >> 3) * 16384;
    const k1 = KILLERS[ply * 2], k2 = KILLERS[ply * 2 + 1];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i], fl = mFlags(m);
      if (m === ttMove) sc[i] = 1 << 30;
      else if (fl & F_CAP) sc[i] = (1 << 28) + VAL[fl & F_EP ? PAWN : b[mTo(m)] & 7] * 8 - (VAL[b[mFrom(m)] & 7] >> 4);
      else if (fl & F_PROMO) sc[i] = (1 << 27) + VAL[mPromo(m)];
      else if (m === k1) sc[i] = (1 << 26) + 1;
      else if (m === k2) sc[i] = 1 << 26;
      else sc[i] = HISTORY[side + (mFrom(m) << 7) + mTo(m)];
    }
    return sc;
  }
  qs(alpha, beta, ply) {
    const pos = this.pos;
    const stand = pos.evaluate();
    if (!this.useQ || ply >= MAX_PLY || this.tick()) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const us = pos.turn, b = pos.board;
    const moves = pos.gen([], true);
    const sc = this.scores(moves, 0, 0);
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, sc, i), fl = mFlags(m);
      // a capture that can't lift the score near alpha even with a margin isn't worth a look
      if (!(fl & F_PROMO) && stand + VAL[fl & F_EP ? PAWN : b[mTo(m)] & 7] + 200 < alpha) continue;
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
  ab(depth, alpha, beta, ply, nullOk) {
    const pos = this.pos;
    if (this.tick()) return 0;
    if (ply && (pos.half >= 100 || this.repeated())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0 || ply >= MAX_PLY) return this.qs(alpha, beta, ply);
    const idx = pos.hlo & TT_MASK;
    let ttMove = 0;
    if (TT_FLAG[idx] && TT_HI[idx] === pos.hhi) {
      ttMove = TT_MOVE[idx];
      if (ply && TT_DEPTH[idx] >= depth) {
        let s = TT_SCORE[idx];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = TT_FLAG[idx];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }
    const us = pos.turn;
    // null move: if passing still leaves us above beta, this position is good enough to cut
    if (nullOk && !inCheck && depth >= 3 && ply && beta < MATE_BOUND && this.hasPieces(us)) {
      pos.makeNull();
      const s = -this.ab(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stop) return 0;
      if (s >= beta) return beta;
    }
    const moves = pos.gen([]);
    const sc = this.scores(moves, ttMove, ply);
    let best = -INF, bestMove = 0, legal = 0;
    const a0 = alpha;
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, sc, i);
      pos.make(m);
      if (pos.attacked(pos.kings[us >> 3], us ^ 8)) { pos.unmake(); continue; }
      legal++;
      const quiet = !(mFlags(m) & (F_CAP | F_PROMO));
      let s;
      if (legal === 1) s = -this.ab(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // later quiet moves are probably worse: look at them a little less deeply first
        const r = depth >= 3 && legal > 3 && quiet && !inCheck && !pos.inCheck() ? (legal > 10 ? 2 : 1) : 0;
        s = -this.ab(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && r) s = -this.ab(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha && s < beta) s = -this.ab(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stop) return 0;
      if (s > best) { best = s; bestMove = m; }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (quiet && ply < 128) {
          if (KILLERS[ply * 2] !== m) { KILLERS[ply * 2 + 1] = KILLERS[ply * 2]; KILLERS[ply * 2] = m; }
          const h = (us >> 3) * 16384 + (mFrom(m) << 7) + mTo(m);
          HISTORY[h] += depth * depth;
          if (HISTORY[h] > 1 << 22) for (let k = 0; k < HISTORY.length; k++) HISTORY[k] >>= 1;
        }
        break;
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;
    let st = best;
    if (st > MATE_BOUND) st += ply; else if (st < -MATE_BOUND) st -= ply;
    TT_HI[idx] = pos.hhi;
    TT_MOVE[idx] = bestMove;
    TT_SCORE[idx] = st;
    TT_DEPTH[idx] = depth;
    TT_FLAG[idx] = best <= a0 ? UPPER : best >= beta ? LOWER : EXACT;
    return best;
  }
}

// ---------------------------------------------------------------- playing at a rating
// How the engine plays at a given rating. From 1000 up it always plays the move it thinks is
// best; what changes is how far it looks ahead, from 2 moves (its move and the reply, plus any
// captures that follow) at 1000 to as deep as it can in 2 seconds at 2000. Below 1000 it is
// sometimes careless, like the skill levels of the big engines: with chance `careless` it picks
// a move at random with odds that favour the better ones, P(move) ∝ exp((score − best) / temp),
// so it may miss a tactic or drop a piece. Between the rows it blends: the depth is chosen per
// move (a rating halfway between a depth-3 row and a depth-4 row searches 3 deep half the time)
// and the rest is interpolated. The ratings come from self-play matches between the settings
// (tools/chess-calibrate.mjs, 36–100 games per step): anchored at 2000 = the engine at full
// strength, each row placed by its measured gap times 0.7, because engines playing each other
// spread out more than the same engines would against people. Measured gaps: full vs depth 6
// +387, 6 vs 5 about +175, 5 vs 4 +215, 4 vs 3 +196, 3 vs 2 +252, then the careless rows +330,
// +246, +424.
const LEVELS = [
  // rating, depth, ms, careless, temperature (centipawns)
  [200, 1, 60, 1, 160],
  [440, 2, 80, 0.85, 120],
  [740, 2, 100, 0.55, 80],
  [910, 2, 120, 0.25, 80],
  [1140, 2, 150, 0, 0],
  [1320, 3, 300, 0, 0],
  [1460, 4, 500, 0, 0],
  [1610, 5, 800, 0, 0],
  [1730, 6, 1200, 0, 0],
  [2000, 30, 2000, 0, 0],
];
export const RATING_MIN = LEVELS[0][0], RATING_MAX = LEVELS[LEVELS.length - 1][0];
export function strengthFor(rating) {
  const R = Math.max(RATING_MIN, Math.min(RATING_MAX, rating));
  let i = 0;
  while (i < LEVELS.length - 2 && R >= LEVELS[i + 1][0]) i++;
  const a = LEVELS[i], b = LEVELS[i + 1], t = (R - a[0]) / (b[0] - a[0]);
  const lerp = (k) => a[k] + (b[k] - a[k]) * t;
  return { rating: Math.round(R), depthLo: a[1], depthHi: b[1], depthT: t, ms: Math.round(lerp(2)), careless: lerp(3), temp: Math.round(lerp(4)), q: true };
}

// The animals, weakest first. Chick moves at random; the others play at a fixed rating, except
// Dragon, whose rating follows the child's results (the game screen passes it in).
export const OPPONENTS = [
  { id: 'chick', name: 'Chick', emoji: '🐣', blurb: 'Just learning the moves', level: 1, random: true, grab: 0.5 },
  { id: 'turtle', name: 'Turtle', emoji: '🐢', blurb: 'Grabs any piece it can', level: 2, rating: 400 },
  { id: 'fox', name: 'Fox', emoji: '🦊', blurb: 'Watches out for traps', level: 3, rating: 700 },
  { id: 'owl', name: 'Owl', emoji: '🦉', blurb: 'Thinks a few moves ahead', level: 4, rating: 1000 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', blurb: 'Matches your level and keeps up as you improve', level: 5, adaptive: true, rating: 1200 },
];
// How an opponent plays: Chick at random, everyone else at a rating.
export function playerFor(opp, rating = opp.rating) {
  return opp.random ? { random: true, grab: opp.grab } : strengthFor(rating);
}

// Pick a move for the side to play. seen: positions already reached this game (avoided when
// winning, so a won game doesn't end in a draw by repetition).
export function chooseMove(pos, opp, { rng = Math.random, seen = null } = {}) {
  const legal = pos.legal();
  if (legal.length <= 1) return legal[0] ?? null;
  if (opp.random) {
    const caps = legal.filter((m) => mFlags(m) & F_CAP);
    if (caps.length && rng() < (opp.grab || 0)) {
      const b = pos.board;
      return caps.reduce((x, m) => (VAL[b[mTo(m)] & 7] > VAL[b[mTo(x)] & 7] ? m : x), caps[0]);
    }
    return legal[Math.floor(rng() * legal.length)];
  }
  const depth = opp.depth ?? (rng() < (opp.depthT || 0) ? opp.depthHi : opp.depthLo);
  // careless this move? (and a little variety in the first moves, so games don't repeat)
  const opening = pos.full <= 3;
  const temp = opening ? Math.max(opp.temp || 0, 12) : opp.temp || 0;
  const careless = opening ? 1 : opp.careless ?? 1;
  const sampling = temp > 0 && rng() < careless;
  const margin = sampling ? Math.min(3000, 5 * temp) : 1; // moves further below the best barely matter
  const S = new Search(pos, Date.now() + (opp.ms || 1000), opp.q !== false);
  // first guess at the order: captures and promotions first
  let order = legal.slice(), done = null;
  const sc0 = S.scores(order, 0, 0);
  order = order.map((m, i) => [m, sc0[i]]).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  for (let d = 1; d <= depth; d++) {
    let best = -INF;
    const res = [];
    for (const m of order) {
      pos.make(m);
      let s;
      if (d === 1 && !pos.legal().length) s = pos.inCheck() ? MATE - 1 : 0; // spots a mate or stalemate at once
      else s = -S.ab(d - 1, -INF, -(best === -INF ? -INF : best - margin), 1, true);
      if (seen && s > 50 && seen.has(pos.key())) s -= 60;
      pos.unmake();
      if (S.stop) break;
      res.push([m, s]);
      if (s > best) best = s;
    }
    if (S.stop && done) break;
    res.sort((x, y) => y[1] - x[1]);
    if (res.length) done = res.length === order.length || !done ? res : done;
    order = done.map((x) => x[0]).concat(order.filter((m) => !done.some((x) => x[0] === m)));
    if (S.stop) break;
    if (Math.abs(done[0][1]) > MATE_BOUND) break; // a forced mate was found
  }
  if (!done) return order[0];
  const top = done[0][1];
  if (!sampling) return done[0][0];
  const w = done.map(([, s]) => Math.exp(Math.max(-40, (s - top) / temp)));
  let r = rng() * w.reduce((x, y) => x + y, 0);
  for (let i = 0; i < done.length; i++) { r -= w[i]; if (r <= 0) return done[i][0]; }
  return done[0][0];
}
