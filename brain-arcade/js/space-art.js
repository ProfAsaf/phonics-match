// Drawings for Rocket Ride: the rocket, a planet for each stop, and the alien friends. SVG strings,
// in the same chunky outlined style as the pet monsters.
import { rng } from './space.js';

const INK = '#2b2d42';
let uid = 0;

export const ROCKET_SVG = `<svg viewBox="0 0 60 112" class="rocket-svg" aria-hidden="true">
  <g class="r-flame"><path d="M 20 82 Q 30 116 40 82 Z" fill="#ff922b"/><path d="M 25 82 Q 30 101 35 82 Z" fill="#fff3bf"/></g>
  <path d="M 17 56 L 4 84 Q 10 86 18 80 Z M 43 56 L 56 84 Q 50 86 42 80 Z" fill="#fa5252" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M 30 4 C 45 18 47 44 44 82 L 16 82 C 13 44 15 18 30 4 Z" fill="#f8f9fa" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M 30 4 C 37 11 41 18 43 27 L 17 27 C 19 18 23 11 30 4 Z" fill="#fa5252" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M 15.5 66 L 44.5 66" stroke="#fa5252" stroke-width="6"/>
  <circle cx="30" cy="44" r="8.5" fill="#74c0fc" stroke="${INK}" stroke-width="3.5"/><circle cx="27" cy="41" r="2.6" fill="#fff"/>
  <path d="M 30 82 L 30 74" stroke="${INK}" stroke-width="3" opacity=".25"/>
</svg>`;

// Planets: a disc with its own markings, clipped to the disc, with an outline. Size: viewBox 100.
const PL = {
  moon: { c: ['#efeadf', '#c9c1ae'], f: (r) => craters(r, '#b5ac98', 7) },
  mars: { c: ['#ff8a5c', '#c2452a'], f: (r) => `<path d="M 8 58 Q 30 50 46 62 T 92 56 L 92 72 Q 60 80 30 70 T 8 74 Z" fill="#a83822" opacity=".55"/><path d="M 26 34 Q 40 28 50 38 Q 40 46 26 34 Z" fill="#a83822" opacity=".5"/><ellipse cx="50" cy="9" rx="20" ry="7" fill="#fff"/>` },
  ceres: { c: ['#c9c0b4', '#8d8478'], f: (r) => `${craters(r, '#7a7166', 6)}<circle cx="58" cy="40" r="3.5" fill="#fff"/><circle cx="63" cy="43" r="2" fill="#fff"/>` },
  jupiter: { c: ['#f5dcbc', '#c98b5b'], f: () => `<path d="M 0 22 H 100 V 31 H 0 Z M 0 42 H 100 V 50 H 0 Z M 0 62 H 100 V 70 H 0 Z M 0 78 H 100 V 83 H 0 Z" fill="#c98b5b" opacity=".75"/><path d="M 0 36 H 100 V 39 H 0 Z" fill="#fff" opacity=".5"/><ellipse cx="64" cy="66" rx="11" ry="6.5" fill="#c0392b" stroke="#8e2a1f" stroke-width="2"/>` },
  europa: { c: ['#fbf3e2', '#d9c7a4'], f: () => `<path d="M 10 30 Q 40 42 60 20 T 96 30 M 4 60 Q 34 48 52 70 T 96 66 M 30 10 Q 36 50 24 92 M 70 8 Q 62 50 78 94" fill="none" stroke="#b5654a" stroke-width="2.5" opacity=".7"/>` },
  saturn: { c: ['#f6e3a8', '#d1a95c'], ring: '#e0c27a', f: () => `<path d="M 0 34 H 100 V 40 H 0 Z M 0 56 H 100 V 61 H 0 Z" fill="#c9a050" opacity=".6"/>` },
  titan: { c: ['#ffd27f', '#d98a2b'], f: () => `<ellipse cx="50" cy="30" rx="60" ry="14" fill="#fff" opacity=".22"/><ellipse cx="40" cy="70" rx="50" ry="10" fill="#b86b1c" opacity=".3"/>` },
  uranus: { c: ['#c8f4f7', '#6cc9d3'], f: () => `<path d="M 47 0 V 100 M 53 0 V 100" stroke="#fff" stroke-width="2.5" opacity=".45"/>` },
  neptune: { c: ['#7ea6ff', '#2f55c8'], f: () => `<ellipse cx="38" cy="56" rx="11" ry="6" fill="#1d3a91"/><path d="M 14 34 Q 40 30 66 36 M 30 76 Q 56 72 84 78" stroke="#dbe7ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>` },
  pluto: { c: ['#e2c4a0', '#a87b55'], f: () => `<path d="M 60 76 C 40 64 34 50 44 42 C 52 36 58 42 60 48 C 62 42 70 36 77 42 C 86 50 80 64 60 76 Z" fill="#fbf1e2"/>${craters(rng(4), '#8f6544', 3)}` },
  comet: { c: ['#f1fbff', '#a5d8ff'], tail: true, f: () => `<circle cx="40" cy="40" r="8" fill="#fff" opacity=".8"/>` },
  proxima: { c: ['#ffd8a8', '#ff5d3a'], star: true, f: () => `<circle cx="36" cy="60" r="7" fill="#e8402a" opacity=".5"/><circle cx="66" cy="34" r="5" fill="#e8402a" opacity=".45"/>` },
  candy: { c: ['#ffd6ea', '#f06595'], f: () => `<path d="M -10 20 L 110 -20 L 110 -4 L -10 36 Z M -10 52 L 110 12 L 110 28 L -10 68 Z M -10 84 L 110 44 L 110 60 L -10 100 Z" fill="#fff" opacity=".85"/>` },
  jelly: { c: ['#b2f2bb', '#37b24d'], f: () => `<circle cx="34" cy="62" r="7" fill="#fff" opacity=".5"/><circle cx="62" cy="72" r="4" fill="#fff" opacity=".5"/><circle cx="68" cy="44" r="5" fill="#fff" opacity=".4"/><ellipse cx="34" cy="26" rx="16" ry="7" fill="#fff" opacity=".55" transform="rotate(-25 34 26)"/>` },
  dino: { c: ['#8ce99a', '#2f9e44'], emoji: '🦕', f: () => `<path d="M 6 44 Q 30 34 44 46 T 80 40 L 100 60 L 100 100 L 0 100 L 0 60 Z" fill="#74c0fc" opacity=".8"/><path d="M 56 30 L 64 14 L 72 30 Z" fill="#a9502a"/><circle cx="64" cy="12" r="4" fill="#ff922b"/>` },
  crystal: { c: ['#e5dbff', '#7950f2'], f: () => `<path d="M 50 4 L 70 40 L 50 96 L 30 40 Z M 4 50 L 30 40 L 50 96 Z M 96 50 L 70 40 L 50 96 Z" fill="#fff" opacity=".25" stroke="#fff" stroke-width="1.5"/>` },
  bubble: { c: ['#e3fafc', '#66d9e8'], f: () => [[30, 30, 10], [62, 26, 7], [52, 62, 13], [24, 70, 6], [78, 58, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.2}" fill="#fff"/>`).join('') },
  robot: { c: ['#dee2e6', '#868e96'], f: () => `<path d="M 0 36 H 100 M 0 66 H 100 M 34 0 V 36 M 66 36 V 66 M 40 66 V 100" stroke="#495057" stroke-width="2.5"/>${[[18, 18], [80, 50], [24, 82], [58, 20]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#495057"/>`).join('')}<circle cx="50" cy="52" r="7" fill="#ffd43b" stroke="#495057" stroke-width="2"/>` },
  rainbow: { c: ['#fff', '#fff'], f: () => ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].map((col, i) => `<rect x="0" y="${i * 17}" width="100" height="17" fill="${col}"/>`).join('') },
  music: { c: ['#c3fae8', '#20c997'], f: () => `<text x="30" y="46" font-size="26" fill="#087f5b" opacity=".75">♪</text><text x="56" y="76" font-size="30" fill="#087f5b" opacity=".75">♫</text>` },
};
function craters(r, col, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${14 + r() * 72}" cy="${14 + r() * 72}" r="${3 + r() * 8}" fill="${col}" opacity=".7" stroke="${col}" stroke-width="1"/>`;
  return s;
}

export function planetSVG(id, { cls = '' } = {}) {
  const p = PL[id] || PL.moon;
  const g = `pg${++uid}`, k = `pk${uid}`;
  const r = rng(id.length * 97 + id.charCodeAt(0));
  const glow = p.star ? `<circle cx="50" cy="50" r="50" fill="url(#${g}s)"/>` : '';
  const ring = p.ring ? (front) => `<ellipse cx="50" cy="50" rx="74" ry="17" fill="none" stroke="${p.ring}" stroke-width="7" transform="rotate(-14 50 50)" ${front ? `clip-path="url(#${k}f)"` : `clip-path="url(#${k}b)"`}/>` : () => '';
  const tail = p.tail ? `<path d="M 80 26 Q 118 40 132 98 Q 120 122 100 128 Q 84 72 26 80 Q 40 58 50 50 Q 58 40 80 26 Z" fill="url(#${g}t)"/><path d="M 72 40 Q 104 62 112 126" fill="none" stroke="#a5d8ff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M 56 64 Q 82 80 126 112" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>` : '';
  return `<svg viewBox="-30 -30 160 160" class="planet-svg ${cls}" aria-hidden="true"><defs>
    <radialGradient id="${g}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${p.c[0]}"/><stop offset="1" stop-color="${p.c[1]}"/></radialGradient>
    ${p.star ? `<radialGradient id="${g}s"><stop offset=".55" stop-color="#ff8c5a" stop-opacity=".55"/><stop offset="1" stop-color="#ff8c5a" stop-opacity="0"/></radialGradient>` : ''}
    ${p.tail ? `<linearGradient id="${g}t" x1=".3" y1=".3" x2="1" y2="1"><stop offset="0" stop-color="#f1fbff" stop-opacity=".95"/><stop offset="1" stop-color="#a5d8ff" stop-opacity="0"/></linearGradient>` : ''}
    <clipPath id="${k}"><circle cx="50" cy="50" r="42"/></clipPath>
    <clipPath id="${k}b"><rect x="-40" y="-40" width="180" height="90"/></clipPath><clipPath id="${k}f"><rect x="-40" y="50" width="180" height="90"/></clipPath>
  </defs>
  ${p.star ? `<g transform="translate(50 50) scale(1.5) translate(-50 -50)">${glow}</g>` : ''}${tail}${ring(false)}
  <circle cx="50" cy="50" r="42" fill="url(#${g})"/>
  <g clip-path="url(#${k})">${p.f(r)}<circle cx="64" cy="66" r="44" fill="#000" opacity=".12"/></g>
  <circle cx="50" cy="50" r="42" fill="none" stroke="${INK}" stroke-width="3.5"/>
  ${ring(true)}${p.emoji ? `<text x="50" y="16" font-size="30" text-anchor="middle">${p.emoji}</text>` : ''}
  </svg>`;
}

// An alien friend, from its seed and colour: a big head, eyes (1 to 3), antennae, a waving arm.
export function alienSVG(friend, { cls = '' } = {}) {
  const r = rng(friend.seed);
  const hue = friend.hue;
  const body = `hsl(${hue} 62% 62%)`, dark = `hsl(${hue} 55% 42%)`, light = `hsl(${hue} 70% 80%)`, pop = `hsl(${(hue + 150) % 360} 80% 62%)`;
  const hw = 26 + r() * 10, hh = 22 + r() * 9; // head half-sizes
  const eyes = [1, 2, 2, 3][Math.floor(r() * 4)];
  const ant = Math.floor(r() * 3); // 0 none, 1 one, 2 two
  const spots = Math.floor(r() * 4);
  const hy = 52;
  const eyeR = eyes === 1 ? 11 : eyes === 2 ? 8 : 6.5;
  const ex = eyes === 1 ? [50] : eyes === 2 ? [50 - hw * 0.38, 50 + hw * 0.38] : [50 - hw * 0.48, 50, 50 + hw * 0.48];
  const ey = (i) => hy - 2 - (eyes === 3 && i === 1 ? 6 : 0);
  const eyeSvg = ex.map((x, i) => `<ellipse cx="${x}" cy="${ey(i)}" rx="${eyeR}" ry="${eyeR * 1.15}" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${x + 1}" cy="${ey(i) + 2}" r="${eyeR * 0.55}" fill="${INK}"/><circle cx="${x + 2.6}" cy="${ey(i) - 0.5}" r="${eyeR * 0.2}" fill="#fff"/>`).join('');
  const antSvg = ant === 0 ? '' : (ant === 1 ? [50] : [50 - hw * 0.45, 50 + hw * 0.45]).map((x) => { const tx = x + (x - 50) * 0.5, ty = hy - hh - 18; return `<path d="M ${x} ${hy - hh + 4} Q ${x} ${ty + 6} ${tx} ${ty}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="${tx}" cy="${ty}" r="5" fill="${pop}" stroke="${INK}" stroke-width="2.5"/>`; }).join('');
  const spotSvg = Array.from({ length: spots }, () => `<circle cx="${50 + (r() - 0.5) * hw * 1.4}" cy="${hy - hh * 0.55 + r() * 6}" r="${2.5 + r() * 3}" fill="${light}" opacity=".8"/>`).join('');
  return `<svg viewBox="0 0 100 118" class="alien-svg ${cls}" aria-hidden="true">
    ${antSvg}
    <path d="M 38 ${hy + hh - 6} Q 30 102 36 108 L 64 108 Q 70 102 62 ${hy + hh - 6} Z" fill="${body}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M 38 ${hy + hh + 4} Q 22 ${hy + hh + 10} 20 ${hy + hh + 20}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M 38 ${hy + hh + 4} Q 22 ${hy + hh + 10} 20 ${hy + hh + 20}" fill="none" stroke="${body}" stroke-width="3.5" stroke-linecap="round"/>
    <g class="a-wave" style="transform-origin: 62px ${hy + hh + 4}px"><path d="M 62 ${hy + hh + 4} Q 78 ${hy + hh - 4} 82 ${hy + hh - 18}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M 62 ${hy + hh + 4} Q 78 ${hy + hh - 4} 82 ${hy + hh - 18}" fill="none" stroke="${body}" stroke-width="3.5" stroke-linecap="round"/></g>
    <ellipse cx="42" cy="110" rx="9" ry="4.5" fill="${dark}" stroke="${INK}" stroke-width="2.5"/><ellipse cx="58" cy="110" rx="9" ry="4.5" fill="${dark}" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="50" cy="${hy}" rx="${hw}" ry="${hh}" fill="${body}" stroke="${INK}" stroke-width="3.5"/>
    ${spotSvg}${eyeSvg}
    <path d="M ${44} ${hy + hh * 0.5} Q 50 ${hy + hh * 0.5 + 7} ${56} ${hy + hh * 0.5}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
