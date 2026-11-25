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
function noise(dur, { vol = 0.25, at = 0, hp = 800 } = {}) {
  const a = ac(); if (!a || !on) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
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
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { vol: 0.12, at: i * 0.11 })); },
};
