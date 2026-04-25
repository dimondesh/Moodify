import axios from "axios";
import FormData from "form-data";
import { createReadStream } from "fs";
import path from "path";

const analyzeAudioFeatures = async (audioFilePath) => {
  try {
    const ANALYSIS_SERVICE_URL =
      process.env.ANALYSIS_SERVICE_URL || "http://localhost:5001";
    const EMBEDDING_SERVICE_URL =
      process.env.EMBEDDING_SERVICE_URL || "http://localhost:5006";

    const formDataForAnalysis = new FormData();
    formDataForAnalysis.append("file", createReadStream(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: "audio/mpeg",
    });

    const formDataForEmbed = new FormData();
    formDataForEmbed.append("file", createReadStream(audioFilePath), {
      filename: path.basename(audioFilePath),
      contentType: "audio/mpeg",
    });

    // Запускаем оба запроса параллельно
    const [analysisResponse, embedResponse] = await Promise.allSettled([
      axios.post(`${ANALYSIS_SERVICE_URL}/analyze`, formDataForAnalysis, {
        headers: { ...formDataForAnalysis.getHeaders() },
        timeout: 30000,
      }),
      axios.post(`${EMBEDDING_SERVICE_URL}/embed`, formDataForEmbed, {
        headers: { ...formDataForEmbed.getHeaders() },
        timeout: 30000,
      }),
    ]);

    let result = { bpm: null, camelot: null, beats: [], embedding: null };

    if (analysisResponse.status === "fulfilled") {
      result.bpm = analysisResponse.value.data.bpm || null;
      result.camelot = analysisResponse.value.data.camelot || null;
      result.beats = analysisResponse.value.data.beats || [];
    } else {
      console.error(
        "[AudioAnalysisService] Ошибка анализа BPM:",
        analysisResponse.reason.message,
      );
    }

    if (embedResponse.status === "fulfilled") {
      result.embedding = embedResponse.value.data.embedding || null;
    } else {
      console.error(
        "[AudioAnalysisService] Ошибка получения эмбеддинга:",
        embedResponse.reason.message,
      );
    }

    return result;
  } catch (error) {
    console.error(`[AudioAnalysisService] Критическая ошибка:`, error.message);
    throw new Error(`Failed to analyze audio: ${error.message}`);
  }
};

export { analyzeAudioFeatures };
