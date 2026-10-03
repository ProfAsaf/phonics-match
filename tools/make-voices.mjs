// Makes the AI voice clips (everything except the letter sounds and his goal shout) with Kokoro,
// a free open-source voice that runs on this computer, and adds them to audio/ like recordings.
// Words are spoken from their letters, sound by sound, so every vowel is the short one the game
// teaches, and nonsense words come out exactly as spelled. Sentences and prompts are read as text.
// (An AI voice can't say a bare letter sound well; those come from a real voice.)
//
//   node tools/make-voices.mjs --setup       one time: a Python environment and the voice model
//   node tools/make-voices.mjs               make every clip that has no audio yet
//   node tools/make-voices.mjs --voice af_bella --redo     remake the AI clips in another voice
//
// Clips recorded in the studio are never replaced: --redo only remakes clips this tool made.
// The voice lives outside the repo, in PHONICS_VOICE_DIR (default: %LOCALAPPDATA%\phonics-voice).
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildIndex, isVowel } from '../js/content.js';
import { voiceJobs } from '../js/voices.js';
import { processTake } from '../js/takes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VOICE_DIR = process.env.PHONICS_VOICE_DIR ?? join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'phonics-voice');
const PYTHON = join(VOICE_DIR, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/';
const MODEL_FILES = ['kokoro-v1.0.onnx', 'voices-v1.0.bin'];

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const run = (cmd, cmdArgs) => {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(' ')} failed`);
};

if (flag('--setup')) {
  mkdirSync(VOICE_DIR, { recursive: true });
  if (!existsSync(PYTHON)) run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', join(VOICE_DIR, 'venv')]);
  // kokoro-onnx still declares Python < 3.14, but runs fine on 3.14 now that onnxruntime does.
  run(PYTHON, ['-m', 'pip', 'install', '-q', '--disable-pip-version-check', '--ignore-requires-python', 'kokoro-onnx']);
  for (const file of MODEL_FILES) {
    if (existsSync(join(VOICE_DIR, file))) continue;
    console.log(`Downloading ${file}…`);
    const res = await fetch(MODEL_URL + file);
    if (!res.ok) throw new Error(`Download failed: ${file} (${res.status})`);
    writeFileSync(join(VOICE_DIR, `${file}.part`), Buffer.from(await res.arrayBuffer()));
    renameSync(join(VOICE_DIR, `${file}.part`), join(VOICE_DIR, file));
  }
  console.log(`Ready: ${VOICE_DIR}`);
  process.exit(0);
}

if (!existsSync(PYTHON) || MODEL_FILES.some(f => !existsSync(join(VOICE_DIR, f)))) {
  console.error('The voice is not set up yet. Run: node tools/make-voices.mjs --setup');
  process.exit(1);
}

// ---- Which clips, and how each is spoken
const read = name => {
  const path = join(ROOT, 'content', `${name}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
};
const C = buildIndex(Object.fromEntries(['sounds', 'levels', 'words', 'nonsense', 'sentences', 'prompts', 'custom-sentences'].map(n => [n, read(n)])));

// How Kokoro spells each letter's taught sound; it matches Kokoro's own reading of regular words,
// except j: written as two symbols (dʒ), Kokoro drops the j's hiss and "jet" sounds like "yet".
const SOUNDS = {
  a: 'æ', e: 'ɛ', i: 'ɪ', o: 'ɑː', u: 'ʌ', b: 'b', c: 'k', d: 'd', f: 'f', g: 'ɡ', h: 'h', j: 'ʤ', k: 'k', l: 'l',
  m: 'm', n: 'n', p: 'p', r: 'ɹ', s: 's', t: 't', v: 'v', w: 'w', x: 'ks', y: 'j', z: 'z', ck: 'k', ll: 'l',
};
const phonemesFor = w => {
  const vowel = w.letters.findIndex(isVowel);
  return w.letters.map((l, i) => (i === vowel ? 'ˈ' : '') + SOUNDS[l]).join('') + '.';
};
// Unhurried, for a beginning reader: Kokoro's normal pace reads a short sentence in under a second.
const SPEED = { word: 0.85, sentence: 0.7, prompt: 0.85, lively: 1.0 };

const manifestPath = join(ROOT, 'audio', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.clips ??= {};
manifest.voices ??= {}; // clips made by this tool, and in which voice; a studio recording removes its entry
const voice = option('--voice', 'af_heart');
const only = option('--only', null)?.split(',');
const wanted = id => (only ? only.includes(id) : !manifest.clips[id] || (flag('--redo') && manifest.voices[id]));
const kindOf = Object.fromEntries(C.clips.map(c => [c.id, c.kind]));
const work = join(tmpdir(), `phonics-voices-${voice}`);
mkdirSync(work, { recursive: true });

// Trims, levels, and saves one of Kokoro's WAV files like a recording.
const save = (id, file) => {
  const raw = readFileSync(file);
  const rate = raw.readUInt32LE(24);
  const dataAt = raw.indexOf('data', 12, 'ascii') + 8;
  const pcm = new Int16Array(raw.buffer.slice(raw.byteOffset + dataAt, raw.byteOffset + raw.length - ((raw.length - dataAt) % 2)));
  const take = processTake({ sampleRate: rate, channels: [Float32Array.from(pcm, v => v / 32768)] });
  writeFileSync(join(ROOT, 'audio', `${id}.wav`), Buffer.from(take.wav));
  manifest.clips[id] = `${id}.wav`;
  manifest.voices[id] = voice;
  return take;
};
const sorted = obj => Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
const saveManifest = () => {
  manifest.clips = sorted(manifest.clips);
  manifest.voices = sorted(manifest.voices);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

const jobs = voiceJobs(C)
  .filter(j => wanted(j.id))
  .map(j => {
    const w = j.id.startsWith('w-') ? C.byWord.get(j.id.slice(2)) : null;
    const kind = kindOf[j.id];
    const speed = kind === 'sentence' ? SPEED.sentence : kind === 'commentary' || C.prompts[j.id.slice(2)]?.praise ? SPEED.lively
      : kind === 'prompt' ? SPEED.prompt : SPEED.word;
    return { id: j.id, text: j.text, speed, ...(w ? { phonemes: phonemesFor(w) } : {}) };
  });
if (!jobs.length) {
  console.log('Every clip already has audio. Add --redo to remake the AI ones.');
  process.exit(0);
}

// ---- Speak them, then trim, level, and save each like a recording
writeFileSync(join(work, 'jobs.json'), JSON.stringify(jobs));
console.log(`Making ${jobs.length} clips with ${voice}…`);
if (flag('--redo') || only) for (const j of jobs) rmSync(join(work, 'raw', `${j.id}.wav`), { force: true });
run(PYTHON, [fileURLToPath(new URL('kokoro.py', import.meta.url)), '--model-dir', VOICE_DIR, '--jobs', join(work, 'jobs.json'), '--out', join(work, 'raw'), '--voice', voice]);

let bytes = 0;
const report = [];
for (const j of jobs) {
  const take = save(j.id, join(work, 'raw', `${j.id}.wav`));
  bytes += take.wav.byteLength;
  report.push([j.id, take.seconds]);
}
saveManifest();

const short = report.filter(([, s]) => s < 0.2).map(([id]) => id);
console.log(`Saved ${report.length} clips (${(bytes / 1e6).toFixed(1)} MB) to audio/ and updated audio/manifest.json.`);
if (short.length) console.log(`Check these, they came out very short: ${short.join(', ')}`);
