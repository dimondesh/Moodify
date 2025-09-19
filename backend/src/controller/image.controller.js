// backend/src/controller/image.controller.js
import sharp from "sharp";
import axios from "axios";
import {
  uploadToBunny,
  deleteFromBunny,
  getPathFromUrl,
} from "../lib/bunny.service.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Song } from "../models/song.model.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";


const optimizeAndUpload = async (imageBuffer, folder) => {
  const tempFileName = `${uuidv4()}.webp`;
  const tempFilePath = path.join(process.cwd(), "temp", tempFileName);

  try {
    await sharp(imageBuffer)
      .resize({ width: 800, height: 800, fit: "cover" })
      .webp({ quality: 80 })
      .toFile(tempFilePath);

    const bunnyFileName = `${uuidv4()}.webp`; 
    const result = await uploadToBunny(tempFilePath, folder, bunnyFileName);

    return result;
  } catch (error) {
    console.error(
      `Error during image optimization/upload to folder ${folder}:`,
      error
    );
    throw error;
  } finally {
    try {
      await fs.unlink(tempFilePath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") {
        console.error(
          `Error deleting temporary file ${tempFilePath}:`,
          cleanupError
        );
      }
    }
  }
};

export const optimizeExistingImages = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Access denied." });
  }

  res
    .status(202)
    .json({
      message:
        "Image optimization process started in the background. This may take some time.",
    });

  (async () => {
    try {
      console.log("--- Starting Full Image Optimization ---");

      const albumsToOptimize = await Album.find({
        imageUrl: { $not: /\.webp/ },
      }).lean();
      console.log(`Found ${albumsToOptimize.length} albums to optimize.`);

      for (const album of albumsToOptimize) {
        try {
          const oldImageUrl = album.imageUrl;
          console.log(`Processing Album: ${album.title}`);

          const response = await axios({
            url: oldImageUrl,
            responseType: "arraybuffer",
          });
          const newImage = await optimizeAndUpload(response.data, "albums");

          await Album.updateOne(
            { _id: album._id },
            {
              $set: { imageUrl: newImage.url, imagePublicId: newImage.path },
            }
          );

          await Song.updateMany(
            { albumId: album._id },
            {
              $set: { imageUrl: newImage.url, imagePublicId: newImage.path },
            }
          );

          if (oldImageUrl) {
            await deleteFromBunny(getPathFromUrl(oldImageUrl));
          }
          console.log(
            `Successfully optimized and updated album: ${album.title}`
          );
        } catch (err) {
          console.error(
            `Failed to process album ${album.title} (${album._id}):`,
            err.message
          );
        }
      }

      const artistsToOptimize = await Artist.find({
        $or: [
          { imageUrl: { $exists: true, $ne: null, $not: /\.webp/ } },
          { bannerUrl: { $exists: true, $ne: null, $not: /\.webp/ } },
        ],
      }).lean();
      console.log(`Found ${artistsToOptimize.length} artists to optimize.`);

      for (const artist of artistsToOptimize) {
        try {
          console.log(`Processing Artist: ${artist.name}`);
          const updates = {};

          if (artist.imageUrl && !artist.imageUrl.endsWith(".webp")) {
            const oldImageUrl = artist.imageUrl;
            const response = await axios({
              url: oldImageUrl,
              responseType: "arraybuffer",
            });
            const newImage = await optimizeAndUpload(response.data, "artists");
            updates.imageUrl = newImage.url;
            updates.imagePublicId = newImage.path;
            await deleteFromBunny(getPathFromUrl(oldImageUrl));
          }

          if (artist.bannerUrl && !artist.bannerUrl.endsWith(".webp")) {
            const oldBannerUrl = artist.bannerUrl;
            const response = await axios({
              url: oldBannerUrl,
              responseType: "arraybuffer",
            });
            const newBanner = await optimizeAndUpload(
              response.data,
              "artists/banners"
            );
            updates.bannerUrl = newBanner.url;
            updates.bannerPublicId = newBanner.path;
            await deleteFromBunny(getPathFromUrl(oldBannerUrl));
          }

          if (Object.keys(updates).length > 0) {
            await Artist.updateOne({ _id: artist._id }, { $set: updates });
            console.log(`Successfully optimized artist: ${artist.name}`);
          }
        } catch (err) {
          console.error(
            `Failed to process artist ${artist.name} (${artist._id}):`,
            err.message
          );
        }
      }

      console.log("--- Image Optimization Process Finished ---");
    } catch (error) {
      console.error(
        "A critical error occurred during the optimization process:",
        error
      );
    }
  })();
};
