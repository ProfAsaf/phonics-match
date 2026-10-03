// AI voices for words, sentences, prompts, and commentary, made once with OpenAI's speech API and
// saved like recordings. Letter sounds and his goal shout are never made this way: a speech voice
// says "em" for m, and the clean sounds are the heart of the game (ground rule 3).
import { clip } from './content.js';

export const VOICES = ['coral', 'nova', 'sage', 'shimmer', 'alloy', 'ash', 'echo', 'fable', 'onyx'];
const MODELS = ['gpt-4o-mini-tts', 'tts-1']; // the second is a fallback without style instructions
const TEACHER = 'like a warm teacher talking to a young child';

// Every clip the AI voice can make, with how it should sound.
export function voiceJobs(C) {
  const jobs = [];
  const word = (id, text) => jobs.push({
    id, text, instructions: `Say this one English word once, clearly, at a normal pace, ${TEACHER}. It is an ordinary word, not an abbreviation. Say nothing else.`,
  });
  for (const w of C.words) {
    if (w.real) word(clip.word(w.word), w.word);
    else {
      jobs.push({
        id: clip.word(w.word), text: w.word,
        instructions: `Say this made-up word once, exactly as spelled, with a short vowel. It rhymes with "${w.rhyme}". Say only the word, clearly, ${TEACHER}.`,
      });
    }
  }
  for (const s of C.sightWords) word(clip.word(s), s);
  for (const s of [...C.sentences, ...C.custom]) {
    jobs.push({
      id: clip.sentence(s.text), text: s.text,
      instructions: 'Read this short sentence aloud once, slowly and clearly, with a little fun in your voice, like a warm teacher reading a silly headline to a young child.',
    });
  }
  for (const p of Object.values(C.prompts)) {
    jobs.push({
      id: clip.prompt(p.id), text: p.text,
      instructions: p.praise ? `Say this cheerfully, ${TEACHER}.` : `Say this warmly and clearly at a calm pace, ${TEACHER}.`,
    });
  }
  C.commentary.forEach((text, i) => jobs.push({
    id: clip.commentary(i), text,
    instructions: 'Say this like an excited soccer commentator, friendly and fun for a young child.',
  }));
  return jobs;
}

export class VoiceError extends Error {
  constructor(message, { fatal = false, retryAfter = 0, model = false } = {}) {
    super(message);
    Object.assign(this, { fatal, retryAfter, model });
  }
}

// One clip from OpenAI, as WAV bytes. Throws a VoiceError that says whether to stop, wait, or skip.
export async function speak({ key, voice, text, instructions, model = MODELS[0], signal }) {
  const body = { model, voice, input: text, response_format: 'wav' };
  if (model !== 'tts-1') body.instructions = instructions;
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new VoiceError('No connection to OpenAI.', { retryAfter: 5 });
  }
  if (res.ok) return res.arrayBuffer();
  let detail = {};
  try {
    detail = (await res.json()).error ?? {};
  } catch {
    // not JSON
  }
  const message = detail.message || `OpenAI said ${res.status}.`;
  if (res.status === 401) throw new VoiceError('OpenAI did not accept that key.', { fatal: true });
  if (res.status === 429 && detail.code === 'insufficient_quota') {
    throw new VoiceError('The OpenAI account is out of credit. Add some at platform.openai.com, then try again.', { fatal: true });
  }
  if (res.status === 429 || res.status >= 500) throw new VoiceError(message, { retryAfter: Number(res.headers.get('retry-after')) || 20 });
  if ((res.status === 400 || res.status === 404) && /model/i.test(message)) throw new VoiceError(message, { model: true });
  throw new VoiceError(message, { fatal: res.status === 403 });
}

// speak(), retrying waits and rate limits, and falling back to an older model if the newer one
// is unavailable to this account.
export async function speakWithRetry(args, state = { model: 0 }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await speak({ ...args, model: MODELS[state.model] });
    } catch (e) {
      if (e.model && state.model < MODELS.length - 1) {
        state.model++;
        continue;
      }
      if (e.fatal || !e.retryAfter || attempt >= 4) throw e;
      await new Promise(resolve => setTimeout(resolve, e.retryAfter * 1000));
    }
  }
}
