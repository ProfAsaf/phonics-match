"""Speaks each job in a jobs file with Kokoro, a free open-source voice, and saves it as a
24 kHz WAV. Called by tools/make-voices.mjs, which prepares the jobs and turns the results
into game clips; run that instead of this."""
import argparse
import json
import os
import wave

import numpy as np
from kokoro_onnx import Kokoro

parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", required=True)
parser.add_argument("--jobs", required=True)
parser.add_argument("--out", required=True)
parser.add_argument("--voice", default="af_heart")
args = parser.parse_args()

kokoro = Kokoro(os.path.join(args.model_dir, "kokoro-v1.0.onnx"), os.path.join(args.model_dir, "voices-v1.0.bin"))
with open(args.jobs, encoding="utf-8") as f:
    jobs = json.load(f)
os.makedirs(args.out, exist_ok=True)

HOP = 0.005


def onset_kind(phonemes):
    """How the clip's first sound starts: p t k, b d g, v, a hiss, or anything else."""
    p = phonemes.lstrip(" ˈˌ.,!?…\"'“")
    if p[:1] == "v":
        return "v"
    if p[:2] in ("dʒ", "tʃ") or p[:1] in "ʤʧszfʃʒθ":
        return "hiss"
    if p[:1] in "ptk":
        return "stop"
    if p[:1] in "bdɡg":
        return "voiced stop"
    return None


def trim_hum(x, sr, kind, single_word):
    """At the unhurried speeds used here, Kokoro often hums a short vowel before a clip's first
    consonant, so "tap" comes out "i-tap". The hum is loud, dark, and voiced, with no burst or
    hiss; it is cut where the consonant really begins: the release of p, t, k, the start of a hiss,
    the closure before b, d, g, or the quieter stretch that is v. In a sentence, a hum before b, d,
    g must also be far darker than any real vowel, so a first syllable like "Big" is never taken
    for one; v is only judged in single words. A clip that starts with its consonant is left alone."""
    if not kind or (kind == "v" and not single_word):
        return x
    h, w = int(sr * HOP), int(sr * 0.012)
    freqs = np.fft.rfftfreq(w, 1 / sr)
    lv, br, hs = [], [], []
    for i in range(0, len(x) - w, h):
        seg = x[i:i + w]
        spec = np.abs(np.fft.rfft(seg * np.hanning(w))) ** 2
        total = spec.sum() + 1e-12
        lv.append(np.sqrt(np.mean(seg ** 2)))
        br.append(spec[freqs > 700].sum() / total)
        hs.append(spec[freqs > 3000].sum() / total)
    lv, br, hs = np.array(lv), np.array(br), np.array(hs)
    if not len(lv):
        return x
    peak = lv.max()
    start = int(np.argmax(lv > peak * 0.1))
    # Some clips open with a faint click; a hum, if any, starts within 30 ms of it.
    hum_at = next((i for i in range(start, min(len(lv), start + 6)) if lv[i] >= peak * 0.15 and br[i] < 0.3), None)
    if hum_at is not None and all(lv[j] < peak * 0.5 for j in range(start, hum_at)):
        start = hum_at
    end = min(len(lv), start + int(0.25 / HOP))  # a hum lasts well under a quarter second
    loud_dark = lambda a, b: np.sum((lv[a:b] > peak * 0.15) & (br[a:b] < 0.3)) * HOP
    cut = None
    if kind in ("stop", "hiss"):
        hissy = (lambda i: hs[i] > 0.35 or br[i] > 0.6) if kind == "hiss" else (lambda i: hs[i] > 0.4 or br[i] > 0.5)
        cue = next((i for i in range(start, end) if lv[i] > peak * 0.05 and hissy(i)), None)
        if cue is not None and loud_dark(start, cue) >= (0.01 if kind == "hiss" else 0.025):
            cut = cue  # the release or hiss starts in this frame's window, so cut just before it
    else:
        # The hum is the first loud stretch. Before b, d, g it fades into the closure, then the
        # release and the vowel rise; before v it drops a few dB into the v.
        a = start + int(np.argmax(lv[start:end] >= peak * 0.25))
        top, i = lv[a], a
        keep = 0.5 if kind == "voiced stop" else 0.63
        while i < end and lv[i] >= top * keep:
            top = max(top, lv[i])
            i += 1
        long_enough = (i - a) * HOP >= (0.025 if kind == "voiced stop" else 0.03)
        if i < end and long_enough and kind == "voiced stop":
            dip = i + int(np.argmin(lv[i:i + 12]))
            dark, deep = (0.3, 0.3) if single_word else (0.08, 0.1)  # hums measure 0.001-0.07; vowels 0.11 and up
            if lv[dip] < top * deep and lv[dip:dip + 12].max() >= peak * 0.5 and br[a:i].mean() < dark:
                cut = dip - 1
        elif i < end and long_enough and br[a:i].mean() < 0.15:
            if any(lv[j] >= peak * 0.5 for j in range(i, min(len(lv), i + 30))):  # the vowel follows
                cut = i - 2
    if cut is None or cut <= start:
        return x
    # Safety: a hum is short, and what is left must still hold the word's vowel, a loud stretch
    # longer than the part cut. Otherwise the first consonant was missed, and nothing is cut.
    hum = loud_dark(start, cut)
    if hum > (0.15 if single_word else 0.12):
        return x
    run = best = 0
    for loud in lv[cut:] >= peak * 0.5:
        run = run + 1 if loud else 0
        best = max(best, run)
    if best * HOP < max(0.07, hum):
        return x
    at = max(0, cut * h - (int(sr * 0.002) if kind in ("stop", "hiss") else 0))
    kept = x[at:].copy()
    ramp = min(len(kept), int(sr * 0.003))
    kept[:ramp] *= np.linspace(0, 1, ramp)  # no click where the cut lands
    # Silence before the consonant, so the clip's fade-in never softens it.
    return np.concatenate([np.zeros(int(sr * 0.04), dtype=x.dtype), kept])

for n, job in enumerate(jobs, 1):
    path = os.path.join(args.out, job["id"] + ".wav")
    if os.path.exists(path):
        continue  # already made; lets an interrupted run pick up where it stopped
    if job.get("phonemes"):
        phonemes = job["phonemes"]
        samples, rate = kokoro.create(phonemes, voice=args.voice, speed=job["speed"], is_phonemes=True)
    else:
        phonemes = kokoro.tokenizer.phonemize(job["text"], "en-us")
        samples, rate = kokoro.create(job["text"], voice=args.voice, speed=job["speed"], lang="en-us")
    samples = trim_hum(np.asarray(samples, dtype=np.float32), rate, onset_kind(phonemes), bool(job.get("phonemes")))
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(path + ".tmp", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    os.replace(path + ".tmp", path)
    print(f"{n}/{len(jobs)} {job['id']}", flush=True)
