// Small DOM helpers shared by the screens.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function fracHTML([n, d, whole]) {
  return `<span class="fracwrap">${whole ? `<span class="whole">${whole}</span>` : ''}<span class="frac"><span>${n}</span><span>${d}</span></span></span>`;
}

// What goes inside an answer: a picture, a cluster of emoji, a fraction, or text.
export function optionInner(o) {
  if (o.svg) return `<span class="o-svg">${o.svg}</span>`;
  if (o.emoji && o.count) return `<span class="o-cluster c${Math.min(o.count, 10)}">${`<i>${o.emoji}</i>`.repeat(o.count)}</span>`;
  if (o.emoji) return `<span class="o-emoji">${o.emoji}</span>${o.label ? `<span class="o-cap">${esc(o.label)}</span>` : ''}`;
  if (o.frac) return fracHTML(o.frac);
  const s = String(o.label);
  const size = s.length <= 2 ? 'xl' : s.length <= 4 ? 'l' : s.length <= 7 ? 'm' : s.length <= 12 ? 's' : 'xs';
  return `<span class="o-label ${size}${o.read ? ' read' : ''}">${esc(s)}</span>${o.sub ? `<span class="o-sub">${o.sub}</span>` : ''}`;
}
// Shrink answer text until it fits inside its balloon / token / plate / orb.
export function fitLabels(root) {
  for (const lab of root.querySelectorAll('.o-label')) {
    const box = lab.closest('.b-body, .tok, .dish, .orb-in') || lab.parentElement;
    const max = box.clientWidth * 0.84;
    if (!max) continue;
    let fs = parseFloat(getComputedStyle(lab).fontSize);
    for (let k = 0; k < 24 && lab.offsetWidth > max && fs > 9; k++) { fs *= 0.9; lab.style.fontSize = fs + 'px'; }
  }
}
export const maxLabel = (item) => Math.max(...item.options.map((o) => (o.svg || o.emoji || o.frac ? 0 : String(o.label).length)));

// Press and hold (for the grown-up door).
export function holdToOpen(el, ms, onOpen) {
  let t = null;
  const start = (e) => { e.preventDefault(); el.classList.add('holding'); t = setTimeout(() => { el.classList.remove('holding'); onOpen(); }, ms); };
  const stop = () => { clearTimeout(t); el.classList.remove('holding'); };
  el.addEventListener('pointerdown', start);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, stop));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function toast(msg, ms = 2200) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export function confirmBox(msg, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-card"><p>${esc(msg)}</p><div class="row"><button class="btn ghost" data-v="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div></div>`;
    el.addEventListener('click', (e) => { const v = e.target.closest('[data-v]')?.dataset.v; if (v != null) { el.remove(); resolve(v === '1'); } });
    document.body.appendChild(el);
  });
}

// Particles (confetti, hearts, sparkles) bursting from a point inside a container.
export function burst(container, x, y, { n = 14, chars = null, colors = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#9775fa', '#f783ac'], spread = 120 } = {}) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'particle' + (chars ? ' char' : '');
    if (chars) p.textContent = chars[i % chars.length];
    else p.style.background = colors[i % colors.length];
    const a = Math.random() * Math.PI * 2, r = spread * (0.5 + Math.random() * 0.7);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--dx', Math.cos(a) * r + 'px');
    p.style.setProperty('--dy', Math.sin(a) * r - 30 + 'px');
    p.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
    container.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}
export function centerIn(el, container) {
  const a = el.getBoundingClientRect(), b = container.getBoundingClientRect();
  return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
}
