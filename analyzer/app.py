import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import essentia.standard as es
import numpy as np

np.float = float
np.int = int
np.bool = bool

from madmom.features.beats import RNNBeatProcessor
from madmom.features.tempo import TempoEstimationProcessor

app = FastAPI(title="Moodify Music Analysis Service")

SAMPLE_RATE = 44100
BUDGET_SEC = 60.0
MAX_INTRO_SKIP_SEC = 15.0
# ponytail: fixed mid-window after intro-skip; upgrade to chorus/section detect if quality dips


def get_camelot(key, scale):
    """Конвертирует стандартную тональность в формат Camelot Wheel"""
    camelot_map = {
        "major": {
            "B": "1B", "F#": "2B", "Gb": "2B", "C#": "3B", "Db": "3B",
            "G#": "4B", "Ab": "4B", "D#": "5B", "Eb": "5B", "A#": "6B", "Bb": "6B",
            "F": "7B", "C": "8B", "G": "9B", "D": "10B", "A": "11B", "E": "12B"
        },
        "minor": {
            "G#": "1A", "Ab": "1A", "D#": "2A", "Eb": "2A", "A#": "3A", "Bb": "3A",
            "F": "4A", "C": "5A", "G": "6A", "D": "7A", "A": "8A", "E": "9A",
            "B": "10A", "F#": "11A", "Gb": "11A", "C#": "12A", "Db": "12A"
        }
    }
    return camelot_map.get(scale, {}).get(key)


def track_duration(file_path: str) -> float:
    """Duration in seconds from file metadata."""
    try:
        outputs = es.MetadataReader(filename=file_path)()
        duration = float(outputs[8])
        if duration > 0:
            return duration
    except Exception:
        pass
    audio = es.MonoLoader(filename=file_path, sampleRate=SAMPLE_RATE)()
    return len(audio) / float(SAMPLE_RATE)


def intro_skip_samples(audio: np.ndarray, duration: float) -> int:
    """Skip leading low-energy region, capped at MAX_INTRO_SKIP_SEC."""
    probe_end = min(MAX_INTRO_SKIP_SEC, max(0.0, duration - BUDGET_SEC))
    if probe_end < 0.5 or len(audio) == 0:
        return 0

    probe = audio[: int(probe_end * SAMPLE_RATE)]
    frame_len = max(1, int(0.1 * SAMPLE_RATE))
    n_frames = len(probe) // frame_len
    if n_frames == 0:
        return 0

    rms = np.array(
        [
            float(np.sqrt(np.mean(probe[i * frame_len : (i + 1) * frame_len] ** 2)))
            for i in range(n_frames)
        ],
        dtype=np.float64,
    )
    peak = float(np.max(rms))
    if peak <= 0:
        return 0

    threshold = peak * 0.1
    for i, value in enumerate(rms):
        if value >= threshold:
            return i * frame_len
    return 0


def load_full_audio(file_path: str) -> np.ndarray:
    """Full-track decode @ 44.1 kHz."""
    return es.MonoLoader(filename=file_path, sampleRate=SAMPLE_RATE)()


def sample_mid_window(audio: np.ndarray) -> np.ndarray:
    """
    Contiguous mid-track slice (~60s Madmom budget).
    Short tracks (<=60s) keep the full waveform.
    """
    if len(audio) == 0:
        return audio

    duration = len(audio) / float(SAMPLE_RATE)
    if duration <= BUDGET_SEC:
        return audio

    skip = intro_skip_samples(audio, duration)
    usable = len(audio) - skip
    window = int(BUDGET_SEC * SAMPLE_RATE)
    if usable <= window:
        return audio[skip:]

    # Mid of the post-intro region
    start = skip + (usable - window) // 2
    return audio[start : start + window]


def _write_temp_wav(audio: np.ndarray) -> str:
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    es.MonoWriter(filename=path, sampleRate=SAMPLE_RATE, format="wav")(audio)
    return path


def _camelot_from_audio(audio: np.ndarray):
    if len(audio) == 0:
        return None
    key_extractor = es.KeyExtractor(profileType="temperley")
    key, scale, _ = key_extractor(audio)
    return get_camelot(key, scale)


def _bpm_from_audio(audio: np.ndarray) -> float:
    if len(audio) == 0:
        return 0.0
    wav_path = _write_temp_wav(audio)
    try:
        act = proc_beat(wav_path)
        tempos = proc_tempo(act)
        return float(tempos[0][0]) if len(tempos) > 0 else 0.0
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def extract_features(file_path: str) -> dict:
    """
    Fast path for /analyze: Camelot on full decode (cheap), BPM on ~60s mid window.
    beats always [] (grid unused downstream).
    """
    full = load_full_audio(file_path)
    if len(full) == 0:
        return {"bpm": 0.0, "camelot": None, "beats": []}

    camelot_key = _camelot_from_audio(full)
    bpm = _bpm_from_audio(sample_mid_window(full))
    return {
        "bpm": round(bpm, 2),
        "camelot": camelot_key,
        "beats": [],
    }


def extract_features_full(file_path: str) -> dict:
    """Full-track BPM + Camelot for quality checks."""
    full = load_full_audio(file_path)
    if len(full) == 0:
        return {"bpm": 0.0, "camelot": None, "beats": []}

    camelot_key = _camelot_from_audio(full)
    bpm = _bpm_from_audio(full)
    return {
        "bpm": round(bpm, 2),
        "camelot": camelot_key,
        "beats": [],
    }

print("Loading Madmom neural networks...")
proc_beat = RNNBeatProcessor()
proc_tempo = TempoEstimationProcessor(fps=100)
print("Models loaded successfully!")


@app.get("/")
async def health_check():
    return {
        "status": "OK",
        "message": "Moodify Music Analysis Service is running",
        "features": "Madmom RNN (BPM), Essentia Temperley (Camelot)",
        "sampleBudgetSec": BUDGET_SEC,
    }


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No selected file")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
        content = await file.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    try:
        analysis_data = extract_features(temp_audio_path)
        return JSONResponse(content=analysis_data, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze audio: {str(e)}")
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)
