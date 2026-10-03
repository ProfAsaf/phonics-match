// Turns a raw take (a microphone recording or an AI voice clip) into a saved clip: mono, silence
// trimmed from both ends, loudness evened out, resampled, and encoded as WAV. Pure functions, so
// the recorder, the studio, and the tests all share them.

// Mono 16-bit WAV at 16 kHz: clear speech, and the full set stays under the spec's 10 MB.
export const RATE = 16000;
const TARGET_RMS = 0.1; // about -20 dBFS while speaking
const PEAK = 0.95;

// take: { sampleRate, channels: [Float32Array, ...] }. Returns { samples, wav, seconds }.
export function processTake({ sampleRate: sr, channels }) {
  const n = channels[0]?.length ?? 0;
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  let mean = 0;
  for (const v of mono) mean += v / (n || 1);
  for (let i = 0; i < n; i++) mono[i] -= mean;

  // Trim: 10 ms frames; speech is anything above a sixteenth of the loudest frame.
  const frame = Math.max(1, Math.round(sr * 0.01));
  const rms = [];
  for (let i = 0; i + frame <= n; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += mono[j] * mono[j];
    rms.push(Math.sqrt(s / frame));
  }
  const loudest = rms.reduce((a, b) => Math.max(a, b), 0);
  if (loudest < 0.002) throw new Error('it was silent. Check the microphone.');
  const threshold = Math.max(loudest / 16, 0.0015);
  const first = rms.findIndex(v => v > threshold);
  let last = rms.length - 1;
  while (last > first && rms[last] <= threshold) last--;
  const start = Math.max(0, (first - 4) * frame); // keep 40 ms before
  const end = Math.min(n, (last + 9) * frame); // and 90 ms after
  const clip = mono.slice(start, end);

  // Loudness: speaking level to the target, without letting the peak clip.
  let sum = 0;
  let count = 0;
  let peak = 0;
  for (const v of clip) {
    peak = Math.max(peak, Math.abs(v));
    if (Math.abs(v) > threshold) {
      sum += v * v;
      count++;
    }
  }
  const speaking = Math.sqrt(sum / (count || 1));
  const gain = Math.min(TARGET_RMS / (speaking || 1), PEAK / (peak || 1));
  for (let i = 0; i < clip.length; i++) clip[i] *= gain;
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
export function resample(input, from, to) {
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

// 16-bit PCM mono WAV, as an ArrayBuffer.
export function encodeWav(samples, rate) {
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
  return view.buffer;
}

// The channels of a decoded AudioBuffer, in the shape processTake takes.
export function takeFromBuffer(buffer) {
  return { sampleRate: buffer.sampleRate, channels: Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)) };
}
