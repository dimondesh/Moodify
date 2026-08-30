#!/usr/bin/env node
/**
 * Compute coverAccentHex (Spotify-style scoring + dark-UI tune) for albums/playlists/songs/users.
 * Run: cd backend && npm run backfill:cover-accent
 * Re-run all after algorithm change: npm run backfill:cover-accent -- --force
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Album } from "../../models/album.model.js";
import { Song } from "../../models/song.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { User } from "../../models/user.model.js";
import { getLargeImageUrl } from "../../lib/media/imageVariants.service.js";
import {
  extractCoverAccentHexFromUrl,
  isSkippableCoverImageUrl,
} from "../../lib/media/coverAccent.service.js";
import { CDN_SYSTEM_PLAYLIST_ACCENT_BY_TYPE } from "../../constants/cdn.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const force = process.argv.includes("--force");

const missingAccentFilter = {};

function entityCoverUrl(entity) {
  return getLargeImageUrl(entity?.images) || entity?.imageUrl || null;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  if (force) {
    console.log(
      "[backfill] --force: recalculating coverAccentHex for all entities with images",
    );
  }

  await mongoose.connect(process.env.MONGO_URI);

  const albumQuery = force ? {} : missingAccentFilter;
  const albums = await Album.find(albumQuery).lean();

  console.log(`Albums to process: ${albums.length}`);
  for (const al of albums) {
    const coverUrl = entityCoverUrl(al);
    const hex = isSkippableCoverImageUrl(coverUrl)
      ? null
      : await extractCoverAccentHexFromUrl(coverUrl);
    await Album.updateOne({ _id: al._id }, { $set: { coverAccentHex: hex } });
    await Song.updateMany({ albumId: al._id }, { $set: { coverAccentHex: hex } });
    console.log(`Album "${al.title}": ${hex ?? "null"}`);
    await sleep(120);
  }

  const playlistQuery = force ? {} : missingAccentFilter;
  const playlists = await Playlist.find(playlistQuery).lean();

  console.log(`Playlists to process: ${playlists.length}`);
  for (const pl of playlists) {
    const fixedHex = CDN_SYSTEM_PLAYLIST_ACCENT_BY_TYPE[pl.type];
    if (fixedHex) {
      await Playlist.updateOne(
        { _id: pl._id },
        { $set: { coverAccentHex: fixedHex } },
      );
      console.log(`Playlist "${pl.title}" (${pl.type}): ${fixedHex} [fixed]`);
      continue;
    }
    const coverUrl = entityCoverUrl(pl);
    if (isSkippableCoverImageUrl(coverUrl)) {
      await Playlist.updateOne(
        { _id: pl._id },
        { $set: { coverAccentHex: null } },
      );
      continue;
    }
    const hex = await extractCoverAccentHexFromUrl(coverUrl);
    await Playlist.updateOne(
      { _id: pl._id },
      { $set: { coverAccentHex: hex } },
    );
    console.log(`Playlist "${pl.title}": ${hex ?? "null"}`);
    await sleep(120);
  }

  if (!force) {
    const albumsWithHex = await Album.find({
      coverAccentHex: { $nin: [null, ""] },
    })
      .select("_id coverAccentHex")
      .lean();

    for (const al of albumsWithHex) {
      await Song.updateMany(
        {
          albumId: al._id,
          ...missingAccentFilter,
        },
        { $set: { coverAccentHex: al.coverAccentHex } },
      );
    }
  } else {
    console.log(
      "[backfill] --force: song accents synced per album in album loop",
    );
  }

  const orphanQuery = force
    ? { albumId: null }
    : { albumId: null, ...missingAccentFilter };
  const orphanSongs = await Song.find(orphanQuery)
    .select("_id title images imageUrl")
    .lean();

  console.log(`Songs without album: ${orphanSongs.length}`);
  for (const s of orphanSongs) {
    const coverUrl = entityCoverUrl(s);
    if (isSkippableCoverImageUrl(coverUrl)) continue;
    const hex = await extractCoverAccentHexFromUrl(coverUrl);
    await Song.updateOne({ _id: s._id }, { $set: { coverAccentHex: hex } });
    await sleep(120);
  }

  const userQuery = force
    ? {}
    : missingAccentFilter;
  const users = await User.find(userQuery)
    .select("_id fullName images imageUrl")
    .lean();

  console.log(`Users (avatars) to process: ${users.length}`);
  for (const u of users) {
    const coverUrl = entityCoverUrl(u);
    if (isSkippableCoverImageUrl(coverUrl)) {
      await User.updateOne({ _id: u._id }, { $set: { coverAccentHex: null } });
      continue;
    }
    const hex = await extractCoverAccentHexFromUrl(coverUrl);
    await User.updateOne({ _id: u._id }, { $set: { coverAccentHex: hex } });
    console.log(`User "${u.fullName || u._id}": ${hex ?? "null"}`);
    await sleep(120);
  }

  await mongoose.disconnect();
  console.log("Backfill finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
