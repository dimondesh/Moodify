#!/usr/bin/env node
/**
 * Re-probe HLS URLs and store accurate duration (2 decimal places).
 *
 * Run:
 *   cd backend && npm run backfill:song-duration
 *   cd backend && npm run backfill:song-duration -- --dry-run
 *   cd backend && npm run backfill:song-duration -- --force
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Song } from "../../models/song.model.js";
import { probeMediaDuration } from "../../lib/media/ffmpeg.service.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null;

async function main() {
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    console.error("MONGO_URI or MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const query = { hlsUrl: { $exists: true, $nin: [null, ""] } };
  let cursor = Song.find(query).select("_id title duration hlsUrl").lean();

  if (limit && Number.isFinite(limit) && limit > 0) {
    cursor = cursor.limit(limit);
  }

  const songs = await cursor;
  console.log(
    `[backfill:song-duration] ${songs.length} song(s) to check` +
      `${dryRun ? " (dry-run)" : ""}` +
      `${force ? " (--force)" : ""}`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `"${song.title}" (${song._id})`;

    try {
      const probed = await probeMediaDuration(song.hlsUrl);
      if (!probed) {
        failed++;
        console.warn(`[skip] ${label}: could not probe duration`);
        await sleep(100);
        continue;
      }

      if (!force && Math.abs(song.duration - probed) <= 0.005) {
        skipped++;
        console.log(`[ok] ${label}: ${song.duration}s (unchanged)`);
        await sleep(50);
        continue;
      }

      console.log(
        `[update] ${label}: ${song.duration}s → ${probed}s` +
          (dryRun ? " (dry-run)" : ""),
      );

      if (!dryRun) {
        await Song.updateOne({ _id: song._id }, { $set: { duration: probed } });
      }
      updated++;
    } catch (error) {
      failed++;
      console.error(`[error] ${label}:`, error.message);
    }

    await sleep(120);
  }

  console.log(
    `[backfill:song-duration] done: updated=${updated}, skipped=${skipped}, failed=${failed}`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[backfill:song-duration] fatal:", error);
  process.exit(1);
});
