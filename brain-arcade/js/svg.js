// Pure string builders for the pictures in questions: shapes, clocks, fractions, number lines,
// graphs, coins, rulers, base-ten blocks, ten frames, arrays, area grids, angles.
// No DOM here, so the question generators (and their tests) can run in Node.

export const PAL = ['#ff6b6b', '#ffa94d', '#f7c531', '#51cf66', '#4dabf7', '#9775fa', '#f783ac', '#20c997'];
const INK = '#36405a';

export const wrap = (w, h, body, cls = 'qsvg') =>
  `<svg class="${cls}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const txt = (x, y, s, size = 16, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${INK}" font-weight="700" ${extra}>${esc(s)}</text>`;

function regPoints(cx, cy, r, n, rotDeg = -90, radii = null) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((rotDeg + (360 / n) * i) * Math.PI) / 180;
    const rr = radii ? r * radii[i] : r;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return pts;
}
const ptsStr = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// ---------- 2D shapes ----------
// kind: circle oval square rectangle triangle right-triangle rhombus trapezoid parallelogram
//       pentagon hexagon octagon star heart kite, or poly3..poly8 (irregular n-gon, seed-stable)
export function shapeBody(kind, { color = PAL[4], rot = 0, cx = 50, cy = 50, r = 38, seed = 1, stroke = INK } = {}) {
  const st = `fill="${color}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"`;
  const T = `transform="rotate(${rot} ${cx} ${cy})"`;
  switch (kind) {
    case 'circle': return `<circle cx="${cx}" cy="${cy}" r="${r}" ${st}/>`;
    case 'oval': return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.62}" ${st} ${T}/>`;
    case 'square': return `<rect x="${cx - r * 0.8}" y="${cy - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" ${st} ${T}/>`;
    case 'rectangle': return `<rect x="${cx - r}" y="${cy - r * 0.55}" width="${r * 2}" height="${r * 1.1}" ${st} ${T}/>`;
    case 'triangle': return `<polygon points="${ptsStr(regPoints(cx, cy + r * 0.15, r * 1.05, 3))}" ${st} ${T}/>`;
    case 'right-triangle': return `<polygon points="${ptsStr([[cx - r * 0.8, cy - r * 0.8], [cx - r * 0.8, cy + r * 0.8], [cx + r * 0.8, cy + r * 0.8]])}" ${st} ${T}/>`;
    case 'rhombus': return `<polygon points="${ptsStr([[cx, cy - r], [cx + r * 0.62, cy], [cx, cy + r], [cx - r * 0.62, cy]])}" ${st} ${T}/>`;
    case 'kite': return `<polygon points="${ptsStr([[cx, cy - r], [cx + r * 0.55, cy - r * 0.25], [cx, cy + r], [cx - r * 0.55, cy - r * 0.25]])}" ${st} ${T}/>`;
    case 'trapezoid': return `<polygon points="${ptsStr([[cx - r * 0.5, cy - r * 0.5], [cx + r * 0.5, cy - r * 0.5], [cx + r, cy + r * 0.5], [cx - r, cy + r * 0.5]])}" ${st} ${T}/>`;
    case 'parallelogram': return `<polygon points="${ptsStr([[cx - r * 0.55, cy - r * 0.5], [cx + r, cy - r * 0.5], [cx + r * 0.55, cy + r * 0.5], [cx - r, cy + r * 0.5]])}" ${st} ${T}/>`;
    case 'pentagon': return `<polygon points="${ptsStr(regPoints(cx, cy + 3, r, 5))}" ${st} ${T}/>`;
    case 'hexagon': return `<polygon points="${ptsStr(regPoints(cx, cy, r, 6, 0))}" ${st} ${T}/>`;
    case 'octagon': return `<polygon points="${ptsStr(regPoints(cx, cy, r, 8, 22.5))}" ${st} ${T}/>`;
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        const rr = i % 2 ? r * 0.45 : r;
        pts.push([cx + rr * Math.cos(a), cy + 4 + rr * Math.sin(a)]);
      }
      return `<polygon points="${ptsStr(pts)}" ${st} ${T}/>`;
    }
    case 'heart': {
      const s = r / 38;
      return `<path d="M ${cx} ${cy + 30 * s} C ${cx - 50 * s} ${cy - 5 * s}, ${cx - 30 * s} ${cy - 42 * s}, ${cx} ${cy - 18 * s} C ${cx + 30 * s} ${cy - 42 * s}, ${cx + 50 * s} ${cy - 5 * s}, ${cx} ${cy + 30 * s} Z" ${st} ${T}/>`;
    }
    default: {
      const m = /^poly(\d)$/.exec(kind);
      if (m) {
        const n = +m[1];
        let s = seed;
        const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
        const radii = Array.from({ length: n }, () => 0.82 + rnd() * 0.18);
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = ((-90 + rot + (360 / n) * i + (rnd() - 0.5) * (120 / n)) * Math.PI) / 180;
          pts.push([cx + r * radii[i] * Math.cos(a), cy + r * radii[i] * Math.sin(a)]);
        }
        return `<polygon points="${ptsStr(pts)}" ${st}/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="${r}" ${st}/>`;
    }
  }
}
export const shapeSVG = (kind, opts = {}) => wrap(100, 100, shapeBody(kind, opts), 'qsvg shape');

// ---------- 3D shapes ----------
export function solidSVG(kind, color = PAL[4]) {
  const st = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  const light = '#ffffff55', dark = '#00000022';
  let b = '';
  switch (kind) {
    case 'cube':
      b = `<polygon points="25,38 60,38 60,78 25,78" fill="${color}" ${st}/>
           <polygon points="25,38 42,22 77,22 60,38" fill="${color}" ${st}/><polygon points="25,38 42,22 77,22 60,38" fill="${light}"/>
           <polygon points="60,38 77,22 77,62 60,78" fill="${color}" ${st}/><polygon points="60,38 77,22 77,62 60,78" fill="${dark}"/>`;
      break;
    case 'prism':
      b = `<polygon points="12,42 66,42 66,78 12,78" fill="${color}" ${st}/>
           <polygon points="12,42 30,28 84,28 66,42" fill="${color}" ${st}/><polygon points="12,42 30,28 84,28 66,42" fill="${light}"/>
           <polygon points="66,42 84,28 84,64 66,78" fill="${color}" ${st}/><polygon points="66,42 84,28 84,64 66,78" fill="${dark}"/>`;
      break;
    case 'sphere':
      b = `<circle cx="50" cy="50" r="34" fill="${color}" ${st}/><ellipse cx="50" cy="50" rx="34" ry="10" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/><circle cx="38" cy="38" r="9" fill="${light}"/>`;
      break;
    case 'cylinder':
      b = `<path d="M 26 26 L 26 74 A 24 9 0 0 0 74 74 L 74 26" fill="${color}" ${st}/><path d="M 26 26 L 26 74 A 24 9 0 0 0 74 74 L 74 26" fill="${dark}"/>
           <ellipse cx="50" cy="26" rx="24" ry="9" fill="${color}" ${st}/><ellipse cx="50" cy="26" rx="24" ry="9" fill="${light}"/>`;
      break;
    case 'cone':
      b = `<path d="M 50 14 L 24 74 A 26 9 0 0 0 76 74 Z" fill="${color}" ${st}/><path d="M 50 14 L 24 74 A 26 9 0 0 0 76 74 Z" fill="${dark}"/>
           <path d="M 24 74 A 26 9 0 0 1 76 74" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      break;
    case 'pyramid':
      b = `<polygon points="50,14 20,72 58,82" fill="${color}" ${st}/><polygon points="50,14 58,82 82,66" fill="${color}" ${st}/><polygon points="50,14 58,82 82,66" fill="${dark}"/>`;
      break;
  }
  return wrap(100, 100, b, 'qsvg shape');
}

// ---------- Clock ----------
export function clockSVG(h, m, { size = 120 } = {}) {
  const c = 60, R = 54;
  let b = `<circle cx="${c}" cy="${c}" r="${R}" fill="#fff" stroke="${INK}" stroke-width="4"/>`;
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 * Math.PI) / 180;
    const r1 = i % 5 ? R - 4 : R - 8;
    b += `<line x1="${c + r1 * Math.sin(a)}" y1="${c - r1 * Math.cos(a)}" x2="${c + (R - 1) * Math.sin(a)}" y2="${c - (R - 1) * Math.cos(a)}" stroke="${INK}" stroke-width="${i % 5 ? 1 : 2.5}"/>`;
  }
  for (let i = 1; i <= 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    b += txt(c + (R - 17) * Math.sin(a), c - (R - 17) * Math.cos(a) + 1, i, 12);
  }
  const ha = (((h % 12) + m / 60) * 30 * Math.PI) / 180;
  const ma = (m * 6 * Math.PI) / 180;
  b += `<line x1="${c}" y1="${c}" x2="${c + 28 * Math.sin(ha)}" y2="${c - 28 * Math.cos(ha)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  b += `<line x1="${c}" y1="${c}" x2="${c + 44 * Math.sin(ma)}" y2="${c - 44 * Math.cos(ma)}" stroke="#e8590c" stroke-width="3.5" stroke-linecap="round"/>`;
  b += `<circle cx="${c}" cy="${c}" r="4" fill="${INK}"/>`;
  return wrap(120, 120, b, 'qsvg clock');
}

// ---------- Fractions ----------
// parts: equal parts, or an array of part sizes (unequal). shaded: number of parts shaded (first k).
export function fractionSVG({ shape = 'rect', parts = 4, shaded = 1, color = PAL[0] } = {}) {
  const sizes = Array.isArray(parts) ? parts : Array(parts).fill(1);
  const total = sizes.reduce((a, x) => a + x, 0);
  let b = '';
  if (shape === 'circle') {
    const c = 50, R = 42;
    if (sizes.length === 1) {
      b += `<circle cx="${c}" cy="${c}" r="${R}" fill="${shaded ? color : '#fff'}" stroke="${INK}" stroke-width="3"/>`;
    } else {
      let a0 = -90;
      sizes.forEach((s, i) => {
        const a1 = a0 + (360 * s) / total;
        const p0 = [c + R * Math.cos((a0 * Math.PI) / 180), c + R * Math.sin((a0 * Math.PI) / 180)];
        const p1 = [c + R * Math.cos((a1 * Math.PI) / 180), c + R * Math.sin((a1 * Math.PI) / 180)];
        const large = a1 - a0 > 180 ? 1 : 0;
        b += `<path d="M ${c} ${c} L ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A ${R} ${R} 0 ${large} 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z" fill="${i < shaded ? color : '#fff'}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
        a0 = a1;
      });
    }
    return wrap(100, 100, b, 'qsvg frac');
  }
  // rect (square-ish) or bar (long strip)
  const W = shape === 'bar' ? 200 : 100, H = shape === 'bar' ? 40 : 80, x0 = 6, y0 = 6;
  let x = x0;
  sizes.forEach((s, i) => {
    const w = (W - 12) * (s / total);
    b += `<rect x="${x.toFixed(1)}" y="${y0}" width="${w.toFixed(1)}" height="${H - 12}" fill="${i < shaded ? color : '#fff'}" stroke="${INK}" stroke-width="3"/>`;
    x += w;
  });
  return wrap(W, H, b, 'qsvg frac');
}

// Fraction strips: rows of a whole cut into n parts, first k shaded.
export function stripsSVG(rows) {
  const W = 240, rowH = 34;
  let b = '';
  rows.forEach(({ n, k, color }, r) => {
    const y = 4 + r * (rowH + 6);
    for (let i = 0; i < n; i++) {
      const w = (W - 8) / n;
      b += `<rect x="${(4 + i * w).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rowH}" fill="${i < k ? color || PAL[r % PAL.length] : '#fff'}" stroke="${INK}" stroke-width="2.5"/>`;
      b += txt(4 + i * w + w / 2, y + rowH / 2, n === 1 ? '1' : `1/${n}`, n > 6 ? 10 : 13);
    }
  });
  return wrap(W, 8 + rows.length * (rowH + 6), b, 'qsvg strips');
}

// ---------- Number line ----------
// min..max with `div` divisions per whole; labels: 'whole' | 'all' | 'ends'; points: [{v, label?}]
export function numberLineSVG({ min = 0, max = 1, div = 4, labels = 'whole', points = [], fracLabels = false, tickLabelFn = null } = {}) {
  const W = 300, H = 70, x0 = 20, x1 = W - 20, y = 30;
  const X = (v) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  let b = `<line x1="${x0 - 8}" y1="${y}" x2="${x1 + 8}" y2="${y}" stroke="${INK}" stroke-width="3"/>`;
  const steps = Math.round((max - min) * div);
  for (let i = 0; i <= steps; i++) {
    const v = min + i / div;
    const whole = Math.abs(v - Math.round(v)) < 1e-9;
    b += `<line x1="${X(v)}" y1="${y - (whole ? 10 : 7)}" x2="${X(v)}" y2="${y + (whole ? 10 : 7)}" stroke="${INK}" stroke-width="${whole ? 3 : 2}"/>`;
    let lab = null;
    if (tickLabelFn) lab = tickLabelFn(v, i);
    else if (labels === 'all' || (labels === 'whole' && whole) || (labels === 'ends' && (i === 0 || i === steps))) lab = whole ? String(Math.round(v)) : fracLabels ? `${i % div}/${div}` : String(+v.toFixed(2));
    if (lab != null) b += txt(X(v), y + 24, lab, 14);
  }
  for (const p of points) {
    b += `<circle cx="${X(p.v)}" cy="${y}" r="7" fill="#e8590c" stroke="#fff" stroke-width="2"/>`;
    if (p.label) b += txt(X(p.v), y - 20, p.label, 14, 'fill="#e8590c"');
  }
  return wrap(W, H, b, 'qsvg nline');
}

// ---------- Graphs ----------
export function barGraphSVG({ bars, max, step = 1, title = '' }) {
  const W = 300, H = 210, left = 34, bottom = 170, top = title ? 30 : 12;
  const bw = Math.min(54, (W - left - 16) / bars.length - 14);
  const Y = (v) => bottom - (v / max) * (bottom - top);
  let b = title ? txt(W / 2, 13, title, 14) : '';
  for (let v = 0; v <= max; v += step) {
    b += `<line x1="${left}" y1="${Y(v)}" x2="${W - 8}" y2="${Y(v)}" stroke="#d0d6e2" stroke-width="1"/>`;
    b += txt(left - 14, Y(v), v, 11);
  }
  b += `<line x1="${left}" y1="${top - 4}" x2="${left}" y2="${bottom}" stroke="${INK}" stroke-width="2"/><line x1="${left}" y1="${bottom}" x2="${W - 8}" y2="${bottom}" stroke="${INK}" stroke-width="2"/>`;
  bars.forEach((bar, i) => {
    const cx = left + 14 + i * (bw + 14) + bw / 2;
    b += `<rect x="${cx - bw / 2}" y="${Y(bar.value)}" width="${bw}" height="${bottom - Y(bar.value)}" fill="${PAL[(i + 4) % PAL.length]}" stroke="${INK}" stroke-width="2" rx="3"/>`;
    b += `<text x="${cx}" y="${bottom + 22}" font-size="20" text-anchor="middle" dominant-baseline="central">${bar.emoji || ''}</text>`;
  });
  return wrap(W, H, b, 'qsvg graph');
}

export function picGraphHTML({ rows, key = 1, keyEmoji = '' }) {
  let h = '<div class="picgraph">';
  for (const r of rows) {
    const icons = Math.round(r.value / key);
    h += `<div class="pg-row"><span class="pg-lab">${r.emoji}</span><span class="pg-icons">${(r.icon || '⭐').repeat(icons)}</span></div>`;
  }
  if (key > 1) h += `<div class="pg-key">${keyEmoji || rows[0].icon || '⭐'} = ${key}</div>`;
  return h + '</div>';
}

// ---------- Coins and bills ----------
const COIN = {
  p: { r: 19, fill: '#c97a3d', edge: '#8a4d22', v: '1¢', name: 'penny' },
  n: { r: 21.5, fill: '#c8ccd2', edge: '#7f858f', v: '5¢', name: 'nickel' },
  d: { r: 17.5, fill: '#dfe3e8', edge: '#8d949e', v: '10¢', name: 'dime' },
  q: { r: 24.5, fill: '#d4d8de', edge: '#7a818b', v: '25¢', name: 'quarter' },
};
export const COIN_INFO = COIN;
export function coinBody(type, cx, cy, labeled) {
  const c = COIN[type];
  let b = `<circle cx="${cx}" cy="${cy}" r="${c.r}" fill="${c.fill}" stroke="${c.edge}" stroke-width="3"/>`;
  b += `<circle cx="${cx}" cy="${cy}" r="${c.r - 5}" fill="none" stroke="${c.edge}" stroke-width="1.2" stroke-dasharray="2 2"/>`;
  if (labeled) b += txt(cx, cy + 1, c.v, c.r > 20 ? 13 : 11);
  return b;
}
export function coinsSVG(list, { labeled = true } = {}) {
  // list: array of 'p','n','d','q', or {bill: 1|5}
  const items = list.map((t) => (typeof t === 'string' ? { t } : t));
  const perRow = 6;
  let b = '', x = 8, y = 32, rowMax = 0, W = 0;
  items.forEach((it, i) => {
    if (i && i % perRow === 0) { x = 8; y += 62; }
    if (it.bill) {
      b += `<rect x="${x}" y="${y - 22}" width="86" height="44" rx="5" fill="#b8d8b0" stroke="#4d7c45" stroke-width="3"/>`;
      b += `<ellipse cx="${x + 43}" cy="${y}" rx="14" ry="16" fill="#d6ead0" stroke="#4d7c45" stroke-width="1.5"/>` + txt(x + 43, y + 1, `$${it.bill}`, 13);
      x += 94;
    } else {
      const r = COIN[it.t].r;
      b += coinBody(it.t, x + r, y, labeled);
      x += r * 2 + 8;
    }
    W = Math.max(W, x);
    rowMax = y;
  });
  return wrap(Math.max(W, 60), rowMax + 32, b, 'qsvg coins');
}

// ---------- Ruler / measuring ----------
const OBJ_COLORS = { pencil: '#f7c531', crayon: '#ff6b6b', ribbon: '#9775fa', worm: '#f783ac', straw: '#4dabf7', key: '#c8a24a' };
function objectBar(kind, x0, x1, y) {
  const col = OBJ_COLORS[kind] || PAL[1];
  if (kind === 'pencil' || kind === 'crayon') {
    const tip = Math.min(14, (x1 - x0) * 0.25);
    return `<rect x="${x0}" y="${y - 8}" width="${x1 - x0 - tip}" height="16" fill="${col}" stroke="${INK}" stroke-width="2"/>` +
      `<polygon points="${x1 - tip},${y - 8} ${x1},${y} ${x1 - tip},${y + 8}" fill="${kind === 'pencil' ? '#f3d9b1' : col}" stroke="${INK}" stroke-width="2"/>`;
  }
  return `<rect x="${x0}" y="${y - 7}" width="${x1 - x0}" height="14" rx="7" fill="${col}" stroke="${INK}" stroke-width="2"/>`;
}
// unit: 'in' | 'cm'; ticks per unit: 4 (in) or 1 (cm); object from start to end (in units)
export function rulerSVG({ units = 6, unit = 'in', start = 0, end = 3, kind = 'pencil' } = {}) {
  const W = 320, x0 = 18, u = (W - 36) / units, y = 70;
  let b = objectBar(kind, x0 + start * u, x0 + end * u, 26);
  b += `<rect x="${x0 - 8}" y="${y - 22}" width="${units * u + 16}" height="40" rx="4" fill="#ffe8a3" stroke="${INK}" stroke-width="2"/>`;
  const sub = unit === 'in' ? 4 : 1;
  for (let i = 0; i <= units * sub; i++) {
    const x = x0 + (i / sub) * u, whole = i % sub === 0;
    b += `<line x1="${x}" y1="${y - 22}" x2="${x}" y2="${y - 22 + (whole ? 16 : i % 2 ? 7 : 10)}" stroke="${INK}" stroke-width="${whole ? 2 : 1}"/>`;
    if (whole) b += txt(x, y + 6, i / sub, 12);
  }
  b += `<line x1="${x0 + start * u}" y1="34" x2="${x0 + start * u}" y2="${y - 22}" stroke="#e8590c" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  b += `<line x1="${x0 + end * u}" y1="34" x2="${x0 + end * u}" y2="${y - 22}" stroke="#e8590c" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  b += txt(W - 22, y + 6, unit, 11);
  return wrap(W, 100, b, 'qsvg ruler');
}
export function cubesMeasureSVG({ n = 5, len = 5, kind = 'crayon' } = {}) {
  const u = 32, x0 = 14, W = x0 * 2 + Math.max(n, len) * u;
  let b = objectBar(kind, x0, x0 + len * u, 22);
  for (let i = 0; i < n; i++) b += `<rect x="${x0 + i * u}" y="40" width="${u}" height="${u}" fill="${PAL[i % 2 ? 4 : 3]}" stroke="${INK}" stroke-width="2" rx="3"/>`;
  return wrap(W, 80, b, 'qsvg cubes');
}
// A single object of given length on a fixed-width canvas (for "which is longest?" options).
export function lengthSVG(len, maxLen, kind = 'pencil') {
  const W = 220, u = (W - 20) / maxLen;
  return wrap(W, 40, objectBar(kind, 10, 10 + len * u, 20), 'qsvg len');
}
export function towerSVG(h, maxH, color = PAL[4]) {
  const u = Math.min(16, 150 / maxH), W = 40, H = maxH * u + 8;
  let b = '';
  for (let i = 0; i < h; i++) b += `<rect x="10" y="${H - 4 - (i + 1) * u}" width="20" height="${u}" fill="${color}" stroke="${INK}" stroke-width="1.5"/>`;
  return wrap(W, H, b, 'qsvg tower');
}

// ---------- Base-ten blocks ----------
export function blocksSVG({ h = 0, t = 0, o = 0 }) {
  const u = 9;
  let b = '', x = 6;
  for (let i = 0; i < h; i++) {
    b += `<rect x="${x}" y="6" width="${u * 10}" height="${u * 10}" fill="${PAL[4]}" stroke="${INK}" stroke-width="2"/>`;
    for (let k = 1; k < 10; k++) b += `<line x1="${x + k * u}" y1="6" x2="${x + k * u}" y2="${6 + u * 10}" stroke="${INK}" stroke-width="0.7"/><line x1="${x}" y1="${6 + k * u}" x2="${x + u * 10}" y2="${6 + k * u}" stroke="${INK}" stroke-width="0.7"/>`;
    x += u * 10 + 10;
  }
  for (let i = 0; i < t; i++) {
    b += `<rect x="${x}" y="6" width="${u}" height="${u * 10}" fill="${PAL[3]}" stroke="${INK}" stroke-width="2"/>`;
    for (let k = 1; k < 10; k++) b += `<line x1="${x}" y1="${6 + k * u}" x2="${x + u}" y2="${6 + k * u}" stroke="${INK}" stroke-width="0.7"/>`;
    x += u + 6;
  }
  x += 6;
  for (let i = 0; i < o; i++) {
    const col = i % 5, row = Math.floor(i / 5);
    b += `<rect x="${x + col * (u + 4)}" y="${6 + u * 10 - (row + 1) * (u + 4) + 4}" width="${u}" height="${u}" fill="${PAL[1]}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  x += o ? Math.min(o, 5) * (u + 4) : 0;
  return wrap(Math.max(x + 6, 40), u * 10 + 12, b, 'qsvg blocks');
}

// ---------- Ten frames, arrays, groups ----------
export function tenFrameSVG(n, color = PAL[0]) {
  const frames = Math.max(1, Math.ceil(n / 10)), u = 30;
  let b = '';
  for (let f = 0; f < frames; f++) {
    const y0 = 4 + f * (u * 2 + 12);
    for (let i = 0; i < 10; i++) {
      const x = 4 + (i % 5) * u, y = y0 + Math.floor(i / 5) * u;
      b += `<rect x="${x}" y="${y}" width="${u}" height="${u}" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      if (f * 10 + i < n) b += `<circle cx="${x + u / 2}" cy="${y + u / 2}" r="${u * 0.36}" fill="${color}"/>`;
    }
  }
  return wrap(u * 5 + 8, frames * (u * 2 + 12) - 4, b, 'qsvg tenframe');
}

export function arraySVG(rows, cols, color = PAL[5]) {
  const u = Math.min(28, 220 / Math.max(rows, cols));
  let b = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) b += `<circle cx="${8 + c * u + u / 2}" cy="${8 + r * u + u / 2}" r="${u * 0.36}" fill="${color}"/>`;
  return wrap(cols * u + 16, rows * u + 16, b, 'qsvg array');
}

// Area figure: list of [row, col] unit squares.
export function gridAreaSVG(cells, { color = PAL[4], showGrid = true } = {}) {
  const rows = Math.max(...cells.map((c) => c[0])) + 1, cols = Math.max(...cells.map((c) => c[1])) + 1;
  const u = Math.min(30, 230 / Math.max(rows, cols));
  let b = '';
  if (showGrid) for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) b += `<circle cx="${6 + c * u}" cy="${6 + r * u}" r="1.3" fill="#9aa3b5"/>`;
  for (const [r, c] of cells) b += `<rect x="${6 + c * u}" y="${6 + r * u}" width="${u}" height="${u}" fill="${color}" stroke="${INK}" stroke-width="1.5"/>`;
  return wrap(cols * u + 12, rows * u + 12, b, 'qsvg grid');
}

// Rectangle with side labels (not to scale beyond a rough ratio).
export function rectDimSVG(w, h, unit = 'cm') {
  const s = Math.min(150 / w, 90 / h, 18);
  const W = Math.max(60, w * s), H = Math.max(36, h * s);
  let b = `<rect x="40" y="18" width="${W}" height="${H}" fill="${PAL[3]}55" stroke="${INK}" stroke-width="3"/>`;
  b += txt(40 + W / 2, 9, `${w} ${unit}`, 13) + txt(20, 18 + H / 2, `${h} ${unit}`, 13, `transform="rotate(-90 20 ${18 + H / 2})"`);
  return wrap(W + 60, H + 30, b, 'qsvg rectdim');
}

// ---------- Angles and symmetry ----------
export function angleSVG(deg) {
  const cx = 30, cy = 80, L = 90;
  const a = (deg * Math.PI) / 180;
  let b = `<line x1="${cx}" y1="${cy}" x2="${cx + L}" y2="${cy}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  b += `<line x1="${cx}" y1="${cy}" x2="${cx + L * Math.cos(a)}" y2="${cy - L * Math.sin(a)}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  if (Math.abs(deg - 90) < 1) b += `<polyline points="${cx + 16},${cy} ${cx + 16},${cy - 16} ${cx},${cy - 16}" fill="none" stroke="#e8590c" stroke-width="2.5"/>`;
  else b += `<path d="M ${cx + 22} ${cy} A 22 22 0 ${deg > 180 ? 1 : 0} 0 ${cx + 22 * Math.cos(a)} ${cy - 22 * Math.sin(a)}" fill="none" stroke="#e8590c" stroke-width="2.5"/>`;
  return wrap(150, 100, b, 'qsvg angle');
}

export function symmetrySVG(kind, line, color = PAL[6]) {
  // line: 'v' | 'h' | 'd' (diagonal) | 'off' (vertical but off-center)
  let b = shapeBody(kind, { color, cx: 50, cy: 50, r: 38 });
  const L = { v: [50, 4, 50, 96], h: [4, 50, 96, 50], d: [12, 12, 88, 88], off: [36, 4, 36, 96], d2: [88, 12, 12, 88] }[line];
  b += `<line x1="${L[0]}" y1="${L[1]}" x2="${L[2]}" y2="${L[3]}" stroke="${INK}" stroke-width="3" stroke-dasharray="7 5"/>`;
  return wrap(100, 100, b, 'qsvg shape');
}

// ---------- Emoji pictures (HTML) ----------
export function emojiGroupHTML(e, n, { cross = 0, cls = '' } = {}) {
  let h = `<span class="egroup ${cls}">`;
  for (let i = 0; i < n; i++) h += `<span class="e${i >= n - cross ? ' crossed' : ''}">${e}</span>`;
  return h + '</span>';
}
export function emojiSumHTML(parts) {
  // parts: [{e, n, cross}, '+', {e, n}] -> joined
  return `<div class="esum">${parts.map((p) => (typeof p === 'string' ? `<span class="eop">${p}</span>` : emojiGroupHTML(p.e, p.n, p))).join('')}</div>`;
}
export function seqHTML(items) {
  return `<div class="seq">${items.map((s) => `<span class="seq-tile${s === '?' ? ' q' : ''}">${s}</span>`).join('')}</div>`;
}
export function bigTextHTML(s, cls = '') {
  return `<div class="bigtext ${cls}">${esc(s)}</div>`;
}
export function vertMathHTML(a, b, op) {
  const w = Math.max(String(a).length, String(b).length + 1);
  const pad = (s) => String(s).padStart(w, ' ');
  return `<div class="vmath"><div>${pad(a).replace(/ /g, '&nbsp;')}</div><div>${op}${pad(b).slice(1).replace(/ /g, '&nbsp;')}</div><div class="vline"></div><div>?</div></div>`;
}
export const escapeHTML = esc;
