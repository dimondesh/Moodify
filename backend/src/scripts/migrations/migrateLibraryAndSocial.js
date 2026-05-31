#!/usr/bin/env node
/**
 * One-time migration: libraries + User social arrays -> join collections.
 * Run: cd backend && npm run migrate:library-social
 * Optional: --drop-legacy to drop libraries collection and $unset User array fields.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { SavedAlbum } from "../../models/savedAlbum.model.js";
import { SavedPlaylist } from "../../models/savedPlaylist.model.js";
import { FollowedArtist } from "../../models/followedArtist.model.js";
import { FollowedUser } from "../../models/followedUser.model.js";

const dropLegacy = process.argv.includes("--drop-legacy");

async function insertManyIgnoreDuplicates(Model, batch, label) {
  if (!batch.length) {
    console.log(`${label}: nothing to insert.`);
    return { inserted: 0, duplicateErrors: 0 };
  }

  try {
    const result = await Model.insertMany(batch, { ordered: false });
    console.log(`${label}: inserted ${result.length}.`);
    return { inserted: result.length, duplicateErrors: 0 };
  } catch (err) {
    if (err?.name === "MongoBulkWriteError" || err?.code === 11000) {
      const inserted = err.insertedDocs?.length ?? err.result?.nInserted ?? 0;
      const writeErrors = err.writeErrors ?? err.result?.writeErrors ?? [];
      console.log(
        `${label}: partial insert inserted=${inserted}, duplicates/skipped=${writeErrors.length}`,
      );
      return { inserted, duplicateErrors: writeErrors.length };
    }
    throw err;
  }
}

async function migrateLibraries() {
  const librariesCol = mongoose.connection.collection("libraries");
  const libraries = await librariesCol.find({}).toArray();

  console.log(`Found ${libraries.length} library document(s).`);

  const albums = [];
  const playlists = [];
  const artists = [];

  for (const library of libraries) {
    const userId = library.userId;
    if (!userId) continue;

    for (const entry of library.albums || []) {
      if (!entry?.albumId) continue;
      albums.push({
        user: new mongoose.Types.ObjectId(userId),
        album: new mongoose.Types.ObjectId(entry.albumId),
        addedAt: entry.addedAt ? new Date(entry.addedAt) : new Date(),
      });
    }

    for (const entry of library.playlists || []) {
      if (!entry?.playlistId) continue;
      playlists.push({
        user: new mongoose.Types.ObjectId(userId),
        playlist: new mongoose.Types.ObjectId(entry.playlistId),
        addedAt: entry.addedAt ? new Date(entry.addedAt) : new Date(),
      });
    }

    for (const entry of library.followedArtists || []) {
      if (!entry?.artistId) continue;
      artists.push({
        user: new mongoose.Types.ObjectId(userId),
        artist: new mongoose.Types.ObjectId(entry.artistId),
        addedAt: entry.addedAt ? new Date(entry.addedAt) : new Date(),
      });
    }
  }

  await insertManyIgnoreDuplicates(SavedAlbum, albums, "SavedAlbum");
  await insertManyIgnoreDuplicates(SavedPlaylist, playlists, "SavedPlaylist");
  await insertManyIgnoreDuplicates(
    FollowedArtist,
    artists,
    "FollowedArtist (from libraries)",
  );
}

async function migrateUserSocial() {
  const usersCol = mongoose.connection.collection("users");
  const users = await usersCol
    .find({
      $or: [
        { followingUsers: { $exists: true, $ne: [] } },
        { followingArtists: { $exists: true, $ne: [] } },
      ],
    })
    .toArray();

  console.log(`Found ${users.length} user(s) with legacy social arrays.`);

  const followedUsers = [];
  const legacyArtists = [];

  for (const user of users) {
    const fallback = user.updatedAt || user.createdAt || new Date();

    for (const followingId of user.followingUsers || []) {
      if (!followingId) continue;
      followedUsers.push({
        follower: new mongoose.Types.ObjectId(user._id),
        following: new mongoose.Types.ObjectId(followingId),
        addedAt: new Date(fallback),
      });
    }

    for (const artistId of user.followingArtists || []) {
      if (!artistId) continue;
      legacyArtists.push({
        user: new mongoose.Types.ObjectId(user._id),
        artist: new mongoose.Types.ObjectId(artistId),
        addedAt: new Date(fallback),
      });
    }
  }

  await insertManyIgnoreDuplicates(
    FollowedUser,
    followedUsers,
    "FollowedUser (from followingUsers)",
  );
  await insertManyIgnoreDuplicates(
    FollowedArtist,
    legacyArtists,
    "FollowedArtist (from user.followingArtists)",
  );
}

async function dropLegacyData() {
  const librariesCol = mongoose.connection.collection("libraries");
  try {
    await librariesCol.drop();
    console.log("Dropped libraries collection.");
  } catch (err) {
    if (err?.code === 26) {
      console.log("libraries collection does not exist, skip drop.");
    } else {
      throw err;
    }
  }

  const usersCol = mongoose.connection.collection("users");
  const result = await usersCol.updateMany(
    {},
    {
      $unset: {
        playlists: "",
        followers: "",
        followingUsers: "",
        followingArtists: "",
      },
    },
  );
  console.log(
    `Unset legacy User array fields on ${result.modifiedCount} document(s).`,
  );
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  await migrateLibraries();
  await migrateUserSocial();

  if (dropLegacy) {
    await dropLegacyData();
  } else {
    console.log(
      "Legacy data kept. Re-run with --drop-legacy after verifying migration.",
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
