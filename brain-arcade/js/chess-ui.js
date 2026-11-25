// The Chess game: a real game of chess against a computer animal. Each right answer earns one
// move (during a level check, every answer does), then the animal replies. The game is saved on
// the player, so it carries on from round to round until someone wins.
import {
  Chess, chooseMove, OPPONENTS, START_FEN, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN,
  F_CAP, F_EP, F_CASTLE_K, F_CASTLE_Q, F_PROMO, mFrom, mTo, mFlags, mPromo, sqName,
} from './chess.js';
import { pieceSVG } from './chess-pieces.js';
import { sfx } from './sfx.js';
import { speak } from './speech.js';
import { store } from './store.js';
import { optionInner, burst, fitLabels, esc, confirmBox } from './ui.js';

const VALUE = [0, 1, 3, 3, 5, 9, 0];
const START_COUNT = [0, 8, 2, 2, 2, 1, 1];
const DRAW_WHY = {
  stalemate: "Stalemate! The king can't move but isn't in check, so it's a draw.",
  insufficient: "There aren't enough pieces left to checkmate, so it's a draw.",
  repetition: "The same position came up three times, so it's a draw.",
  fifty: "Fifty moves went by with no captures or pawn moves, so it's a draw.",
};
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class ChessGame {
  constructor(stage, { onPick, player, playEl, answerHost }) {
    this.stage = stage;
    this.onPick = onPick;
    this.player = player;
    this.playEl = playEl;
    this.host = answerHost;
    this.els = [];
    this.turnEveryAnswer = true; // play.js: during a level check, every answer earns a move
    this.cancels = new Set();
    this.aborted = false;
    this.pcs = new Map();
    this.sel = -1;
    this.targets = new Map();
    this.legal = [];
    this.moveDone = null;
    this.status = '';
  }
  handles(item) { return item.kind === 'choice' && item.layout !== 'long'; }

  // ------------------------------------------------------------ waiting (cancelled by Home)
  until(setup) {
    return new Promise((resolve) => {
      if (this.aborted) { resolve(null); return; }
      let open = true;
      const cancel = () => finish(null);
      const finish = (v) => { if (!open) return; open = false; this.cancels.delete(cancel); resolve(v); };
      this.cancels.add(cancel);
      setup(finish);
    });
  }
  sleep(ms) { return this.until((done) => setTimeout(() => done(true), ms)); }
  abort() { this.aborted = true; for (const c of [...this.cancels]) c(); }

  // ------------------------------------------------------------ saved game
  loadState() {
    const s = (this.player.chess ||= {});
    s.rec ||= {};
    s.keys ||= [];
    this.state = s;
    this.opp = OPPONENTS.find((o) => o.id === s.opp) || OPPONENTS[0];
    this.game = null;
    if (s.fen) { try { this.game = new Chess(s.fen); } catch { this.game = null; } }
    if (this.game && this.game.outcome(this.repeats())) this.game = null;
    if (!this.game) s.fen = null;
  }
  repeats() { const k = this.game.key(); return Math.max(1, this.state.keys.filter((x) => x === k).length); }
  save() { this.state.fen = this.game ? this.game.fen() : null; this.state.opp = this.opp.id; store.saveSoon(); }

  // ------------------------------------------------------------ building the screen
  async start() {
    this.loadState();
    this.stage.innerHTML = `<div class="scene chessroom"><div class="cwrap">
      <div class="cbar opp"><span class="cav"></span><b class="cnm"></b><span class="clvl"></span><span class="ccap"></span><span class="cmsg"></span></div>
      <div class="cboard"><div class="csqs"></div><div class="cpcs"></div><div class="cflash hidden"></div></div>
      <div class="cbar me"><span class="cav"></span><b class="cnm"></b><span class="ccap"></span><span class="cadv"></span><span class="cmsg"></span><button class="cnew" aria-label="Start a new game">🏳️</button></div>
    </div><div class="fx"></div></div>`;
    const q = (s) => this.stage.querySelector(s);
    this.scene = q('.chessroom');
    this.wrap = q('.cwrap');
    this.boardEl = q('.cboard');
    this.pcsEl = q('.cpcs');
    this.oppBar = q('.cbar.opp');
    this.meBar = q('.cbar.me');
    this.flashEl = q('.cflash');
    this.fx = q('.fx');
    q('.cnew').addEventListener('click', () => this.askNewGame());
    this.buildSquares();
    this.bindBoard();
    this.tiles = document.createElement('div');
    this.tiles.className = 'ctiles hidden';
    this.host.appendChild(this.tiles);
    this.fit();
    this.ro = new ResizeObserver(() => { this.fit(); this.sizeTiles(); });
    this.ro.observe(this.stage);
    if (window.__BA_TEST) window.__BA_TEST.chess = this.testHook();
    this.playEl.classList.add('c-move'); // show the board until the first question
    this.renderAll();
    if (!this.game) await this.newGame();
    else if (this.game.turn === BLACK) await this.robotTurn(); // left before the animal replied
    if (!this.aborted) this.setStatus('answer');
  }
  buildSquares() {
    let h = '';
    for (let row = 0; row < 8; row++) {
      for (let f = 0; f < 8; f++) {
        const sq = (7 - row) * 16 + f;
        h += `<div class="csq ${(row + f) % 2 ? 'd' : 'l'}" data-sq="${sqName(sq)}">${f === 0 ? `<i class="crk">${8 - row}</i>` : ''}${row === 7 ? `<i class="cfl">${'abcdefgh'[f]}</i>` : ''}</div>`;
      }
    }
    const el = this.stage.querySelector('.csqs');
    el.innerHTML = h;
    this.sqEls = [];
    el.querySelectorAll('.csq').forEach((d, i) => { this.sqEls[(7 - (i >> 3)) * 16 + (i & 7)] = d; });
  }
  fit() {
    const r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const bar = r.width < 500 ? 40 : 48;
    const avail = Math.min(r.width - 44, r.height - 2 * bar - 44, 820); // room for the frame
    this.wrap.style.setProperty('--bs', Math.max(200, Math.floor(avail / 8) * 8) + 'px');
    this.wrap.style.setProperty('--bh', bar + 'px');
  }
  renderAll() {
    this.pcsEl.innerHTML = '';
    this.pcs.clear();
    if (this.game) {
      for (let sq = 0; sq < 120; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.game.board[sq];
        if (p) this.addPiece(p, sq);
      }
    }
    this.markLast();
    this.markCheck();
    this.updateBars();
  }
  addPiece(p, sq) {
    const el = document.createElement('div');
    el.className = 'cpc';
    el.innerHTML = pieceSVG(p);
    this.place(el, sq);
    this.pcsEl.appendChild(el);
    this.pcs.set(sq, el);
  }
  place(el, sq) { el.style.left = (sq & 7) * 12.5 + '%'; el.style.top = (7 - (sq >> 4)) * 12.5 + '%'; }
  markLast() {
    this.sqEls.forEach((d) => d.classList.remove('last'));
    const l = this.state.last;
    if (this.game && l) for (const sq of l) this.sqEls[sq]?.classList.add('last');
  }
  markCheck() {
    this.sqEls.forEach((d) => d.classList.remove('chk'));
    if (this.game && this.game.inCheck()) this.sqEls[this.game.kings[this.game.turn >> 3]]?.classList.add('chk');
  }
  updateBars() {
    const set = (bar, sel, v, html = false) => { const e = bar.querySelector(sel); if (html) e.innerHTML = v; else e.textContent = v; };
    set(this.oppBar, '.cav', this.opp.emoji);
    set(this.oppBar, '.cnm', this.opp.name);
    set(this.oppBar, '.clvl', '★'.repeat(this.opp.level));
    set(this.meBar, '.cav', this.player.avatar || '🙂');
    set(this.meBar, '.cnm', this.player.name);
    const c = this.captured();
    set(this.oppBar, '.ccap', c.byBlack, true);
    set(this.meBar, '.ccap', c.byWhite, true);
    set(this.meBar, '.cadv', c.adv > 0 ? `+${c.adv}` : '');
  }
  // Pieces each side has taken, and how far ahead the child is in points.
  captured() {
    if (!this.game) return { byWhite: '', byBlack: '', adv: 0 };
    const count = { [WHITE]: [0, 0, 0, 0, 0, 0, 0], [BLACK]: [0, 0, 0, 0, 0, 0, 0] };
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.game.board[sq];
      if (p) count[p & 8][p & 7]++;
    }
    const lost = (side) => [QUEEN, ROOK, BISHOP, KNIGHT, PAWN].map((t) => pieceSVG(side | t).repeat(Math.max(0, START_COUNT[t] - count[side][t]))).join('');
    const mat = (side) => [PAWN, KNIGHT, BISHOP, ROOK, QUEEN].reduce((a, t) => a + count[side][t] * VALUE[t], 0);
    return { byWhite: lost(BLACK), byBlack: lost(WHITE), adv: mat(WHITE) - mat(BLACK) };
  }
  setStatus(kind) {
    this.status = kind;
    const me = this.meBar.querySelector('.cmsg'), op = this.oppBar.querySelector('.cmsg');
    me.className = op.className = 'cmsg';
    me.textContent = op.textContent = '';
    this.meBar.classList.toggle('turn', kind === 'yours' || kind === 'incheck');
    this.oppBar.classList.toggle('turn', kind === 'thinking');
    if (kind === 'yours') me.textContent = 'Your move!';
    else if (kind === 'incheck') { me.textContent = 'Check!'; me.classList.add('red'); }
    else if (kind === 'thinking') op.textContent = 'thinking…';
  }
  flash(text) { this.flashEl.textContent = text; this.flashEl.classList.toggle('hidden', !text); }
  cover(html) {
    const el = document.createElement('div');
    el.className = 'cover';
    el.innerHTML = html;
    this.scene.appendChild(el);
    return el;
  }

  // ------------------------------------------------------------ answers (tiles over the board)
  ask() { this.playEl.classList.remove('c-move'); this.flash(''); this.setStatus('answer'); }
  show(item) {
    this.clear();
    this.tiles.classList.toggle('wide', item.layout === 'word');
    this.tiles.innerHTML = '<div class="ct-grid"></div>';
    const grid = this.tiles.firstChild;
    item.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'ctile';
      b.style.setProperty('--d', i * 0.05 + 's');
      b.innerHTML = `<span class="ct-in">${optionInner(o)}</span>`;
      b.addEventListener('click', () => { if (!b.disabled && !b.classList.contains('wrong')) this.onPick(i); });
      grid.appendChild(b);
      this.els.push(b);
    });
    this.tiles.classList.remove('hidden');
    this.sizeTiles();
    fitLabels(this.tiles);
  }
  sizeTiles() {
    const n = this.els.length;
    if (!n || !this.tiles || this.tiles.classList.contains('hidden')) return;
    const r = this.tiles.getBoundingClientRect();
    const wide = this.tiles.classList.contains('wide');
    const gap = 14, ratio = wide ? 0.46 : 1;
    const W = r.width - 28, H = r.height - 28;
    let best = null;
    for (let cols = n; cols >= 1; cols--) { // biggest tiles; on a tie, full rows (2×2, not 3+1), then a row over a column
      const rows = Math.ceil(n / cols);
      const w = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / ratio, wide ? 340 : 210);
      const empty = rows * cols - n;
      if (!best || w > best.w + 0.5 || (Math.abs(w - best.w) <= 0.5 && empty < best.empty)) best = { cols, w, empty };
    }
    const w = Math.max(wide ? 120 : 64, Math.floor(best.w));
    this.tiles.style.setProperty('--cols', best.cols);
    this.tiles.style.setProperty('--tw', w + 'px');
    this.tiles.style.setProperty('--th', Math.round(w * ratio) + 'px');
  }
  markWrong(i) { const el = this.els[i]; if (!el) return; el.classList.add('wrong'); el.disabled = true; }
  reveal(i) { this.els[i]?.classList.add('reveal'); }
  lock() { this.els.forEach((e) => { e.disabled = true; }); }
  clear() { this.els.forEach((e) => e.remove()); this.els = []; this.tiles?.classList.add('hidden'); }
  progress() {}
  async markRight(i) { this.els[i]?.classList.add('right'); await this.sleep(380); await this.turn(); }
  async neutral(i) { this.els[i]?.classList.add('picked'); sfx.soft(); await this.sleep(320); await this.turn(); }
  async reward() { await this.turn(); }

  // ------------------------------------------------------------ one turn: the child moves, the animal replies
  async turn() {
    this.lock();
    this.playEl.classList.add('c-move');
    if (!(await this.sleep(300))) return;
    this.clear();
    for (;;) {
      if (this.aborted) return;
      if (!this.game) { await this.newGame(); continue; }
      if (this.game.turn === BLACK) { await this.robotTurn(); continue; }
      const r = await this.kidTurn();
      if (!r) return;
      if (r === 'new') { this.game = null; this.state.keys = []; this.state.last = null; this.save(); continue; }
      if (await this.checkEnd()) return;
      await this.robotTurn();
      if (this.aborted) return;
      await this.sleep(750); // time to see the animal's reply before the next question covers the board
      return;
    }
  }
  async kidTurn() {
    this.legal = this.game.legal();
    const check = this.game.inCheck();
    this.setStatus(check ? 'incheck' : 'yours');
    if (check) speak("You're in check! Keep your king safe.");
    else if (!this.saidTurn) speak('Your move!');
    this.saidTurn = true;
    this.boardEl.classList.add('my-turn');
    const r = await this.until((done) => { this.moveDone = done; });
    this.moveDone = null;
    this.boardEl.classList.remove('my-turn');
    this.deselect();
    if (!r || r === 'new') return r;
    this.setStatus('');
    await this.play(r.m, r.dropped);
    return 'moved';
  }
  async robotTurn() {
    this.setStatus('thinking');
    if (!(await this.sleep(380))) return;
    await frame();
    const t0 = performance.now();
    const m = chooseMove(this.game, this.opp, { seen: new Set(this.state.keys) });
    const left = 450 - (performance.now() - t0);
    if (left > 0 && !(await this.sleep(left))) return;
    if (this.aborted || m == null) return;
    await this.play(m);
    if (await this.checkEnd()) return;
    if (this.game.inCheck()) { sfx.check(); speak('Check!'); this.setStatus('incheck'); }
    else this.setStatus('answer');
  }
  // Move a piece on the board (with captures, castling, en passant and promotion) and save.
  async play(m, dropped = false) {
    const g = this.game, from = mFrom(m), to = mTo(m), fl = mFlags(m);
    const mover = g.board[from];
    const capSq = fl & F_EP ? to + (mover & 8 ? 16 : -16) : fl & F_CAP ? to : -1;
    const el = this.pcs.get(from);
    g.make(m);
    if (capSq >= 0) {
      const v = this.pcs.get(capSq);
      this.pcs.delete(capSq);
      if (v) { v.classList.add('taken'); setTimeout(() => v.remove(), 420); }
    }
    this.pcs.delete(from);
    if (el) {
      this.pcs.set(to, el);
      el.classList.remove('dragging');
      if (dropped) { el.style.transition = 'none'; el.style.transform = ''; this.place(el, to); void el.offsetWidth; el.style.transition = ''; }
      else { el.style.transform = ''; this.place(el, to); }
      el.classList.add('moving');
      setTimeout(() => el.classList.remove('moving'), 380);
      if (fl & F_PROMO) setTimeout(() => { el.innerHTML = pieceSVG(g.board[to]); }, dropped ? 0 : 260);
    }
    if (fl & (F_CASTLE_K | F_CASTLE_Q)) {
      const rf = fl & F_CASTLE_K ? from + 3 : from - 4, rt = fl & F_CASTLE_K ? from + 1 : from - 1;
      const rook = this.pcs.get(rf);
      if (rook) { this.pcs.delete(rf); this.pcs.set(rt, rook); this.place(rook, rt); }
    }
    if (capSq >= 0) sfx.capture(); else sfx.move();
    const s = this.state;
    s.last = [from, to];
    if ((mover & 7) === PAWN || capSq >= 0) s.keys = [];
    s.keys.push(g.key());
    this.save();
    this.markLast();
    this.markCheck();
    this.updateBars();
    await this.sleep(dropped ? 160 : 380);
  }
  async checkEnd() {
    const out = this.game.outcome(this.repeats());
    if (!out) return false;
    const kind = out.result === 'checkmate' ? (out.winner === WHITE ? 'win' : 'loss') : 'draw';
    const rec = (this.state.rec[this.opp.id] ||= { w: 0, l: 0, d: 0 });
    rec[kind[0]]++;
    this.state.games = (this.state.games || 0) + 1;
    this.game = null;
    this.state.keys = [];
    this.state.last = null;
    this.save();
    store.save();
    this.setStatus('');
    await this.showResult(kind, out.result);
    if (this.aborted) return true;
    await this.newGame();
    return true;
  }
  async showResult(kind, how) {
    const o = this.opp;
    const title = kind === 'win' ? 'Checkmate!' : kind === 'loss' ? 'Checkmate' : "It's a draw";
    const line = kind === 'win' ? `You beat ${o.name}!` : kind === 'loss' ? `${o.name} won this time. Good game!` : DRAW_WHY[how] || "It's a draw.";
    const big = kind === 'win' ? '🏆' : kind === 'loss' ? o.emoji : '🤝';
    const cover = this.cover(`<div class="cpanel cres ${kind}"><div class="cr-big">${big}</div><h2>${esc(title)}</h2><p>${esc(line)}</p><button class="btn primary big cgo">New game ▶</button></div>`);
    if (kind === 'win') {
      sfx.win();
      const r = this.fx.getBoundingClientRect();
      burst(this.fx, r.width / 2, r.height * 0.4, { n: 36, spread: 240 });
    } else sfx.soft();
    speak(`${title}! ${line}`);
    await this.until((done) => cover.querySelector('.cgo').addEventListener('click', () => { sfx.tap(); done(true); }, { once: true }));
    cover.remove();
  }
  // The first animal not beaten yet.
  suggested() {
    const i = OPPONENTS.findIndex((o) => !(this.state.rec[o.id]?.w > 0));
    return OPPONENTS[i < 0 ? OPPONENTS.length - 1 : i];
  }
  async newGame() {
    this.setStatus('');
    this.flash('');
    const sug = this.suggested();
    const cover = this.cover(`<div class="cpanel cpick"><h2>Who do you want to play?</h2><div class="cp-list">${OPPONENTS.map((o) => {
      const w = this.state.rec[o.id]?.w || 0;
      return `<button class="cp-opp${o.id === sug.id ? ' sugg' : ''}" data-id="${o.id}"><span class="cp-em">${o.emoji}</span><span class="cp-txt"><b>${o.name}</b><small>${esc(o.blurb)}</small></span><span class="cp-side"><span class="cp-lv">${'★'.repeat(o.level)}<i>${'★'.repeat(5 - o.level)}</i></span>${w ? `<span class="cp-w">🏆 ${w}</span>` : o.id === sug.id ? '<span class="cp-next">Try me!</span>' : ''}</span></button>`;
    }).join('')}</div><p class="cp-note">You play white and go first. Answer a question to make each move.</p></div>`);
    speak('Who do you want to play?');
    const pick = await this.until((done) => cover.addEventListener('click', (e) => {
      const b = e.target.closest('.cp-opp');
      if (b) { sfx.tap(); done(OPPONENTS.find((o) => o.id === b.dataset.id)); }
    }));
    cover.remove();
    if (!pick) return;
    this.opp = pick;
    this.game = new Chess(START_FEN);
    this.state.last = null;
    this.state.keys = [this.game.key()];
    this.saidTurn = false;
    this.save();
    this.renderAll();
  }
  async askNewGame() {
    if (!this.moveDone) return;
    const ok = await confirmBox('Start a new game? This one will end.', { ok: 'New game', cancel: 'Keep playing' });
    if (ok && this.moveDone) { const d = this.moveDone; this.moveDone = null; d('new'); }
  }
  pickPromotion() {
    const cover = this.cover(`<div class="cpanel cpromo"><h2>Your pawn made it! Pick a piece:</h2><div class="cpr-row">${[QUEEN, ROOK, BISHOP, KNIGHT].map((t) => `<button class="cpr" data-t="${t}">${pieceSVG(WHITE | t)}</button>`).join('')}</div></div>`);
    speak('Your pawn made it to the end! Pick a new piece.');
    return this.until((done) => cover.addEventListener('click', (e) => { const b = e.target.closest('.cpr'); if (b) done(+b.dataset.t); }))
      .then((v) => { cover.remove(); return v; });
  }

  // ------------------------------------------------------------ touching the board: tap-tap or drag
  bindBoard() {
    const b = this.boardEl;
    b.addEventListener('pointerdown', (e) => this.onDown(e));
    b.addEventListener('pointermove', (e) => this.onMove(e));
    b.addEventListener('pointerup', (e) => this.onUp(e));
    b.addEventListener('pointercancel', (e) => this.onUp(e, true));
  }
  sqAt(x, y) {
    const r = this.boardEl.getBoundingClientRect();
    const f = Math.floor(((x - r.left) / r.width) * 8), row = Math.floor(((y - r.top) / r.height) * 8);
    return f < 0 || f > 7 || row < 0 || row > 7 ? -1 : (7 - row) * 16 + f;
  }
  onDown(e) {
    if (!this.moveDone || e.button > 0) return;
    const sq = this.sqAt(e.clientX, e.clientY);
    if (sq < 0) return;
    if (this.sel >= 0 && this.targets.has(sq)) { this.tryMove(sq); return; }
    const p = this.game.board[sq];
    if (p && !(p & 8)) {
      if (this.sel !== sq) this.select(sq);
      this.drag = { sq, x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
      try { this.boardEl.setPointerCapture(e.pointerId); } catch { /* not needed */ }
      return;
    }
    this.deselect();
  }
  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    const el = this.pcs.get(d.sq);
    if (!el) return;
    el.classList.add('dragging');
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
  }
  onUp(e, cancelled = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (!d.moved) return;
    const sq = cancelled ? -1 : this.sqAt(e.clientX, e.clientY);
    if (sq >= 0 && this.targets.has(sq)) { this.tryMove(sq, true); return; }
    const el = this.pcs.get(d.sq);
    if (el) { el.classList.remove('dragging'); el.style.transform = ''; }
  }
  select(sq) {
    this.deselect();
    this.sel = sq;
    this.sqEls[sq].classList.add('sel');
    for (const m of this.legal) {
      if (mFrom(m) !== sq) continue;
      const to = mTo(m);
      if (!this.targets.has(to)) this.targets.set(to, []);
      this.targets.get(to).push(m);
      this.sqEls[to].classList.add(mFlags(m) & F_CAP ? 'tcap' : 'tgt');
    }
    sfx.tap();
  }
  deselect() {
    if (this.sel >= 0) this.sqEls[this.sel].classList.remove('sel');
    for (const to of this.targets.keys()) this.sqEls[to].classList.remove('tgt', 'tcap');
    this.targets.clear();
    this.sel = -1;
  }
  async tryMove(to, dropped = false) {
    const moves = this.targets.get(to);
    const done = this.moveDone;
    if (!moves || !done) return;
    this.moveDone = null; // ignore extra taps while this move happens
    let m = moves[0];
    if (moves.length > 1) {
      const el = this.pcs.get(this.sel);
      if (el) { el.classList.remove('dragging'); el.style.transform = ''; }
      dropped = false;
      const t = await this.pickPromotion();
      if (!t) return;
      m = moves.find((x) => mPromo(x) === t) || moves[0];
    }
    done({ m, dropped });
  }

  // ------------------------------------------------------------ end of round / leaving
  async finish() {
    this.lock();
    this.playEl.classList.add('c-move');
    this.setStatus('');
    if (this.game) this.flash('Game saved! It keeps going next round.');
    await this.sleep(1800);
    this.clear();
  }
  destroy() {
    this.abort();
    this.ro?.disconnect();
    this.tiles?.remove();
    this.playEl?.classList.remove('c-move');
    this.stage.innerHTML = '';
    if (window.__BA_TEST?.chess) delete window.__BA_TEST.chess;
  }
  testHook() {
    return {
      phase: () => (this.moveDone ? 'move' : this.status),
      moves: () => (this.moveDone ? this.legal.map((m) => [sqName(mFrom(m)), sqName(mTo(m)), mFlags(m)]) : []),
      fen: () => this.game?.fen() || null,
    };
  }
}
