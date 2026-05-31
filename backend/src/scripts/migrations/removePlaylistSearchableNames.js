#!/usr/bin/env node
/**
 * Removes legacy `searchableNames` from all playlists (duplicate of localizedNames).
 *
 *   cd backend && npm run strip:playlist-searchable-names
 */
import "dotenv/config";
import mongoose from "mongoose";
import { removePlaylistSearchableNames } from "../../lib/playlists/playlistLocaleCleanup.service.js";

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const { matched, modified } = await removePlaylistSearchableNames();
  console.log(
    `Removed searchableNames from ${modified}/${matched} playlist(s) that had the field.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
