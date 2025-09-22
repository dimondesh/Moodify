// backend/src/lib/ffmpeg.service.js
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fs from "fs/promises";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Transcodes an audio file into a highly compatible HLS format.
 * @param {string} inputPath - The local path to the source audio file.
 * @param {string} outputDir - The directory where HLS files will be created.
 * @returns {Promise<string>} A promise that resolves with the path to the master HLS manifest file.
 */
export const transcodeToHls = (inputPath, outputDir) => {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.mkdir(outputDir, { recursive: true });
      const manifestPath = path.join(outputDir, "master.m3u8");

      console.log(`[FFMPEG] Starting HLS transcoding...`);
      console.log(`[FFMPEG] Input: ${inputPath}`);
      console.log(`[FFMPEG] Output Dir: ${outputDir}`);

      ffmpeg(inputPath)
        // Входные опции (если нужны, но пока пропускаем)
        // .inputOptions(...)

        .outputOptions([
          // Убираем возможное видео из потока
          "-vn",

          // Аудио настройки для максимальной совместимости
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-profile:a",
          "aac_low",

          // Фильтр для совместимости с Apple
          "-bsf:a",
          "aac_adtstoasc",

          // HLS настройки
          "-hls_time",
          "10",
          "-hls_playlist_type",
          "vod",
          "-hls_list_size",
          "0",
          "-hls_segment_filename",
          `${outputDir}/segment%03d.ts`,
        ])
        .output(manifestPath)
        .format("hls") // Указываем формат через метод
        .on("start", (commandLine) => {
          console.log(`[FFMPEG] Spawned Ffmpeg with command: ${commandLine}`);
        })
        .on("end", () => {
          console.log(`[FFMPEG] HLS transcoding finished for ${inputPath}`);
          resolve(manifestPath);
        })
        .on("error", (err, stdout, stderr) => {
          console.error(`[FFMPEG] Error during HLS transcoding:`, err.message);
          console.error(`[FFMPEG] STDOUT: ${stdout}`);
          console.error(`[FFMPEG] STDERR: ${stderr}`);
          reject(err);
        })
        .run();
    } catch (error) {
      console.error(
        `[FFMPEG] Failed to create output directory or start process:`,
        error
      );
      reject(error);
    }
  });
};
