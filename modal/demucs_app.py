"""Demucs instrumental separation on Modal (T4).

Deploy:
  modal deploy modal/demucs_app.py

Create a Modal secret named `moodify-demucs` with key MODAL_DEMUCS_SECRET,
matching backend .env. Then set MODAL_DEMUCS_URL to the printed endpoint URL.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import modal

app = modal.App("moodify-demucs")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "numpy",
        "torch",
        "torchaudio",
        "demucs",
        "fastapi[standard]",
        "httpx",
    )
)

model_cache = modal.Volume.from_name("demucs-models", create_if_missing=True)
CACHE_DIR = "/models"


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


@app.function(
    image=image,
    gpu="T4",
    timeout=600,
    memory=8192,
    volumes={CACHE_DIR: model_cache},
    secrets=[modal.Secret.from_name("moodify-demucs")],
)
@modal.fastapi_endpoint(method="POST")
def separate(item: dict):
    from fastapi import HTTPException
    from fastapi.responses import Response

    expected = os.environ.get("MODAL_DEMUCS_SECRET", "")
    provided = (item or {}).get("secret") or ""
    if not expected or provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    hls_url = (item or {}).get("hls_url")
    if not hls_url or not isinstance(hls_url, str):
        raise HTTPException(status_code=400, detail="hls_url required")

    os.environ.setdefault("TORCH_HOME", CACHE_DIR)
    os.environ.setdefault("XDG_CACHE_HOME", CACHE_DIR)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        in_wav = tmp_path / "input.wav"
        out_dir = tmp_path / "out"

        try:
            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    hls_url,
                    "-vn",
                    "-ac",
                    "2",
                    "-ar",
                    "44100",
                    str(in_wav),
                ]
            )
        except subprocess.CalledProcessError as err:
            raise HTTPException(
                status_code=502, detail=f"ffmpeg failed: {err}"
            ) from err

        try:
            _run(
                [
                    "python",
                    "-m",
                    "demucs",
                    "--two-stems=vocals",
                    "-n",
                    "htdemucs",
                    "-o",
                    str(out_dir),
                    str(in_wav),
                ]
            )
        except subprocess.CalledProcessError as err:
            raise HTTPException(
                status_code=500, detail=f"demucs failed: {err}"
            ) from err

        instrumental = out_dir / "htdemucs" / "input" / "no_vocals.wav"
        if not instrumental.is_file():
            matches = list(out_dir.rglob("no_vocals.wav"))
            if not matches:
                raise HTTPException(
                    status_code=500, detail="no_vocals.wav not found"
                )
            instrumental = matches[0]

        out_mp3 = tmp_path / "instrumental.mp3"
        try:
            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(instrumental),
                    "-vn",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "128k",
                    "-ar",
                    "44100",
                    "-ac",
                    "2",
                    str(out_mp3),
                ]
            )
        except subprocess.CalledProcessError as err:
            raise HTTPException(
                status_code=500, detail=f"mp3 encode failed: {err}"
            ) from err

        data = out_mp3.read_bytes()

    model_cache.commit()
    return Response(content=data, media_type="audio/mpeg")
