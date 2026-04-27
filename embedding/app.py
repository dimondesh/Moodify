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
    # Загружаем аудио. Теперь мы не обрезаем 30 секунд, а берем трек целиком!
    loader = es.MonoLoader(filename=file_path, sampleRate=16000)
    audio = loader()
        
    if len(audio) == 0:
        return [0.0] * 50

    # Получаем массив предсказаний для каждого 3-секундного патча трека
    features = musicnn(audio)
    
    # Усредняем значения (чтобы понять общую, базовую картину трека)
    mean_features = np.mean(features, axis=0)
    
    # Берем максимальные значения (чтобы засечь резкие срывы в другой жанр)
    max_features = np.max(features, axis=0)
    
    # Смешиваем: 70% базы и 30% пиковых значений (Уровень 2)
    embedding_hybrid = (mean_features * 0.7) + (max_features * 0.3)
    
    # L2-Нормализация
    norm = np.linalg.norm(embedding_hybrid)
    if norm > 0:
        embedding_hybrid = embedding_hybrid / norm
        
    return embedding_hybrid.tolist()

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
        "model": "MusiCNN (Hybrid Mean 70% + Max 30%)"
    }

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=5006)