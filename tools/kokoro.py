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

for n, job in enumerate(jobs, 1):
    path = os.path.join(args.out, job["id"] + ".wav")
    if os.path.exists(path):
        continue  # already made; lets an interrupted run pick up where it stopped
    if job.get("phonemes"):
        samples, rate = kokoro.create(job["phonemes"], voice=args.voice, speed=job["speed"], is_phonemes=True)
    else:
        samples, rate = kokoro.create(job["text"], voice=args.voice, speed=job["speed"], lang="en-us")
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(path + ".tmp", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    os.replace(path + ".tmp", path)
    print(f"{n}/{len(jobs)} {job['id']}", flush=True)
