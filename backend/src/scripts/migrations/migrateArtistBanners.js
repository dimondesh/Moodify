#!/usr/bin/env node
/**
 * Remove legacy artist banner fields (bannerUrl, bannerPublicId) and delete
 * banner files from Bunny CDN. Artist pages now use 1:1 avatars only.
 *
 * Run: cd backend && npm run migrate:artist-banners
 * Dry run: npm run migrate:artist-banners -- --dry-run
 */
import "dotenv/config";
import mongoose from "mongoose";
import { deleteFromBunny, getPathFromUrl } from "../../lib/media/bunny.service.js";

const dryRun = process.argv.includes("--dry-run");

function resolveBannerPath(artist) {
  if (artist.bannerPublicId) return artist.bannerPublicId;
  if (artist.bannerUrl) return getPathFromUrl(artist.bannerUrl);
  return null;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const artists = await mongoose.connection
    .collection("artists")
    .find({
      $or: [
        { bannerUrl: { $nin: [null, ""] } },
        { bannerPublicId: { $nin: [null, ""] } },
      ],
    })
    .project({ name: 1, bannerUrl: 1, bannerPublicId: 1 })
    .toArray();

  console.log(
    `[migrate:artist-banners] Found ${artists.length} artist(s) with banner data${dryRun ? " (dry run)" : ""}.`,
  );

  let deletedFromCdn = 0;
  let skippedCdn = 0;

  for (const artist of artists) {
    const remotePath = resolveBannerPath(artist);
    console.log(
      `- ${artist.name} (${artist._id}): bannerUrl=${artist.bannerUrl ?? "null"}, path=${remotePath ?? "none"}`,
    );

    if (remotePath) {
      if (dryRun) {
        console.log(`  would delete from CDN: ${remotePath}`);
      } else {
        await deleteFromBunny(remotePath);
        deletedFromCdn += 1;
      }
    } else {
      skippedCdn += 1;
    }
  }

  if (dryRun) {
    console.log(
      `[migrate:artist-banners] Dry run complete. Would unset banner fields on ${artists.length} document(s).`,
    );
  } else {
    const result = await mongoose.connection.collection("artists").updateMany(
      {},
      { $unset: { bannerUrl: "", bannerPublicId: "" } },
    );
    console.log(
      `[migrate:artist-banners] CDN deletes attempted: ${deletedFromCdn}, no path: ${skippedCdn}.`,
    );
    console.log(
      `[migrate:artist-banners] Unset banner fields on ${result.modifiedCount} document(s).`,
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate:artist-banners] Failed:", err);
  process.exit(1);
});
