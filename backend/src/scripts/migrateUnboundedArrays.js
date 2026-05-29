#!/usr/bin/env node
/**
 * One-time migration: backfill Song.trackNumber from Album.songs order,
 * then remove legacy unbounded arrays from Album and Artist documents.
 * Run: cd backend && npm run migrate:unbounded-arrays
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function maskMongoUri(uri) {
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    return `${uri.split("://")[0]}://${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "(invalid URI)";
  }
}

async function backfillTrackNumbers() {
  const albumsCol = mongoose.connection.collection("albums");
  const songsCol = mongoose.connection.collection("songs");

  console.log("Scanning albums with legacy songs[] arrays...");
  const albumsWithSongs = await albumsCol
    .find({ songs: { $exists: true, $ne: [] } })
    .project({ _id: 1, songs: 1 })
    .toArray();

  let albumsProcessed = 0;
  let songsBackfilled = 0;

  for (const album of albumsWithSongs) {
    albumsProcessed += 1;
    const songIds = album.songs || [];

    for (let index = 0; index < songIds.length; index += 1) {
      const songId = songIds[index];
      const result = await songsCol.updateOne(
        {
          _id: songId,
          $or: [{ trackNumber: null }, { trackNumber: { $exists: false } }],
        },
        { $set: { trackNumber: index + 1 } },
      );
      songsBackfilled += result.modifiedCount;
    }
  }

  console.log(
    `Backfilled trackNumber on ${songsBackfilled} song(s) across ${albumsProcessed} album(s) (from legacy album.songs[]).`,
  );
}

async function backfillRemainingTrackNumbers() {
  const songsCol = mongoose.connection.collection("songs");

  console.log(
    "Backfilling trackNumber for songs linked via albumId but missing trackNumber...",
  );

  const albumIds = await songsCol.distinct("albumId", {
    albumId: { $ne: null },
    $or: [{ trackNumber: null }, { trackNumber: { $exists: false } }],
  });

  let albumsProcessed = 0;
  let songsBackfilled = 0;

  for (const albumId of albumIds) {
    const [maxTrackDoc] = await songsCol
      .find({ albumId, trackNumber: { $ne: null, $exists: true } })
      .sort({ trackNumber: -1 })
      .limit(1)
      .project({ trackNumber: 1 })
      .toArray();

    let nextTrackNumber = maxTrackDoc?.trackNumber ?? 0;

    const songsWithoutTrackNumber = await songsCol
      .find({
        albumId,
        $or: [{ trackNumber: null }, { trackNumber: { $exists: false } }],
      })
      .sort({ createdAt: 1, _id: 1 })
      .project({ _id: 1 })
      .toArray();

    if (!songsWithoutTrackNumber.length) continue;

    albumsProcessed += 1;

    for (const song of songsWithoutTrackNumber) {
      nextTrackNumber += 1;
      const result = await songsCol.updateOne(
        { _id: song._id },
        { $set: { trackNumber: nextTrackNumber } },
      );
      songsBackfilled += result.modifiedCount;
    }
  }

  const totalSongs = await songsCol.countDocuments();
  const withAlbum = await songsCol.countDocuments({ albumId: { $ne: null } });
  const withoutAlbum = totalSongs - withAlbum;
  const withTrackNumber = await songsCol.countDocuments({
    trackNumber: { $ne: null, $exists: true },
  });
  const missingTrackNumber = await songsCol.countDocuments({
    albumId: { $ne: null },
    $or: [{ trackNumber: null }, { trackNumber: { $exists: false } }],
  });

  console.log(
    `Backfilled trackNumber on ${songsBackfilled} additional song(s) across ${albumsProcessed} album(s) (from albumId + createdAt).`,
  );
  console.log(
    `Song stats: total=${totalSongs}, withAlbum=${withAlbum}, withoutAlbum=${withoutAlbum}, withTrackNumber=${withTrackNumber}, stillMissingTrackNumber=${missingTrackNumber}.`,
  );
}

async function unsetLegacyArrays() {
  const albumsCol = mongoose.connection.collection("albums");
  const artistsCol = mongoose.connection.collection("artists");

  console.log("Removing legacy songs[] from albums and songs[]/albums[] from artists...");

  const albumsResult = await albumsCol.updateMany(
    { songs: { $exists: true } },
    { $unset: { songs: "" } },
  );
  const artistsResult = await artistsCol.updateMany(
    {
      $or: [{ songs: { $exists: true } }, { albums: { $exists: true } }],
    },
    { $unset: { songs: "", albums: "" } },
  );

  console.log(
    `Unset songs on ${albumsResult.modifiedCount} album document(s).`,
  );
  console.log(
    `Unset songs/albums on ${artistsResult.modifiedCount} artist document(s).`,
  );
}

async function main() {
  if (!MONGO_URI) {
    console.error(
      "MONGODB_URI or MONGO_URI is required (expected in backend/.env).",
    );
    process.exit(1);
  }

  console.log(`Connecting to MongoDB (${maskMongoUri(MONGO_URI)})...`);

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  });

  console.log(`Connected to database: ${mongoose.connection.name}`);

  await backfillTrackNumbers();
  await backfillRemainingTrackNumbers();
  await unsetLegacyArrays();

  await mongoose.disconnect();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
