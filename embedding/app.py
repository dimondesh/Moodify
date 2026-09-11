import os
import tempfile
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
import essentia.standard as es

app = FastAPI(title="Moodify Music Deep Embedding Service")

MODEL_PATH = "msd-musicnn-1.pb"
SAMPLE_RATE = 16000
WINDOW_SEC = 15.0
NUM_WINDOWS = 3
MAX_INTRO_SKIP_SEC = 15.0
BUDGET_SEC = WINDOW_SEC * NUM_WINDOWS  # 45s inference budget
# Drop a window if its start is closer than this to an already kept one
MIN_WINDOW_GAP_SEC = WINDOW_SEC * 0.5
EMBEDDING_DIM = 50

print("Loading MusiCNN model...")
musicnn = es.TensorflowPredictMusiCNN(graphFilename=MODEL_PATH)
print("Model loaded successfully!")


def track_duration(file_path: str) -> float:
    """Duration in seconds from file metadata (integer from MetadataReader)."""
    try:
        outputs = es.MetadataReader(filename=file_path)()
        duration = float(outputs[8])  # duration
        if duration > 0:
            return duration
    except Exception:
        pass
    # Fallback: decode (rare; MetadataReader failed)
    audio = es.MonoLoader(filename=file_path, sampleRate=SAMPLE_RATE)()
    return len(audio) / float(SAMPLE_RATE)


def intro_skip_samples(audio: np.ndarray, duration: float) -> int:
    """Skip leading low-energy region, capped at MAX_INTRO_SKIP_SEC."""
    probe_end = min(MAX_INTRO_SKIP_SEC, max(0.0, duration - WINDOW_SEC))
    if probe_end < 0.5 or len(audio) == 0:
        return 0

    probe = audio[: int(probe_end * SAMPLE_RATE)]
    frame_len = max(1, int(0.1 * SAMPLE_RATE))  # 100ms frames
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


def _window_starts(duration: float, skip: float) -> list[float]:
    """Early / middle / late 15s starts; drop near-duplicates."""
    max_start = max(0.0, duration - WINDOW_SEC)
    early = min(max(0.0, skip), max_start)
    middle = max_start / 2.0
    late = max_start

    kept: list[float] = []
    for start in sorted({early, middle, late}):
        if not kept or (start - kept[-1]) >= MIN_WINDOW_GAP_SEC:
            kept.append(start)
    return kept[:NUM_WINDOWS]


def load_sampled_audio(file_path: str) -> np.ndarray:
    """
    Stratified multi-window sample (~45s MusiCNN budget).
    Decode once @ 16 kHz, then slice — MP3 EasyLoader seeks re-decode and are slower.
    Short tracks (<=45s) keep the full waveform.
    # ponytail: no chorus detector — fixed early/mid/late windows; upgrade if quality dips
    """
    audio = es.MonoLoader(filename=file_path, sampleRate=SAMPLE_RATE)()
    if len(audio) == 0:
        return audio

    duration = len(audio) / float(SAMPLE_RATE)
    if duration <= BUDGET_SEC:
        return audio

    skip_sec = intro_skip_samples(audio, duration) / float(SAMPLE_RATE)
    window_len = int(WINDOW_SEC * SAMPLE_RATE)
    windows = []
    for start in _window_starts(duration, skip_sec):
        i0 = int(start * SAMPLE_RATE)
        i1 = min(i0 + window_len, len(audio))
        if i1 > i0:
            windows.append(audio[i0:i1])

    if not windows:
        return audio
    return np.concatenate(windows)


def load_full_audio(file_path: str) -> np.ndarray:
    """Full-track decode @ 16 kHz (for quality checks vs sampled path)."""
    return es.MonoLoader(filename=file_path, sampleRate=SAMPLE_RATE)()


def embedding_from_audio(audio) -> list[float]:
    if len(audio) == 0:
        return [0.0] * EMBEDDING_DIM

    features = musicnn(audio)
    mean_features = np.mean(features, axis=0)
    max_features = np.max(features, axis=0)
    embedding_hybrid = (mean_features * 0.7) + (max_features * 0.3)

    norm = np.linalg.norm(embedding_hybrid)
    if norm > 0:
        embedding_hybrid = embedding_hybrid / norm

    return embedding_hybrid.tolist()


def extract_embedding(file_path: str) -> list[float]:
    # Sampled path: ~45s stratified windows. Re-embed catalog after deploy for consistency
    # with vectors that were built from full-track audio.
    audio = load_sampled_audio(file_path)
    return embedding_from_audio(audio)


def extract_embedding_full(file_path: str) -> list[float]:
    """Full-track embedding — used by check_sample_vs_full.py only."""
    audio = load_full_audio(file_path)
    return embedding_from_audio(audio)


@app.post("/embed")
async def get_embedding(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        embedding_vector = extract_embedding(temp_path)
        return {"embedding": embedding_vector}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio processing error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/")
async def health_check():
    return {
        "status": "OK",
        "message": "Moodify Music Deep Embedding Service is running",
        "dimensions": EMBEDDING_DIM,
        "model": "MusiCNN (Hybrid Mean 70% + Max 30%, stratified 3x15s)",
        "sampleBudgetSec": BUDGET_SEC,
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5006)
