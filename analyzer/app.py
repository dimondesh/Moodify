# --- Импорты ---
import os 
from flask import Flask, request, jsonify 
import essentia.standard as es 
import numpy as np

# --- Инициализация приложения ---
app = Flask(__name__)

# --- Тестовый роут ---
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "OK", "message": "Moodify Analysis Service is running", "features": "Basic audio features"}), 200

# --- Роут (Endpoint) для анализа ---
@app.route('/analyze', methods=['POST'])
def analyze_audio():
    # --- Валидация запроса ---
    if 'file' not in request.files:
        return jsonify({"error": "File part is missing"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # --- Сохранение и обработка файла ---
    temp_audio_path = f"/tmp/{file.filename}"
    
    try:
        file.save(temp_audio_path)

        # --- Базовый анализ аудио с помощью Essentia ---
        
        # 1. Загружаем аудиофайл
        loader = es.MonoLoader(filename=temp_audio_path)
        audio = loader()

        # 2. Базовые дескрипторы
        # BPM
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, beats_confidence, _, beats_intervals = rhythm_extractor(audio)
        
        # Тональность
        key_extractor = es.KeyExtractor()
        key, scale, key_strength = key_extractor(audio)
        
        # Танцевальность
        danceability_extractor = es.Danceability()
        danceability_result, _ = danceability_extractor(audio)
        
        # Энергия
        energy_extractor = es.Energy()
        energy = energy_extractor(audio)
        
        # RMS (громкость)
        try:
            rms = es.RMS()
            rms_value = rms(audio)
        except:
            rms_value = 0.0
        
        # --- Формируем расширенный ответ ---
        analysis_data = {
            # Ритмические параметры
            "bpm": round(float(bpm), 2),
            "beats_count": len(beats),
            "beats_confidence": round(float(np.mean(beats_confidence)), 3),
            
            # Высокоуровневые параметры
            "danceability": round(float(danceability_result), 3),
            "energy": round(float(np.mean(energy)), 5),
            "rms": round(float(rms_value), 5),
            
            # Тональные параметры
            "key": key,
            "scale": scale,
            "key_strength": round(float(key_strength), 3),
            
            # Метаданные
            "duration": len(audio) / 44100
        }

        return jsonify(analysis_data), 200

    except Exception as e:
        return jsonify({"error": f"Failed to analyze audio: {str(e)}"}), 500
    
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

# --- Точка входа для запуска сервера ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
