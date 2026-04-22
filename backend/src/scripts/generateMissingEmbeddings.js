import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import util from "util";
import axios from "axios";
import FormData from "form-data";
import { Song } from "../models/song.model.js";

const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://localhost:5002";

if (!MONGO_URL) {
  console.error(
    "❌ Ошибка: Не найдена переменная MONGODB_URI или MONGO_URI в файле .env",
  );
  process.exit(1);
}

// Функция для получения эмбеддинга через микросервис
async function getEmbedding(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error("Файл пустой после склейки ffmpeg!");
  }

  const fileBuffer = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append("file", fileBuffer, {
    filename: path.basename(filePath),
    contentType: "audio/mpeg",
    knownLength: stats.size,
  });

  const response = await axios.post(
    `${EMBEDDING_SERVICE_URL}/embed`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        "Content-Length": formData.getLengthSync(),
      },
      timeout: 0,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );

  return response.data.embedding;
}

// Функция скачивания и объединения HLS чанков
async function downloadHlsAndMerge(hlsUrl, tempPath) {
  const command = `ffmpeg -y -i "${hlsUrl}" -c:a libmp3lame -q:a 2 "${tempPath}"`;
  await execPromise(command);
}

async function runEmbeddingMigration() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Успешное подключение к MongoDB");

    // Ищем треки, у которых отсутствует вектор (null, пустой массив или нет поля)
    const songs = await Song.find({
      $or: [
        { "audioFeatures.embedding": null },
        { "audioFeatures.embedding": { $exists: false } },
        { "audioFeatures.embedding": { $size: 0 } },
      ],
    });

    console.log(`🔍 Найдено ${songs.length} треков для генерации эмбеддингов.`);

    const tempDir = path.resolve(__dirname, "../../tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let updatedCount = 0;

    for (const song of songs) {
      if (!song.hlsUrl) {
        console.warn(`⚠️ Пропуск трека ${song._id}: нет hlsUrl`);
        continue;
      }

      console.log(`\n⏳ Обработка трека: "${song.title}" (${song._id})`);
      const tempFilePath = path.join(tempDir, `embed_${song._id}.mp3`);

      try {
        console.log(`   ⬇️ Скачивание и склейка HLS чанков...`);
        await downloadHlsAndMerge(song.hlsUrl, tempFilePath);

        console.log(`   🧠 Отправка в сервис эмбеддингов...`);
        const embeddingVector = await getEmbedding(tempFilePath);

        if (!embeddingVector || embeddingVector.length === 0) {
          throw new Error("Микросервис вернул пустой вектор.");
        }

        song.audioFeatures.embedding = embeddingVector;
        await song.save();
        updatedCount++;

        console.log(
          `   ✅ Успешно! Длина вектора: ${embeddingVector.length} измерений.`,
        );
      } catch (error) {
        console.error(
          `   ❌ Ошибка обработки трека "${song.title}":`,
          error.message,
        );
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }

    console.log(
      `\n🎉 Генерация завершена. Успешно обновлено треков: ${updatedCount}`,
    );
  } catch (error) {
    console.error("❌ Глобальная ошибка скрипта:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runEmbeddingMigration();
