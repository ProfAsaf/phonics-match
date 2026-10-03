// The recording page (SPEC.md, "Recording page"): lists every clip the content files require,
// shows what to say, records, plays back, trims silence, evens out loudness, and saves the clip
// under the right name in audio/ through tools/studio-server.mjs. Localhost only.
import { loadContent } from './content.js';
import { RATE, processTake, takeFromBuffer } from './takes.js';

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
      S.take = processTake(takeFromBuffer(decoded));
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
    const res = await fetch(`api/clip/${c.id}`, { method: 'POST', headers: { 'content-type': 'audio/wav', 'x-studio': '1' }, body: new Blob([S.take.wav], { type: 'audio/wav' }) });
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
