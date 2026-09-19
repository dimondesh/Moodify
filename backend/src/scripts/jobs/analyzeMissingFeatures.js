import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";
import axios from "axios";
import FormData from "form-data";

import { Song } from "../../models/song.model.js";

const execPromise = util.promisify(exec);

// Настройка путей для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Указываем явный путь к .env файлу
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const ANALYSIS_SERVICE_URL =
  process.env.ANALYSIS_SERVICE_URL || "http://127.0.0.1:5001";
if (!MONGO_URL) {
  console.error("MONGODB_URI or MONGO_URI is required");
  process.exit(1);
}

// Функция для анализа аудио через микросервис
async function analyzeAudio(filePath) {
  // 1. Проверяем, что ffmpeg нормально создал файл
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error("Файл пустой после склейки ffmpeg!");
  }

  // 2. Читаем файл целиком в память.
  // Это гарантирует, что Flask получит весь файл сразу, а не чанками.
  const fileBuffer = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append("file", fileBuffer, {
    filename: path.basename(filePath),
    contentType: "audio/mpeg",
    knownLength: stats.size,
  });

  // 3. Отправляем запрос
  const response = await axios.post(
    `${ANALYSIS_SERVICE_URL}/analyze`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        // Вычисляем точный размер всего Multipart-запроса
        "Content-Length": formData.getLengthSync(),
      },
      timeout: 0, // 0 означает бесконечное ожидание (анализ может идти долго)
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );

  return response.data;
}

async function downloadHlsAndMerge(hlsUrl, tempPath) {
  const command = `ffmpeg -y -i "${hlsUrl}" -c:a libmp3lame -q:a 2 "${tempPath}"`;
  await execPromise(command);
}

async function runAnalysisMigration() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("[analyze] Connected to MongoDB");

    // Ищем треки, у которых отсутствуют нужные аудио-фичи
    const songs = await Song.find({
      $or: [
        { "audioFeatures.bpm": null },
        { "audioFeatures.camelot": null },
        { audioFeatures: { $exists: false } },
      ],
    });

    console.log(`[analyze] ${songs.length} tracks to process`);

    // Создаем папку tmp если ее нет
    const tempDir = path.resolve(__dirname, "../../tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let updatedCount = 0;

    for (const song of songs) {
      if (!song.hlsUrl) {
        console.warn(`[analyze] Skip ${song._id}: no hlsUrl`);
        continue;
      }

      console.log(`[analyze] ${song.title} (${song._id})`);
      const tempFilePath = path.join(tempDir, `${song._id}.mp3`);

      try {
        // 1. Скачиваем HLS поток и склеиваем в один файл
        console.log("[analyze] Downloading HLS...");
        await downloadHlsAndMerge(song.hlsUrl, tempFilePath);

        // 2. Отправляем в Python-анализатор
        console.log("[analyze] Sending to analyzer...");
        const features = await analyzeAudio(tempFilePath);

        // 3. Обновляем документ в БД
        if (!song.audioFeatures) {
          song.audioFeatures = {};
        }

        song.audioFeatures.bpm = features.bpm;
        song.audioFeatures.camelot = features.camelot;
        song.audioFeatures.beats = features.beats || [];

        await song.save();
        updatedCount++;

        console.log(
          `[analyze] OK: BPM ${features.bpm}, Camelot ${features.camelot}`,
        );
      } catch (error) {
        console.error(
          `[analyze] Failed ${song.title}:`,
          error.message,
        );
      } finally {
        // 4. Обязательно удаляем временный файл для экономии места
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    console.log(`[analyze] Done. Updated ${updatedCount}`);
  } catch (error) {
    console.error("[analyze] Fatal:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runAnalysisMigration();
