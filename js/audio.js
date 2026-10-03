// Audio on the Web Audio clock (SPEC.md, "Technical requirements"): unlocked by the first tap,
// decoded up front, and scheduled so gaps are exact. Every spoken clip is a recorded file in audio/
// (ground rule 3). Until a clip is recorded, a placeholder tone pattern stands in for it, with its
// words shown as a caption, so the whole game can be tried before anything is recorded. The
// placeholders are tones, never speech: the app does no speech synthesis.
import { clip } from './content.js';
import { hash } from './rng.js';

const PENTATONIC = [0, 2, 4, 7, 9];

export class AudioEngine {
  constructor(C, base = 'audio/') {
    this.C = C;
    this.base = base;
    this.ctx = null;
    this.buffers = new Map();
    this.recorded = {};
    this.sources = new Set();
    this.timers = new Set();
    this.waits = new Set();
    this.placeholders = true;
    this.useCues = false; // after three sessions, short cues replace spoken prompts
    this.onCaption = null;
    this.gen = 0;
  }

  // Must run inside a tap: iOS starts audio only from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.start(0);
  }

  get running() {
    return this.ctx?.state === 'running';
  }

  async loadManifest() {
    try {
      const res = await fetch(`${this.base}manifest.json`, { cache: 'no-cache' });
      this.recorded = (await res.json()).clips ?? {};
    } catch {
      this.recorded = {};
    }
  }

  isRecorded(id) {
    return Object.hasOwn(this.recorded, id);
  }

  // An item may be played only when all of its audio exists (or placeholders are on).
  available(id) {
    return this.isRecorded(id) || this.placeholders;
  }

  async prepare(ids) {
    await Promise.all([...new Set(ids)].map(id => this.load(id)));
  }

  async load(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    let buffer = null;
    if (this.isRecorded(id)) {
      try {
        const res = await fetch(this.base + this.recorded[id]);
        buffer = await this.decode(await res.arrayBuffer());
      } catch (e) {
        console.warn(`Could not load audio ${id}`, e);
      }
    }
    if (!buffer && this.placeholders) buffer = this.placeholder(id);
    if (buffer) this.buffers.set(id, buffer);
    return buffer;
  }

  decode(data) {
    return new Promise((resolve, reject) => this.ctx.decodeAudioData(data, resolve, reject));
  }

  now() {
    return this.ctx.currentTime;
  }

  // Starts a clip at an exact time on the audio clock and returns when it will end.
  at(id, when) {
    const buffer = this.buffers.get(id);
    if (!buffer) return when;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.out);
    src.start(when);
    this.track(src);
    if (!this.isRecorded(id) && this.onCaption) this.later(when, () => this.onCaption(this.C.clipText[id] ?? id));
    return when + buffer.duration;
  }

  track(node) {
    this.sources.add(node);
    node.onended = () => this.sources.delete(node);
  }

  // Runs fn when the audio clock reaches a time.
  later(time, fn) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, Math.max(0, (time - this.now()) * 1000));
    this.timers.add(timer);
  }

  // Resolves when the audio clock reaches a time, or at once if stop() is called.
  until(time) {
    return new Promise(resolve => {
      const wait = { resolve };
      wait.timer = setTimeout(() => {
        this.waits.delete(wait);
        resolve();
      }, Math.max(0, (time - this.now()) * 1000));
      this.waits.add(wait);
    });
  }

  // Runs audio steps in order, dropping the rest if stop() is called partway (say, by replay).
  async say(...steps) {
    const gen = this.gen;
    for (const step of steps) {
      if (gen !== this.gen) return false;
      await step();
    }
    return gen === this.gen;
  }

  // Silences everything playing or scheduled, and releases anything waiting on it.
  stop() {
    this.gen++;
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const wait of this.waits) {
      clearTimeout(wait.timer);
      wait.resolve();
    }
    this.waits.clear();
  }

  async play(id) {
    await this.load(id);
    await this.until(this.at(id, this.now() + 0.03));
  }

  // Clips in order with exact silences between them (one gap, or a list of gaps); onStart(i)
  // fires as clip i begins.
  async sequence(ids, { gap = 0, onStart } = {}) {
    await this.prepare(ids);
    const gapAfter = i => (i >= ids.length - 1 ? 0 : Array.isArray(gap) ? gap[i] ?? 0 : gap);
    let t = this.now() + 0.05;
    ids.forEach((id, i) => {
      if (onStart) this.later(t, () => onStart(i));
      t = this.at(id, t) + gapAfter(i);
    });
    await this.until(t);
  }

  // A spoken prompt, or its short cue once he knows the routine. Replay always passes full.
  async prompt(id, { full = false } = {}) {
    const p = this.C.prompts[id];
    if (!p) return;
    if (p.cue && !full && this.useCues) return this.cue(id);
    await this.play(clip.prompt(id));
  }

  async cue(id) {
    const h = hash(id);
    const t = this.now() + 0.03;
    [h % 5, (h >> 4) % 5].forEach((n, i) => this.tone(523.25 * 2 ** (PENTATONIC[n] / 12), t + i * 0.13, 0.12, 'triangle', 0.2));
    await this.until(t + 0.32);
  }

  // ---- Synthesized sounds: music and effects, never speech.
  tone(freq, when, dur, type = 'sine', gain = 0.2) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(env).connect(this.out);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    this.track(osc);
  }

  noise(when, dur, { gain = 0.2, type = 'bandpass', freq = 1500, q = 1 } = {}) {
    if (!this.noiseBuffer) {
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    env.gain.setValueAtTime(gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter).connect(env).connect(this.out);
    src.start(when);
    src.stop(when + dur + 0.02);
    this.track(src);
  }

  kick(when) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.frequency.setValueAtTime(130, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.14);
    env.gain.setValueAtTime(0.5, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(env).connect(this.out);
    osc.start(when);
    osc.stop(when + 0.2);
    this.track(osc);
  }

  snare(when) {
    this.noise(when, 0.12, { gain: 0.22, freq: 1800, q: 0.8 });
  }

  hat(when) {
    this.noise(when, 0.04, { gain: 0.08, type: 'highpass', freq: 7000 });
  }

  // Effects for the game layer.
  effect(name) {
    if (!this.running) return;
    const t = this.now() + 0.02;
    if (name === 'pass') {
      this.kick(t);
      this.noise(t + 0.02, 0.18, { gain: 0.06, freq: 900, q: 0.6 });
    } else if (name === 'whistle') {
      this.tone(2100, t, 0.22, 'square', 0.05);
      this.tone(2100, t + 0.28, 0.5, 'square', 0.05);
    } else if (name === 'goal') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.3, 'triangle', 0.16));
      this.noise(t, 1.2, { gain: 0.08, freq: 1200, q: 0.3 });
    } else if (name === 'sign') {
      [783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.12, 0.25, 'triangle', 0.16));
    } else if (name === 'tap') {
      this.tone(880, t, 0.05, 'sine', 0.06);
    }
  }

  // ---- Placeholders: one tone per sound, so a word sounds like its sounds strung together.
  placeholder(id) {
    const notes = placeholderNotes(this.C, id);
    const sr = this.ctx.sampleRate;
    const total = notes.reduce((t, n) => t + n.dur, 0) + 0.04;
    const buffer = this.ctx.createBuffer(1, Math.ceil(total * sr), sr);
    const data = buffer.getChannelData(0);
    let t = 0;
    for (const n of notes) {
      render(data, sr, t, n);
      t += n.dur;
    }
    return buffer;
  }
}

function pitchOf(C, soundId) {
  const i = Math.max(0, C.sounds.findIndex(s => s.id === soundId));
  return 220 * 2 ** ((PENTATONIC[i % 5] + 12 * Math.floor(i / 5)) / 24);
}

function placeholderNotes(C, id) {
  const soundNotes = (s, short) => {
    const kind = C.soundById[s]?.kind ?? 'stop';
    const freq = pitchOf(C, s);
    if (short) return [{ freq, dur: kind === 'vowel' ? 0.16 : 0.1, type: kind === 'vowel' ? 'tone' : 'pluck' }];
    if (kind === 'vowel') return [{ freq, dur: 0.6, type: 'tone' }];
    if (kind === 'continuous') return [{ freq, dur: 0.5, type: 'hiss' }];
    return [{ freq, dur: 0.16, type: 'pluck' }];
  };
  const wordNotes = word => {
    const w = C.byWord.get(word.toLowerCase());
    const sounds = w ? w.sounds : [...word.toLowerCase()].map(l => C.letterSound[l]).filter(Boolean);
    return sounds.flatMap(s => soundNotes(s, true));
  };
  if (id.startsWith('s-')) return soundNotes(id.slice(2), false);
  if (id.startsWith('w-')) return wordNotes(id.slice(2));
  if (id.startsWith('t-')) {
    return (C.clipText[id] ?? '').split(/\s+/)
      .flatMap(t => [...wordNotes(t.replace(/[^A-Za-z]/g, '')), { freq: 0, dur: 0.08, type: 'rest' }]);
  }
  if (id.startsWith('p-')) {
    const h = hash(id);
    return [0, 1, 2].map(i => ({ freq: 392 * 2 ** (PENTATONIC[(h >> (i * 3)) % 5] / 12), dur: 0.17, type: 'bell' }))
      .concat({ freq: 0, dur: 0.12, type: 'rest' });
  }
  return [{ freq: 330, dur: 0.9, type: 'cheer' }]; // goal commentary and his shout
}

function render(data, sr, t0, { freq, dur, type }) {
  if (type === 'rest') return;
  const start = Math.floor(t0 * sr);
  const len = Math.floor(dur * sr);
  for (let i = 0; i < len && start + i < data.length; i++) {
    const t = i / sr;
    const edge = Math.min(1, t / 0.015) * Math.min(1, (dur - t) / 0.05);
    let v = 0;
    if (type === 'tone') v = edge * Math.sin(2 * Math.PI * freq * t + 0.25 * Math.sin(2 * Math.PI * 5 * t));
    else if (type === 'hiss') v = edge * (0.55 * Math.sin(2 * Math.PI * freq * t) + 0.3 * (Math.random() * 2 - 1));
    else if (type === 'pluck') v = Math.exp(-t * 28) * (Math.sin(2 * Math.PI * freq * t) + (t < 0.008 ? Math.random() * 2 - 1 : 0));
    else if (type === 'bell') v = Math.exp(-t * 10) * Math.min(1, t / 0.004) * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
    else if (type === 'cheer') v = Math.sin(Math.PI * t / dur) * (0.5 * (Math.random() * 2 - 1) + 0.35 * Math.sin(2 * Math.PI * (freq + 250 * t / dur) * t));
    data[start + i] += 0.3 * v;
  }
}
