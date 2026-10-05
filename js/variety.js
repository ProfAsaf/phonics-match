// Variety (SPEC.md, "Variety"): the routine stays fixed, with the same stops in the same order so he
// always knows what comes next, but what surrounds it changes. Every match brings its own weather,
// things in the sky, rival keepers in the goals, and a mystery chest at one stop with a surprise to
// try for the day. His goals unlock balls, hats, and goal celebrations, which he picks in his locker.
// Pure: everything comes from the day, his progress, and a seed.
import { makeRng } from './rng.js';

// What he can unlock, in the order it comes: quickly at first, then about every five to eight
// matches, a different kind each time, spread across a school year of goals.
export const GEAR = [
  { kind: 'celebration', id: 'cheer', goals: 0 },
  { kind: 'ball', id: 'classic', goals: 0 },
  { kind: 'hat', id: 'none', goals: 0 },
  { kind: 'celebration', id: 'slide', goals: 10 },
  { kind: 'hat', id: 'cap', goals: 20 },
  { kind: 'ball', id: 'gold', goals: 30 },
  { kind: 'celebration', id: 'spin', goals: 45 },
  { kind: 'hat', id: 'party', goals: 60 },
  { kind: 'ball', id: 'rainbow', goals: 75 },
  { kind: 'celebration', id: 'dance', goals: 95 },
  { kind: 'hat', id: 'crown', goals: 115 },
  { kind: 'ball', id: 'beach', goals: 135 },
  { kind: 'celebration', id: 'flip', goals: 160 },
  { kind: 'hat', id: 'wizard', goals: 185 },
  { kind: 'ball', id: 'star', goals: 210 },
  { kind: 'celebration', id: 'robot', goals: 240 },
  { kind: 'hat', id: 'viking', goals: 270 },
  { kind: 'ball', id: 'fire', goals: 300 },
  { kind: 'celebration', id: 'airplane', goals: 335 },
  { kind: 'hat', id: 'pirate', goals: 370 },
  { kind: 'ball', id: 'ice', goals: 405 },
  { kind: 'celebration', id: 'fireworks', goals: 445 },
  { kind: 'hat', id: 'propeller', goals: 485 },
  { kind: 'ball', id: 'galaxy', goals: 525 },
  { kind: 'celebration', id: 'moonwalk', goals: 570 },
  { kind: 'hat', id: 'astronaut', goals: 615 },
  { kind: 'ball', id: 'block', goals: 660 },
];
export const KINDS = ['ball', 'hat', 'celebration'];
const DEFAULT = { ball: 'classic', hat: 'none', celebration: 'cheer' };

export const goalsOf = P => P.seasonGoals ?? 0;
export const isUnlocked = (P, kind, id) => GEAR.some(g => g.kind === kind && g.id === id && goalsOf(P) >= g.goals);
export const unlockedGear = P => GEAR.filter(g => goalsOf(P) >= g.goals);
// Things unlocked by going from `before` goals to `after`.
export const newlyUnlocked = (before, after) => GEAR.filter(g => g.goals > before && g.goals <= after);
export const nextUnlock = P => GEAR.find(g => g.goals > goalsOf(P)) ?? null;
// Unlocked since he last opened his locker: a gold dot on its button.
export const lockerNews = P => GEAR.filter(g => g.goals > (P.gear?.seen ?? 0) && g.goals <= goalsOf(P));

// What he wears and uses: his picks, or the defaults for anything not unlocked.
export function gearOf(P) {
  const out = {};
  for (const kind of KINDS) {
    const id = P.gear?.[kind];
    out[kind] = id && isUnlocked(P, kind, id) ? id : DEFAULT[kind];
  }
  return out;
}

export function pickGear(P0, kind, id) {
  const P = structuredClone(P0);
  if (!isUnlocked(P, kind, id)) return P;
  P.gear = { ...DEFAULT, seen: 0, ...P.gear, [kind]: id };
  return P;
}

export function sawLocker(P0) {
  const P = structuredClone(P0);
  P.gear = { ...DEFAULT, ...P.gear, seen: goalsOf(P) };
  return P;
}

// ---- The day's look. Weather comes from his world's own kinds; the sky gets two visitors by day and
// one by night; the keepers are a rival team in another color; and the chest holds the day's surprise.
const WEATHER = {
  meadow: ['clear', 'butterflies', 'rain', 'wind', 'clear'],
  river: ['clear', 'butterflies', 'rain', 'wind'],
  forest: ['leaves', 'leaves', 'rain', 'fireflies'],
  snow: ['snow', 'snow', 'heavy', 'sparkle'],
  beach: ['clear', 'wind', 'butterflies', 'rain'],
  desert: ['clear', 'wind', 'sparkle', 'clear'],
  jungle: ['rain', 'butterflies', 'fireflies', 'rain'],
  autumn: ['leaves', 'leaves', 'wind', 'rain'],
  mountain: ['clear', 'wind', 'snow', 'sparkle'],
  mushroom: ['fireflies', 'sparkle', 'butterflies'],
  town: ['clear', 'rain', 'butterflies', 'wind'],
  volcano: ['embers', 'embers', 'clear'],
};
export const DAY_SKY = ['balloon', 'plane', 'birds', 'kite', 'blimp'];
export const NIGHT_SKY = ['ufo', 'shooting', 'rocket'];
export const RIVALS = ['#e63946', '#1d6fd8', '#f77f00', '#7b2cbf', '#ff4fa3', '#e0b100', '#222222', '#00a6a6', '#2a9d8f', '#8d5524'];
export const ACTIVITY_STOPS = [0, 1, 2, 4, 5, 6];

export function dayLook(P, { day, theme, stops = ACTIVITY_STOPS, characters = ['boy', 'girl', 'robot', 'zombie'], seed } = {}) {
  const rng = makeRng(seed ?? `${day}#${P.sessionCount ?? 0}#look`);
  const weather = rng.pick(WEATHER[theme] ?? ['clear']);
  const sky = rng.shuffle(DAY_SKY).slice(0, 2);
  const night = rng.pick(NIGHT_SKY);
  const color = rng.pick(RIVALS.filter(c => c !== P.team?.color));
  const keepers = rng.shuffle(characters.filter(c => c !== P.character));
  return { weather, sky, night, keeper: { color, characters: keepers }, chest: { stop: rng.pick(stops), item: chestItem(P, rng) } };
}

// The chest's surprise, to use for the rest of the match: usually a taste of something still locked,
// one of the next few he'll earn; sometimes a favorite he already has.
export function chestItem(P, rng) {
  const coming = GEAR.filter(g => g.goals > goalsOf(P)).slice(0, 4);
  const owned = unlockedGear(P).filter(g => g.id !== DEFAULT[g.kind]);
  const pool = coming.length && (rng.next() < 0.7 || !owned.length) ? coming : owned;
  const g = pool.length ? rng.pick(pool) : GEAR[3];
  return { kind: g.kind, id: g.id, locked: g.goals > goalsOf(P) };
}
