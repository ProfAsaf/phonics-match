// Recording on the device itself, from the parent area. His goal shout is recorded with the
// microphone; everything else comes with the free AI voice (or can be made once with an OpenAI
// voice), and any clip can be re-recorded. Clips are trimmed and leveled the same way as in the studio.
import { today } from './mastery.js';
import { processTake, takeFromBuffer } from './takes.js';
import * as store from './clipstore.js';
import { VOICES, voiceJobs, speakWithRetry } from './voices.js';
import { MicSession } from './mic.js';
import { h } from './ui.js';

const MIC_ONLY = new Set(['sound', 'shout']); // an OpenAI voice can't say a bare letter sound
const GROUP_LABELS = { Sounds: 'Letter sounds: listen, and re-record any that sound wrong', 'Goal commentary': 'His goal shout, and goal commentary' };
const SAMPLE_LINE = 'Read the word. Find its picture.';

export async function openRecorder(state, overlay, { onBack }) {
  const { C, audio } = state;
  let meta = await store.listMeta();
  let group = 'Sounds';
  let selected = C.clips.find(c => c.group === group && !audio.isRecorded(c.id))?.id ?? C.clips.find(c => c.group === group)?.id ?? null;
  let take = null; // { id, samples, wav, seconds } waiting to be kept
  let recording = null; // { stop } while the microphone is on
  let making = null; // { controller } while AI voices are being made
  let usedMic = false;
  let notice = '';

  // The AI voice controls are made once, so the key and choices survive re-renders.
  const voice = h('select', {}, VOICES.map(v => h('option', { value: v }, v)));
  const keyInput = h('input', { type: 'password', autocomplete: 'off', placeholder: 'sk-…', spellcheck: 'false' });
  const redo = h('input', { type: 'checkbox', onchange: () => render() });
  const progress = h('div', { class: 'muted' });
  const hear = h('button', { class: 'pbig', onclick: hearVoice }, '▶ Hear this voice');
  const make = h('button', { class: 'pbig due', onclick: makeVoices }, 'Make the AI voices');
  const stop = h('button', { class: 'pbig danger', onclick: () => making?.controller.abort() }, 'Stop');
  const importFile = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  importFile.addEventListener('change', importRecordings);

  // The microphone stays on while the recorder is open, and turns off if the app goes to the background.
  const mic = new MicSession();
  const onHidden = () => {
    if (document.hidden && !recording) mic.close();
  };
  document.addEventListener('visibilitychange', onHidden);

  const sourceOf = id => meta.get(id)?.source
    ?? (Object.hasOwn(audio.recorded, id) ? (audio.madeVoices[id] ? 'free' : 'website') : null);
  const label = { mic: 'you', voice: 'OpenAI voice', free: 'free AI voice', website: 'website recording' };
  render();

  function render() {
    const groups = [...new Set(C.clips.map(c => c.group))];
    const counts = { mic: 0, voice: 0, free: 0, website: 0 };
    for (const c of C.clips) {
      const s = sourceOf(c.id);
      if (s) counts[s]++;
    }
    const total = counts.mic + counts.voice + counts.free + counts.website;
    const parts = [[counts.mic, 'recorded by you'], [counts.free, 'free AI voice'], [counts.voice, 'OpenAI voice'], [counts.website, 'website recordings']]
      .filter(([n]) => n).map(([n, what]) => `${n} ${what}`);
    // With the free voice already published, OpenAI is only an optional switch.
    const openai = [
      h('label', { class: 'field' }, h('span', {}, 'Voice'), h('span', { class: 'row-inline' }, voice, hear)),
      h('label', { class: 'field' }, h('span', {}, 'OpenAI API key'), keyInput,
        h('span', { class: 'muted' }, 'Used only to make these clips, and not saved. Create one at platform.openai.com.')),
      h('label', { class: 'field inline' }, redo, h('span', {}, 'Also redo clips that already have an AI voice (to switch voices)')),
      h('div', { class: 'pbtns left' }, make, making && stop),
      progress,
    ];
    const toMake = pendingJobs().length;
    make.textContent = toMake ? `Make the AI voices (${toMake} clips)` : 'Make the AI voices';
    make.disabled = !!making || !toMake;
    hear.disabled = !!making;
    const groupSelect = h('select', {}, groups.map(g => h('option', { value: g, selected: g === group }, GROUP_LABELS[g] ?? g)));
    groupSelect.addEventListener('change', () => {
      group = groupSelect.value;
      take = null;
      selected = C.clips.find(c => c.group === group && !audio.isRecorded(c.id))?.id ?? C.clips.find(c => c.group === group)?.id;
      render();
    });

    overlay.replaceChildren(
      h('header', { class: 'phead' },
        h('div', {}, h('h1', {}, 'Recordings'),
          h('div', { class: 'muted' }, `${total} of ${C.clips.length} clips have audio${parts.length ? `: ${parts.join(', ')}` : ''}.`)),
        h('button', { class: 'pclose', disabled: !!making || !!recording, onclick: leave }, 'Back')),
      notice && h('section', { class: 'psec notice' }, notice),
      h('section', { class: 'psec' },
        h('h2', {}, 'AI voices'),
        counts.free
          ? [h('p', { class: 'muted' }, 'Words, sentences, prompts, and letter sounds already have a free AI voice. The letter sounds are cut from AI speech, so listen to each one below and re-record any that sound wrong. His goal shout is his to record; any other clip can be re-recorded too.'),
            h('details', { open: !!making }, h('summary', {}, 'Switch to an OpenAI voice (optional)'), openai)]
          : [h('p', { class: 'muted' }, 'Letter sounds and his goal shout need a real voice, so record those below. Everything else can be made once with an OpenAI voice, for a few cents. These are AI-generated voices; any clip can be re-recorded below.'),
            openai]),
      h('section', { class: 'psec' },
        h('h2', {}, 'Record with the microphone'),
        h('label', { class: 'field' }, h('span', {}, 'Which clips'), groupSelect),
        group === 'Sounds' && h('details', {}, h('summary', {}, 'How to say the sounds'),
          h('ul', {},
            h('li', {}, 'Stretchable sounds (f, l, m, n, r, s, v, z, and the vowels): hold for one second. "Mmm," not "muh."'),
            h('li', {}, 'Stop sounds (b, d, g, k, p, t) and j: short and clipped, with as little "uh" as possible.'),
            h('li', {}, 'h is a breath; w and y are quick, with no vowel after.'),
            h('li', {}, 'Short vowels: a as in apple, e as in bed, i as in itch, o as in octopus, u as in up.'),
            h('li', {}, 'One quiet room, same distance from the phone each time.'))),
        h('div', { class: 'rec-list' }, C.clips.filter(c => c.group === group).map(row))),
      h('section', { class: 'psec' },
        h('h2', {}, 'Back up recordings'),
        h('p', { class: 'muted' }, 'Recordings live on this device. Save a copy so they survive if Safari clears its storage, or to move them to another device.'),
        h('div', { class: 'pbtns left' },
          h('button', { class: 'pbig', onclick: exportRecordings }, 'Export recordings'),
          h('button', { class: 'pbig', onclick: () => importFile.click() }, 'Import recordings'), importFile)),
    );
  }

  function row(c) {
    const source = sourceOf(c.id);
    const isSel = c.id === selected;
    const el = h('div', { class: `rec-row${isSel ? ' sel' : ''}${source ? ' done' : ''}` },
      h('span', { class: 'status' }),
      h('div', { class: 'what' },
        h('div', { class: `say ${c.kind}` }, c.text),
        c.hint && h('div', { class: 'muted' }, c.hint)),
      h('span', { class: 'chip' }, source ? label[source] : 'not yet'));
    if (!isSel) {
      el.addEventListener('click', () => {
        if (recording) return;
        selected = c.id;
        take = null;
        render();
      });
      return el;
    }
    const controls = h('div', { class: 'rec-controls' });
    if (recording?.live) {
      // Unmistakable: speak now. The meter shows it hearing you; it stops by itself after you finish.
      controls.append(
        h('div', { class: 'rec-live' }, h('div', {}, '● Recording: say it now'), h('div', { class: 'meter' }, h('i'))),
        h('button', { class: 'pbig rec on', onclick: stopRecording }, '■ Stop'));
    } else if (recording) {
      controls.append(h('div', { class: 'rec-wait' }, 'Getting the microphone ready…'));
    } else {
      controls.append(h('button', { class: 'pbig rec', onclick: () => startRecording(c.id) }, '● Record'));
    }
    if (!recording && take?.id !== c.id) {
      controls.append(h('div', { class: 'muted rec-hint' }, 'Tap Record. When the red bar shows, say it. It stops by itself when you finish.'));
    }
    if (take?.id === c.id && !recording) {
      controls.append(
        h('button', { class: 'pbig', onclick: () => playWav(take.wav) }, `▶ Hear take (${take.seconds.toFixed(1)}s)`),
        h('button', { class: 'pbig due', onclick: keepTake }, '✓ Keep'),
        h('button', { class: 'pbig', onclick: () => { take = null; render(); } }, 'Discard'));
    } else if (source && !recording) {
      controls.append(h('button', { class: 'pbig', onclick: () => playClip(c.id) }, '▶ Play'));
      if (meta.has(c.id)) controls.append(h('button', { class: 'pbig', onclick: () => removeClip(c.id) }, 'Remove'));
    }
    el.append(controls);
    return el;
  }

  function ensureAudio() {
    if (!audio.ctx || audio.ctx.state !== 'running') audio.unlock();
  }

  // ---- Microphone: asked for once per visit, on for the whole visit.
  async function startRecording(id) {
    if (recording) return;
    usedMic = true;
    player?.pause();
    selected = id;
    take = null;
    notice = '';
    const session = { live: false, stop: null };
    recording = session;
    render();
    if (!(await mic.start())) {
      recording = null;
      notice = mic.error;
      return render();
    }
    if (recording !== session) return; // left the recorder meanwhile
    session.stop = mic.record({
      onLive: () => {
        session.live = true;
        render();
      },
      onLevel: v => {
        const bar = overlay.querySelector('.meter i');
        if (bar) bar.style.width = `${Math.round(v * 100)}%`;
      },
      onAutoStop: () => stopRecording(),
    }).stop;
  }

  async function stopRecording() {
    const session = recording;
    if (!session?.stop) return;
    recording = null;
    render();
    const blob = await session.stop();
    try {
      take = { id: selected, ...processTake(takeFromBuffer(await mic.decode(blob))) };
    } catch (e) {
      notice = e.message.includes('silent') ? "It didn't hear anything. Tap Record and try again, a little louder." : `That take didn't work: ${e.message}`;
    }
    render();
    if (take) playWav(take.wav, { quiet: true }); // Safari may hold this back until the next tap
  }

  // Previews play through Safari's media player rather than the game's Web Audio, which the
  // microphone can leave stalled or routed to the earpiece on iPhones.
  let player = null;
  function playUrl(url, { quiet = false, revoke = false } = {}) {
    audio.stop();
    if (player) player.pause();
    player = new Audio(url);
    if (revoke) player.addEventListener('ended', () => URL.revokeObjectURL(url));
    return player.play().catch(e => {
      if (quiet) return;
      notice = `It didn't play: ${e.message}`;
      render();
    });
  }

  function playWav(wav, opts = {}) {
    return playUrl(URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), { ...opts, revoke: true });
  }

  async function playClip(id) {
    if (meta.has(id)) {
      const wav = await store.getAudio(id);
      if (wav) return playWav(wav);
    }
    if (audio.recorded[id]) return playUrl(`audio/${audio.recorded[id]}`);
  }

  async function keepTake() {
    if (!take) return;
    await save(take.id, { source: 'mic' }, take);
    take = null;
    // On to the next clip in this group that has no audio yet.
    const list = C.clips.filter(c => c.group === group);
    const after = list.slice(list.findIndex(c => c.id === selected) + 1);
    selected = after.find(c => !audio.isRecorded(c.id))?.id ?? selected;
    render();
  }

  async function save(id, info, processed) {
    const row = { id, created: today(), seconds: processed.seconds, ...info };
    await store.putClip(row, processed.wav);
    meta.set(id, row);
    audio.local.add(id);
    audio.forget(id);
  }

  async function removeClip(id) {
    await store.deleteClip(id);
    meta.delete(id);
    audio.local.delete(id);
    audio.forget(id);
    render();
  }

  // ---- AI voice
  function pendingJobs() {
    const clipKind = Object.fromEntries(C.clips.map(c => [c.id, c.kind]));
    // A clip with no audio at all; or, when switching voices, one whose audio is an AI voice.
    const isAI = id => ['voice', 'free'].includes(sourceOf(id));
    return voiceJobs(C).filter(j => !MIC_ONLY.has(clipKind[j.id]) && (!audio.isRecorded(j.id) || (redo.checked && isAI(j.id))));
  }

  function needKey() {
    const key = keyInput.value.trim();
    if (!key) {
      notice = 'Paste your OpenAI API key first.';
      render();
      keyInput.focus();
    }
    return key;
  }

  async function hearVoice() {
    const key = needKey();
    if (!key) return;
    ensureAudio();
    hear.textContent = '…';
    try {
      const wav = await speakWithRetry({ key, voice: voice.value, text: SAMPLE_LINE, instructions: 'Say this warmly and clearly at a calm pace, like a warm teacher talking to a young child.' });
      const t = processTake(takeFromBuffer(await audio.decode(wav)));
      playWav(t.wav);
      notice = '';
    } catch (e) {
      notice = e.message;
    }
    hear.textContent = '▶ Hear this voice';
    render();
  }

  async function makeVoices() {
    const key = needKey();
    if (!key) return;
    ensureAudio();
    const jobs = pendingJobs();
    const controller = new AbortController();
    making = { controller };
    notice = '';
    let done = 0;
    const failed = [];
    let fatal = null;
    const modelState = { model: 0 };
    let lock = null;
    try {
      lock = await navigator.wakeLock?.request('screen'); // keep the screen on while it works
    } catch {
      // not available
    }
    render();
    const show = () => { progress.textContent = `Made ${done} of ${jobs.length}…`; };
    show();
    const queue = [...jobs];
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const job = queue.shift();
        try {
          const wav = await speakWithRetry({ key, voice: voice.value, text: job.text, instructions: job.instructions, signal: controller.signal }, modelState);
          const processed = processTake(takeFromBuffer(await audio.decode(wav)));
          await save(job.id, { source: 'voice', voice: voice.value }, processed);
        } catch (e) {
          if (e.name === 'AbortError') return;
          if (e.fatal) {
            fatal = e;
            controller.abort();
            return;
          }
          failed.push(job.id);
        }
        done++;
        show();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    lock?.release?.();
    making = null;
    progress.textContent = '';
    notice = fatal ? fatal.message
      : controller.signal.aborted ? `Stopped after ${done} clips. Press the button again to finish the rest.`
        : failed.length ? `Made ${done - failed.length} clips; ${failed.length} didn't work. Press the button again to retry them.`
          : `Done: made ${done} clips. Play a match to hear them.`;
    render();
  }

  // ---- Backup
  async function exportRecordings() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `phonics-recordings-${today()}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function importRecordings() {
    try {
      const n = await store.importAll(JSON.parse(await importFile.files[0].text()));
      meta = await store.listMeta();
      for (const id of meta.keys()) {
        audio.local.add(id);
        audio.forget(id);
      }
      notice = `Imported ${n} recordings.`;
    } catch (e) {
      notice = e.message;
    }
    importFile.value = '';
    render();
  }

  function leave() {
    if (making || recording) return;
    player?.pause();
    mic.close();
    document.removeEventListener('visibilitychange', onHidden);
    audio.stop();
    // After the microphone, start the game's audio fresh on the next tap, in case iOS left it stalled.
    if (usedMic) audio.reset();
    onBack();
  }
}
