// Little sound effects made on the fly with Web Audio (no files to download).
let ctx = null;
let on = true;
export const setSfx = (v) => { on = !!v; };

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export const unlockAudio = () => { try { ac(); } catch { /* ignore */ } };

function tone(freq, dur, { type = 'sine', vol = 0.18, at = 0, slide = 0 } = {}) {
  const a = ac(); if (!a || !on) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const noiseBufs = new Map(); // one buffer per length: bubble pops come many to the second
function noise(dur, { vol = 0.25, at = 0, hp = 800 } = {}) {
  const a = ac(); if (!a || !on) return;
  const t = a.currentTime + at;
  let buf = noiseBufs.get(dur);
  if (!buf) {
    buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    noiseBufs.set(dur, buf);
  }
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}

export const sfx = {
  tap: () => tone(660, 0.06, { vol: 0.08 }),
  pop: () => { noise(0.18, { vol: 0.35, hp: 1200 }); tone(900, 0.08, { vol: 0.12, slide: 0.4 }); },
  good: () => { tone(784, 0.13, { vol: 0.14 }); tone(1047, 0.22, { vol: 0.14, at: 0.1 }); },
  bad: () => { tone(220, 0.18, { type: 'triangle', vol: 0.13, slide: 0.8 }); },
  soft: () => { tone(523, 0.12, { vol: 0.1 }); tone(659, 0.16, { vol: 0.1, at: 0.08 }); },
  star: () => { [1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, { vol: 0.07, at: i * 0.06 })); },
  whoosh: () => noise(0.35, { vol: 0.12, hp: 400 }),
  chomp: () => { noise(0.07, { vol: 0.3, hp: 300 }); noise(0.07, { vol: 0.3, hp: 300, at: 0.16 }); tone(140, 0.12, { type: 'square', vol: 0.05 }); },
  jump: () => tone(330, 0.25, { type: 'triangle', vol: 0.12, slide: 2.2 }),
  boost: () => { noise(0.5, { vol: 0.15, hp: 200 }); tone(110, 0.5, { type: 'sawtooth', vol: 0.04, slide: 2 }); },
  move: () => { noise(0.05, { vol: 0.28, hp: 1500 }); tone(196, 0.06, { type: 'triangle', vol: 0.1 }); },
  capture: () => { noise(0.1, { vol: 0.4, hp: 700 }); tone(392, 0.1, { type: 'triangle', vol: 0.1, slide: 0.5 }); },
  check: () => { tone(880, 0.1, { type: 'square', vol: 0.05 }); tone(698, 0.16, { type: 'square', vol: 0.05, at: 0.11 }); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { vol: 0.12, at: i * 0.11 })); },
  // a soap bubble: a quick rising "plip". k climbs a pentatonic scale while pops come in a quick
  // chain, so a swipe through a cluster plays a little tune.
  bubble: (k = 0) => { const f = PENTA[Math.min(PENTA.length - 1, k)]; tone(f, 0.09, { vol: 0.11, slide: 1.6 }); noise(0.03, { vol: 0.12, hp: 2600 }); },
  fizz: () => noise(0.05, { vol: 0.05, hp: 3500 }), // a bubble that pops by itself
  friend: () => { tone(1568, 0.08, { vol: 0.08 }); tone(2093, 0.12, { vol: 0.08, at: 0.07 }); },
  giggle: () => { [988, 1175, 1047, 1319].forEach((f, i) => tone(f, 0.07, { type: 'triangle', vol: 0.09, at: i * 0.085, slide: 1.15 })); },
  bump: () => { tone(110, 0.16, { type: 'triangle', vol: 0.16, slide: 0.6 }); noise(0.12, { vol: 0.25, hp: 300 }); },
  crack: () => { noise(0.06, { vol: 0.35, hp: 1800 }); noise(0.06, { vol: 0.3, hp: 1500, at: 0.22 }); noise(0.08, { vol: 0.4, hp: 1200, at: 0.5 }); },
};
const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637];
