import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import axios from "axios";
import { Song } from "../models/song.model.js";
import { Artist } from "../models/artist.model.js";
import { uploadToBunny } from "../lib/bunny.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const CANVAS_SERVICE_URL =
  process.env.CANVAS_SERVICE_URL || "http://localhost:3000";

if (!MONGO_URL) {
  console.error("❌ Ошибка: Не найдена переменная MONGODB_URI в .env");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Файл для хранения ID треков, у которых точно нет канваса (чтобы не дудосить API при перезапусках)
const SKIPPED_FILE = path.join(__dirname, "skipped_canvases.json");
let skippedIds = [];
if (fs.existsSync(SKIPPED_FILE)) {
  skippedIds = JSON.parse(fs.readFileSync(SKIPPED_FILE, "utf-8"));
}

const saveSkippedId = (id) => {
  if (!skippedIds.includes(id.toString())) {
    skippedIds.push(id.toString());
    fs.writeFileSync(SKIPPED_FILE, JSON.stringify(skippedIds, null, 2));
  }
};

// Получение токена Spotify
const getSpotifyToken = async () => {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET,
          ).toString("base64"),
      },
    },
  );
  return response.data.access_token;
};

// Поиск Spotify Track ID
const searchTrackId = async (token, title, artistName) => {
  const query = encodeURIComponent(`track:${title} artist:${artistName}`);
  try {
    const res = await axios.get(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const tracks = res.data.tracks.items;
    return tracks.length > 0 ? tracks[0].id : null;
  } catch (e) {
    if (e.response && e.response.status === 429) throw e; // Пробрасываем 429 наверх для паузы
    console.error(
      `   [Spotify Error] Ошибка поиска для "${title}":`,
      e.response?.data?.error?.message || e.message,
    );
  }
  return null;
};

// Получение Canvas URL
const getCanvasUrl = async (trackId) => {
  try {
    const res = await axios.get(
      `${CANVAS_SERVICE_URL}/api/canvas?trackId=${trackId}`,
    );
    const data = res.data;
    const canvases = data?.data?.canvasesList || data?.canvasesList;

    if (canvases && canvases.length > 0) {
      return canvases[0].canvasUrl;
    }
  } catch (e) {
    if (e.response && e.response.status === 429) throw e; // Пробрасываем 429 наверх для паузы
    if (e.response && e.response.status !== 404) {
      console.error(`   [Canvas API Error] Ошибка для ${trackId}:`, e.message);
    }
  }
  return null;
};

async function runCanvasMigration() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Успешное подключение к MongoDB");

    // Исключаем треки, у которых канваса точно нет (они в skipped_canvases.json)
    const songs = await Song.find({
      _id: { $nin: skippedIds },
      $or: [{ canvasUrl: null }, { canvasUrl: { $exists: false } }],
    }).populate("artist");

    console.log(`🔍 Найдено ${songs.length} необработанных треков.`);

    if (songs.length === 0) {
      console.log("Все треки уже обработаны!");
      return;
    }

    let spotifyToken = await getSpotifyToken();
    let updatedCount = 0;
    let skippedCount = 0;

    // Используем обычный цикл for, чтобы можно было манипулировать индексом 'i'
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const primaryArtistName = song.artist[0]?.name || "";

      console.log(
        `\n⏳ [${i + 1}/${songs.length}] "${song.title}" - ${primaryArtistName}`,
      );

      try {
        // 1. Ищем ID
        const trackId = await searchTrackId(
          spotifyToken,
          song.title,
          primaryArtistName,
        );
        if (!trackId) {
          console.log(`   ⏭️ Spotify ID не найден. Пропускаем навсегда.`);
          saveSkippedId(song._id);
          skippedCount++;
          await sleep(300);
          continue;
        }

        console.log(`   🔎 ID: ${trackId}. Поиск Canvas...`);
        // 2. Ищем Canvas
        const canvasSpotifyUrl = await getCanvasUrl(trackId);

        if (!canvasSpotifyUrl) {
          console.log(`   ⏭️ Canvas не найден. Пропускаем навсегда.`);
          saveSkippedId(song._id);
          skippedCount++;
          await sleep(300);
          continue;
        }

        console.log(`   ⬇️ Canvas загружается в CDN...`);
        // 3. Загружаем
        const uploadResult = await uploadToBunny(
          canvasSpotifyUrl,
          "songs/canvas",
        );

        // 4. Сохраняем
        song.canvasUrl = uploadResult.url;
        song.canvasPublicId = uploadResult.path;
        await song.save();

        updatedCount++;
        console.log(`   ✅ Успешно! URL: ${uploadResult.url}`);
      } catch (error) {
        if (error.response && error.response.status === 401) {
          console.log(`   🔄 Токен Spotify истек. Обновляем...`);
          spotifyToken = await getSpotifyToken();
          i--; // Откатываем цикл на 1 шаг назад, чтобы повторить этот же трек!
        } else if (error.response && error.response.status === 429) {
          // Spotify часто отдает заголовок 'retry-after' в секундах
          const retryAfter = error.response.headers["retry-after"] || 30;
          console.log(`   ⚠️ [RATE LIMIT 429] Ждем ${retryAfter} секунд...`);
          await sleep(retryAfter * 1000);
          i--; // Откатываем цикл на 1 шаг назад, чтобы повторить этот же трек!
        } else {
          console.error(`   ❌ Ошибка:`, error.message);
        }
      }

      // Дефолтная пауза между успешными треками
      await sleep(1000);
    }

    console.log(`\n🎉 Миграция завершена!`);
    console.log(`✅ Загружено видео: ${updatedCount}`);
    console.log(`⏭️ Отсеяно (без видео): ${skippedCount}`);
  } catch (error) {
    console.error("❌ Глобальная ошибка:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runCanvasMigration();
