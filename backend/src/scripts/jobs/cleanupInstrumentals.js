#!/usr/bin/env node
/**
 * Delete generated instrumental stems from Bunny and clear Song.instrumentalUrl.
 *
 *   cd backend && node src/scripts/jobs/cleanupInstrumentals.js --dry-run
 *   cd backend && node src/scripts/jobs/cleanupInstrumentals.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  deleteFromBunny,
  getPathFromUrl,
} from "../../lib/media/bunny.service.js";

const dryRun = process.argv.includes("--dry-run");
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("MONGO_URI is not set");
  process.exit(1);
}

async function deleteInstrumentalMedia(url) {
  const remotePath = getPathFromUrl(url);
  if (!remotePath) {
    console.warn(`[cleanup] skip non-bunny url: ${url}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] would delete ${remotePath}`);
    return;
  }
  await deleteFromBunny(remotePath);
  const dir = remotePath.replace(/\/master\.m3u8$/, "");
  if (dir && dir !== remotePath) {
    await deleteFromBunny(dir.endsWith("/") ? dir : `${dir}/`);
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.db.collection("songs");

  const songs = await col
    .find(
      { instrumentalUrl: { $type: "string", $ne: "" } },
      { projection: { title: 1, instrumentalUrl: 1 } },
    )
    .toArray();

  console.log(`Found ${songs.length} song(s) with instrumentalUrl`);

  let ok = 0;
  for (const song of songs) {
    try {
      console.log(`- ${song.title} (${song._id})`);
      await deleteInstrumentalMedia(song.instrumentalUrl);
      if (!dryRun) {
        await col.updateOne(
          { _id: song._id },
          { $unset: { instrumentalUrl: "" } },
        );
      }
      ok += 1;
    } catch (err) {
      console.error(`  failed: ${err.message}`);
    }
  }

  console.log(
    dryRun
      ? `Dry run done (${ok}/${songs.length})`
      : `Cleared ${ok}/${songs.length} instrumentals`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
