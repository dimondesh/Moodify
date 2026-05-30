#!/usr/bin/env node
/**
 * Copies Genre/Mood.localizedNames → GENRE_MIX / MOOD_MIX playlists.
 *
 *   cd backend && npm run migrate:locales
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Playlist } from "../models/playlist.model.js";

const backfillMixPlaylistLocalizedNames = async () => {
  const sources = await Promise.all([
    Genre.find().select("localizedNames").lean(),
    Mood.find().select("localizedNames").lean(),
  ]);
  const bySourceId = new Map();
  for (const doc of [...sources[0], ...sources[1]]) {
    if (doc.localizedNames) {
      bySourceId.set(doc._id.toString(), doc.localizedNames);
    }
  }

  const mixes = await Playlist.find({
    type: { $in: ["GENRE_MIX", "MOOD_MIX"] },
    sourceId: { $ne: null },
  }).select("sourceId");

  let updated = 0;
  for (const mix of mixes) {
    const localizedNames = bySourceId.get(mix.sourceId.toString());
    if (!localizedNames) continue;
    await Playlist.updateOne(
      { _id: mix._id },
      {
        $set: { localizedNames },
        $unset: { searchableNames: "" },
      },
    );
    updated += 1;
  }

  return { playlists: mixes.length, updated };
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const removedSearchable = await Playlist.updateMany(
    { searchableNames: { $exists: true } },
    { $unset: { searchableNames: "" } },
  );
  console.log(
    `Removed searchableNames from ${removedSearchable.modifiedCount} playlist(s)`,
  );

  const playlistResult = await backfillMixPlaylistLocalizedNames();
  console.log("Mix playlists:", playlistResult);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
