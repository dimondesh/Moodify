#!/usr/bin/env node
/**
 * One-time migration: LIKED_SONGS playlists -> LikedSong collection.
 * Run: cd backend && npm run migrate:liked-songs
 */
import "dotenv/config";
import mongoose from "mongoose";
import { LikedSong } from "../models/likedSong.model.js";

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const playlistsCol = mongoose.connection.collection("playlists");
  const legacyPlaylists = await playlistsCol
    .find({ type: "LIKED_SONGS" })
    .toArray();

  console.log(`Found ${legacyPlaylists.length} legacy LIKED_SONGS playlist(s).`);

  const batch = [];

  for (const playlist of legacyPlaylists) {
    const userId = playlist.owner;
    if (!userId) continue;

    const ts =
      typeof playlist.songLikeTimestamps === "object" &&
      playlist.songLikeTimestamps !== null
        ? playlist.songLikeTimestamps
        : {};
    const fallback = playlist.createdAt || playlist.updatedAt || new Date();
    const songs = playlist.songs || [];

    for (const songId of songs) {
      if (!songId) continue;
      const sid = songId.toString();
      const rawLikedAt = ts[sid];
      const likedAt = rawLikedAt ? new Date(rawLikedAt) : new Date(fallback);

      batch.push({
        user: new mongoose.Types.ObjectId(userId),
        song: new mongoose.Types.ObjectId(sid),
        likedAt,
      });
    }
  }

  console.log(`Prepared ${batch.length} LikedSong document(s) for insert.`);

  let inserted = 0;
  let duplicateErrors = 0;

  if (batch.length > 0) {
    try {
      const result = await LikedSong.insertMany(batch, { ordered: false });
      inserted = result.length;
    } catch (err) {
      if (err?.name === "MongoBulkWriteError" || err?.code === 11000) {
        inserted = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
        const writeErrors = err.writeErrors ?? err.result?.writeErrors ?? [];
        duplicateErrors = writeErrors.length;
        console.log(
          `insertMany partial: inserted=${inserted}, duplicates/skipped=${duplicateErrors}`,
        );
      } else {
        throw err;
      }
    }
  }

  const deleteResult = await playlistsCol.deleteMany({ type: "LIKED_SONGS" });

  console.log(
    `Done. inserted≈${inserted}, duplicate write errors=${duplicateErrors}, deleted playlists=${deleteResult.deletedCount}`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
