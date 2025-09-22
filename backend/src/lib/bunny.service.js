// backend/src/lib/bunny.service.js
import axios from "axios";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import mime from "mime-types";
import dotenv from "dotenv";

dotenv.config();

const {
  BUNNY_STORAGE_ZONE_NAME,
  BUNNY_STORAGE_ACCESS_KEY,
  BUNNY_PULL_ZONE_HOSTNAME,
} = process.env;

const bunnyAxios = axios.create({
  baseURL: `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE_NAME}/`,
  headers: { AccessKey: BUNNY_STORAGE_ACCESS_KEY },
});

const putFileToBunny = async (localFilePath, remoteFullPath, mimeType) => {
  const fileStream = fsSync.createReadStream(localFilePath);
  await bunnyAxios.put(remoteFullPath, fileStream, {
    headers: {
      "Content-Length": (await fs.stat(localFilePath)).size,
      "Content-Type": mimeType || "application/octet-stream",
    },
  });
};

export const uploadToBunny = async (source, remoteFolder) => {
  let localFilePath;
  let originalFileName;
  let isTempDownload = false;
  let mimeType;

  try {
    if (typeof source === "string") {
      if (source.startsWith("http://") || source.startsWith("https://")) {
        const response = await axios.get(source, { responseType: "stream" });
        const urlPath = new URL(source).pathname;
        const extension = path.extname(urlPath) || ".jpg";
        originalFileName = `${uuidv4()}${extension}`;
        localFilePath = path.join(os.tmpdir(), originalFileName);
        isTempDownload = true;
        const writer = fsSync.createWriteStream(localFilePath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
      } else {
        localFilePath = source;
        originalFileName = path.basename(source);
      }
    } else if (source && source.tempFilePath) {
      localFilePath = source.tempFilePath;
      originalFileName = source.name;
    } else {
      throw new Error("Invalid source for upload.");
    }

    mimeType =
      source.mimetype ||
      mime.lookup(originalFileName) ||
      "application/octet-stream";

    const remoteFileName = `${uuidv4()}${path.extname(originalFileName)}`;
    const fullRemotePath = path
      .join(remoteFolder, remoteFileName)
      .replace(/\\/g, "/");

    await putFileToBunny(localFilePath, fullRemotePath, mimeType);

    const fileUrl = `https://${BUNNY_PULL_ZONE_HOSTNAME}/${fullRemotePath}`;
    console.log(
      `[Bunny] File uploaded successfully with Content-Type: ${mimeType}. URL: ${fileUrl}`
    );

    return { url: fileUrl, path: fullRemotePath };
  } catch (error) {
    console.error(`[Bunny] Smart uploader failed! Source:`, source);
    if (error.isAxiosError) {
      console.error(
        "[Bunny] Axios Error:",
        error.response?.data || error.message
      );
    } else {
      console.error("[Bunny] Filesystem or other error:", error);
    }
    throw new Error("Failed to upload file to Bunny.net");
  } finally {
    if (isTempDownload && localFilePath) {
      try {
        await fs.unlink(localFilePath);
      } catch (cleanupError) {
        console.error(
          `[Bunny] Failed to delete temporary file ${localFilePath}:`,
          cleanupError
        );
      }
    }
  }
};

export const uploadDirectoryToBunny = async (
  localDirectory,
  remoteDirectory
) => {
  try {
    const files = await fs.readdir(localDirectory);
    for (const file of files) {
      const localFilePath = path.join(localDirectory, file);
      const remotePath = path.join(remoteDirectory, file).replace(/\\/g, "/");
      const mimeType = mime.lookup(file) || "application/octet-stream";
      await putFileToBunny(localFilePath, remotePath, mimeType);
      console.log(`[Bunny] Uploaded directory file: ${remotePath}`);
    }
    console.log(
      `[Bunny] Successfully uploaded directory ${localDirectory} to ${remoteDirectory}`
    );
  } catch (error) {
    console.error(
      `[Bunny] Failed to upload directory ${localDirectory}:`,
      error
    );
    throw new Error("Failed to upload directory to Bunny.net");
  }
};

export const deleteFromBunny = async (remoteFilePath) => {
  if (!remoteFilePath) {
    console.warn("[Bunny] No remote file path provided. Skipping deletion.");
    return;
  }
  try {
    console.log(`[Bunny] Deleting ${remoteFilePath}...`);
    await bunnyAxios.delete(remoteFilePath);
    console.log(`[Bunny] Successfully deleted ${remoteFilePath}.`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(
        `[Bunny] Resource ${remoteFilePath} was not found, considering it deleted.`
      );
    } else {
      console.error(
        `[Bunny] Error deleting ${remoteFilePath}:`,
        error.response ? error.response.data : error.message
      );
    }
  }
};

export const getPathFromUrl = (url) => {
  if (!url || !url.startsWith(`https://${BUNNY_PULL_ZONE_HOSTNAME}`)) {
    return null;
  }
  return url.replace(`https://${BUNNY_PULL_ZONE_HOSTNAME}/`, "");
};
