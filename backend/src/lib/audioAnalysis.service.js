// backend/src/lib/audioAnalysis.service.js
import axios from "axios";
import FormData from "form-data";
import { createReadStream } from "fs";
import path from "path";

const analyzeAudioFeatures = async (audioFilePath) => {
  try {
    const ANALYSIS_SERVICE_URL =
      process.env.ANALYSIS_SERVICE_URL || "http://localhost:5001";

    if (!process.env.ANALYSIS_SERVICE_URL) {
      console.warn(
        `[AudioAnalysisService] ANALYSIS_SERVICE_URL не установлен в .env, используется значение по умолчанию: ${ANALYSIS_SERVICE_URL}`
      );
    } else {
      console.log(
        `[AudioAnalysisService] Используется URL из .env: ${ANALYSIS_SERVICE_URL}`
      );
    }

    const formData = new FormData();
    const fileStream = createReadStream(audioFilePath);
    formData.append("file", fileStream, {
      filename: path.basename(audioFilePath),
      contentType: "audio/mpeg",
    });

    console.log(
      `[AudioAnalysisService] Отправка файла на анализ: ${audioFilePath}`
    );

    const response = await axios.post(
      `${ANALYSIS_SERVICE_URL}/analyze`,
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 30000,
      }
    );

    console.log(
      `[AudioAnalysisService] Получены аудио-характеристики:`,
      response.data
    );

    // Возвращаем данные в нужном формате
    return {
      beatsConfidence: response.data.beats_confidence || null,
      beatsCount: response.data.beats_count || null,
      bpm: response.data.bpm || null,
      danceability: response.data.danceability || null,
      duration: response.data.duration || null,
      energy: response.data.energy || null,
      key: response.data.key || null,
      keyStrength: response.data.key_strength || null,
      rms: response.data.rms || null,
      scale: response.data.scale || null,
    };
  } catch (error) {
    console.error(
      `[AudioAnalysisService] Ошибка при анализе аудио:`,
      error.message
    );
    throw new Error(`Failed to analyze audio: ${error.message}`);
  }
};

export { analyzeAudioFeatures };
