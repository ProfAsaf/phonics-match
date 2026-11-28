// Drawing the pet monster (and its egg) as SVG, from lookOf() in monster-pet.js. The class names
// (m-body, eyes, happy-eyes, mouth-open, mouth-shut, tongue) are what the CSS animates when it
// chomps, smiles or says yuck.
import { rng, lookOf, UNLOCKS } from './monster-pet.js';

const INK = '#2b2d42';
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
let uid = 0;

// Body outlines in a 200 x 210 box standing on y = 200, with where the face and limbs go.
const SHAPES = [
  { // gumdrop
    d: 'M 34 190 C 18 112 40 44 100 44 C 160 44 182 112 166 190 Z',
    top: 44, eyeY: 88, spread: 30, mouthY: 128, horn: [[68, 58], [132, 58]], arm: [[32, 146], [168, 146]], belly: [100, 162, 44, 26], feet: [70, 130], tail: [158, 172],
  },
  { // round
    d: 'M 100 52 C 150 52 178 92 178 130 C 178 168 146 190 100 190 C 54 190 22 168 22 130 C 22 92 50 52 100 52 Z',
    top: 52, eyeY: 102, spread: 31, mouthY: 140, horn: [[68, 64], [132, 64]], arm: [[26, 140], [174, 140]], belly: [100, 166, 46, 22], feet: [68, 132], tail: [168, 164],
  },
  { // tall pear
    d: 'M 100 30 C 134 30 148 62 146 94 C 170 122 172 162 156 190 L 44 190 C 28 162 30 122 54 94 C 52 62 66 30 100 30 Z',
    top: 30, eyeY: 72, spread: 22, mouthY: 110, horn: [[80, 40], [120, 40]], arm: [[44, 136], [156, 136]], belly: [100, 158, 40, 28], feet: [72, 128], tail: [158, 174],
  },
  { // wide bean
    d: 'M 100 84 C 160 84 190 114 186 152 C 184 180 166 192 140 192 L 60 192 C 34 192 16 180 14 152 C 10 114 40 84 100 84 Z',
    top: 84, eyeY: 120, spread: 38, mouthY: 156, horn: [[60, 96], [140, 96]], arm: [[16, 158], [184, 158]], belly: [100, 176, 50, 14], feet: [62, 138], tail: [178, 176],
  },
];

function eyes(L, S, baby) {
  const k = baby ? 1.2 : 1;
  const pts = L.eyes === 1 ? [[100, S.eyeY, 22 * k]]
    : L.eyes === 2 ? [[100 - S.spread, S.eyeY, 17 * k], [100 + S.spread, S.eyeY, 17 * k]]
      : [[100 - S.spread * 1.38, S.eyeY + 5, 13 * k], [100, S.eyeY - 9, 15 * k], [100 + S.spread * 1.38, S.eyeY + 5, 13 * k]];
  const open = pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle class="pupil" cx="${x + r * 0.12}" cy="${y + r * 0.18}" r="${r * 0.46}" fill="${INK}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.04}" r="${r * 0.15}" fill="#fff"/>`).join('');
  const happy = pts.map(([x, y, r]) => `M ${x - r * 0.8} ${y + 3} Q ${x} ${y - r * 0.95} ${x + r * 0.8} ${y + 3}`).join(' ');
  return `<g class="eyes">${open}</g><path class="happy-eyes" d="${happy}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
}

function mouth(L, S, baby) {
  const y = S.mouthY, w = baby ? 17 : 24;
  const teeth = L.fangs
    ? `<path d="M ${100 - w * 0.62} ${y + 1} l 5 ${w * 0.6} l 5 ${-w * 0.6} Z M ${100 + w * 0.62 - 10} ${y + 1} l 5 ${w * 0.6} l 5 ${-w * 0.6} Z" fill="#fff"/>`
    : `<path d="M ${100 - w * 0.55} ${y + 1} l 5 8 l 5 -7 Z M ${100 + w * 0.55 - 10} ${y + 1} l 5 7 l 5 -8 Z" fill="#fff"/>`;
  return `<g class="mouth-open" style="transform-origin: 100px ${y}px"><path d="M ${100 - w} ${y} Q 100 ${y + w * 1.5} ${100 + w} ${y} Z" fill="#7a1f3d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>${teeth}<ellipse cx="100" cy="${y + w * 0.92}" rx="${w * 0.5}" ry="${w * 0.2}" fill="#ff8fab"/></g>
  <path class="mouth-shut" d="M ${100 - w} ${y + 6} Q 100 ${y + 22} ${100 + w} ${y + 6}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <g class="tongue"><path d="M ${100 - w} ${y + 6} Q 100 ${y + 16} ${100 + w} ${y + 6}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M 92 ${y + 11} Q 100 ${y + 32} 110 ${y + 11}" fill="#ff8fab" stroke="${INK}" stroke-width="4"/></g>`;
}

// Horns or the like, drawn behind the body so their roots tuck under it.
function horns(L, S, body) {
  const [[ax, ay], [bx, by]] = S.horn;
  const out = [];
  if (L.horns === 'bobbles') { // berry antennae
    for (const [x, y, s] of [[ax, ay, -1], [bx, by, 1]]) {
      out.push(`<path d="M ${x} ${y + 10} Q ${x + s * 2} ${y - 22} ${x + s * 16} ${y - 36}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="${x + s * 16}" cy="${y - 38}" r="10" fill="${hsl(338, 78, 60)}" stroke="${INK}" stroke-width="4"/><circle cx="${x + s * 16 - 3}" cy="${y - 41}" r="3" fill="#fff" opacity=".8"/>`);
    }
  } else if (L.horns === 'leaves') { // veggie sprouts
    for (const [x, y, s] of [[ax, ay, -1], [bx, by, 1]]) {
      const tx = x + s * 22, ty = y - 34;
      out.push(`<path d="M ${x} ${y + 8} Q ${x + s * 30} ${y - 6} ${tx} ${ty} Q ${x - s * 6} ${y - 18} ${x} ${y + 8} Z" fill="${hsl(108, 58, 48)}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M ${x + s * 2} ${y + 2} Q ${x + s * 12} ${y - 12} ${tx - s * 3} ${ty + 4}" fill="none" stroke="${hsl(108, 60, 32)}" stroke-width="2.5"/>`);
    }
  } else if (L.horns === 'swirls') { // candy horns
    for (const [x, y, s] of [[ax, ay, -1], [bx, by, 1]]) {
      const B1 = [x - 9, y + 8], B2 = [x + 9, y + 8], T = [x + s * 12, y - 34];
      const at = (P, t) => [P[0] + (T[0] - P[0]) * t, P[1] + (T[1] - P[1]) * t];
      const stripes = [0.22, 0.5, 0.76].map((t) => { const p = at(B1, t), q = at(B2, t + 0.08); return `<path d="M ${p[0]} ${p[1]} L ${q[0]} ${q[1]}" stroke="${hsl(345, 80, 64)}" stroke-width="5.5"/>`; }).join('');
      out.push(`<path d="M ${B1[0]} ${B1[1]} L ${T[0]} ${T[1]} L ${B2[0]} ${B2[1]} Z" fill="#fff"/>${stripes}<path d="M ${B1[0]} ${B1[1]} L ${T[0]} ${T[1]} L ${B2[0]} ${B2[1]}" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
    }
  } else if (L.horns === 'spikes') { // a crest of cheesy spikes along the top
    for (const dx of [-32, 0, 32]) {
      const x = 100 + dx, y = S.top + 10 + Math.abs(dx) * 0.42;
      out.push(`<path d="M ${x - 15} ${y + 8} L ${x + dx * 0.2} ${y - 34 + Math.abs(dx) * 0.15} L ${x + 15} ${y + 8} Z" fill="${hsl(44, 90, 60)}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`);
    }
  } else if (L.horns === 'fins') { // a fishy fin on top
    const y = S.top + 10;
    out.push(`<path d="M 72 ${y} Q 70 ${y - 40} 100 ${y - 44} Q 132 ${y - 40} 128 ${y} Z" fill="${hsl(196, 72, 58)}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M 86 ${y - 2} L 88 ${y - 32} M 100 ${y - 2} L 100 ${y - 38} M 114 ${y - 2} L 112 ${y - 32}" stroke="${hsl(196, 70, 38)}" stroke-width="2.5" stroke-linecap="round"/>`);
  }
  return out.join('');
}

function pattern(L, S, clip) {
  const r = rng(L.seed * 7 + 3);
  const col = hsl(L.patternHue, L.sat + 6, L.light - 20);
  const out = [];
  const inBox = () => [26 + r() * 148, S.top + 18 + r() * (186 - S.top - 18)];
  if (L.pattern === 'spots') for (let i = 0; i < 9; i++) { const [x, y] = inBox(); out.push(`<circle cx="${x}" cy="${y}" r="${5 + r() * 7}" fill="${col}" opacity=".5"/>`); }
  else if (L.pattern === 'stripes') for (let y = S.top + 34; y < 200; y += 26) out.push(`<path d="M 0 ${y} Q 100 ${y + 16} 200 ${y}" fill="none" stroke="${col}" stroke-width="8" opacity=".42"/>`);
  else if (L.pattern === 'sprinkles') {
    const cols = ['#ff6b6b', '#ffd43b', '#4dabf7', '#51cf66', '#f783ac', '#ffffff'];
    for (let i = 0; i < 18; i++) { const [x, y] = inBox(); out.push(`<rect x="${x - 4.5}" y="${y - 1.8}" width="9" height="3.6" rx="1.8" fill="${cols[i % cols.length]}" transform="rotate(${Math.round(r() * 180)} ${x} ${y})"/>`); }
  } else if (L.pattern === 'freckles') for (let i = 0; i < 16; i++) { const [x, y] = inBox(); out.push(`<circle cx="${x}" cy="${y}" r="${2 + r() * 1.6}" fill="${col}" opacity=".6"/>`); }
  else if (L.pattern === 'scales') {
    const light = hsl(L.patternHue, L.sat, Math.min(90, L.light + 14));
    for (let y = S.top + 30, row = 0; y < 200; y += 15, row++) for (let x = 10 + (row % 2) * 10; x < 200; x += 20) out.push(`<path d="M ${x - 9} ${y} a 9 9 0 0 0 18 0" fill="none" stroke="${light}" stroke-width="3" opacity=".7"/>`);
  }
  return out.length ? `<g clip-path="url(#${clip})">${out.join('')}</g>` : '';
}

function tail(L, S, body, dark) {
  if (!L.tail) return '';
  const [x, y] = S.tail;
  const ex = x + 32, ey = y - 30;
  const path = `M ${x - 12} ${y + 6} Q ${x + 28} ${y + 6} ${ex} ${ey}`;
  const tips = {
    berry: `<path d="M ${ex} ${ey + 6} C ${ex - 14} ${ey - 4} ${ex - 8} ${ey - 18} ${ex} ${ey - 10} C ${ex + 8} ${ey - 18} ${ex + 14} ${ey - 4} ${ex} ${ey + 6} Z" fill="${hsl(345, 80, 62)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
    veg: `<path d="M ${ex - 4} ${ey + 4} Q ${ex - 2} ${ey - 22} ${ex + 18} ${ey - 24} Q ${ex + 16} ${ey - 2} ${ex - 4} ${ey + 4} Z" fill="${hsl(108, 58, 48)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
    sweet: `<circle cx="${ex + 2}" cy="${ey - 8}" r="12" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M ${ex + 2} ${ey - 8} m -7 0 a 7 7 0 1 1 7 7 a 4 4 0 1 1 -4 -4" fill="none" stroke="${hsl(345, 80, 64)}" stroke-width="3"/>`,
    pizza: `<path d="M ${ex - 9} ${ey + 4} L ${ex + 6} ${ey - 22} L ${ex + 11} ${ey + 6} Z" fill="${hsl(44, 90, 60)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
    fish: `<path d="M ${ex} ${ey} L ${ex + 18} ${ey - 18} Q ${ex + 10} ${ey} ${ex + 20} ${ey + 14} Z" fill="${hsl(196, 72, 58)}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
  };
  return `<path d="${path}" fill="none" stroke="${INK}" stroke-width="17" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${body}" stroke-width="9" stroke-linecap="round"/>${tips[L.tail] || ''}`;
}

// Every drawing sits in this box (room above for horns and hats, to the right for a tail).
const VB = { x: -14, y: -40, w: 238, h: 250 };
const VIEW = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;

// Where its mouth is, as fractions of the drawing's box (for flying treats into it).
export function mouthAt(m, look = lookOf(m)) {
  const S = SHAPES[look.shape];
  const y = 200 - (200 - S.mouthY) * look.scale + 8;
  return { x: (100 - VB.x) / VB.w, y: (y - VB.y) / VB.h };
}

// The monster. cls adds classes (e.g. 'mini' for the small pictures on covers); big draws a
// young one nearly full size (on buttons and panels, where there is nothing to compare it with).
export function monsterSVG(m, { look = lookOf(m), cls = '', big = false } = {}) {
  const L = big ? { ...look, scale: Math.max(0.9, look.scale) } : look, S = SHAPES[L.shape], baby = L.stage === 'baby';
  const body = hsl(L.hue, L.sat, L.light), dark = hsl(L.hue, L.sat + 4, L.light - 16), belly = hsl(L.hue, Math.max(20, L.sat - 16), Math.min(92, L.light + 16));
  const clip = `mclip${++uid}`;
  const [bx, by, brx, bry] = S.belly;
  const cheeks = (L.eyes === 1 ? S.spread + 30 : S.spread + 26);
  const hat = L.hat ? UNLOCKS.find((u) => u.id === L.hat) : null;
  const arms = S.arm.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="12" ry="18" fill="${body}" stroke="${INK}" stroke-width="4" transform="rotate(${i ? -28 : 28} ${x} ${y})"/>`).join('');
  const feet = S.feet.map((x) => `<ellipse cx="${x}" cy="196" rx="19" ry="9" fill="${dark}" stroke="${INK}" stroke-width="4"/>`).join('');
  return `<svg viewBox="${VIEW}" class="monster-svg ${cls}" aria-hidden="true"><defs><clipPath id="${clip}"><path d="${S.d}"/></clipPath></defs>
  <g transform="translate(100 200) scale(${L.scale}) translate(-100 -200)"><g class="m-body">
    ${tail(L, S, body, dark)}${horns(L, S, body)}${arms}
    <path d="${S.d}" fill="${body}"/>
    <ellipse cx="${bx}" cy="${by}" rx="${brx}" ry="${bry}" fill="${belly}" clip-path="url(#${clip})"/>
    ${pattern(L, S, clip)}
    <path d="${S.d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${feet}
    <ellipse cx="${100 - cheeks}" cy="${S.mouthY - 10}" rx="9" ry="6" fill="#ff8fab" opacity=".55"/><ellipse cx="${100 + cheeks}" cy="${S.mouthY - 10}" rx="9" ry="6" fill="#ff8fab" opacity=".55"/>
    ${eyes(L, S, baby)}${mouth(L, S, baby)}
    ${hat ? `<text class="m-hat" x="100" y="${S.top + 12}" font-size="60" text-anchor="middle">${hat.emoji}</text>` : ''}
  </g></g></svg>`;
}

// The egg in its nest; cracks show how close it is to hatching.
export function eggSVG(m, { cls = '' } = {}) {
  const r = rng(m.seed);
  const hue = lookOf(m).baseHue;
  const spots = Array.from({ length: 6 }, () => `<ellipse cx="${66 + r() * 68}" cy="${78 + r() * 92}" rx="${6 + r() * 8}" ry="${5 + r() * 6}" fill="${hsl(hue, 62, 66)}"/>`).join('');
  const w = m.warm || 0;
  const cracks = [
    'M 62 128 L 74 120 L 80 132 L 92 122 L 98 132',
    'M 104 104 L 112 114 L 122 106 L 128 118 L 138 112',
    'M 70 156 L 84 148 L 92 160 L 106 150 L 116 160 L 128 150',
  ].slice(0, w).map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const clip = `eclip${++uid}`;
  const egg = 'M 100 52 C 136 52 154 112 154 142 C 154 174 130 192 100 192 C 70 192 46 174 46 142 C 46 112 64 52 100 52 Z';
  return `<svg viewBox="${VIEW}" class="monster-svg egg-svg ${cls}" aria-hidden="true"><defs><clipPath id="${clip}"><path d="${egg}"/></clipPath></defs>
    <g class="m-body egg">
      <ellipse cx="100" cy="196" rx="74" ry="16" fill="#a0703c" stroke="${INK}" stroke-width="4"/>
      <path d="${egg}" fill="${hsl(hue, 40, 93)}"/>
      <g clip-path="url(#${clip})">${spots}<ellipse cx="82" cy="92" rx="10" ry="18" fill="#fff" opacity=".7" transform="rotate(20 82 92)"/></g>
      <path d="${egg}" fill="none" stroke="${INK}" stroke-width="5"/>
      ${cracks}
      <path d="M 30 192 Q 60 176 84 192 M 116 192 Q 140 176 170 192 M 46 200 Q 100 186 154 200" fill="none" stroke="#7a5230" stroke-width="5" stroke-linecap="round"/>
    </g></svg>`;
}
