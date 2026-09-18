#!/usr/bin/env node
/**
 * Fetch missing synced LRC lyrics from lrclib.net.
 *
 * Run:
 *   cd backend && npm run backfill:song-lyrics
 *   cd backend && npm run backfill:song-lyrics -- --dry-run
 *   cd backend && npm run backfill:song-lyrics -- --force
 *   cd backend && npm run backfill:song-lyrics -- --limit=50
 *
 * Default: only songs with empty/missing lyrics.
 * --force: also re-fetch songs that already have lyrics.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Song } from "../../models/song.model.js";
import { Artist } from "../../models/artist.model.js"; // populate
import { Album } from "../../models/album.model.js"; // populate
import { getLrcLyricsFromLrclib } from "../../lib/integrations/lyricsService.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null;

const missingLyricsQuery = {
  $or: [{ lyrics: null }, { lyrics: "" }, { lyrics: { $exists: false } }],
};

async function main() {
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    console.error("MONGO_URI or MONGODB_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const query = force ? {} : missingLyricsQuery;
  let cursor = Song.find(query)
    .select("_id title duration lyrics artist albumId")
    .populate("artist", "name")
    .populate("albumId", "title")
    .lean();

  if (limit && Number.isFinite(limit) && limit > 0) {
    cursor = cursor.limit(limit);
  }

  const songs = await cursor;
  console.log(
    `[backfill:song-lyrics] ${songs.length} song(s) to check` +
      `${dryRun ? " (dry-run)" : ""}` +
      `${force ? " (--force)" : ""}`,
  );

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let failed = 0;

  for (const song of songs) {
    const label = `"${song.title}" (${song._id})`;
    const artistName = song.artist?.[0]?.name;
    const albumName = song.albumId?.title || undefined;

    if (!artistName) {
      skipped++;
      console.warn(`[skip] ${label}: no primary artist`);
      continue;
    }

    try {
      const lyrics = await getLrcLyricsFromLrclib({
        artistName,
        songName: song.title,
        albumName,
        songDuration: song.duration,
      });

      if (!lyrics) {
        notFound++;
        console.log(`[miss] ${label}: no synced LRC`);
        await sleep(250);
        continue;
      }

      console.log(
        `[update] ${label}: ${lyrics.split("\n").length} LRC lines` +
          (dryRun ? " (dry-run)" : ""),
      );

      if (!dryRun) {
        await Song.updateOne({ _id: song._id }, { $set: { lyrics } });
      }
      updated++;
    } catch (error) {
      failed++;
      console.error(`[error] ${label}:`, error.message);
    }

    await sleep(250);
  }

  console.log(
    `[backfill:song-lyrics] done: updated=${updated}, notFound=${notFound}, skipped=${skipped}, failed=${failed}`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("[backfill:song-lyrics] fatal:", error);
  process.exit(1);
});
