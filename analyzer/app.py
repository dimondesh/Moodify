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

from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
from madmom.features.tempo import TempoEstimationProcessor

app = FastAPI(title="Moodify Analysis Service")

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

# Инициализируем нейросетевые модели Madmom при запуске сервера.
# Это позволяет загрузить веса в память один раз, 
# что ускоряет обработку каждого трека в несколько раз.
print("Loading Madmom neural networks...")
proc_beat = RNNBeatProcessor()
proc_track = DBNBeatTrackingProcessor(fps=100)
proc_tempo = TempoEstimationProcessor(fps=100)
print("Models loaded successfully!")

@app.get("/")
async def health_check():
    return {
        "status": "OK", 
        "message": "Moodify Analysis Service is running", 
        "features": "Madmom RNN (Beats/BPM), Essentia Temperley (Camelot)"
    }

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No selected file")

    # FastAPI работает с файлами иначе, используем tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
        content = await file.read()
        temp_audio.write(content)
        temp_audio_path = temp_audio.name

    try:
        # === 1. Извлечение тональности (Essentia) ===
        loader = es.MonoLoader(filename=temp_audio_path)
        audio_es = loader()
        
        # Используем профиль temperley для точного различия параллельных тональностей (4A/4B)
        key_extractor = es.KeyExtractor(profileType="temperley")
        key, scale, _ = key_extractor(audio_es)
        camelot_key = get_camelot(key, scale)

        # === 2. Извлечение BPM и Beats (Madmom) ===
        # Прогоняем аудио через рекуррентную нейросеть
        act = proc_beat(temp_audio_path)
        
        # Достаем точную сетку ударов
        beats = proc_track(act)
        
        # Вычисляем темп
        tempos = proc_tempo(act)
        
        # TempoEstimationProcessor возвращает список вероятных темпов: [[bpm, уверенность], ...]
        # Берем самый уверенный результат
        bpm = float(tempos[0][0]) if len(tempos) > 0 else 0.0

        # Форматируем данные для базы
        beats_list = [round(float(b), 3) for b in beats]

        analysis_data = {
            "bpm": round(bpm, 2),
            "camelot": camelot_key,
            "beats": beats_list
        }

        return JSONResponse(content=analysis_data, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze audio: {str(e)}")
    
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == '__main__':
    # Запуск сервера для локальной отладки
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)