// The microphone for the recorder. It is opened once per visit, so the permission question comes
// up at most once, and stays on until the recorder closes. Each take shows when it is really
// recording, shows a live level, and stops by itself a moment after the speaking ends.
const MAX_SECONDS = 8;
const GIVE_UP_SECONDS = 6; // nothing heard by then: stop
const SILENCE_AFTER = 0.7; // seconds of quiet after speech that end the take

export class MicSession {
  constructor() {
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
  }

  get open() {
    return !!this.stream;
  }

  // Call from a tap. Returns false (with a reason in this.error) if the microphone is unavailable.
  async start() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      this.error = 'This browser cannot record. Use Safari on the iPhone or iPad, or the studio on a computer.';
      return false;
    }
    // The meter's audio context is made inside the tap, before the permission question, so iOS lets it run.
    this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume();
    if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch {
      this.close();
      this.error = 'The microphone is blocked. Allow it for this site in Safari settings, then try again.';
      return false;
    }
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    return true;
  }

  // Starts one take. onLive() fires when recording has truly begun; onLevel(0..1) as it listens;
  // onAutoStop() when the speaking has ended (or nothing was heard). Returns { stop() -> Blob }.
  record({ onLive, onLevel, onAutoStop }) {
    const chunks = [];
    const rec = new MediaRecorder(this.stream);
    rec.ondataavailable = e => chunks.push(e.data);
    const finished = new Promise(resolve => { rec.onstop = resolve; });
    const data = new Float32Array(this.analyser.fftSize);
    let startedAt = 0;
    let quietest = Infinity; // the room's background level, as the quietest moment so far
    let signal = false;
    let above = 0;
    let heard = false;
    let quietSince = 0;
    let autoStop = true;
    let timer = null;
    const tick = () => {
      const t = performance.now() / 1000 - startedAt;
      this.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      const level = Math.sqrt(sum / data.length);
      onLevel?.(Math.min(1, level / 0.15));
      if (level > 0) signal = true;
      if (t > 1.2 && !signal) autoStop = false; // the meter gets nothing (iOS can pause it): use Stop
      if (t < 0.25) return; // let the sound of the tap settle
      quietest = Math.min(quietest, level);
      const threshold = Math.min(0.04, Math.max(0.012, quietest * 4));
      if (level > threshold) {
        // Speech: above the room for two readings in a row, so a click doesn't count.
        if (++above >= 2) {
          heard = true;
          quietSince = 0;
        }
      } else {
        above = 0;
        if (heard) quietSince ||= t;
      }
      const done = (heard && quietSince && t - quietSince > SILENCE_AFTER) || (!heard && t > GIVE_UP_SECONDS);
      if ((autoStop && done) || t > MAX_SECONDS) onAutoStop?.();
    };
    rec.onstart = () => {
      startedAt = performance.now() / 1000;
      timer = setInterval(tick, 30);
      onLive?.();
    };
    rec.start();
    return {
      stop: async () => {
        clearInterval(timer);
        if (rec.state !== 'inactive') rec.stop();
        await finished;
        return new Blob(chunks, { type: rec.mimeType });
      },
    };
  }

  decode(blob) {
    return blob.arrayBuffer().then(data => new Promise((resolve, reject) => this.ctx.decodeAudioData(data, resolve, reject)));
  }

  // Turns the microphone off (the iPhone's orange dot goes away).
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.analyser = null;
    try {
      this.ctx?.close();
    } catch {
      // already closed
    }
    this.ctx = null;
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  }
}
