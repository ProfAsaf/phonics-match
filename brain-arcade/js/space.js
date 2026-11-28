// Rocket Ride's trip: each child's rocket flies from stop to stop across a star map that is saved
// between rounds. Every right answer is a unit of fuel; a stop is reached after `dist` units, and
// an alien friend there joins the child's album. The real solar system first (each with a true,
// simple fact), then pretend planets, which loop with new friends each time round. The steering
// between questions gets harder or easier with how the child flies (pilot, 0 to 1). No DOM here.

export const STOPS = [
  { id: 'moon', name: 'the Moon', short: 'Moon', dist: 6, hue: 275, fact: 'The Moon has no wind or rain, so footprints there could last for millions of years.' },
  { id: 'mars', name: 'Mars', dist: 8, hue: 150, fact: 'Mars looks red because its dust is full of rust.' },
  { id: 'ceres', name: 'Ceres', dist: 8, hue: 40, fact: 'Ceres is the biggest rock in the asteroid belt. It is a dwarf planet.' },
  { id: 'jupiter', name: 'Jupiter', dist: 9, hue: 190, fact: 'Jupiter is so big that more than a thousand Earths could fit inside it.' },
  { id: 'europa', name: 'Europa', dist: 7, hue: 320, fact: 'Europa is one of Jupiter\'s moons. Scientists think it has an ocean under its ice.' },
  { id: 'saturn', name: 'Saturn', dist: 9, hue: 260, fact: 'Saturn\'s rings are made of chunks of ice and rock.' },
  { id: 'titan', name: 'Titan', dist: 7, hue: 120, fact: 'It rains on Titan, Saturn\'s biggest moon, but the rain is not water.' },
  { id: 'uranus', name: 'Uranus', dist: 10, hue: 20, fact: 'Uranus spins on its side, like a ball rolling around the Sun.' },
  { id: 'neptune', name: 'Neptune', dist: 10, hue: 55, fact: 'Neptune has the fastest winds of any planet.' },
  { id: 'pluto', name: 'Pluto', dist: 10, hue: 200, fact: 'Pluto has a giant heart shape on it, made of ice.' },
  { id: 'comet', name: 'a comet', short: 'Comet', dist: 9, hue: 300, fact: 'A comet is a big ball of ice and dust. Its tail always points away from the Sun.' },
  { id: 'proxima', name: 'Proxima Centauri', short: 'Proxima', dist: 12, hue: 180, fact: 'Proxima Centauri is the closest star to our Sun. Its light takes more than four years to reach us.' },
  // pretend planets from here on (the map marks them as pretend)
  { id: 'candy', name: 'Candy Planet', dist: 9, hue: 160, pretend: true, fact: 'On this pretend planet, the hills are made of candy!' },
  { id: 'jelly', name: 'Jelly Planet', dist: 9, hue: 330, pretend: true, fact: 'On this pretend planet, the ground wobbles like jelly!' },
  { id: 'dino', name: 'Dino Planet', dist: 10, hue: 280, pretend: true, fact: 'On this pretend planet, dinosaurs never went away!' },
  { id: 'crystal', name: 'Crystal Planet', dist: 10, hue: 100, pretend: true, fact: 'On this pretend planet, everything sparkles like a jewel!' },
  { id: 'bubble', name: 'Bubble Planet', dist: 10, hue: 30, pretend: true, fact: 'On this pretend planet, you float around inside bubbles!' },
  { id: 'robot', name: 'Robot Planet', dist: 10, hue: 340, pretend: true, fact: 'On this pretend planet, robots bake cookies all day!' },
  { id: 'rainbow', name: 'Rainbow Planet', dist: 11, hue: 210, pretend: true, fact: 'On this pretend planet, it rains every color of the rainbow!' },
  { id: 'music', name: 'Music Planet', dist: 11, hue: 50, pretend: true, fact: 'On this pretend planet, the rocks sing songs!' },
];
export const PRETEND = STOPS.findIndex((s) => s.pretend);
export const stopAt = (i) => STOPS[Math.min(i, STOPS.length - 1)];

const NAMES = ['Zib', 'Blip', 'Quix', 'Zorp', 'Nibbit', 'Pim', 'Tiko', 'Glorp', 'Yuzu', 'Wibble', 'Fizzle', 'Bop', 'Zuzu', 'Plink', 'Mipo', 'Gleep', 'Vex', 'Lumo', 'Kip', 'Zabby', 'Nox', 'Twee', 'Oobi', 'Ziggle'];

// a small seeded random generator, so a friend always looks the same
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// The friend living at a stop (a new one each time the trip comes round again).
export function friendAt(stopIndex, lap = 1) {
  const stop = stopAt(stopIndex);
  const seed = hash(`${stop.id}:${lap}`);
  // a different name at every stop (7 and the 24 names share no factor, so a lap uses each once)
  return { stop: stop.id, lap, seed, name: NAMES[(stopIndex * 7 + (lap - 1) * 5) % NAMES.length], hue: (stop.hue + (lap - 1) * 47) % 360 };
}

export function loadTrip(player) {
  const t = (player.trip ||= {});
  t.leg ??= 0; // the stop the rocket is flying to
  t.fuel ??= 0; // units of fuel toward it
  t.lap ??= 1; // times round the pretend planets (+1 each loop)
  t.friends ||= [];
  t.dust ??= 0; // star bits grabbed, ever
  t.pilot ??= (player.grade ?? 1) < 0 ? 0 : 0.3;
  t.flights ??= 0;
  return t;
}
export const target = (t) => stopAt(t.leg);
export const from = (t) => (t.leg === 0 ? null : t.leg === PRETEND && t.lap > 1 ? STOPS[STOPS.length - 1] : stopAt(t.leg - 1));

// One unit of fuel. Returns { arrived: stop, friend } when it reaches the stop, else {}.
export function addFuel(t, now = Date.now()) {
  t.fuel++;
  const stop = target(t);
  if (t.fuel < stop.dist) return {};
  const friend = { ...friendAt(t.leg, t.lap), at: now };
  t.friends.push(friend);
  t.fuel = 0;
  t.leg++;
  if (t.leg >= STOPS.length) { t.leg = PRETEND; t.lap++; }
  return { arrived: stop, friend };
}

// After each flight: steer well (no bumps, most stars) and the next flight gets harder; bump
// into rocks and it gets easier.
export function pilotAfter(t, { stars, of, bumps }) {
  t.flights++;
  if (bumps === 0 && of > 0 && stars / of >= 0.7) t.pilot = Math.min(1, t.pilot + 0.08);
  else if (bumps >= 2) t.pilot = Math.max(0, t.pilot - 0.12);
  else if (bumps === 1) t.pilot = Math.max(0, t.pilot - 0.03);
  return t.pilot;
}

// What a flight holds, from the pilot level: rocks to dodge, stars to grab, and how fast they come.
export function flightPlan(pilot, { secs = 5, small = false } = {}) {
  return {
    secs,
    speed: (small ? 0.22 : 0.3) + 0.22 * pilot, // screen heights per second
    rocks: Math.round((small ? 0.5 : 1.5) + pilot * 4.5),
    stars: small ? 9 : 10,
  };
}
