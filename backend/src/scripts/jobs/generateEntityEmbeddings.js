import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { Playlist } from "../../models/playlist.model.js";
import {
  computeAlbumEmbedding,
  computeArtistEmbedding,
  computePlaylistEmbedding,
} from "../../lib/recommendations/recommendation.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const BATCH_SIZE = 100;

if (!MONGO_URL) {
  console.error(
    "❌ Не найдена переменная MONGODB_URI или MONGO_URI в файле .env",
  );
  process.exit(1);
}

async function processCollection(Model, computeFn, label) {
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  const cursor = Model.find({}).select("_id").cursor({ batchSize: BATCH_SIZE });

  for await (const doc of cursor) {
    processed += 1;
    const embedding = await computeFn(doc._id);
    await Model.updateOne({ _id: doc._id }, { $set: { embedding } });

    if (embedding) {
      updated += 1;
    } else {
      skipped += 1;
    }

    if (processed % BATCH_SIZE === 0) {
      console.log(`   ${label}: обработано ${processed}...`);
    }
  }

  console.log(
    `✅ ${label}: processed=${processed}, updated=${updated}, skipped=${skipped}`,
  );
}

async function run() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Подключение к MongoDB");

    console.log("\n📀 Альбомы...");
    await processCollection(Album, computeAlbumEmbedding, "Albums");

    console.log("\n🎵 Плейлисты...");
    await processCollection(Playlist, computePlaylistEmbedding, "Playlists");

    console.log("\n🎤 Артисты...");
    await processCollection(Artist, computeArtistEmbedding, "Artists");

    console.log("\n🎉 Пересчёт эмбеддингов сущностей завершён.");
  } catch (error) {
    console.error("❌ Ошибка скрипта:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

run();
