import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { Song } from "../models/song.model.js";
import { analyzeAudioFeatures } from "../lib/audioAnalysis.service.js";
import { downloadHlsAudio } from "../lib/hlsDownload.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URL) {
  console.error(
    "❌ Ошибка: Не найдена переменная MONGODB_URI или MONGO_URI в файле .env",
  );
  process.exit(1);
}

async function runJamendoTagsMigration() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Успешное подключение к MongoDB");

    const songs = await Song.find({
      $or: [
        { "audioFeatures.predictedGenres": null },
        { "audioFeatures.predictedGenres": { $exists: false } },
        { "audioFeatures.predictedGenres": { $size: 0 } },
        { "audioFeatures.predictedMoods": null },
        { "audioFeatures.predictedMoods": { $exists: false } },
        { "audioFeatures.predictedMoods": { $size: 0 } },
      ],
    });

    console.log(
      `🔍 Найдено ${songs.length} треков без predictedGenres/predictedMoods для обработки.`,
    );

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
      const tempFilePath = path.join(tempDir, `jamendo_${song._id}.mp3`);

      try {
        console.log(`   ⬇️ Скачивание и склейка HLS чанков...`);
        await downloadHlsAudio(song.hlsUrl, tempFilePath, song.duration ?? 0);

        console.log(`   🧠 Анализ аудио (embedding + Jamendo теги)...`);
        const features = await analyzeAudioFeatures(tempFilePath);

        if (!features.embedding || features.embedding.length === 0) {
          throw new Error("Сервис вернул пустой embedding.");
        }

        if (!song.audioFeatures) {
          song.audioFeatures = {};
        }

        song.audioFeatures.embedding = features.embedding;
        song.audioFeatures.predictedGenres = features.predictedGenres || [];
        song.audioFeatures.predictedMoods = features.predictedMoods || [];

        await song.save();
        updatedCount++;

        const genresStr =
          features.predictedGenres.length > 0
            ? features.predictedGenres.join(", ")
            : "(нет)";
        const moodsStr =
          features.predictedMoods.length > 0
            ? features.predictedMoods.join(", ")
            : "(нет)";

        console.log(`   🎵 "${song.title}"`);
        console.log(`   📀 Жанры: ${genresStr}`);
        console.log(`   💫 Настроения: ${moodsStr}`);
        console.log(
          `   ✅ Сохранено. Embedding: ${features.embedding.length} измерений.`,
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
      `\n🎉 Миграция завершена. Успешно обновлено треков: ${updatedCount}`,
    );
  } catch (error) {
    console.error("❌ Глобальная ошибка скрипта:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runJamendoTagsMigration();
