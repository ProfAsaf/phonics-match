// Monster Munch's pet: one monster per child that stays between rounds. It starts as an egg that
// hatches after a few right answers, then every right answer is a treat. Before each round the
// child picks what it eats today, and what it eats most shapes how it grows: its colour, then
// horns, a pattern, and at last a tail. Grown up (GROWN treats), it moves into the Monster Castle
// and a new egg arrives. Stars unlock hats and things for its room. No DOM here (unit-tested).

export const MENUS = [
  { id: 'berry', name: 'Berries', emoji: '🍓', foods: ['🍓', '🫐', '🍒', '🍇'], hue: 330, horns: 'bobbles', pattern: 'spots', said: 'berries' },
  { id: 'veg', name: 'Veggies', emoji: '🥕', foods: ['🥕', '🥦', '🌽', '🥒'], hue: 112, horns: 'leaves', pattern: 'stripes', said: 'veggies' },
  { id: 'sweet', name: 'Sweets', emoji: '🧁', foods: ['🧁', '🍩', '🍪', '🍭'], hue: 272, horns: 'swirls', pattern: 'sprinkles', said: 'sweets' },
  { id: 'pizza', name: 'Pizza', emoji: '🍕', foods: ['🍕', '🧀', '🍔', '🌭'], hue: 28, horns: 'spikes', pattern: 'freckles', said: 'pizza' },
  { id: 'fish', name: 'Fish', emoji: '🐟', foods: ['🐟', '🦐', '🍣', '🦑'], hue: 192, horns: 'fins', pattern: 'scales', said: 'fish' },
];
export const menuOf = (id) => MENUS.find((m) => m.id === id) || MENUS[0];

export const HATCH = 3; // right answers to hatch the egg
export const STAGES = [ // by treats eaten since hatching
  { id: 'baby', from: 0, scale: 0.62, name: 'baby' },
  { id: 'kid', from: 15, scale: 0.76, name: 'little monster' },
  { id: 'big', from: 40, scale: 0.89, name: 'big monster' },
  { id: 'grown', from: 80, scale: 1, name: 'grown-up monster' },
];
export const GROWN = STAGES[3].from;

export const NAMES = ['Bloop', 'Munchy', 'Zuzu', 'Fizz', 'Pip', 'Bobo', 'Wiggles', 'Nugget', 'Tofu', 'Mochi', 'Pickle', 'Bean', 'Noodle', 'Sprout', 'Ziggy', 'Gumdrop', 'Puddle', 'Waffles', 'Biscuit', 'Doodle', 'Pebble', 'Fuzzy', 'Momo', 'Kiki', 'Lulu', 'Goober', 'Dumpling', 'Blinky', 'Squish', 'Pudding', 'Taffy', 'Bubbles', 'Snorkel', 'Muffin', 'Zippy', 'Gizmo'];

// Unlocked by total stars (from every game). kind 'hat' is worn; 'room' sits in its room.
export const UNLOCKS = [
  { id: 'bow', kind: 'hat', emoji: '🎀', name: 'a bow', stars: 15 },
  { id: 'plant', kind: 'room', emoji: '🪴', name: 'a plant', stars: 25 },
  { id: 'tophat', kind: 'hat', emoji: '🎩', name: 'a top hat', stars: 40 },
  { id: 'picture', kind: 'room', emoji: '🖼️', name: 'a picture', stars: 60 },
  { id: 'crown', kind: 'hat', emoji: '👑', name: 'a crown', stars: 90 },
  { id: 'teddy', kind: 'room', emoji: '🧸', name: 'a teddy bear', stars: 110 },
  { id: 'cap', kind: 'hat', emoji: '🧢', name: 'a cap', stars: 140 },
  { id: 'clock', kind: 'room', emoji: '⏰', name: 'a clock', stars: 170 },
  { id: 'grad', kind: 'hat', emoji: '🎓', name: 'a smart hat', stars: 200 },
  { id: 'ball', kind: 'room', emoji: '⚽', name: 'a ball', stars: 230 },
  { id: 'flower', kind: 'hat', emoji: '🌸', name: 'a flower', stars: 260 },
  { id: 'balloons', kind: 'room', emoji: '🎈', name: 'balloons', stars: 300 },
  { id: 'sunhat', kind: 'hat', emoji: '👒', name: 'a sun hat', stars: 330 },
  { id: 'mushroom', kind: 'hat', emoji: '🍄', name: 'a mushroom hat', stars: 380 },
  { id: 'rainbow', kind: 'room', emoji: '🌈', name: 'a rainbow', stars: 460 },
  { id: 'disco', kind: 'room', emoji: '🪩', name: 'a disco ball', stars: 550 },
];
export const unlocked = (stars) => UNLOCKS.filter((u) => (stars || 0) >= u.stars);

// a small seeded random generator, so a monster always looks the same
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function newEgg(now = Date.now(), seed = Math.floor(Math.random() * 2 ** 31)) {
  return { id: 'm' + now.toString(36) + (seed % 1296).toString(36), seed, name: null, warm: 0, fed: 0, diet: {}, started: now, born: null, hat: null };
}
export function loadPet(player) {
  const p = (player.pet ||= {});
  p.family ||= [];
  p.seen ||= [];
  if (!p.cur) p.cur = newEgg();
  return p;
}

export const isEgg = (m) => !m.born;
export function stageOf(m) {
  if (isEgg(m)) return { id: 'egg', from: 0, scale: 0.62, name: 'egg' };
  let s = STAGES[0];
  for (const x of STAGES) if (m.fed >= x.from) s = x;
  return s;
}
export const isGrown = (m) => !isEgg(m) && m.fed >= GROWN;

// What it has eaten most, then second most (menu objects), counting only treats eaten.
export function favourites(m) {
  const d = Object.entries(m.diet || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || MENUS.findIndex((x) => x.id === a[0]) - MENUS.findIndex((x) => x.id === b[0]));
  return d.map(([id, n]) => ({ ...menuOf(id), n }));
}

// One right answer. Returns what happened, for the screen to show:
// { warmed, hatched } for an egg, { ate, grew: stage or null, grown } for a monster.
export function feed(m, menuId, now = Date.now()) {
  if (isEgg(m)) {
    m.warm = (m.warm || 0) + 1;
    if (m.warm >= HATCH) { m.born = now; return { warmed: true, hatched: true }; }
    return { warmed: true, hatched: false };
  }
  const before = stageOf(m).id;
  m.fed++;
  m.diet[menuId] = (m.diet[menuId] || 0) + 1;
  const after = stageOf(m);
  return { ate: menuId, grew: after.id !== before ? after : null, grown: after.id === 'grown' && before !== 'grown' };
}

// A grown monster moves into the Monster Castle; a new egg takes its place.
export function moveOut(pet, now = Date.now()) {
  const m = pet.cur;
  pet.family.push({ ...m, grownAt: now });
  pet.cur = newEgg(now);
  return m;
}

// Hats and room things unlocked since the child last saw the list (to show off once).
export function newUnlocks(pet, stars) {
  const fresh = unlocked(stars).filter((u) => !pet.seen.includes(u.id));
  return fresh;
}
export function markSeen(pet, items) { for (const u of items) if (!pet.seen.includes(u.id)) pet.seen.push(u.id); }

const mixHue = (a, b, w) => { // the shorter way round the colour wheel
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * w + 360) % 360;
};

// How the monster looks, from its seed, age and diet.
export function lookOf(m) {
  const r = rng(m.seed);
  const shape = Math.floor(r() * 4); // 0 gumdrop, 1 round, 2 tall, 3 wide
  const eyes = [2, 2, 1, 3, 2, 3][Math.floor(r() * 6)];
  const baseHue = Math.floor(r() * 360);
  const st = stageOf(m);
  const fav = favourites(m);
  const total = fav.reduce((s, f) => s + f.n, 0);
  const top = fav[0] || null, second = fav[1] || top;
  // the colour drifts from its egg colour toward its favourite food's, as it eats
  const w = top ? Math.min(1, total / 12) * (0.45 + 0.55 * (top.n / total)) : 0;
  const hue = top ? mixHue(baseHue, top.hue, w) : baseHue;
  const grow = Math.min(1, (m.fed || 0) / GROWN);
  const look = {
    stage: st.id, scale: st.scale, shape, eyes, seed: m.seed,
    hue: Math.round(hue), sat: Math.round(48 + 26 * grow), light: Math.round(70 - 8 * grow),
    horns: null, pattern: null, tail: null, fangs: false, hat: m.hat || null, baseHue,
  };
  if (st.id === 'kid' || st.id === 'big' || st.id === 'grown') look.horns = top?.horns || 'bobbles';
  if (st.id === 'big' || st.id === 'grown') look.pattern = second?.pattern || top?.pattern || 'spots';
  if (st.id === 'grown') look.tail = top?.id || 'berry';
  if (top?.id === 'pizza' && st.id !== 'baby') look.fangs = true;
  look.patternHue = second ? second.hue : look.hue;
  return look;
}

// "Bloop ate lots of veggies, so it grew leafy horns!"
export function growthLine(m, stage) {
  const top = favourites(m)[0];
  const name = m.name || 'Your monster';
  const food = top ? top.said : 'treats';
  if (stage.id === 'kid') return `${name} grew horns from all those ${food}!`;
  if (stage.id === 'big') { const f = favourites(m); const p = (f[1] || f[0]); return `${name} got ${({ spots: 'spots', stripes: 'stripes', sprinkles: 'sprinkles', freckles: 'freckles', scales: 'scales' })[p?.pattern] || 'a pattern'} from the ${p ? p.said : food}!`; }
  if (stage.id === 'grown') return `${name} is all grown up, with a tail from the ${food}!`;
  return `${name} is growing!`;
}
