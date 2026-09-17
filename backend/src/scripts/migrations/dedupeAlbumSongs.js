#!/usr/bin/env node
/**
 * Remove duplicate songs that share the same albumId + discNumber + trackNumber,
 * keeping the oldest document (by createdAt, then _id).
 *
 * Also drops the old non-unique compound index (if present) and ensures the
 * unique partial index exists.
 *
 * Run:
 *   cd backend && npm run migrate:dedupe-album-songs -- --dry-run
 *   cd backend && npm run migrate:dedupe-album-songs
 *   cd backend && npm run migrate:dedupe-album-songs -- --skip-cdn
 */
import "dotenv/config";
import mongoose from "mongoose";
import {
  deleteFromBunny,
  getPathFromUrl,
} from "../../lib/media/bunny.service.js";

const dryRun = process.argv.includes("--dry-run");
const skipCdn = process.argv.includes("--skip-cdn");
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

const UNIQUE_INDEX_NAME = "albumId_1_discNumber_1_trackNumber_1";

const maskMongoUri = (uri) =>
  String(uri).replace(/\/\/([^@/]+)@/, "//***@");

async function deleteSongMedia(song, albumImagePublicId) {
  if (skipCdn) return;
  if (song.hlsUrl) {
    const hlsPath = getPathFromUrl(song.hlsUrl);
    if (hlsPath) {
      await deleteFromBunny(hlsPath);
      const hlsDir = hlsPath.replace("/master.m3u8", "");
      await deleteFromBunny(hlsDir + "/");
    }
  }
  // Covers are usually shared with the album — leave album art alone.
  void albumImagePublicId;
}

async function detachSongRefs(db, songId) {
  await Promise.all([
    db.collection("likedsongs").deleteMany({ song: songId }),
    db.collection("listenhistories").deleteMany({ song: songId }),
    db.collection("playlists").updateMany(
      { songs: songId },
      { $pull: { songs: songId } },
    ),
    db.collection("recentactivities").updateMany(
      { songIds: songId },
      { $pull: { songIds: songId } },
    ),
    db.collection("homefeeds").updateMany(
      { "quickPicks.songIds": songId },
      { $pull: { "quickPicks.songIds": songId } },
    ),
  ]);
}

async function findDuplicateGroups(songsCol) {
  return songsCol
    .aggregate([
      {
        $match: {
          albumId: { $ne: null },
          discNumber: { $type: "number" },
          trackNumber: { $type: "number" },
        },
      },
      {
        $group: {
          _id: {
            albumId: "$albumId",
            discNumber: "$discNumber",
            trackNumber: "$trackNumber",
          },
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: "$_id",
              createdAt: "$createdAt",
              title: "$title",
              hlsUrl: "$hlsUrl",
              imagePublicId: "$imagePublicId",
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
}

async function ensureUniqueIndex(songsCol) {
  const existing = await songsCol.indexes();
  const current = existing.find((idx) => idx.name === UNIQUE_INDEX_NAME);
  if (current?.unique) {
    console.log(`Index ${UNIQUE_INDEX_NAME} already unique.`);
    return;
  }
  if (current && !current.unique) {
    console.log(`Dropping non-unique ${UNIQUE_INDEX_NAME}...`);
    if (!dryRun) await songsCol.dropIndex(UNIQUE_INDEX_NAME);
  }
  console.log(`Creating unique partial ${UNIQUE_INDEX_NAME}...`);
  if (!dryRun) {
    await songsCol.createIndex(
      { albumId: 1, discNumber: 1, trackNumber: 1 },
      {
        name: UNIQUE_INDEX_NAME,
        unique: true,
        partialFilterExpression: {
          albumId: { $type: "objectId" },
          discNumber: { $type: "number" },
          trackNumber: { $type: "number" },
        },
      },
    );
  }
}

async function main() {
  if (!MONGO_URI) {
    console.error("MONGODB_URI or MONGO_URI is required.");
    process.exit(1);
  }

  console.log(
    `Connecting to MongoDB (${maskMongoUri(MONGO_URI)})${dryRun ? " [dry-run]" : ""}...`,
  );
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const songsCol = db.collection("songs");
  const albumsCol = db.collection("albums");

  const groups = await findDuplicateGroups(songsCol);
  console.log(`Found ${groups.length} duplicate disc/track slot(s).`);

  let deleted = 0;
  let kept = 0;

  for (const group of groups) {
    const sorted = [...group.docs].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a._id).localeCompare(String(b._id));
    });
    const keep = sorted[0];
    const drop = sorted.slice(1);
    kept += 1;

    const album = await albumsCol.findOne(
      { _id: group._id.albumId },
      { projection: { title: 1, imagePublicId: 1 } },
    );

    console.log(
      `  ${album?.title || group._id.albumId} d${group._id.discNumber}t${group._id.trackNumber} "${keep.title}": keep ${keep._id} (${keep.createdAt}), drop ${drop.length}`,
    );

    for (const song of drop) {
      if (!dryRun) {
        await deleteSongMedia(song, album?.imagePublicId);
        await detachSongRefs(db, song._id);
        await songsCol.deleteOne({ _id: song._id });
      }
      deleted += 1;
    }
  }

  console.log(
    `${dryRun ? "Would delete" : "Deleted"} ${deleted} duplicate song(s); kept ${kept} older version(s).`,
  );

  const remaining = await findDuplicateGroups(songsCol);
  if (remaining.length > 0 && !dryRun) {
    console.error(
      `Still ${remaining.length} duplicate group(s) after cleanup — aborting index create.`,
    );
    process.exit(1);
  }
  if (!dryRun && remaining.length === 0) {
    console.log("No duplicate slots remain.");
  }

  await ensureUniqueIndex(songsCol);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
