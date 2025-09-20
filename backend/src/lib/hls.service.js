// backend/src/lib/hls.service.js
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  uploadDirectoryToBunny,
  deleteFolderFromBunny,
} from "./bunny.service.js";

const HLS_FOLDER = "hls-streams";

// Убедитесь, что путь к ffmpeg указан, если он не в системном PATH
// const ffmpegPath = "/path/to/your/ffmpeg";
// ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Конвертирует аудиофайл в HLS формат.
 * @param {string} localAudioPath - Путь к исходному аудиофайлу.
 * @returns {Promise<{hlsPlaylistUrl: string, hlsFolderPath: string}>} - URL плейлиста и путь к папке на Bunny.
 */
export const convertToHlsAndUpload = async (localAudioPath) => {
  const uniqueId = uuidv4();
  const localHlsDir = path.join(process.cwd(), "temp", "hls", uniqueId);
  const remoteHlsDir = path.join(HLS_FOLDER, uniqueId).replace(/\\/g, "/");

  try {
    await fs.mkdir(localHlsDir, { recursive: true });

    // Процесс конвертации
    await new Promise((resolve, reject) => {
      ffmpeg(localAudioPath)
        .outputOptions([
          "-c:a aac",
          "-b:a 192k",
          "-hls_time 10",
          "-hls_list_size 0",
          "-f hls",
        ])
        .output(path.join(localHlsDir, "playlist.m3u8"))
        .on("end", resolve)
        .on("error", (err) => {
          console.error("FFmpeg error:", err.message);
          reject(new Error("Failed to convert audio to HLS."));
        })
        .run();
    });

    console.log(`[HLS] Conversion complete for ${uniqueId}`);

    // Загрузка на Bunny.net
    const { mainPlaylistUrl } = await uploadDirectoryToBunny(
      localHlsDir,
      remoteHlsDir
    );

    console.log(`[HLS] Upload complete. Playlist URL: ${mainPlaylistUrl}`);

    return { hlsPlaylistUrl: mainPlaylistUrl, hlsFolderPath: remoteHlsDir };
  } catch (error) {
    console.error("[HLS Service] Error during HLS processing:", error);
    // Попытка очистки в случае ошибки
    await deleteFolderFromBunny(remoteHlsDir).catch((e) =>
      console.error(
        `[HLS Cleanup Error] Failed to delete remote folder ${remoteHlsDir}`,
        e
      )
    );
    throw error;
  } finally {
    // Очистка локальной временной папки
    await fs
      .rm(localHlsDir, { recursive: true, force: true })
      .catch((e) =>
        console.error(
          `[HLS Cleanup] Failed to delete local temp folder ${localHlsDir}`,
          e
        )
      );
  }
};
