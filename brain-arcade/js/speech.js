// Read-aloud with the device's own voice (Web Speech API). On iPads the best voices are the
// "Enhanced"/"Premium" ones (Settings > Accessibility > Spoken Content > Voices); the parent
// area lists what this device has.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const PREFERRED = ['Samantha (Enhanced)', 'Ava (Premium)', 'Ava (Enhanced)', 'Zoe (Premium)', 'Zoe (Enhanced)', 'Allison (Enhanced)', 'Susan (Enhanced)', 'Nicky (Enhanced)',
  'Samantha', 'Ava', 'Allison', 'Nicky', 'Susan', 'Google US English', 'Microsoft Aria Online (Natural) - English (United States)', 'Microsoft Jenny Online (Natural) - English (United States)', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira'];

let voice = null;
let rate = 0.95;
let wanted = '';
let seq = 0;

export const speechAvailable = () => !!synth;

export function englishVoices() {
  if (!synth) return [];
  return synth.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
}

function chooseVoice() {
  const vs = englishVoices();
  if (!vs.length) return null;
  if (wanted) { const v = vs.find((x) => x.name === wanted); if (v) return v; }
  for (const name of PREFERRED) {
    const v = vs.find((x) => x.name === name || x.name.startsWith(name + ' ')) ;
    if (v && /en[-_]US/i.test(v.lang)) return v;
  }
  return vs.find((v) => /en[-_]US/i.test(v.lang)) || vs[0];
}

export function configureSpeech({ voice: name = '', rate: r = 0.95 } = {}) {
  wanted = name;
  rate = r;
  voice = chooseVoice();
}
if (synth) synth.onvoiceschanged = () => { voice = chooseVoice(); };

export const currentVoiceName = () => voice?.name || '';

// iOS needs the first utterance to come from a tap.
export function unlockSpeech() {
  if (!synth) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch { /* ignore */ }
}

export function stopSpeech() {
  seq++;
  try { synth?.cancel(); } catch { /* ignore */ }
}

// Speak text; resolves when finished (or when interrupted, or after a safety timeout).
export function speak(text, { rate: r, interrupt = true } = {}) {
  if (!synth || !text) return Promise.resolve();
  // Safari can drop an utterance queued right after cancel(), so give it a moment.
  const busy = synth.speaking || synth.pending;
  if (interrupt) stopSpeech();
  const my = ++seq;
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const u = new SpeechSynthesisUtterance(String(text).replace(/[✓✗]/g, ''));
    if (!voice) voice = chooseVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
    u.rate = r ?? rate;
    u.pitch = 1.05;
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, 1700 + String(text).length * 95);
    const go = () => { if (my !== seq) return finish(); try { synth.speak(u); } catch { finish(); } };
    if (interrupt && busy) setTimeout(go, 90); else go();
  });
}
