#!/usr/bin/env node
/**
 * Upload sized webp variants for fixed system playlist covers, then rewrite
 * playlist.images for DISCOVER_WEEKLY / ON_REPEAT / ON_REPEAT_REWIND.
 *
 * Run: cd backend && npm run migrate:system-cover-variants
 */
import "dotenv/config";
import fs from "fs/promises";
import os from "os";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import mongoose from "mongoose";
import { Playlist } from "../../models/playlist.model.js";
import { putFileToBunny } from "../../lib/media/bunny.service.js";
import {
  IMAGE_SIZES,
  IMAGE_VARIANT_QUALITY,
} from "../../lib/media/imageVariants.service.js";
import {
  CDN_BASE,
  SYSTEM_COVER_SOURCES,
  CDN_SYSTEM_PLAYLIST_IMAGES_BY_TYPE,
} from "../../constants/cdn.js";

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

async function uploadStemVariants(stem, sourcePath) {
  const sourceUrl = `${CDN_BASE}/${sourcePath}`;
  console.log(`[system-covers] downloading ${sourceUrl}`);
  const res = await axios.get(sourceUrl, DOWNLOAD_OPTS);
  const sourceBuffer = Buffer.from(res.data);
  const baseImage = sharp(sourceBuffer).rotate();

  for (const size of IMAGE_SIZES) {
    const remotePath = `${stem}_${size}.webp`;
    const tempFilePath = path.join(os.tmpdir(), remotePath);

    await baseImage
      .clone()
      .resize(size, size, { fit: "cover", position: "centre" })
      .webp({ quality: IMAGE_VARIANT_QUALITY })
      .toFile(tempFilePath);

    const { size: bytes } = await fs.stat(tempFilePath);
    await putFileToBunny(tempFilePath, remotePath, "image/webp");
    await fs.unlink(tempFilePath).catch(() => {});
    console.log(
      `[system-covers] uploaded ${remotePath} (${(bytes / 1024).toFixed(1)} KB)`,
    );
  }
}

async function rewritePlaylistImages() {
  const types = Object.keys(CDN_SYSTEM_PLAYLIST_IMAGES_BY_TYPE).filter(
    (type) => type !== "LIKED_SONGS",
  );

  let updated = 0;
  for (const type of types) {
    const images = CDN_SYSTEM_PLAYLIST_IMAGES_BY_TYPE[type];
    const result = await Playlist.updateMany({ type }, { $set: { images } });
    updated += result.modifiedCount;
    console.log(
      `[system-covers] ${type}: matched=${result.matchedCount} modified=${result.modifiedCount}`,
    );
  }
  return updated;
}

async function main() {
  if (!process.env.BUNNY_PULL_ZONE_HOSTNAME) {
    console.error("BUNNY_PULL_ZONE_HOSTNAME is required");
    process.exit(1);
  }
  if (!process.env.BUNNY_STORAGE_ZONE_NAME || !process.env.BUNNY_STORAGE_ACCESS_KEY) {
    console.error("Bunny storage credentials are required");
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  for (const { stem, sourcePath } of SYSTEM_COVER_SOURCES) {
    await uploadStemVariants(stem, sourcePath);
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const updated = await rewritePlaylistImages();
    console.log(`[system-covers] playlists updated: ${updated}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("[system-covers] failed:", err);
  process.exit(1);
});
