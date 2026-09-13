#!/usr/bin/env python3
"""Compare fast path (Camelot full + BPM 60s mid) vs full-track BPM/Camelot.

Usage:
  python check_sample_vs_full.py [audio1.mp3 audio2.mp3 ...]

If no files are given, synthesizes a few tones under /tmp/moodify_analyze_check/.
Asserts Camelot match rate and BPM agreement (incl. octave 2x) meet thresholds.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

import numpy as np

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app import (  # noqa: E402
    extract_features,
    extract_features_full,
    track_duration,
)

MIN_CAMELOT_MATCH = 0.90
MIN_BPM_MATCH = 0.90
BPM_TOL_ABS = 2.0
BPM_TOL_REL = 0.04
SYNTH_DIR = "/tmp/moodify_analyze_check"


def bpm_agree(a: float, b: float) -> bool:
    """True if tempos match within tolerance, allowing octave error (2x / 0.5x)."""
    if a <= 0 or b <= 0:
        return a == b
    for fa, fb in ((a, b), (a * 2, b), (a, b * 2), (a * 0.5, b), (a, b * 0.5)):
        diff = abs(fa - fb)
        if diff <= BPM_TOL_ABS or diff <= BPM_TOL_REL * max(fa, fb):
            return True
    return False


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
    camelot_hits = []
    bpm_hits = []

    for path in paths:
        if not os.path.isfile(path):
            print(f"SKIP missing: {path}")
            continue

        dur = track_duration(path)
        print(f"\n=== {path} (duration≈{dur:.1f}s) ===")

        t0 = time.perf_counter()
        sampled = extract_features(path)
        t_sampled = time.perf_counter() - t0

        t0 = time.perf_counter()
        full = extract_features_full(path)
        t_full = time.perf_counter() - t0

        c_ok = sampled["camelot"] == full["camelot"]
        b_ok = bpm_agree(float(sampled["bpm"]), float(full["bpm"]))
        camelot_hits.append(1.0 if c_ok else 0.0)
        bpm_hits.append(1.0 if b_ok else 0.0)

        speedup = (t_full / t_sampled) if t_sampled > 0 else float("inf")
        print(
            f"sampled bpm={sampled['bpm']} camelot={sampled['camelot']}  "
            f"full bpm={full['bpm']} camelot={full['camelot']}"
        )
        print(
            f"camelot_match={c_ok}  bpm_match={b_ok}  "
            f"sampled={t_sampled:.2f}s  full={t_full:.2f}s  speedup≈{speedup:.2f}x"
        )

    if not camelot_hits:
        print("No files checked.")
        return 1

    camelot_rate = float(np.mean(camelot_hits))
    bpm_rate = float(np.mean(bpm_hits))
    print(
        f"\ncamelot match={camelot_rate:.2f} (threshold {MIN_CAMELOT_MATCH})  "
        f"bpm match={bpm_rate:.2f} (threshold {MIN_BPM_MATCH})"
    )
    if camelot_rate < MIN_CAMELOT_MATCH or bpm_rate < MIN_BPM_MATCH:
        print("FAIL: agreement below threshold")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
