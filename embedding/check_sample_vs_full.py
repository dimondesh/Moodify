#!/usr/bin/env python3
"""Compare stratified 3x15s sampling vs full-track MusiCNN embeddings.

Usage:
  python check_sample_vs_full.py [audio1.mp3 audio2.mp3 ...]

If no files are given, synthesizes a few tones under /tmp/moodify_embed_check/.
Asserts mean cosine(sampled, full) >= MIN_COSINE.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

import numpy as np

# Import after cwd so MODEL_PATH resolves relative to embedding/
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app import (  # noqa: E402
    extract_embedding,
    extract_embedding_full,
    track_duration,
)

MIN_COSINE = 0.90
SYNTH_DIR = "/tmp/moodify_embed_check"


def cosine(a: list[float], b: list[float]) -> float:
    va = np.asarray(a, dtype=np.float64)
    vb = np.asarray(b, dtype=np.float64)
    na = np.linalg.norm(va)
    nb = np.linalg.norm(vb)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


def synth_mp3(path: str, duration_sec: float, freq: float) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency={freq}:duration={duration_sec}",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
        path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def default_fixtures() -> list[str]:
    specs = [
        ("short_40s.mp3", 40.0, 440.0),
        ("mid_120s.mp3", 120.0, 523.25),
        ("long_210s.mp3", 210.0, 349.23),
    ]
    paths = []
    for name, dur, freq in specs:
        path = os.path.join(SYNTH_DIR, name)
        if not os.path.exists(path):
            print(f"synth {path} ({dur}s)...")
            synth_mp3(path, dur, freq)
        paths.append(path)
    return paths


def main() -> int:
    paths = sys.argv[1:] or default_fixtures()
    scores = []

    for path in paths:
        if not os.path.isfile(path):
            print(f"SKIP missing: {path}")
            continue

        dur = track_duration(path)
        print(f"\n=== {path} (duration≈{dur:.1f}s) ===")

        t0 = time.perf_counter()
        sampled = extract_embedding(path)
        t_sampled = time.perf_counter() - t0

        t0 = time.perf_counter()
        full = extract_embedding_full(path)
        t_full = time.perf_counter() - t0

        sim = cosine(sampled, full)
        scores.append(sim)
        speedup = (t_full / t_sampled) if t_sampled > 0 else float("inf")
        print(
            f"cosine={sim:.4f}  sampled={t_sampled:.2f}s  full={t_full:.2f}s  "
            f"speedup≈{speedup:.2f}x"
        )

    if not scores:
        print("No files checked.")
        return 1

    mean = float(np.mean(scores))
    print(f"\nmean cosine={mean:.4f} (threshold {MIN_COSINE})")
    if mean < MIN_COSINE:
        print("FAIL: mean cosine below threshold")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
