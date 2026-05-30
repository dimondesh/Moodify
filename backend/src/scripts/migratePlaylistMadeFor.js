/**
 * Moves generated playlists from owner → madeFor and clears owner.
 * Run once after deploying the madeFor field: npm run migrate:made-for
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Playlist } from "../models/playlist.model.js";
import { GENERATED_PLAYLIST_TYPES } from "../constants/playlistTypes.js";

dotenv.config();

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const cursor = Playlist.find({
    type: { $in: GENERATED_PLAYLIST_TYPES },
    owner: { $ne: null },
  }).cursor();

  let updated = 0;
  for await (const doc of cursor) {
    doc.madeFor = doc.owner;
    doc.owner = null;
    await doc.save();
    updated += 1;
  }

  console.log(`Updated ${updated} generated playlist(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
