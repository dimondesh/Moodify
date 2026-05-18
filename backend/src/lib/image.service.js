// backend/src/lib/image.service.js
import sharp from "sharp";
import { uploadToBunny } from "./bunny.service.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import os from "os";
import fs from "fs/promises";

const USER_IMAGE_SIZE = 512;
const USER_IMAGE_QUALITY = 82;

export const optimizeAndUploadImage = async (source, originalFileName, folder) => {
  const newFileName = `${uuidv4()}.webp`;
  const tempOptimizedFilePath = path.join(os.tmpdir(), newFileName);

  const sourceBuffer = source.tempFilePath
    ? await fs.readFile(source.tempFilePath)
    : source;

  try {
    const image = sharp(sourceBuffer).rotate();
    const { width, height } = await image.metadata();
    const side = Math.min(width, height, USER_IMAGE_SIZE);

    await image
      .resize(side, side, { fit: "cover", position: "centre" })
      .webp({ quality: USER_IMAGE_QUALITY })
      .toFile(tempOptimizedFilePath);

    const result = await uploadToBunny(tempOptimizedFilePath, folder);

    return { url: result.url, path: result.path, publicId: result.path };
  } catch (error) {
    console.error(`Error optimizing and uploading image to ${folder}:`, error);
    throw error;
  } finally {
    await fs.unlink(tempOptimizedFilePath).catch((err) => {
      if (err.code !== "ENOENT") {
        console.error(
          `Error deleting temp optimized file: ${tempOptimizedFilePath}`,
          err
        );
      }
    });
    if (source.tempFilePath) {
      await fs.unlink(source.tempFilePath).catch((err) => {
        if (err.code !== "ENOENT") {
          console.error(
            `Error deleting original temp file: ${source.tempFilePath}`,
            err
          );
        }
      });
    }
  }
};
