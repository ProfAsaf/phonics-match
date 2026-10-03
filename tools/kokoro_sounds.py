"""Makes the 24 isolated letter sounds with Kokoro. A speech voice can't say a bare consonant: said
alone, Kokoro hums a short "uh" first. So each sound is taken from where Kokoro says it cleanly:
  vowels         said alone, slowly; stretched to a second (same pitch)
  stops and j    said as "buh"; from the release to just after the vowel starts
  w, y           said as "wuh"; the glide, cut where it turns toward the vowel
  h              said as "huh"; its breath, remade a quarter second long
  s, f           said after a vowel ("ahs"); the hiss, remade a second long
  z, v           said where Kokoro voices them ("zoo", "uh-vuh"); the hum stretched, the hiss remade
  m, n           said after a vowel ("ahm"); the closed-mouth hum, stretched to a second
  l, r           said long, alone; the steady middle, stretched to a second
  x (/ks/)       said as "ex"; the "ks" after the k's silent gap
Hiss and breath are remade as fresh noise with the same tone, because looped noise buzzes. Any sound
that can't be found is skipped, so it stays a placeholder for the parent to record.
Called by tools/make-voices.mjs --sounds."""
import argparse
import json
import os
import wave

import numpy as np
from kokoro_onnx import Kokoro

parser = argparse.ArgumentParser()
parser.add_argument("--model-dir", required=True)
parser.add_argument("--out", required=True)
parser.add_argument("--voice", default="af_heart")
parser.add_argument("--only", default="")
args = parser.parse_args()
kokoro = Kokoro(os.path.join(args.model_dir, "kokoro-v1.0.onnx"), os.path.join(args.model_dir, "voices-v1.0.bin"))

VOWEL = {"a": "æ", "e": "ɛ", "i": "ɪ", "o": "ɑ", "u": "ʌ"}
STOP = {"b": ("b", 0.05), "d": ("d", 0.05), "g": ("ɡ", 0.05), "p": ("p", 0.03), "t": ("t", 0.03), "k": ("k", 0.03),
        "j": ("dʒ", 0.03)}  # seconds of vowel kept after the release: enough to hear b/d/g, little "uh"
GLIDE = {"w": "w", "y": "j"}
HISS = {"s": ("s", 0.35), "f": ("f", 0.2)}
BUZZ = {"z": ("zˈuː.", 0.5, 0), "v": ("ˈʌvə.", 0.6, -4)}  # and the hiss against the hum, in dB: a held z
# hisses clearly, a v is softer (the game's 16 kHz clips also lose the hiss above 8 kHz)
NASAL = {"m": "m", "n": "n"}
HELD = {"l": "l", "r": "ɹ"}
ORDER = list(VOWEL) + list(STOP) + list(GLIDE) + ["h"] + list(HISS) + list(BUZZ) + list(NASAL) + list(HELD) + ["ks"]
LONG = 1.0  # stretchable sounds are held for a second
BREATH = 0.25


def say(phonemes, speed):
    x, sr = kokoro.create(phonemes, voice=args.voice, speed=speed, is_phonemes=True)
    return np.asarray(x, dtype=np.float64), sr


def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) + 1e-12


def features(x, sr, hop=0.01, win=0.02):
    """Per hop: loudness; the share of energy above 700 Hz ("bright"), above 3 kHz ("hiss"), and
    between 0.9 and 2.5 kHz ("mid": vowels have formants there, a closed-mouth hum almost none);
    the level from 80 to 400 Hz in dB ("low": the voice); and the strongest frequency under 1 kHz."""
    h, w = int(sr * hop), int(sr * win)
    freqs = np.fft.rfftfreq(w, 1 / sr)
    rows = []
    for i in range(0, max(1, len(x) - w), h):
        seg = x[i:i + w]
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=w)) ** 2
        total = spec.sum() + 1e-12
        under = spec * (freqs < 1000)
        rows.append((rms(seg), spec[freqs > 700].sum() / total, spec[freqs > 3000].sum() / total,
                     spec[(freqs > 900) & (freqs < 2500)].sum() / total,
                     10 * np.log10(spec[(freqs > 80) & (freqs < 400)].sum() + 1e-12), freqs[int(np.argmax(under))]))
    return np.array(rows), h


def longest_run(mask):
    """[start, stop) of the longest run of True; (0, 0) if there is none."""
    best, run, end = 0, 0, -1
    for i, v in enumerate(mask):
        run = run + 1 if v else 0
        if run > best:
            best, end = run, i
    return end - best + 1, end + 1


def main_segment(f, h, floor=0.1):
    """The loud stretch around the loudest moment (drops any faint noise before or after)."""
    lv = f[:, 0]
    peak = int(np.argmax(lv))
    lo, hi = peak, peak
    while lo > 0 and lv[lo - 1] > lv[peak] * floor:
        lo -= 1
    while hi < len(lv) - 1 and lv[hi + 1] > lv[peak] * floor:
        hi += 1
    return lo * h, (hi + 2) * h


def band(x, sr, lo=None, hi=None, width=200):
    """x with only the frequencies between lo and hi, with soft edges about `width` Hz wide."""
    pad = 2048
    xp = np.pad(x, pad)
    f = np.fft.rfftfreq(len(xp), 1 / sr)
    gain = np.ones_like(f)
    if lo:
        gain *= np.clip((f - lo) / width + 0.5, 0, 1)
    if hi:
        gain *= np.clip((hi - f) / width + 0.5, 0, 1)
    return np.fft.irfft(np.fft.rfft(xp) * gain, n=len(xp))[pad:pad + len(x)]


def stretch(x, sr, seconds, frame=0.025, search=0.012):
    """Lengthens a steady sound without changing its pitch: overlapping slices of it, each placed
    where it lines up with the one before (waveform-similarity overlap-add)."""
    target = int(seconds * sr)
    n = int(sr * min(frame, len(x) / sr / 3))
    if len(x) >= target or n < sr * 0.008:
        return x
    hop = n // 2
    rate = (len(x) - n) / max(1, target - n)
    tol = int(sr * search)
    win = np.hanning(n)
    xp = np.pad(x, (tol, tol + n))
    out = np.zeros(target + n)
    norm = np.zeros(target + n)
    prev = None
    for at in range(0, target, hop):
        ideal = tol + int(at * rate)
        if prev is None:
            pos = ideal
        else:
            ref = xp[prev + hop:prev + hop + n]
            lo, hi = max(0, ideal - tol), min(len(xp) - n, ideal + tol)
            pos = lo + int(np.argmax(np.correlate(xp[lo:hi + n], ref, mode="valid")))
        out[at:at + n] += xp[pos:pos + n] * win
        norm[at:at + n] += win
        prev = pos
    return (out / np.maximum(norm, 1e-3))[:target]


def remade(seg, sr, seconds, seed):
    """Fresh noise with seg's average spectrum and loudness, `seconds` long."""
    n = 512 if len(seg) < sr * 0.15 else 1024
    src = np.pad(seg, (0, max(0, n - len(seg))))
    frames = [src[i:i + n] * np.hanning(n) for i in range(0, len(src) - n + 1, n // 4)]
    power = np.mean([np.abs(np.fft.rfft(fr)) ** 2 for fr in frames], axis=0)
    width = max(1, int(round(250 / (sr / n))))  # smoothed over 250 Hz, so the noise has no whistles
    power = np.convolve(power, np.ones(width) / width, mode="same")
    length = int(seconds * sr)
    spec = np.fft.rfft(np.random.default_rng(seed).standard_normal(length))
    shape = np.sqrt(np.interp(np.fft.rfftfreq(length, 1 / sr), np.fft.rfftfreq(n, 1 / sr), power))
    y = np.fft.irfft(spec * shape, n=length)
    return y * rms(seg) / rms(y)


def finish(x, sr, fade_in, fade_out):
    """Soft start and end, and silence around the sound so later trimming keeps all of it."""
    x = x.copy()
    a, b = min(len(x) // 2, int(sr * fade_in)), min(len(x) // 2, int(sr * fade_out))
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return np.concatenate([np.zeros(int(sr * 0.05)), x, np.zeros(int(sr * 0.1))])


def stop_cut(x, sr, tail):
    """From a stop's release to `tail` seconds after the vowel starts. Kokoro hums a short "uh"
    before a lone consonant, then dips; the release is the first bright moment after that."""
    f, h = features(x, sr, hop=0.005, win=0.012)
    lv, br = f[:, 0], f[:, 1]
    peak = int(np.argmax(lv))
    start = int(np.argmax(lv > lv[peak] * 0.3))
    i = start
    while i < peak and br[i] < 0.3:
        i += 1
    rel, how = start, "no hum"
    if i > start + 3:
        top = start + int(np.argmax(lv[start:i]))
        if lv[top:i + 1].min() < lv[top] * 0.63:
            rel, how = i, "after the hum"
    j = rel + 1
    while j < len(lv) - 1 and not (br[j] < 0.25 and lv[j] > lv[peak] * 0.1):
        j += 1
    a, b = max(0, rel - 1) * h, min(len(x), j * h + int(sr * tail))
    return a, b, f"release {how} at {rel * h / sr * 1000:.0f} ms, vowel at {j * h / sr * 1000:.0f} ms"


def glide_cut(x, sr):
    """w or y said as "wuh": from the start of the glide to where it turns toward the vowel."""
    f, h = features(x, sr, hop=0.005, win=0.012)
    lv, br = f[:, 0], f[:, 1]
    peak = int(np.argmax(lv))
    start = int(np.argmax(lv > lv[peak] * 0.1))
    end = start + 8
    while end < peak and br[end] <= 0.08:
        end += 1
    return max(0, start - 1) * h, end * h


def make(sound):
    """Returns (samples, rate, note) or (None, None, reason)."""
    if sound in VOWEL:
        x, sr = say(f"ˈ{VOWEL[sound]}.", 0.5)
        f, h = features(x, sr)
        a, b = main_segment(f, h)
        seg = x[a:b]
        return finish(stretch(seg, sr, LONG), sr, 0.03, 0.08), sr, f"vowel {len(seg) / sr:.2f}s, stretched"
    if sound in STOP:
        ph, tail = STOP[sound]
        x, sr = say(f"{ph}ə.", 0.9)
        a, b, note = stop_cut(x, sr, tail)
        return finish(x[a:b], sr, 0.003, 0.025), sr, note
    if sound in GLIDE:
        x, sr = say(f"{GLIDE[sound]}ə.", 0.9)
        a, b = glide_cut(x, sr)
        return finish(x[a:b], sr, 0.01, 0.04), sr, f"glide {a / sr * 1000:.0f}-{b / sr * 1000:.0f} ms"
    if sound == "h":
        x, sr = say("hə.", 0.8)
        f, h = features(x, sr, hop=0.005, win=0.012)
        lv, br = f[:, 0], f[:, 1]
        peak = int(np.argmax(lv))
        start = int(np.argmax(lv > lv[peak] * 0.03))
        end = start
        while end < peak and br[end] >= 0.25:  # the breath, until the voice starts
            end += 1
        if end - start < 4:
            return None, None, "no breath found"
        seg = x[start * h:end * h]
        return finish(remade(seg, sr, BREATH, 7), sr, 0.02, 0.12), sr, f"breath {len(seg) / sr:.2f}s, remade"
    if sound in HISS:
        ph, thresh = HISS[sound]
        x, sr = say(f"ˈɑː{ph}.", 0.6)
        f, h = features(x, sr)
        noisy = (f[:, 0] > f[:, 0].max() * 0.02) & (f[:, 2] > thresh)
        idx = np.where(noisy)[0]
        if not len(idx):
            return None, None, "no hiss found after the vowel"
        end = idx[-1]
        start = end
        while start - 1 >= 0 and noisy[start - 1]:
            start -= 1
        seg = x[start * h:(end + 1) * h]
        if len(seg) < sr * 0.08:
            return None, None, f"hiss too short ({len(seg) / sr:.2f}s)"
        core = seg[len(seg) // 5:len(seg) * 4 // 5]  # leave out the edges, where the vowel fades
        return finish(remade(core, sr, LONG, 11), sr, 0.05, 0.15), sr, f"hiss {len(seg) / sr:.2f}s, remade"
    if sound in BUZZ:
        ph, speed, hiss_db = BUZZ[sound]
        x, sr = say(ph, speed)
        f, h = features(x, sr, hop=0.005, win=0.02)
        a, b = longest_run((f[:, 0] > f[:, 0].max() * 0.018) & (f[:, 2] > 0.4))
        if b - a < 8:
            return None, None, "no hiss found"
        va, vb = longest_run(f[a:b, 4] > f[:, 4].max() - 20)  # voiced: a strong low hum under the hiss
        va, vb = va + a, vb + a
        if vb - va < 6:
            return None, None, f"too little voice ({(vb - va) * h / sr:.2f}s)"
        tail = int(sr * 0.02)  # each frame's window reaches 20 ms past its start
        fric, voiced = x[a * h:b * h + tail], x[va * h:vb * h + tail]
        low = band(voiced, sr, hi=700)
        hum = stretch(low, sr, LONG)
        hiss = remade(band(fric, sr, lo=900), sr, LONG, 13)
        hiss *= 0.65 + 0.35 * hum / (np.max(np.abs(hum)) + 1e-12)  # the voice pulses the hiss, as in a real z
        hum *= rms(low) / rms(hum)
        hiss *= rms(band(voiced, sr, lo=900)) / rms(hiss) * 10 ** (hiss_db / 20)
        return finish(hum + hiss, sr, 0.05, 0.12), sr, f"voice {len(voiced) / sr:.2f}s stretched, hiss {len(fric) / sr:.2f}s remade"
    if sound in NASAL:
        x, sr = say(f"ˈɑː{NASAL[sound]}.", 0.5)
        f, h = features(x, sr)
        a, b = longest_run((f[:, 0] > f[:, 0].max() * 0.2) & (f[:, 3] < 0.06) & (f[:, 5] < 400))
        if (b - a) * h < sr * 0.1:
            return None, None, f"no clear hum ({(b - a) * h / sr:.2f}s)"
        seg = x[a * h:(b + 1) * h]
        return finish(stretch(seg, sr, LONG), sr, 0.04, 0.1), sr, f"hum {a * h / sr * 1000:.0f}-{(b + 1) * h / sr * 1000:.0f} ms, stretched"
    if sound in HELD:
        x, sr = say(f"{HELD[sound]}ː.", 0.5)
        f, h = features(x, sr)
        a, b = longest_run((f[:, 0] > f[:, 0].max() * 0.1) & (f[:, 1] < 0.55))
        if (b - a) * h < sr * 0.25:
            return None, None, f"no steady stretch ({(b - a) * h / sr:.2f}s)"
        seg = x[a * h:b * h]
        return finish(stretch(seg, sr, LONG), sr, 0.04, 0.1), sr, f"steady {len(seg) / sr:.2f}s, stretched"
    if sound == "ks":
        x, sr = say("ˈɛks.", 0.8)
        f, h = features(x, sr)
        lv = f[:, 0]
        peak = int(np.argmax(lv))
        quiet = np.where(lv[peak:] < lv[peak] * 0.05)[0]
        if not len(quiet):
            return None, None, "no k gap found"
        gap_end = peak + quiet[0]
        while gap_end < len(lv) - 1 and lv[gap_end] < lv[peak] * 0.05:
            gap_end += 1
        return finish(x[gap_end * h:], sr, 0.003, 0.03), sr, "after the k gap"
    return None, None, "unknown sound"


os.makedirs(args.out, exist_ok=True)
sounds = [s for s in (args.only.split(",") if args.only else ORDER) if s]
report = {}
for sound in sounds:
    samples, rate, note = make(sound)
    if samples is None:
        report[sound] = {"skipped": note}
        print(f"s-{sound}: skipped ({note})", flush=True)
        continue
    pcm = (np.clip(samples / max(1.0, np.max(np.abs(samples)) / 0.95), -1, 1) * 32767).astype("<i2")
    with wave.open(os.path.join(args.out, f"s-{sound}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    report[sound] = {"seconds": round(len(samples) / rate, 2), "how": note}
    print(f"s-{sound}: {len(samples) / rate:.2f}s ({note})", flush=True)
with open(os.path.join(args.out, "sounds.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1, ensure_ascii=False)
