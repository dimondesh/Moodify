#!/usr/bin/env node
/**
 * Rebuilds GENRE_MIX / MOOD_MIX playlist titles from Genre/Mood category names (+ Mix suffix).
 *
 *   cd backend && npm run migrate:locales
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";
import { Playlist } from "../../models/playlist.model.js";
import {
  buildPersonalMixLabels,
  getSmartPlaylistLabels,
  buildMixPlaylistLabels,
} from "../../lib/playlists/labels.js";
import { removePlaylistSearchableNames } from "../../lib/playlists/playlistLocaleCleanup.service.js";
import { GENERATED_PLAYLIST_TYPES } from "../../constants/playlistTypes.js";

const backfillMixPlaylistLocalizedNames = async () => {
  const [genres, moods] = await Promise.all([
    Genre.find().select("name localizedNames").lean(),
    Mood.find().select("name localizedNames").lean(),
  ]);
  const bySourceId = new Map();
  for (const doc of [...genres, ...moods]) {
    bySourceId.set(doc._id.toString(), doc);
  }

  const mixes = await Playlist.find({
    type: { $in: ["GENRE_MIX", "MOOD_MIX"] },
    sourceId: { $ne: null },
  }).select("sourceId");

  let updated = 0;
  for (const mix of mixes) {
    const source = bySourceId.get(mix.sourceId.toString());
    if (!source) continue;

    const { title, localizedNames } = buildMixPlaylistLabels(source);
    await Playlist.updateOne(
      { _id: mix._id },
      {
        $set: { localizedNames, title },
      },
    );
    updated += 1;
  }

  return { playlists: mixes.length, updated };
};

const backfillSmartPlaylistLocalizedNames = async () => {
  const types = ["ON_REPEAT", "DISCOVER_WEEKLY", "ON_REPEAT_REWIND"];
  let updated = 0;

  for (const type of types) {
    const { title, localizedNames } = getSmartPlaylistLabels(type);
    const result = await Playlist.updateMany(
      { type },
      { $set: { localizedNames, title } },
    );
    updated += result.modifiedCount;
  }

  return { types: types.length, updated };
};

const backfillPersonalMixLocalizedNames = async () => {
  const userIds = await Playlist.distinct("madeFor", {
    type: "PERSONAL_MIX",
    madeFor: { $ne: null },
  });

  let updated = 0;
  for (const userId of userIds) {
    const mixes = await Playlist.find({
      type: "PERSONAL_MIX",
      madeFor: userId,
    })
      .sort({ lastGeneratedAt: 1, _id: 1 })
      .select("_id");

    for (let index = 0; index < mixes.length; index += 1) {
      const { title, localizedNames } = buildPersonalMixLabels(index + 1);
      await Playlist.updateOne(
        { _id: mixes[index]._id },
        { $set: { localizedNames, title } },
      );
      updated += 1;
    }
  }

  return { users: userIds.length, updated };
};

const clearGeneratedPlaylistDescriptions = async () => {
  const result = await Playlist.updateMany(
    { type: { $in: GENERATED_PLAYLIST_TYPES } },
    { $set: { description: "" } },
  );
  return { modified: result.modifiedCount };
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const removedSearchable = await removePlaylistSearchableNames();
  console.log(
    `Removed searchableNames from ${removedSearchable.modified}/${removedSearchable.matched} playlist(s)`,
  );

  const playlistResult = await backfillMixPlaylistLocalizedNames();
  console.log("Genre/mood mixes:", playlistResult);

  const smartResult = await backfillSmartPlaylistLocalizedNames();
  console.log("Smart playlists:", smartResult);

  const personalResult = await backfillPersonalMixLocalizedNames();
  console.log("Personal mixes:", personalResult);

  const clearedDescriptions = await clearGeneratedPlaylistDescriptions();
  console.log("Cleared descriptions:", clearedDescriptions);

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
