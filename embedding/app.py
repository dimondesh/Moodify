import os
import tempfile
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
import essentia.standard as es

app = FastAPI(title="Moodify Deep Embedding Service")

MODEL_PATH = "msd-musicnn-1.pb"

print("Loading MusiCNN model...")
musicnn = es.TensorflowPredictMusiCNN(graphFilename=MODEL_PATH)
print("Model loaded successfully!")

def extract_embedding(file_path: str):
    loader = es.MonoLoader(filename=file_path, sampleRate=16000)
    audio = loader()
    
    sr = 16000
    if len(audio) > sr * 60:
        start = sr * 30
        end = start + sr * 30
        audio = audio[start:end]
        
    if len(audio) == 0:
        return [0.0] * 200

    # Исправлено: получаем один массив с семантическими признаками (50 измерений)
    features = musicnn(audio)
    
    # Усредняем значения всех 3-секундных патчей по времени
    embedding_mean = np.mean(features, axis=0)
    
    # L2-Нормализация
    norm = np.linalg.norm(embedding_mean)
    if norm > 0:
        embedding_mean = embedding_mean / norm
        
    return embedding_mean.tolist()

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
        "message": "Moodify Deep Embedding Service is running",
        "dimensions": 50,
        "model": "MusiCNN (Million Song Dataset Semantic Vector)"
    }

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5006)