import json
import os
import tempfile
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
import essentia.standard as es

app = FastAPI(title="Moodify Deep Embedding Service")

EMBEDDING_DIM = 1280
GENRE_THRESHOLD = 0.15
# moodtheme head outputs lower sigmoid scores (PR-AUC ~0.14 vs ~0.20 for genre)
MOOD_THRESHOLD = 0.05
TOP_K_TAGS = 5

GENRE_JSON = "models/mtg_jamendo_genre-discogs-effnet-1.json"
MOOD_JSON = "models/mtg_jamendo_moodtheme-discogs-effnet-1.json"


def load_vocab(json_path: str) -> list[str]:
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)["classes"]


def get_top_tags(
    scores: np.ndarray,
    vocab: list[str],
    threshold: float,
    top_k: int = TOP_K_TAGS,
) -> list[str]:
    mean_scores = np.mean(scores, axis=0)
    indices = np.where(mean_scores >= threshold)[0]
    tagged = [(vocab[i], float(mean_scores[i])) for i in indices]
    tagged.sort(key=lambda x: x[1], reverse=True)
    if tagged:
        return [tag for tag, _ in tagged[:top_k]]
    # fallback: top-k by score when nothing passes threshold
    all_tagged = [(vocab[i], float(mean_scores[i])) for i in range(len(vocab))]
    all_tagged.sort(key=lambda x: x[1], reverse=True)
    return [tag for tag, score in all_tagged[:top_k] if score > 0]


print("Loading tag vocabularies...")
GENRE_VOCAB = load_vocab(GENRE_JSON)
MOOD_VOCAB = load_vocab(MOOD_JSON)

print("Loading Discogs-EffNet and MTG-Jamendo models...")
effnet = es.TensorflowPredictEffnetDiscogs(
    graphFilename="models/discogs-effnet-bs64-1.pb",
    output="PartitionedCall:1",
)
genre_model = es.TensorflowPredict2D(
    graphFilename="models/mtg_jamendo_genre-discogs-effnet-1.pb",
    output="model/Sigmoid",
)
mood_model = es.TensorflowPredict2D(
    graphFilename="models/mtg_jamendo_moodtheme-discogs-effnet-1.pb",
    output="model/Sigmoid",
)
print("Models loaded successfully!")


def extract_features(file_path: str) -> dict:
    loader = es.MonoLoader(filename=file_path, sampleRate=16000)
    audio = loader()

    if len(audio) == 0:
        return {
            "embedding": [0.0] * EMBEDDING_DIM,
            "predicted_genres": [],
            "predicted_moods": [],
        }

    activations = effnet(audio)
    mean_embedding = np.mean(activations, axis=0)

    norm = np.linalg.norm(mean_embedding)
    if norm > 0:
        mean_embedding = mean_embedding / norm

    genre_scores = genre_model(activations)
    mood_scores = mood_model(activations)

    return {
        "embedding": mean_embedding.tolist(),
        "predicted_genres": get_top_tags(genre_scores, GENRE_VOCAB, GENRE_THRESHOLD),
        "predicted_moods": get_top_tags(mood_scores, MOOD_VOCAB, MOOD_THRESHOLD),
    }


@app.post("/embed")
async def get_embedding(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        result = extract_features(temp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio processing error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/")
async def health_check():
    return {
        "status": "OK",
        "message": "Moodify Deep Embedding Service is running",
        "dimensions": EMBEDDING_DIM,
        "model": "Discogs-EffNet + MTG-Jamendo (genre & moodtheme heads)",
        "genre_classes": len(GENRE_VOCAB),
        "mood_classes": len(MOOD_VOCAB),
    }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5006)
