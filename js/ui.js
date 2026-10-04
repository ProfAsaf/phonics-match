// DOM helpers and the pieces every child screen shares: the replay button, the kick button (the
// confirm step), the parent corner, celebrations, and chess-piece cards. Nothing on a child screen
// is written instruction (ground rule 4); every target is at least 64 px (ground rule 8).
import { ballSVG, ICONS, pieceSVG, kitPiece } from './art.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function mount(el) {
  document.getElementById('app').replaceChildren(el);
  return el;
}

export function tapped(el) {
  return new Promise(resolve => el.addEventListener('click', resolve, { once: true }));
}

// Lights an element for a moment.
export function flash(el, ms = 450, cls = 'lit') {
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

export const icon = (name, cls = 'ico') => h('span', { class: cls, html: ICONS[name] });
export const ballIcon = (cls = 'ico') => h('span', { class: cls, html: ballSVG() });

// The confirm step is kicking the ball: he picks an answer, then kicks.
export function confirmButton() {
  return h('button', { class: 'confirm', 'aria-label': 'Kick', disabled: true }, ballIcon('confirm-ball'));
}

const SPEAKER_COLORS = ['#ffe08a', '#b5e3ff', '#ffc1b8', '#c9f2c7'];
export function speakerButton(i) {
  return h('button', { class: `card speaker s${i}`, 'aria-label': 'Sound', style: { background: SPEAKER_COLORS[i % 4] } }, icon('speaker', 'ico spk'));
}

// The first few times, if he picks an answer and doesn't kick, a hand points at the ball.
let kickHint = null;
export const setKickHint = fn => { kickHint = fn; };

// Tap a choice to select it (onSelect plays its audio where that cannot give the answer away);
// the kick button submits, so a stray tap never answers by itself.
export function pick(choices, confirm, onSelect) {
  return new Promise(resolve => {
    let selected = null;
    let hint = null;
    const handlers = choices.map(([value, el]) => {
      el.dataset.v = String(value);
      const fn = () => {
        if (el.disabled) return;
        selected = value;
        for (const [, other] of choices) other.classList.toggle('selected', other === el);
        confirm.disabled = false;
        onSelect?.(value);
        hint?.cancel();
        hint = kickHint?.(confirm) ?? null;
      };
      el.addEventListener('click', fn);
      return [el, fn];
    });
    const go = () => {
      if (selected == null) return;
      hint?.cancel();
      confirm.disabled = true;
      for (const [el, fn] of handlers) el.removeEventListener('click', fn);
      confirm.removeEventListener('click', go);
      for (const [, el] of choices) el.classList.remove('selected');
      resolve(selected);
    };
    confirm.addEventListener('click', go);
  });
}

// The parent area opens only after a three-second press, so a child never stumbles in.
export function parentCorner(open) {
  const el = h('button', { class: 'corner', 'aria-label': 'Grown-ups: press and hold' }, h('span', {}, '⚙︎'));
  let timer = null;
  const cancel = () => {
    clearTimeout(timer);
    el.classList.remove('pressing');
  };
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.classList.add('pressing');
    timer = setTimeout(() => {
      cancel();
      open();
    }, 3000);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(type, cancel);
  el.addEventListener('contextmenu', e => e.preventDefault());
  return el;
}

export function replayButton(onReplay) {
  return h('button', { class: 'replay', 'aria-label': 'Hear it again', onclick: () => onReplay?.() }, icon('speaker'));
}

// Placeholder captions: what a recording will say, shown only while it is a placeholder tone.
export function caption(text) {
  let el = document.getElementById('caption');
  if (!el) {
    el = h('div', { id: 'caption' });
    document.body.append(el);
  }
  el.textContent = `🔈 ${text}`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(caption.timer);
  caption.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

// A celebration lasts at most `ms`, and any tap skips it.
export function celebrate(content, { ms = 2000, cls = '', onSkip } = {}) {
  return new Promise(resolve => {
    const el = h('div', { class: `celebrate ${cls}` }, content);
    document.body.append(el);
    let done = false;
    const end = skipped => {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
      if (skipped) onSkip?.();
      resolve();
    };
    el.addEventListener('click', () => end(true));
    setTimeout(() => end(false), ms);
  });
}

export function confetti(n = 40) {
  return Array.from({ length: n }, (_, i) => h('i', {
    class: 'bit',
    style: {
      left: `${(i * 37) % 100}%`,
      background: ['#ffd23f', '#ee4266', '#3bceac', '#540d6e', '#0ead69', '#fff'][i % 6],
      animationDelay: `${(i % 10) * 0.05}s`,
    },
  }));
}

const kitColor = () => getComputedStyle(document.documentElement).getPropertyValue('--kit').trim() || '#e63946';

// A chess piece card in his kit color (a pale silhouette until the player is signed).
export function pieceEl(piece, { signed = true, number = null, name = null, small = false } = {}) {
  const col = signed ? kitPiece(kitColor()) : { fill: '#dfe5ec', shade: '#cfd7e0', detail: '#ffffff' };
  return h('div', { class: `piece ${signed ? 'signed' : 'silhouette'}${small ? ' small' : ''}` },
    h('span', { class: 'symbol', html: pieceSVG(piece, col) }),
    number != null && h('span', { class: 'number' }, number),
    name && h('span', { class: 'name' }, name));
}
