# --- Импорты ---
import os 
from flask import Flask, request, jsonify 
import essentia.standard as es 

# --- Инициализация приложения ---
app = Flask(__name__)

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

# --- Тестовый роут ---
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "OK", "message": "Moodify Analysis Service is running", "features": "BPM and Camelot"}), 200

# --- Роут (Endpoint) для анализа ---
@app.route('/analyze', methods=['POST'])
def analyze_audio():
    if 'file' not in request.files:
        return jsonify({"error": "File part is missing"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    temp_audio_path = f"/tmp/{file.filename}"
    
    try:
        file.save(temp_audio_path)

        # 1. Загружаем аудиофайл
        loader = es.MonoLoader(filename=temp_audio_path)
        audio = loader()

        # 2. Извлекаем только BPM
        rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
        bpm, _, _, _, _ = rhythm_extractor(audio)
        
        # 3. Извлекаем тональность и конвертируем в Camelot
        key_extractor = es.KeyExtractor()
        key, scale, _ = key_extractor(audio)
        
        camelot_key = get_camelot(key, scale)

        analysis_data = {
            "bpm": round(float(bpm), 2),
            "camelot": camelot_key
        }

        return jsonify(analysis_data), 200

    except Exception as e:
        return jsonify({"error": f"Failed to analyze audio: {str(e)}"}), 500
    
    finally:
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)