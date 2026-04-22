from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
import librosa
import numpy as np
import tempfile
import os

app = FastAPI(title="Moodify Embedding Service")

def extract_embedding(file_path: str):
    # Загружаем аудио (resample до 22050 Hz для стандартизации)
    # Берем центральные 30 секунд трека, чтобы избежать интро/аутро
    y, sr = librosa.load(file_path, sr=22050, offset=30.0, duration=30.0)
    
    # Если трек короче 30 секунд, загружаем целиком
    if len(y) == 0:
        y, sr = librosa.load(file_path, sr=22050)

    # 1. MFCC (Мел-частотные кепстральные коэффициенты) - тембр голоса и инструментов (20 измерений)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    
    # 2. Chroma (Хроматограмма) - гармония и аккорды (12 измерений)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    
    # 3. Spectral Contrast - разница между пиками и впадинами в спектре (7 измерений)
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    
    # Усредняем значения по времени, чтобы получить плоский вектор
    mfcc_mean = np.mean(mfcc, axis=1)
    chroma_mean = np.mean(chroma, axis=1)
    contrast_mean = np.mean(spectral_contrast, axis=1)
    
    # Конкатенируем в один вектор (20 + 12 + 7 = 39 измерений)
    embedding = np.concatenate([mfcc_mean, chroma_mean, contrast_mean])
    
    # L2-Нормализация вектора для корректного расчета косинусного расстояния в JS
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
        
    return embedding.tolist()

@app.post("/embed")
async def get_embedding(file: UploadFile = File(...)):
    # Сохраняем загруженный файл во временную директорию
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
        "message": "Moodify Embedding Service is running",
        "dimensions": 39,
        "model": "librosa-features"
    }
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5006)