// Pixel art for a blocky look: textured blocks drawn from tiny 8 by 8 patterns, pixel sprites
// from text maps, and square particles. Original art only, with no textures, creatures, or
// characters from any real game. Everything is SVG with crisp square pixels.

// The day's route on the world map (360 by 520): the start, then the eight stops.
export const ROUTE = [[180, 506], [88, 462], [178, 420], [278, 380], [266, 314], [164, 290], [76, 236], [162, 182], [266, 130]];

// The point at fraction t of the way from route point i to point i + 1, on a smooth curve, so
// the walking player follows the path.
export function routeAt(i, t) {
  const pts = ROUTE;
  const p0 = pts[i - 1] ?? pts[i];
  const [p1, p2] = [pts[i], pts[i + 1] ?? pts[i]];
  const p3 = pts[i + 2] ?? p2;
  const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
  const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * p1[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p2[k]);
}

// The stops of a day, in the order he meets them: six levels, then halftime and the trophy.
export const STOP_KINDS = ['stadium', 'castle', 'mine', 'show', 'workshop', 'islands', 'night', 'trophy'];
export const CHARACTERS = ['striker', 'keeper', 'fox', 'robot'];

// ---- Textures: each is an 8 by 8 grid of colors, made by a seeded random so it never changes.
function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const pickFrom = (r, pal, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r() * total;
  for (let i = 0; i < pal.length; i++) if ((x -= weights[i]) < 0) return pal[i];
  return pal[0];
};
const noise = (seed, pal, weights = [5, 3, 2, 1]) => {
  const r = rand(seed);
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => pickFrom(r, pal, weights)));
};

const GREEN = ['#5fae3c', '#6cbf4a', '#4e9a33', '#7bd35a'];
const BROWN = ['#8b5a2b', '#9c6b3a', '#7a4b22', '#a8794a'];
const GRAY = ['#8d8d8d', '#9c9c9c', '#7f7f7f', '#a9a9a9'];

export const TEXTURES = {
  grass: () => noise(11, GREEN),
  grassSide: () => {
    const g = noise(12, BROWN);
    const r = rand(13);
    for (let x = 0; x < 8; x++) {
      g[0][x] = pickFrom(r, GREEN, [5, 3, 2, 1]);
      g[1][x] = pickFrom(r, GREEN, [5, 3, 2, 1]);
      if (r() < 0.55) g[2][x] = GREEN[2];
    }
    return g;
  },
  dirt: () => noise(14, BROWN),
  stone: () => noise(15, GRAY),
  cobble: () => {
    const g = noise(16, GRAY);
    const r = rand(17);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (r() < 0.2) g[y][x] = '#666666';
    return g;
  },
  planks: () => {
    const g = noise(18, ['#b8935a', '#ad8850', '#c29d64', '#a07c45'], [5, 3, 2, 1]);
    for (let x = 0; x < 8; x++) {
      g[3][x] = '#8a6a3a';
      g[7][x] = '#8a6a3a';
    }
    g[1][2] = g[2][2] = '#8a6a3a';
    g[5][6] = g[6][6] = '#8a6a3a';
    return g;
  },
  darkPlanks: () => {
    const g = noise(19, ['#5a3d22', '#4f351d', '#654529', '#46301a'], [5, 3, 2, 1]);
    for (let x = 0; x < 8; x++) {
      g[3][x] = '#36240f';
      g[7][x] = '#36240f';
    }
    return g;
  },
  log: () => {
    const g = noise(20, ['#6b4a2b', '#5a3d22', '#7a5733', '#4f351d'], [4, 4, 2, 1]);
    for (let y = 0; y < 8; y++) g[y][1] = g[y][5] = '#4f351d';
    return g;
  },
  leaves: () => {
    const g = noise(21, ['#3f9a3a', '#4fb048', '#2f7d2c', '#24601f'], [5, 3, 3, 1]);
    return g;
  },
  sand: () => noise(22, ['#e6d59a', '#dccb8c', '#efe0aa', '#d2c182']),
  snow: () => noise(23, ['#f4f8fb', '#e6eef4', '#ffffff', '#dde7ef']),
  water: () => {
    const g = noise(24, ['#3f76e4', '#4a85f0', '#3568d0', '#5a93f5']);
    g[2][1] = g[2][2] = g[5][5] = g[5][6] = '#9cc4ff';
    return g;
  },
  path: () => noise(25, ['#c9a46a', '#b8935a', '#d6b27a', '#a8834a']),
  gravel: () => noise(26, ['#9e9e9e', '#8a8a8a', '#b0aaa0', '#76716b']),
  gold: () => {
    const g = noise(27, ['#ffd54f', '#f2c037', '#ffe680', '#e0aa1e'], [5, 3, 2, 1]);
    for (let i = 0; i < 8; i++) {
      g[0][i] = '#fff0a6';
      g[i][0] = '#fff0a6';
      g[7][i] = '#c99a1a';
      g[i][7] = '#c99a1a';
    }
    return g;
  },
  bricks: () => {
    const g = noise(28, GRAY);
    for (let x = 0; x < 8; x++) {
      g[3][x] = '#5e5e5e';
      g[7][x] = '#5e5e5e';
    }
    for (let y = 0; y < 3; y++) g[y][3] = '#5e5e5e';
    for (let y = 4; y < 7; y++) g[y][7] = '#5e5e5e';
    return g;
  },
  obsidian: () => noise(29, ['#1f1630', '#2a1f42', '#15101f', '#3a2a5a']),
  glow: () => noise(30, ['#ffd86b', '#f5c242', '#fff0a0', '#e8a92a']),
  table: () => {
    const g = TEXTURES.planks();
    for (let x = 0; x < 8; x++) g[0][x] = '#d1ad72';
    g[2][2] = g[3][2] = g[4][2] = '#6b6b6b';
    g[2][1] = g[2][3] = '#6b6b6b';
    g[2][5] = g[3][5] = g[4][5] = '#8a6a3a';
    g[4][4] = g[4][6] = '#8a6a3a';
    return g;
  },
  note: () => {
    const g = TEXTURES.darkPlanks();
    for (const [y, x] of [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [5, 4], [6, 4], [6, 3], [5, 3], [1, 6], [2, 7]]) g[y][x] = '#e8a92a';
    return g;
  },
};

export function ore(color, seed = 31) {
  const g = noise(seed, GRAY);
  const r = rand(seed + 1);
  const light = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(r() * 6);
    const y = 1 + Math.floor(r() * 6);
    g[y][x] = color;
    if (x < 7) g[y][x + 1] = color;
    if (y < 7 && r() < 0.6) g[y + 1][x] = color;
    if (r() < 0.4) g[y][x] = light;
  }
  return g;
}

// A pattern element for a texture grid; blocks of `size` units tile without seams when they sit
// on the same grid.
export function patternDef(id, grid, size) {
  const p = size / 8;
  let rects = '';
  for (let y = 0; y < 8; y++) {
    let x = 0;
    while (x < 8) {
      let run = 1;
      while (x + run < 8 && grid[y][x + run] === grid[y][x]) run++;
      rects += `<rect x="${x * p}" y="${y * p}" width="${run * p + 0.02}" height="${p + 0.02}" fill="${grid[y][x]}"/>`;
      x += run;
    }
  }
  return `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${rects}</pattern>`;
}

// Defines textures as patterns plus a <symbol> per block, so a block can be drawn anywhere
// (moving ones too) with <use href="#prefix-name-b">.
export function blockDefs(prefix, size, names, extra = {}) {
  const grids = { ...Object.fromEntries(names.map(n => [n, TEXTURES[n]()])), ...extra };
  return Object.entries(grids).map(([name, grid]) => `${patternDef(`${prefix}-${name}`, grid, size)}
    <symbol id="${prefix}-${name}-b" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="url(#${prefix}-${name})"/></symbol>`).join('');
}

// ---- Sprites: pixel maps as rows of letters, one color per letter ('.' is clear).
export function spriteRects(rows, palette, px, ox = 0, oy = 0) {
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      if (c !== '.' && palette[c]) out += `<rect x="${ox + x * px}" y="${oy + y * px}" width="${run * px + 0.02}" height="${px + 0.02}" fill="${palette[c]}"/>`;
      x += run;
    }
  });
  return out;
}

// ---- The four players, blocky and front-facing: 10 pixels wide, 18 tall. Rows 0 to 13 are the
// head and body; the arms are columns 0 and 9 of rows 7 to 11; the legs are rows 14 to 17.
const HEADS = {
  striker: ['..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.SEWSSEWS.', '.SEESSEES.', '.SSSMMSSS.', '..SSSSSS..'],
  keeper: ['..YYYYYY..', '.YYYYYYYYY', '.YSSSSSSYY', '.SEWSSEWSY', '.SEESSEES.', '.SSSMMSSS.', '..SSSSSS..'],
  fox: ['.O......O.', '.OO....OO.', '.OOOOOOOO.', '.OEWOOEWO.', '.OEEOOEEO.', '.OWWNNWWO.', '..WWWWWW..'],
  robot: ['....R.....', '....L.....', '.LLLLLLLL.', '.LVCVVCVL.', '.LVVVVVVL.', '.LLLDDLLL.', '..DDDDDD..'],
};
const SKIN_OF = { striker: '#d9a06b', keeper: '#f2c7a0', fox: '#f08a3c', robot: '#c3ccd8' };
const ARM_OF = { striker: 'S', keeper: 'G', fox: 'Z', robot: 'D' };
const LEG_OF = { striker: 'S', keeper: 'S', fox: 'Z', robot: 'D' };

function playerPalette(kind, kit) {
  return {
    H: '#4a2c17', Y: '#e8b23a', S: SKIN_OF[kind], E: '#1f2937', W: '#ffffff', M: '#8a3a26', O: '#f08a3c', N: '#2b1d16',
    L: '#c3ccd8', D: '#7d899b', V: '#22344d', C: '#6ee7f9', R: '#ff5a5f', K: kit, k: shade(kit, -0.25), G: '#ffd23f', Z: '#6b4226', B: '#2b2f3a', T: '#ffffff',
  };
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

// The sprite with its feet at (0, 0); walking swings the arms and lifts each leg in turn.
export function pixelPlayer(kind, kit, px = 6, { walk = false, cheer = false } = {}) {
  const pal = playerPalette(kind, kit);
  const head = HEADS[kind] ?? HEADS.striker;
  const a = ARM_OF[kind];
  const l = LEG_OF[kind];
  const body = ['.kKKTTKKk.', '.KKKKKKKK.', '.KKKKKKKK.', '.KKKKKKKK.', '.kKKKKKKk.', '.TTTTTTTT.', '.TTT..TTT.'];
  const arms = ['K........K', 'K........K', 'K........K', a + '........' + a, a + '........' + a].map(r => r);
  const legL = [`.${l}${l}${l}......`, '.KKK......', '.KKK......', '.BBB......'];
  const legR = [`......${l}${l}${l}.`, '......KKK.', '......KKK.', '......BBB.'];
  const W = 10 * px;
  const H = 18 * px;
  const ox = -W / 2;
  const oy = -H;
  const tail = kind === 'fox' ? spriteRects(['..OO', '.OOO', 'OOW.', 'OW..'], { O: '#f08a3c', W: '#ffffff' }, px, ox + 9 * px, oy + 9 * px) : '';
  const pony = kind === 'keeper' ? spriteRects(['YY', 'YY', '.Y'], { Y: '#e8b23a' }, px, ox + 10 * px, oy + 2 * px) : '';
  const swing = (v, d) => (walk ? `<animateTransform attributeName="transform" type="translate" values="${v}" dur="${d}s" repeatCount="indefinite" calcMode="discrete"/>` : '');
  const lift = cheer ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 ${-2 * px};0 0" dur="0.5s" repeatCount="indefinite" calcMode="discrete"/>` : '';
  return `<g shape-rendering="crispEdges">
    <rect x="${ox + px}" y="${-px * 0.6}" width="${W - 2 * px}" height="${px}" fill="#000" opacity="0.18"/>
    <g>${lift}${tail}${pony}${spriteRects(head, pal, px, ox, oy)}${spriteRects(body, pal, px, ox, oy + 7 * px)}
      <g>${swing(`0 0;0 ${-px}`, 0.5)}${spriteRects(arms.map(r => r[0] + '.........'), pal, px, ox, oy + 7 * px)}</g>
      <g>${swing(`0 ${-px};0 0`, 0.5)}${spriteRects(arms.map(r => '.........' + r[9]), pal, px, ox, oy + 7 * px)}</g>
      <g>${swing(`0 0;0 ${-px}`, 0.5)}${spriteRects(legL, pal, px, ox, oy + 14 * px)}</g>
      <g>${swing(`0 ${-px};0 0`, 0.5)}${spriteRects(legR, pal, px, ox, oy + 14 * px)}</g></g></g>`;
}

// ---- Item sprites
const PIECES = {
  pawn: ['...XX...', '..XXXX..', '..XXXX..', '...XX...', '..XXXX..', '...XX...', '...XX...', '..XXXX..', '.XXXXXX.', '.XXXXXX.'],
  rook: ['.X.XX.X.', '.XXXXXX.', '.XXXXXX.', '..XXXX..', '..XXXX..', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX'],
  bishop: ['...XX...', '..XXXX..', '..XX.X..', '..X.XX..', '..XXXX..', '...XX...', '...XX...', '..XXXX..', '.XXXXXX.', '.XXXXXX.'],
  knight: ['..XXX...', '.XXXXX..', 'XXWXXXX.', 'XXXXXXX.', '...XXXX.', '..XXXX..', '..XXXX..', '..XXXX..', '.XXXXXX.', '.XXXXXX.'],
  queen: ['X.X..X.X', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '..XXXX..', '..XXXX..', '..XXXX..', '.XXXXXX.', '.XXXXXX.'],
  king: ['...XX...', '..XXXX..', '...XX...', '.XXXXXX.', '..XXXX..', '..XXXX..', '..XXXX..', '..XXXX..', '.XXXXXX.', '.XXXXXX.'],
};
export const pixelPiece = (name, color, px = 4, ox = 0, oy = 0) =>
  spriteRects(PIECES[name] ?? PIECES.pawn, { X: color, W: '#ffffff' }, px, ox, oy);

// A ball, 10 by 10, centered on (cx, cy); the second frame is turned, for rolling.
const BALL = ['...XXXX...', '.XXWWWWXX.', '.XWWBBWWX.', 'XWWBBBBWWX', 'XWBWBBWBWX', 'XWWWWWWWWX', 'XBWWWWWWBX', '.XBWWWWBX.', '.XXWBBWXX.', '...XXXX...'];
const BALL2 = ['...XXXX...', '.XXWBBWXX.', '.XBWWWWBX.', 'XBWWWWWWBX', 'XWWWWWWWWX', 'XWBWBBWBWX', 'XWWBBBBWWX', '.XWWBBWWX.', '.XXWWWWXX.', '...XXXX...'];
export const pixelBall = (px = 4, cx = 0, cy = 0, frame = 0) => spriteRects(frame ? BALL2 : BALL, { W: '#ffffff', B: '#24304a', X: '#24304a' }, px, cx - 5 * px, cy - 5 * px);

const GEM = ['..XXXX..', '.XWXXXX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'];
export const pixelGem = (color, px = 4, ox = 0, oy = 0) => spriteRects(GEM, { X: color, W: '#ffffff' }, px, ox, oy);

const PICK = ['.GGGGGG.', 'GG....GG', 'G..BB..G', '...BB...', '...BB...', '...BB...', '...BB...', '...BB...'];
const TORCH = ['.FF.', 'FYYF', '.YY.', '.BB.', '.BB.', '.BB.', '.BB.', '.BB.'];
const CART = ['XXXXXXXXXXXX', 'XDDDDDDDDDDX', 'XDDDDDDDDDDX', '.XXXXXXXXXX.', '..WW....WW..', '..WW....WW..'];
const TROPHY = ['YYYYYYYYYY', 'Y.YYYYYY.Y', 'Y.YYWYYY.Y', '.YYYYYYYY.', '..YYYYYY..', '...YYYY...', '....YY....', '....YY....', '..BBBBBB..', '..BBBBBB..'];
const NOTE = ['...XXX', '...X.X', '...X..', '...X..', '.XXX..', 'XXXX..', '.XX...'];
export const pixelTorch = (px = 6, ox = 0, oy = 0) => `<g>${spriteRects(TORCH, { F: '#ff7a1a', Y: '#ffd23f', B: '#8a5f37' }, px, ox, oy)}<rect x="${ox + px}" y="${oy}" width="${2 * px}" height="${px}" fill="#fff3a0"><animate attributeName="opacity" values="1;0.2;0.8;0.3;1" dur="0.7s" repeatCount="indefinite" calcMode="discrete"/></rect></g>`;

// ---- The world map in blocks: the same route and stops as the drawn map, so walking works the same.

const MAP_THEMES = {
  meadow: { ground: 'grass', trees: 'oak' },
  river: { ground: 'grass', trees: 'oak', river: true },
  forest: { ground: 'grass', trees: 'pine', dense: true },
  snow: { ground: 'snow', trees: 'snowpine' },
  beach: { ground: 'sand', trees: 'palm', sea: true },
};

export const THEME_NAMES = Object.keys(MAP_THEMES);

const TREE_SPRITES = {
  oak: { rows: ['.LLLL.', 'LLLLLL', 'LLDLLL', 'LLLLLL', '.LLLL.', '..TT..', '..TT..'], pal: { L: '#4fb048', D: '#2f7d2c', T: '#6b4a2b' } },
  pine: { rows: ['..LL..', '.LLLL.', '..LL..', '.LLLL.', 'LLLLLL', '..TT..', '..TT..'], pal: { L: '#2f8f5b', T: '#5a3d22' } },
  snowpine: { rows: ['..WW..', '.LWWL.', '..LL..', '.WWLL.', 'LLLWWL', '..TT..', '..TT..'], pal: { L: '#2f7d5b', W: '#ffffff', T: '#5a3d22' } },
  palm: { rows: ['LL..LL', '.LLLL.', 'L.TT.L', '..T...', '..T...', '..TT..', '..TT..'], pal: { L: '#3fa660', T: '#a0703f' } },
};

const STOP_ICONS = {
  stadium: () => pixelBall(2.4, 0, 0),
  castle: () => pixelPiece('knight', '#ffffff', 3, -12, -15),
  mine: () => pixelGem('#5ee7ff', 3, -12, -9),
  show: () => spriteRects(NOTE, { X: '#ffffff' }, 3, -9, -11),
  workshop: () => spriteRects(['GGGGGG', 'GGGGGG', '..BB..', '..BB..', '..BB..', '..BB..'], { G: '#cfd8dc', B: '#8a5f37' }, 3, -9, -9),
  islands: () => spriteRects(['GGGGGGGG', 'DDDDDDDD', '.DDDDDD.', '..DDDD..'], { G: '#6cbf4a', D: '#8b5a2b' }, 3, -12, -6),
  night: () => spriteRects(['..Y..', '.YYY.', 'YYYYY', '.YYY.', 'Y...Y'], { Y: '#ffe17a' }, 3, -7.5, -7.5),
  trophy: () => spriteRects(TROPHY, { Y: '#ffd23f', W: '#fff6c2', B: '#8d6e63' }, 2.4, -12, -12),
};
const STOP_BLOCK = { stadium: '#2e7d32', castle: '#5c6bc0', mine: '#546e7a', show: '#ab47bc', workshop: '#ef6c00', islands: '#0288d1', night: '#283593', trophy: '#e0a800' };

function stopTile(kind, state, kit) {
  const c = STOP_BLOCK[kind];
  const fade = state === 'skip' ? 0.3 : state === 'ahead' ? 0.6 : 1;
  const ring = state === 'next' ? `<rect x="-26" y="-26" width="52" height="52" fill="none" stroke="#ffd23f" stroke-width="4"><animate attributeName="opacity" values="1;0.2" dur="0.8s" repeatCount="indefinite" calcMode="discrete"/></rect>` : '';
  const flag = state === 'done' ? `<rect x="12" y="-40" width="3" height="26" fill="#6b4a2b"/><rect x="15" y="-40" width="14" height="9" fill="${kit}"/>` : '';
  return `${ring}<g opacity="${fade}"><rect x="-21" y="-17" width="42" height="42" fill="#000" opacity="0.2"/>
    <rect x="-21" y="-21" width="42" height="42" fill="${c}"/><rect x="-21" y="-21" width="42" height="5" fill="${shade(c, 0.3)}"/><rect x="-21" y="16" width="42" height="5" fill="${shade(c, -0.3)}"/>
    ${STOP_ICONS[kind]()}</g>${flag}`;
}

export function pixelMapSVG({ theme = 'meadow', kit = '#e63946', character = 'striker', stops = [], at = 0, world = 1 }) {
  const T = MAP_THEMES[theme] ?? MAP_THEMES.meadow;
  const B = 24; // block size on the map
  const cells = new Set();
  for (let i = 0; i < ROUTE.length - 1; i++) {
    for (let k = 0; k <= 40; k++) {
      const [x, y] = routeAt(i, k / 40);
      for (const dx of [-1, 0]) for (const dy of [-1, 0]) cells.add(`${Math.floor(x / B + dx * 0.5 + 0.25)},${Math.floor(y / B + dy * 0.5 + 0.25)}`);
    }
  }
  const pathTiles = [...cells].map(c => {
    const [cx, cy] = c.split(',').map(Number);
    return `<rect x="${cx * B}" y="${cy * B}" width="${B}" height="${B}" fill="url(#pm-${theme === 'snow' ? 'gravel' : 'path'})"/>`;
  }).join('');
  const river = T.river ? `<rect x="0" y="${14 * B}" width="360" height="${B * 1.5}" fill="url(#pm-water)"/>
    <rect x="0" y="${14 * B}" width="360" height="${B * 1.5}" fill="#ffffff" opacity="0.12"><animate attributeName="opacity" values="0.05;0.2;0.05" dur="2s" repeatCount="indefinite" calcMode="discrete"/></rect>` : '';
  const sea = T.sea ? `<rect x="0" y="${3 * B}" width="360" height="${2 * B}" fill="url(#pm-water)"/>` : '';
  const treeSpots = [[18, 330], [312, 296], [306, 462], [20, 160], [318, 196], [214, 478], [100, 346], [26, 462], [212, 232], ...(T.dense ? [[60, 290], [300, 380], [120, 150], [250, 410]] : [])];
  const tree = TREE_SPRITES[T.trees];
  const trees = treeSpots.map(([x, y]) => `<g transform="translate(${x} ${y - 28})">${spriteRects(tree.rows, tree.pal, 5)}</g>`).join('');
  const flowers = theme === 'snow' || theme === 'beach' ? '' : [[64, 404], [236, 258], [296, 418], [118, 498], [50, 206]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="5" height="5" fill="${['#ff6fae', '#ffffff', '#ffd23f'][i % 3]}"/>`).join('');
  const [hx, hy] = ROUTE[at] ?? ROUTE[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 520" class="worldmap pixel" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
    <defs>${blockDefs('pm', B, ['grass', 'snow', 'sand', 'path', 'gravel', 'water'])}</defs>
    <rect width="360" height="520" fill="#9fd8ff"/>
    <rect x="276" y="22" width="44" height="44" fill="#ffe680"/><rect x="284" y="30" width="28" height="28" fill="#fff3b0"/>
    <g fill="#ffffff">${[[24, 44, 72], [180, 70, 96]].map(([x, y, w], i) => `<g><animateTransform attributeName="transform" type="translate" values="0 0;${i ? -24 : 24} 0;0 0" dur="${14 + i * 3}s" repeatCount="indefinite"/><rect x="${x}" y="${y}" width="${w}" height="12"/><rect x="${x + 12}" y="${y - 8}" width="${w - 30}" height="8"/></g>`).join('')}</g>
    <rect x="0" y="${4 * B}" width="360" height="${520 - 4 * B}" fill="url(#pm-${T.ground})"/>
    ${sea}${river}${pathTiles}
    ${T.river ? `<rect x="252" y="${13.6 * B}" width="40" height="${B * 2.3}" fill="#9c6b3a"/>${[0, 1, 2, 3, 4].map(k => `<rect x="252" y="${13.6 * B + k * 11}" width="40" height="3" fill="#7a4b22"/>`).join('')}` : ''}
    ${flowers}${trees}
    ${ROUTE.slice(1).map(([x, y], i) => `<g transform="translate(${x} ${y})">${stopTile(STOP_KINDS[i], stops[i] ?? 'ahead', kit)}</g>`).join('')}
    <g id="hero" transform="translate(${hx} ${hy - 4})"><g class="hero-flip"><g class="pose-stand">${pixelPlayer(character, kit, 3.2)}</g><g class="pose-walk" display="none">${pixelPlayer(character, kit, 3.2, { walk: true })}</g></g></g>
    <g transform="translate(14 12)"><rect width="46" height="30" fill="#ffffff" opacity="0.92"/>${spriteRects(['.GGG.', 'GBGBG', 'GGGGG', 'GBGBG', '.GGG.'], { G: '#1f6fb5', B: '#9fd8ff' }, 3.6, 6, 6)}
      <text x="33" y="22" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="17" fill="#1f4e79">${world}</text></g>
  </svg>`;
}

// ---- Level scenes in blocks (800 by 800, cropped to the screen like the drawn ones).
const scene = (defs, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" class="level-scene pixel" shape-rendering="crispEdges"><defs>${defs}</defs><rect width="800" height="800" fill="${bg}"/>${body}</svg>`;
const step = (values, dur, begin = 0, type = 'translate') => `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="discrete"/>`;
const glide = (values, dur, begin = 0) => `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`;
const squareCloud = (x, y, w, dur, dx) => `<g fill="#ffffff">${glide(`0 0;${dx} 0;0 0`, dur)}<rect x="${x}" y="${y}" width="${w}" height="24"/><rect x="${x + 24}" y="${y - 16}" width="${w - 64}" height="16"/></g>`;

// The crystal mine (Find the sound): torches, ores, a minecart, and a block being mined.
function mine() {
  const B = 64;
  const defs = blockDefs('px', B, ['stone', 'cobble', 'planks', 'gravel'], { diamond: ore('#5ee7ff', 41), goldOre: ore('#ffd54f', 43), emerald: ore('#39d353', 45), ruby: ore('#ff4d6d', 47) });
  const ceiling = [2, 1, 2, 3, 1, 2, 2, 1, 3, 2, 1, 2, 2].map((h, i) => `<rect x="${i * B}" y="0" width="${B}" height="${h * B}" fill="url(#px-stone)"/>`).join('');
  const crack = stage => `<g opacity="0"><animate attributeName="opacity" values="${[0, 1, 2, 3, 4].map(s => (s === stage ? 1 : 0)).join(';')};0" dur="3s" repeatCount="indefinite" calcMode="discrete"/>
    ${spriteRects(stage === 1 ? ['........', '...X....', '....X...', '........', '........', '........', '........', '........']
      : stage === 2 ? ['........', '...X....', '....X...', '...XX...', '.....X..', '........', '........', '........']
        : stage === 3 ? ['.X......', '..XX....', '....X.X.', '...XX...', '..X..X..', '.X....X.', '........', '........']
          : ['.X....X.', '..XX.X..', 'X...XX.X', '..XX..X.', '.X..X..X', 'X....X..', '..X..X..', '.X.....X'], { X: '#2b2b2b' }, 8, 448, 576)}</g>`;
  const bits = Array.from({ length: 8 }, (_, i) => {
    const dx = [-60, -30, 0, 30, 60, -45, 15, 45][i];
    const dy = [-70, -100, -120, -95, -65, -40, -50, -35][i];
    return `<rect x="${472 + (i % 3) * 8}" y="${600 + (i % 2) * 8}" width="10" height="10" fill="${i % 3 ? '#8d8d8d' : '#5ee7ff'}" opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.8;0.81;0.95;1" dur="3s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 0;${dx} ${dy};${dx * 1.4} ${dy + 60}" keyTimes="0;0.8;0.9;1" dur="3s" repeatCount="indefinite"/></rect>`;
  }).join('');
  const target = `<use href="#px-diamond-b" x="448" y="576"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.8;0.8;0.99;1" dur="3s" repeatCount="indefinite" calcMode="discrete"/></use>`;
  const pick = `<g transform="translate(560 560)"><g>${step('0 0 0;-35 0 0;0 0 0;-35 0 0;0 0 0;-35 0 0;0 0 0;-35 0 0', 3, 0, 'rotate')}<g transform="rotate(-30) translate(-24 -60)">${spriteRects(PICK, { G: '#b0bec5', B: '#8a5f37' }, 6)}</g></g></g>`;
  const cart = `<g>${glide('-220 0;900 0', 9)}<g transform="translate(0 652)">${spriteRects(CART, { X: '#6c7a89', D: '#3c4752', W: '#2b2f3a' }, 8)}${pixelGem('#5ee7ff', 5, 16, -22)}${pixelGem('#ffd54f', 5, 44, -26)}${pixelGem('#39d353', 5, 64, -20)}</g></g>`;
  const rails = `<rect x="0" y="694" width="800" height="6" fill="#9e9e9e"/>${Array.from({ length: 20 }, (_, i) => `<rect x="${i * 40 + 6}" y="700" width="20" height="8" fill="#6b4a2b"/>`).join('')}`;
  const floatGem = (x, y, c, begin) => `<g transform="translate(${x} ${y})"><g>${step('0 0;0 -6;0 -10;0 -6', 1.6, begin)}<g>${step('1 1;0.6 1;0.2 1;0.6 1', 0.8, begin, 'scale')}${pixelGem(c, 6, -24, -18)}</g></g></g>`;
  const glowAround = (x, y) => [140, 100, 64].map((s, k) => `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="#ffb300" opacity="${0.06 + k * 0.04}"><animate attributeName="opacity" values="${0.06 + k * 0.04};${0.1 + k * 0.05};${0.06 + k * 0.04}" dur="0.9s" repeatCount="indefinite" calcMode="discrete"/></rect>`).join('');
  return scene(defs, `
    <rect width="800" height="800" fill="url(#px-stone)"/><rect width="800" height="800" fill="#000" opacity="0.42"/>
    ${ceiling}
    <use href="#px-diamond-b" x="192" y="192"/><use href="#px-goldOre-b" x="576" y="256"/><use href="#px-emerald-b" x="256" y="448"/><use href="#px-ruby-b" x="512" y="384"/>
    ${glowAround(268, 300)}${glowAround(540, 300)}
    <g transform="translate(256 270)">${pixelTorch(6)}</g><g transform="translate(528 270)">${pixelTorch(6)}</g>
    <rect x="0" y="704" width="800" height="96" fill="url(#px-cobble)"/>
    <rect x="384" y="576" width="64" height="128" fill="url(#px-stone)"/><rect x="448" y="640" width="128" height="64" fill="url(#px-stone)"/>
    ${target}${[1, 2, 3, 4].map(crack).join('')}${bits}${pick}
    ${floatGem(330, 640, '#ffd54f', 0)}
    ${rails}${cart}
  `, '#2c231d');
}

// The stadium (Sound match): stands built of blocks with a blocky crowd, his signed players in
// the front row, a pixel ball, and a player running on the grass.
function stadium({ kit, signed = [] }) {
  const B = 64;
  const wool = ['#e63946', '#1d6fd8', '#f7c948', '#2ec4b6', '#9b5de5', '#f77f00'];
  const defs = blockDefs('px', B, ['grass', 'stone', 'planks', 'glow']);
  const fan = (x, y, i) => {
    const skin = ['#f2c7a0', '#d9a06b', '#a86b45', '#6e4429'][i % 4];
    const hair = ['#4a2c17', '#e8b23a', '#2b1d16', '#8a3a26'][(i * 3) % 4];
    return spriteRects(['HHHHHH', 'HSSSSH', 'SESSES', 'SSSSSS', '.SSSS.', 'CCCCCC', 'CCCCCC'], { H: hair, S: skin, E: '#1f2937', C: wool[(i * 5) % wool.length] }, 6, x, y);
  };
  const rowOf = (y, parity, r) => Array.from({ length: 20 }, (_, i) => i).filter(i => (i + r) % 2 === parity).map(i => fan(i * 42 + (r % 2) * 21, y, i + r * 7)).join('');
  const crowd = parity => [150, 214, 278].map((y, r) => rowOf(y, parity, r)).join('');
  const players = signed.slice(-8).map((p, i) => `<g transform="translate(${296 + i * 28} 318)"><g>${step('0 0;0 -8', 0.6, i * 0.1)}${pixelPiece(p, kit, 3.4, -13.6, -34)}</g></g>`).join('');
  const stripes = Array.from({ length: 5 }, (_, i) => `<rect y="${384 + i * 96}" width="800" height="48" fill="#ffffff" opacity="0.07"/>`).join('');
  const goalNet = `<g transform="translate(470 672)"><rect x="0" y="0" width="12" height="96" fill="#ffffff"/><rect x="0" y="0" width="128" height="12" fill="#ffffff"/>
    ${Array.from({ length: 7 }, (_, i) => `<rect x="${16 + i * 16}" y="12" width="2" height="84" fill="#e8edf3"/>`).join('')}${Array.from({ length: 5 }, (_, i) => `<rect x="12" y="${24 + i * 16}" width="116" height="2" fill="#e8edf3"/>`).join('')}</g>`;
  const ball = `<g>${glide('-60 0;860 0', 5)}<g transform="translate(0 748)"><g opacity="1">${pixelBall(4, 0, 0, 0)}<animate attributeName="opacity" values="1;0" dur="0.3s" repeatCount="indefinite" calcMode="discrete"/></g><g opacity="0">${pixelBall(4, 0, 0, 1)}<animate attributeName="opacity" values="0;1" dur="0.3s" repeatCount="indefinite" calcMode="discrete"/></g></g></g>`;
  const runner = `<g>${glide('250 0;430 0;250 0', 6)}<g transform="translate(0 790)">${pixelPlayer('striker', '#7b2cbf', 5, { walk: true })}</g></g>`;
  return scene(defs, `
    ${squareCloud(220, 60, 160, 18, 50)}${squareCloud(500, 96, 128, 14, -40)}
    <rect y="128" width="800" height="232" fill="url(#px-stone)"/><rect y="128" width="800" height="232" fill="#1b2a44" opacity="0.55"/>
    ${[192, 256, 320].map(y => `<rect y="${y}" width="800" height="8" fill="#0f1a2c" opacity="0.6"/>`).join('')}
    <g>${step('0 0;0 -6', 0.7)}${crowd(0)}</g><g>${step('0 -6;0 0', 0.7)}${crowd(1)}</g>
    ${players}
    <rect x="40" y="40" width="16" height="320" fill="#5a5a5a"/><use href="#px-glow-b" x="16" y="8"/>
    <rect x="744" y="40" width="16" height="320" fill="#5a5a5a"/><use href="#px-glow-b" x="720" y="8"/>
    ${wool.concat(wool).map((c, i) => `<rect x="${i * 64}" y="352" width="64" height="32" fill="${c}"/>`).join('')}
    <rect y="384" width="800" height="416" fill="url(#px-grass)"/>${stripes}
    <rect y="392" width="800" height="8" fill="#ffffff" opacity="0.85"/>
    <g transform="translate(250 700)"><rect x="0" y="0" width="6" height="72" fill="#ffffff"/><rect x="6" y="0" width="30" height="18" fill="#ffd23f">${step('0 0;0 4', 0.6)}</rect></g>
    ${goalNet}${ball}${runner}
  `, '#9fd8ff');
}

// A sprite with a one-pixel dark outline, so pieces read clearly on busy ground.
function outlined(rows, color, outline, px, ox, oy) {
  const dark = { X: outline, W: outline };
  return [[-px, 0], [px, 0], [0, -px], [0, px]].map(([dx, dy]) => spriteRects(rows, dark, px, ox + dx, oy + dy)).join('')
    + spriteRects(rows, { X: color, W: color === '#f5f5f5' ? '#3b3f4a' : '#ffffff' }, px, ox, oy);
}
export const pixelPieceOutlined = (name, color, outline, px, ox = 0, oy = 0) => outlined(PIECES[name] ?? PIECES.pawn, color, outline, px, ox, oy);

const fade = (values, dur, begin = 0) => `<animate attributeName="opacity" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="discrete"/>`;
const twinkleSquares = (n, x0, w, y0, h, size, color) => Array.from({ length: n }, (_, i) => `<rect x="${x0 + (i * 97) % w}" y="${y0 + (i * 61) % h}" width="${size}" height="${size}" fill="${color}">${fade('1;0.2;1;0.5', 1.4 + (i % 4) * 0.4, i * 0.2)}</rect>`).join('');

const MOON = ['..YYYY..', '.YYYYYY.', 'YYYDYYYY', 'YYYYYYDY', 'YYDYYYYY', 'YYYYYYYY', '.YYYYYY.', '..YYYY..'];
const GEAR = ['.X.XX.X.', 'XXXXXXXX', '.XX..XX.', 'XX....XX', 'XX....XX', '.XX..XX.', 'XXXXXXXX', '.X.XX.X.'];
const BIRD = [['X.....X', '.X...X.', '..XXX..'], ['.......', 'XX...XX', '..XXX..']];
const ANVIL = ['DDDDDDDDDD..', '.DDDDDDDDDDD', '...DDDDD....', '...DDDDD....', '..DDDDDDD...', '.DDDDDDDDD..'];
const CROWN = ['Y....YY....Y', 'YY..YYYY..YY', 'YYYYYYYYYYYY', 'YYRYYYYYYRYY', 'YYYYYYYYYYYY', 'OOOOOOOOOOOO'];
const BOOK = ['.BBBBBB.', 'BBBBBBWW', 'BBYYBBWW', 'BBBBBBWW', 'BBYYBBWW', 'BBBBBBWW', 'BBBBBBWW', '.BBBBBB.'];
const HOUSE = ['...WW...', '..WWWW..', '.WWWWWW.', 'WWWWWWWW', '.WWWWWW.', '.WW..WW.', '.WW..WW.', '.WW..WW.'];
const GEM_BIG = ['..XXXXXX..', '.XWXXXXXX.', 'XXXXXXXXXX', 'XXXXXXXXXX', '.XXXXXXXX.', '..XXXXXX..', '...XXXX...', '....XX....'];

// The chess castle (Blend it): brick towers with his flags, pieces hopping on a giant board.
function castle({ kit }) {
  const B = 64;
  const defs = blockDefs('px', B, ['bricks', 'darkPlanks'], { birch: noise(51, ['#e3cc96', '#d8c088', '#ecd8a6', '#cfb57a']) });
  const merlons = (x0, x1, y) => Array.from({ length: Math.floor((x1 - x0) / B) }, (_, i) => (i % 2 ? '' : `<rect x="${x0 + i * B}" y="${y}" width="${B}" height="${B}" fill="url(#px-bricks)"/>`)).join('');
  const flag = x => `<g transform="translate(${x} 0)"><rect x="0" y="0" width="8" height="64" fill="#6b4a2b"/>
    <g>${step('0 0;0 4', 0.8)}<rect x="8" y="4" width="48" height="28" fill="${kit}"/><rect x="8" y="24" width="48" height="8" fill="${shade(kit, -0.3)}"/><rect x="24" y="12" width="12" height="8" fill="#ffffff"/></g></g>`;
  const board = [];
  for (let r = 0; r < 7; r++) for (let c = 0; c < 13; c++) board.push(`<rect x="${c * B}" y="${384 + r * B}" width="${B}" height="${B}" fill="url(#px-${(r + c) % 2 ? 'darkPlanks' : 'birch'})"/>`);
  const piece = (name, x, y, white, anim) => `<g transform="translate(${x} ${y})"><g>${anim}${pixelPieceOutlined(name, white ? '#f5f5f5' : '#2f3440', white ? '#3b3f4a' : '#0b0d12', 7, -28, -70)}</g></g>`;
  const knight = piece('knight', 288, 768, true, step('0 0;0 0;0 -32;0 -64;0 -96;0 -128;32 -128;64 -128;64 -128;64 -128;32 -128;0 -128;0 -96;0 -64;0 -32;0 0', 4.8));
  const pawn = piece('pawn', 544, 768, false, step('0 0;0 0;0 0;0 -32;0 -64;0 -64;0 -64;0 -32', 4));
  const bishop = piece('bishop', 416, 704, false, step('0 0;0 0;-32 -32;-64 -64;-64 -64;-32 -32', 5, 1));
  return scene(defs, `
    ${squareCloud(80, 40, 160, 20, 50)}${squareCloud(560, 80, 128, 16, -40)}
    <rect x="0" y="256" width="800" height="128" fill="url(#px-bricks)"/>${merlons(0, 800, 192)}
    <rect x="192" y="128" width="128" height="256" fill="url(#px-bricks)"/>${merlons(192, 320, 64)}
    <rect x="480" y="128" width="128" height="256" fill="url(#px-bricks)"/>${merlons(480, 608, 64)}
    <rect x="224" y="192" width="64" height="48" fill="#2a2a35"/><rect x="512" y="192" width="64" height="48" fill="#2a2a35"/>
    <rect x="352" y="288" width="96" height="96" fill="url(#px-darkPlanks)"/><rect x="368" y="272" width="64" height="16" fill="url(#px-darkPlanks)"/>
    ${flag(248)}${flag(536)}
    ${board.join('')}
    ${knight}${pawn}${bishop}
  `, '#9fd8ff');
}

// The halftime show (the chant): curtains, blinking lights, beams, and notes rising from note blocks.
function show() {
  const B = 64;
  const defs = blockDefs('px', B, ['darkPlanks', 'note'], { redWool: noise(53, ['#c62828', '#b71c1c', '#d32f2f', '#a51b1b']) });
  const curtain = (x0, w) => `<rect x="${x0}" y="0" width="${w}" height="800" fill="url(#px-redWool)"/>${Array.from({ length: Math.floor(w / 32) }, (_, i) => `<rect x="${x0 + i * 32 + 24}" y="0" width="8" height="800" fill="#7f1414" opacity="0.6"/>`).join('')}`;
  const beam = (x, c, begin) => `<g opacity="0.16">${step('0 0;24 0;48 0;24 0', 2.4, begin)}<rect x="${x}" y="64" width="64" height="96" fill="${c}"/><rect x="${x - 32}" y="160" width="128" height="160" fill="${c}"/><rect x="${x - 64}" y="320" width="192" height="320" fill="${c}"/></g>`;
  const note = (x, begin, c) => `<g opacity="0">${fade('0;1;1;1;1;0', 2.4, begin)}${step('0 0;0 -32;0 -64;0 -96;0 -128;0 -160', 2.4, begin)}${spriteRects(NOTE, { X: c }, 6, x, 540)}</g>`;
  const lights = ['#ff5a5f', '#ffd23f', '#5ee7ff', '#39d353', '#c77dff'].map((c, i) => `<rect x="${248 + i * 64}" y="76" width="32" height="32" fill="${c}">${fade('1;0.25;1;0.25', 0.8 + i * 0.15)}</rect>`).join('');
  return scene(defs, `
    ${twinkleSquares(16, 220, 360, 150, 300, 6, '#ffecb3')}
    <rect x="192" y="48" width="416" height="72" fill="#2a1f42"/>${lights}
    ${beam(288, '#fff59d', 0)}${beam(480, '#b3e5fc', 1.2)}
    <rect y="640" width="800" height="160" fill="url(#px-darkPlanks)"/><rect y="640" width="800" height="12" fill="#2a1a10"/>
    <use href="#px-note-b" x="272" y="576"/><use href="#px-note-b" x="464" y="576"/>
    ${note(284, 0, '#ffd23f')}${note(476, 0.8, '#5ee7ff')}${note(380, 1.6, '#ff8fab')}
    ${curtain(0, 224)}${curtain(576, 224)}
    <rect x="0" y="0" width="800" height="48" fill="url(#px-redWool)"/>
  `, '#1b1230');
}

// The workshop (Build it): shelves of jars, turning gears, a furnace, and a hammer at the crafting table.
function workshop() {
  const B = 64;
  const defs = blockDefs('px', B, ['planks', 'darkPlanks', 'table', 'cobble', 'stone']);
  const jar = (x, y, c) => spriteRects(['.WW.', '.CC.', 'XXXX', 'XXXX', '.XX.'], { W: '#f5f5f5', C: '#8a5f37', X: c }, 8, x, y);
  const gear = (x, y, dir, dur) => `<g transform="translate(${x} ${y})"><g>${step(dir > 0 ? '0;45;90;135' : '0;-45;-90;-135', dur, 0, 'rotate')}${spriteRects(GEAR, { X: '#8d99a6' }, 8, -32, -32)}</g></g>`;
  const hammer = `<g transform="translate(424 632)"><g>${step('-50 0 0;-20 0 0;10 0 0;10 0 0', 1.2, 0, 'rotate')}<g transform="translate(-24 -96)">${spriteRects(['GGGGGG..', 'GGGGGG..', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....', '..BB....'], { G: '#9aa6b3', B: '#8a5f37' }, 8)}</g></g></g>`;
  const sparks = Array.from({ length: 6 }, (_, i) => `<rect x="${380 + i * 10}" y="${628 - (i % 3) * 8}" width="8" height="8" fill="#ffd54f" opacity="0">${fade('0;0;1;0', 1.2)}${step(`0 0;0 0;${(i - 3) * 14} ${-20 - (i % 2) * 16};${(i - 3) * 20} ${-30 - (i % 2) * 16}`, 1.2)}</rect>`).join('');
  const fire = `<g>${spriteRects(['.Y..Y.', 'YOYYOY', 'OROORO'], { Y: '#ffd23f', O: '#ff9800', R: '#e65100' }, 8, 488, 664)}${fade('1;0.6;1;0.8', 0.6)}</g>`;
  return scene(defs, `
    <rect width="800" height="800" fill="url(#px-planks)"/>
    <rect x="192" y="200" width="416" height="24" fill="url(#px-darkPlanks)"/>
    ${jar(232, 160, '#e53935')}${jar(296, 160, '#43a047')}${jar(360, 160, '#1e88e5')}${jar(456, 160, '#fdd835')}${jar(520, 160, '#8e24aa')}
    ${gear(272, 320, 1, 1.6)}${gear(336, 368, -1, 1.6)}${gear(528, 320, -1, 2)}
    <rect y="704" width="800" height="96" fill="url(#px-stone)"/>
    <rect x="352" y="640" width="64" height="64" fill="url(#px-table)"/>
    <rect x="480" y="640" width="64" height="64" fill="url(#px-cobble)"/><rect x="488" y="664" width="48" height="24" fill="#1d1d1d"/>${fire}
    <g transform="translate(232 664)">${spriteRects(ANVIL, { D: '#4a4f57' }, 6)}</g>
    ${hammer}${sparks}
  `, '#b8935a');
}

// The sky islands (Read and find): floating block islands, a tree, a waterfall, drifting blocks, and birds.
function islands() {
  const B = 48;
  const defs = blockDefs('pi', B, ['grassSide', 'dirt', 'log', 'leaves', 'water']);
  const blk = (name, x, y) => `<use href="#pi-${name}-b" x="${x}" y="${y}"/>`;
  const island = (x, y, widths) => widths.map((w, r) => Array.from({ length: w }, (_, i) => blk(r === 0 ? 'grassSide' : 'dirt', x + (widths[0] - w) * B / 2 + i * B, y + r * B)).join('')).join('');
  const tree = (x, y) => `${blk('log', x, y - B)}${blk('log', x, y - 2 * B)}${[-1, 0, 1].map(i => blk('leaves', x + i * B, y - 3 * B)).join('')}${[-1, 0, 1].map(i => blk('leaves', x + i * B, y - 4 * B)).join('')}${blk('leaves', x, y - 5 * B)}`;
  const bobbing = (inner, begin, dur = 3) => `<g>${step('0 0;0 -8;0 -12;0 -8', dur, begin)}${inner}</g>`;
  const waterfall = `${Array.from({ length: 12 }, (_, k) => blk('water', 432, 312 + k * B)).join('')}
    <g fill="#ffffff" opacity="0.35">${step('0 0;0 16;0 32', 0.6)}${Array.from({ length: 14 }, (_, k) => `<rect x="${440 + (k % 2) * 16}" y="${300 + k * 48}" width="8" height="16"/>`).join('')}</g>`;
  const bird = (y, dur, begin) => `<g>${glide(`-60 ${y};880 ${y - 40}`, dur, begin)}<g opacity="1">${fade('1;0', 0.4)}${spriteRects(BIRD[0], { X: '#3a4658' }, 4)}</g><g opacity="0">${fade('0;1', 0.4)}${spriteRects(BIRD[1], { X: '#3a4658' }, 4)}</g></g>`;
  return scene(defs, `
    <rect x="560" y="48" width="64" height="64" fill="#ffe680"/><rect x="572" y="60" width="40" height="40" fill="#fff3b0"/>
    ${squareCloud(160, 260, 160, 16, 40)}${squareCloud(520, 520, 128, 14, -36)}
    ${waterfall}
    ${bobbing(`${island(288, 264, [5, 5, 3, 1])}${tree(336, 264)}`, 0, 4)}
    ${bobbing(island(520, 400, [3, 1]), 0.7, 3.4)}
    ${bobbing(island(208, 688, [4, 2]), 1.3, 3.8)}
    ${bobbing(blk('grassSide', 560, 640), 0.4, 2.6)}${bobbing(blk('grassSide', 248, 520), 1, 3.1)}
    ${bird(200, 13, 0)}${bird(150, 16, 5)}
  `, '#9fd8ff');
}

// The night stadium (Read aloud): stars, a square moon, square fireworks, and a dark crowd.
function night() {
  const B = 64;
  const defs = blockDefs('px', B, ['grass', 'glow']);
  const burst = (cx, cy, c, begin) => [1, 2, 3, 4].map(k => `<g opacity="0">${fade([1, 2, 3, 4, 5, 6].map(f => (f === k ? (k === 4 ? 0.5 : 1) : 0)).join(';'), 2.4, begin)}
    ${[[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([dx, dy]) => `<rect x="${cx + dx * k * 22 - 6}" y="${cy + dy * k * 22 - 6}" width="12" height="12" fill="${c}"/>`).join('')}</g>`).join('');
  const fans = parity => Array.from({ length: 24 }, (_, i) => i).filter(i => i % 2 === parity).map(i => `<rect x="${i * 34 + 4}" y="296" width="24" height="24" fill="#222c42"/><rect x="${i * 34}" y="320" width="32" height="24" fill="#1b2438"/>`).join('');
  return scene(defs, `
    ${twinkleSquares(26, 0, 800, 10, 230, 6, '#ffffff')}
    <g transform="translate(560 40)">${spriteRects(MOON, { Y: '#fff3c4', D: '#e2d39a' }, 8)}</g>
    ${burst(300, 140, '#ff6fae', 0)}${burst(500, 110, '#ffe17a', 0.8)}${burst(400, 210, '#6ee7f9', 1.6)}
    <rect x="232" y="64" width="16" height="280" fill="#4a566b"/><use href="#px-glow-b" x="208" y="16"/>
    <rect x="552" y="64" width="16" height="280" fill="#4a566b"/><use href="#px-glow-b" x="528" y="16"/>
    <g>${step('0 0;0 -6', 0.8)}${fans(0)}</g><g>${step('0 -6;0 0', 0.8)}${fans(1)}</g>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${60 + i * 95}" y="${300 + (i % 2) * 8}" width="6" height="6" fill="#ffe082">${fade('1;0.2;1', 1 + (i % 3) * 0.5, i * 0.3)}</rect>`).join('')}
    <rect y="352" width="800" height="448" fill="url(#px-grass)"/><rect y="352" width="800" height="448" fill="#04101f" opacity="0.38"/>
    <g transform="translate(470 680)"><rect x="0" y="0" width="12" height="96" fill="#e8edf3"/><rect x="0" y="0" width="128" height="12" fill="#e8edf3"/>
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${16 + i * 16}" y="12" width="2" height="84" fill="#c9d3de"/>`).join('')}</g>
  `, '#0f1830');
}

// The trophy (full time): a big pixel cup on gold blocks, pulsing light, and square confetti.
function trophy() {
  const B = 64;
  const defs = blockDefs('px', B, ['gold']);
  const rings = [3, 2, 1].map((k, i) => `<rect x="${400 - 70 - k * 40}" y="${200 - 70 - k * 40}" width="${140 + k * 80}" height="${140 + k * 80}" fill="#ffe08a" opacity="0">${fade([0, 1, 2].map(f => (f === i ? 0.5 : 0.12)).join(';'), 1.2)}</rect>`).join('');
  const confetti = Array.from({ length: 30 }, (_, i) => {
    const x = (i * 61) % 800;
    const c = ['#ee4266', '#3bceac', '#ffd23f', '#1d6fd8', '#7b2cbf'][i % 5];
    return `<rect x="${x}" y="-20" width="12" height="12" fill="${c}">${step(Array.from({ length: 12 }, (_, f) => `${(f % 2 ? 6 : -6)} ${f * 72}`).join(';'), 3 + (i % 5) * 0.5, -(i * 0.3))}</rect>`;
  }).join('');
  return scene(defs, `
    ${rings}
    <g transform="translate(330 130)">${spriteRects(TROPHY, { Y: '#ffd23f', W: '#fff6c2', B: '#8d6e63' }, 14)}</g>
    <rect x="304" y="270" width="192" height="64" fill="url(#px-gold)"/>
    ${confetti}
  `, '#fff3c4');
}

// ---- The goal: his player shoots, the ball flies in pixel steps into the net, and the net shakes.
export function pixelGoalSVG(kit, character) {
  const arc = Array.from({ length: 9 }, (_, f) => {
    const t = f / 8;
    return `${Math.round(110 + 150 * t)} ${Math.round(150 - 110 * t + 80 * t * t)}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" class="goal-scene" shape-rendering="crispEdges">
    <rect y="168" width="320" height="32" fill="#5fae3c"/><rect y="168" width="320" height="6" fill="#7bd35a"/><rect y="182" width="320" height="18" fill="#8b5a2b"/>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-4 0;4 0;-2 0;0 0" keyTimes="0;0.6;0.66;0.72;0.8;1" dur="1.6s" fill="freeze" calcMode="discrete"/>
      <rect x="232" y="70" width="8" height="98" fill="#ffffff"/><rect x="232" y="70" width="80" height="8" fill="#ffffff"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${244 + i * 14}" y="78" width="2" height="90" fill="#dfe6ee"/>`).join('')}${Array.from({ length: 6 }, (_, i) => `<rect x="240" y="${90 + i * 14}" width="72" height="2" fill="#dfe6ee"/>`).join('')}</g>
    <g transform="translate(84 172)"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -20;0 0;0 -14;0 0" keyTimes="0;0.4;0.55;0.7;0.82;1" dur="1.6s" fill="freeze" calcMode="discrete"/>${pixelPlayer(character, kit, 5)}</g></g>
    <g><animateTransform attributeName="transform" type="translate" values="${arc.join(';')}" dur="0.6s" begin="0.25s" fill="freeze" calcMode="discrete"/>${pixelBall(2.4, 0, 0)}</g>
  </svg>`;
}

// ---- Icons and the grown-up
const icon = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" class="icon" shape-rendering="crispEdges">${body}</svg>`;
export const PIXEL_ICONS = {
  ball: icon(10, 10, pixelBall(1, 5, 5)),
  book: icon(8, 8, spriteRects(BOOK, { B: '#3a6ea5', W: '#ffffff', Y: '#ffd23f' }, 1)),
  gem: icon(8, 6, pixelGem('#5ee7ff', 1)),
  crown: icon(12, 6, spriteRects(CROWN, { Y: '#ffd23f', R: '#ee4266', O: '#e0a800' }, 1)),
  home: icon(8, 8, spriteRects(HOUSE, { W: '#ffffff' }, 1)),
};
export const pawnIcon = color => icon(8, 10, pixelPiece('pawn', color, 1));

// A letter gem for his gem collection: gold when mastered, blue while learning, gray until found.
export function letterGem(letter, state) {
  const c = state === 'mastered' ? '#ffd23f' : state === 'learning' ? '#5ee7ff' : '#d5dbe3';
  return `<svg viewBox="0 0 80 72" class="gem ${state}"><g shape-rendering="crispEdges">${spriteRects(GEM_BIG, { X: c, W: '#ffffff' }, 8, 0, 4)}</g>
    <text x="40" y="44" text-anchor="middle" font-family="Andika, Century Gothic, Avenir Next, sans-serif" font-size="30" font-weight="700" fill="${state === 'new' ? '#8a96a5' : '#1f2a37'}">${state === 'new' ? '?' : letter}</text></svg>`;
}

// A grown-up for the "With a grown-up" button: taller, in everyday clothes.
const GROWN_UP = ['..HHHHHH..', '.HHHHHHHH.', '.HSSSSSSH.', '.SEWSSEWS.', '.SEESSEES.', '.SSSMMSSS.', '..SSSSSS..', '.GGGGGGGG.', 'GGGGGGGGGG', 'GGGGGGGGGG', 'GGGGGGGGGG', 'SGGGGGGGGS', '.GGGGGGGG.', '.PPPPPPPP.', '.PPP..PPP.', '.PPP..PPP.', '.PPP..PPP.', '.PPP..PPP.', '.PPP..PPP.', '.BBB..BBB.'];
export function pixelGrownUp(px = 6) {
  const W = 10 * px;
  return `<g shape-rendering="crispEdges"><rect x="${-W / 2 + px}" y="${-px * 0.6}" width="${W - 2 * px}" height="${px}" fill="#000" opacity="0.18"/>
    ${spriteRects(GROWN_UP, { H: '#6b4a2f', S: '#f2c7a0', E: '#1f2937', W: '#ffffff', M: '#8a3a26', G: '#7aa874', P: '#3d4f6b', B: '#3b2a20' }, px, -W / 2, -20 * px)}</g>`;
}

const SCENES = { stadium, castle, mine, show, workshop, islands, night, trophy };
export const PIXEL_SCENES = Object.keys(SCENES);
export const pixelLevelSVG = (kind, opts = {}) => (SCENES[kind] ?? stadium)({ kit: '#e63946', ...opts });
