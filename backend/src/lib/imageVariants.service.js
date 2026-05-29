// backend/src/lib/imageVariants.service.js
import sharp from "sharp";
import path from "path";
import os from "os";
import fs from "fs/promises";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import {
  deleteFromBunny,
  getPathFromUrl,
  putFileToBunny,
} from "./bunny.service.js";

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

export const IMAGE_SIZES = [64, 300, 640];
export const IMAGE_VARIANT_QUALITY = 80;
export const LARGE_SIZE = 640;

/** @param {{ size: number, url: string }[] | undefined} images */
export const getLargeImageUrl = (images) => {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => a.size - b.size);
  return (
    sorted.find((img) => img.size === LARGE_SIZE)?.url ??
    sorted[sorted.length - 1]?.url ??
    null
  );
};

/** Mongo fields from an upload result (or plain { imagePublicId, images }). */
export const toImageFields = (uploadResult) => ({
  imagePublicId: uploadResult.imagePublicId,
  images: uploadResult.images,
});

/** System covers (liked, on-repeat, defaults): same CDN URL for every size slot. */
export const buildStaticCdnImages = (cdnUrl) =>
  IMAGE_SIZES.map((size) => ({ size, url: cdnUrl }));

const readUploadToBuffer = async (source) => {
  if (Buffer.isBuffer(source)) return source;
  if (source?.tempFilePath) return fs.readFile(source.tempFilePath);
  if (typeof source === "string") {
    const res = await axios.get(source, DOWNLOAD_OPTS);
    return Buffer.from(res.data);
  }
  throw new Error("Invalid image source");
};

const generateAndUploadImageVariants = async (sourceBuffer, folder) => {
  const baseId = uuidv4();
  const images = [];
  const uploadedPaths = [];

  try {
    const baseImage = sharp(sourceBuffer).rotate();

    for (const size of IMAGE_SIZES) {
      const tempFileName = `${baseId}_${size}.webp`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);

      await baseImage
        .clone()
        .resize(size, size, { fit: "cover", position: "centre" })
        .webp({ quality: IMAGE_VARIANT_QUALITY })
        .toFile(tempFilePath);

      const remotePath = path
        .join(folder, `${baseId}_${size}.webp`)
        .replace(/\\/g, "/");

      await putFileToBunny(tempFilePath, remotePath, "image/webp");
      uploadedPaths.push(remotePath);

      const hostname = process.env.BUNNY_PULL_ZONE_HOSTNAME;
      images.push({
        size,
        url: `https://${hostname}/${remotePath}`,
      });

      await fs.unlink(tempFilePath).catch(() => {});
    }

    return {
      imagePublicId: uploadedPaths.find((p) =>
        p.endsWith(`_${LARGE_SIZE}.webp`),
      ),
      images,
    };
  } catch (error) {
    await Promise.all(uploadedPaths.map((p) => deleteFromBunny(p)));
    console.error("[imageVariants] generateAndUpload failed:", error);
    throw error;
  }
};

/** @param {import('express-fileupload').UploadedFile | Buffer | string} source */
export const uploadImageVariantsFromSource = async (source, folder) => {
  const buffer = await readUploadToBuffer(source);
  return generateAndUploadImageVariants(buffer, folder);
};

/** @param {{ images?: { url?: string }[], imagePublicId?: string }} entity */
export const deleteImageVariants = async (entity) => {
  const paths = new Set();

  if (Array.isArray(entity.images)) {
    for (const img of entity.images) {
      const p = getPathFromUrl(img?.url);
      if (p) paths.add(p);
    }
  }

  if (entity.imagePublicId) {
    paths.add(entity.imagePublicId.replace(/\\/g, "/"));
  }

  await Promise.all([...paths].map((p) => deleteFromBunny(p)));
};

/** Upload new variants, update entity in memory, delete previous CDN files. */
export const replaceEntityImageVariants = async (entity, source, folder) => {
  const previous = {
    images: entity.images ? [...entity.images] : [],
    imagePublicId: entity.imagePublicId,
  };
  const uploadResult = await uploadImageVariantsFromSource(source, folder);
  Object.assign(entity, toImageFields(uploadResult));
  await deleteImageVariants(previous);
  return uploadResult;
};
