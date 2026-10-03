// The recording page (SPEC.md, "Recording page"): lists every clip the content files require,
// shows what to say, records, plays back, trims silence, evens out loudness, and saves the clip
// under the right name in audio/ through tools/studio-server.mjs. Localhost only.
import { loadContent } from './content.js';

// Mono 16-bit WAV at 16 kHz: clear speech, and the full set stays under the spec's 10 MB.
const RATE = 16000;
const TARGET_RMS = 0.1; // about -20 dBFS while speaking
const PEAK = 0.95;
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

const S = { C: null, clips: [], recorded: {}, sel: 0, group: 'all', missingOnly: false, take: null, recorder: null, stream: null, ctx: null, busy: false };
const $ = sel => document.querySelector(sel);

function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid.nodeType ? kid : String(kid));
  return node;
}

async function boot() {
  if (!LOCAL) {
    document.body.replaceChildren(el('main', { class: 'away' }, el('h1', {}, 'The recording studio runs on your own computer'),
      el('p', {}, 'In the game folder, run: node tools/studio-server.mjs'), el('p', {}, 'Then open http://localhost:8321/studio.html')));
    return;
  }
  S.C = await loadContent();
  S.clips = S.C.clips;
  await loadManifest();
  const groups = [...new Set(S.clips.map(c => c.group))];
  $('#group').append(...groups.map(g => el('option', { value: g }, g)));
  $('#group').addEventListener('change', e => { S.group = e.target.value; S.sel = 0; render(); });
  $('#missing').addEventListener('change', e => { S.missingOnly = e.target.checked; S.sel = 0; render(); });
  document.addEventListener('keydown', onKey);
  render();
}

async function loadManifest() {
  const res = await fetch('audio/manifest.json', { cache: 'no-store' });
  S.recorded = (await res.json()).clips ?? {};
}

const visible = () => S.clips.filter(c => (S.group === 'all' || c.group === S.group) && (!S.missingOnly || !S.recorded[c.id]));
const current = () => visible()[S.sel];

function render() {
  const list = visible();
  S.sel = Math.min(S.sel, Math.max(0, list.length - 1));
  const done = S.clips.filter(c => S.recorded[c.id]).length;
  const inGroup = list.length;
  $('#count').textContent = `${done} of ${S.clips.length} recorded`;
  const groupDone = S.clips.filter(c => (S.group === 'all' || c.group === S.group) && S.recorded[c.id]).length;
  const groupAll = S.clips.filter(c => S.group === 'all' || c.group === S.group).length;
  $('#groupcount').textContent = S.group === 'all' ? '' : `${groupDone} of ${groupAll} in this group`;
  $('#list').replaceChildren(...list.map((c, i) => row(c, i === S.sel)));
  if (!inGroup) $('#list').append(el('p', { class: 'muted' }, 'Nothing left to record here.'));
  $('#list .sel')?.scrollIntoView({ block: 'nearest' });
}

function row(c, selected) {
  const status = S.recorded[c.id] ? 'done' : 'missing';
  const r = el('div', { class: `row ${status}${selected ? ' sel' : ''}`, onclick: () => { if (!selected) { S.sel = visible().indexOf(c); S.take = null; render(); } } },
    el('span', { class: 'status', title: status }),
    el('div', { class: 'what' }, el('div', { class: `say ${c.kind}` }, c.text), c.hint && el('div', { class: 'hint' }, c.hint),
      el('div', { class: 'id' }, `${c.group} · ${c.id}`)));
  if (selected) {
    const recording = !!S.recorder;
    r.append(el('div', { class: 'controls' },
      el('button', { class: recording ? 'rec on' : 'rec', onclick: e => { e.stopPropagation(); toggleRecord(); } }, recording ? '■ Stop (space)' : '● Record (space)'),
      el('button', { disabled: !S.take, onclick: e => { e.stopPropagation(); playTake(); } }, '▶ Take (p)'),
      el('button', { disabled: !S.take || S.busy, class: 'save', onclick: e => { e.stopPropagation(); saveTake(); } }, '✓ Save (enter)'),
      S.recorded[c.id] && el('button', { onclick: e => { e.stopPropagation(); playSaved(c.id); } }, '▶ Saved'),
      el('canvas', { class: 'wave', width: 360, height: 56 })));
    if (S.take) requestAnimationFrame(() => drawWave(r.querySelector('canvas'), S.take.samples));
  }
  return r;
}

function onKey(e) {
  if (e.target.matches('select, input')) return;
  if (e.key === ' ') { e.preventDefault(); toggleRecord(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (S.take) saveTake(); }
  else if (e.key === 'p') playTake();
  else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); move(-1); }
}

function move(d) {
  if (S.recorder) return;
  S.sel = Math.max(0, Math.min(visible().length - 1, S.sel + d));
  S.take = null;
  render();
}

function audioContext() {
  S.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (S.ctx.state !== 'running') S.ctx.resume();
  return S.ctx;
}

async function toggleRecord() {
  if (S.recorder) return S.recorder.stop();
  if (!current()) return;
  audioContext();
  try {
    S.stream ??= await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    return alert(`The microphone is not available: ${e.message}`);
  }
  const chunks = [];
  const recorder = new MediaRecorder(S.stream);
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = async () => {
    S.recorder = null;
    try {
      const decoded = await decode(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer());
      S.take = processTake(decoded);
      render();
      playTake();
    } catch (e) {
      alert(`That take could not be processed: ${e.message}`);
      render();
    }
  };
  S.recorder = recorder;
  S.take = null;
  recorder.start();
  render();
}

function decode(data) {
  return new Promise((resolve, reject) => audioContext().decodeAudioData(data, resolve, reject));
}

// Mono, DC removed, silence trimmed from both ends, loudness evened out, resampled to RATE.
function processTake(buffer) {
  const sr = buffer.sampleRate;
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / buffer.numberOfChannels;
  }
  const mean = mono.reduce((a, b) => a + b, 0) / (mono.length || 1);
  for (let i = 0; i < mono.length; i++) mono[i] -= mean;

  // Trim: 10 ms frames; speech is anything above a sixteenth of the loudest frame.
  const frame = Math.round(sr * 0.01);
  const rms = [];
  for (let i = 0; i + frame <= mono.length; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += mono[j] * mono[j];
    rms.push(Math.sqrt(s / frame));
  }
  const loudest = Math.max(...rms, 0);
  if (loudest < 0.002) throw new Error('it was silent. Check the microphone.');
  const threshold = Math.max(loudest / 16, 0.0015);
  const first = rms.findIndex(v => v > threshold);
  const last = rms.length - 1 - [...rms].reverse().findIndex(v => v > threshold);
  const start = Math.max(0, (first - 4) * frame); // keep 40 ms before
  const end = Math.min(mono.length, (last + 9) * frame); // and 90 ms after
  let clip = mono.slice(start, end);

  // Loudness: speaking level to the target, without letting the peak clip.
  let sum = 0;
  let n = 0;
  let peak = 0;
  for (const v of clip) {
    peak = Math.max(peak, Math.abs(v));
    if (Math.abs(v) > threshold) { sum += v * v; n++; }
  }
  const speaking = Math.sqrt(sum / (n || 1));
  const gain = Math.min(TARGET_RMS / (speaking || 1), PEAK / (peak || 1));
  clip = clip.map(v => v * gain);
  // A 10 ms fade at each end so nothing clicks.
  const fade = Math.round(sr * 0.01);
  for (let i = 0; i < fade && i < clip.length; i++) {
    clip[i] *= i / fade;
    clip[clip.length - 1 - i] *= i / fade;
  }
  const samples = resample(clip, sr, RATE);
  return { samples, wav: encodeWav(samples, RATE), seconds: samples.length / RATE };
}

// Windowed-sinc resampling, low-passed just under the new Nyquist frequency.
function resample(input, from, to) {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  const cutoff = Math.min(1, to / from) * 0.92;
  const half = 16;
  for (let i = 0; i < out.length; i++) {
    const center = i * ratio;
    const lo = Math.ceil(center - half * ratio);
    const hi = Math.floor(center + half * ratio);
    let acc = 0;
    let norm = 0;
    for (let k = lo; k <= hi; k++) {
      if (k < 0 || k >= input.length) continue;
      const x = (k - center) * cutoff;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * (k - center)) / (half * ratio + 1));
      acc += input[k] * sinc * w;
      norm += sinc * w;
    }
    out[i] = norm ? acc / norm : 0;
  }
  return out;
}

function encodeWav(samples, rate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([view.buffer], { type: 'audio/wav' });
}

function playSamples(samples, rate) {
  const ctx = audioContext();
  const buffer = ctx.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

function playTake() {
  if (S.take) playSamples(S.take.samples, RATE);
}

async function playSaved(id) {
  const res = await fetch(`audio/${S.recorded[id]}?t=${Date.now()}`, { cache: 'no-store' });
  const buffer = await decode(await res.arrayBuffer());
  const src = audioContext().createBufferSource();
  src.buffer = buffer;
  src.connect(S.ctx.destination);
  src.start();
}

async function saveTake() {
  const c = current();
  if (!c || !S.take || S.busy) return;
  S.busy = true;
  try {
    const res = await fetch(`api/clip/${c.id}`, { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-studio': '1' }, body: S.take.wav });
    if (!res.ok) throw new Error(await res.text());
    S.recorded[c.id] = (await res.json()).file;
    S.take = null;
    // On to the next clip.
    const list = visible();
    if (!S.missingOnly) S.sel = Math.min(list.length - 1, S.sel + 1);
  } catch (e) {
    alert(`Could not save: ${e.message}`);
  } finally {
    S.busy = false;
    render();
  }
}

function drawWave(canvas, samples) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  g.fillStyle = '#3c9442';
  const step = Math.max(1, Math.floor(samples.length / width));
  for (let x = 0; x < width; x++) {
    let peak = 0;
    for (let i = x * step; i < (x + 1) * step && i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const hgt = peak * height;
    g.fillRect(x, (height - hgt) / 2, 1, Math.max(1, hgt));
  }
}

boot();
