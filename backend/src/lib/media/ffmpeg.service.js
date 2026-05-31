import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ffprobePath = path.join(
  path.dirname(ffmpegInstaller.path),
  process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
);
ffmpeg.setFfprobePath(ffprobePath);

const EXTINF_RE = /^#EXTINF:([\d.]+)/;

/** Store track length with centisecond precision (e.g. 238.67). */
export function roundTrackDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * 100) / 100;
}

function sumExtinfDuration(lines) {
  let total = 0;
  let hasSegments = false;

  for (const line of lines) {
    const match = line.match(EXTINF_RE);
    if (match) {
      total += Number.parseFloat(match[1]);
      hasSegments = true;
    }
  }

  return hasSegments && total > 0 ? total : null;
}

function findVariantReference(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].startsWith("#EXT-X-STREAM-INF") &&
      lines[i + 1] &&
      !lines[i + 1].startsWith("#")
    ) {
      return lines[i + 1];
    }
  }
  return null;
}

async function readLocalPlaylist(manifestPath) {
  const text = await fs.readFile(manifestPath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Sum #EXTINF from a local HLS manifest (follows one local variant if present).
 */
export async function getDurationFromHlsManifest(manifestPath) {
  let currentPath = manifestPath;
  const visited = new Set();

  while (true) {
    if (visited.has(currentPath)) return null;
    visited.add(currentPath);

    const lines = await readLocalPlaylist(currentPath);
    const variantRef = findVariantReference(lines);

    if (variantRef) {
      currentPath = path.resolve(path.dirname(currentPath), variantRef);
      continue;
    }

    const total = sumExtinfDuration(lines);
    return total ? roundTrackDuration(total) : null;
  }
}

async function fetchRemotePlaylist(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 300,
  });

  return data
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function probeRemoteHlsDuration(playlistUrl, visited = new Set()) {
  if (visited.has(playlistUrl)) return null;
  visited.add(playlistUrl);

  const lines = await fetchRemotePlaylist(playlistUrl);
  const variantRef = findVariantReference(lines);

  if (variantRef) {
    const variantUrl = new URL(variantRef, playlistUrl).href;
    return probeRemoteHlsDuration(variantUrl, visited);
  }

  const total = sumExtinfDuration(lines);
  return total ? roundTrackDuration(total) : null;
}

function probeWithFfprobe(url) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(url, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata?.format?.duration;
      resolve(
        Number.isFinite(duration) && duration > 0 ? duration : null,
      );
    });
  });
}

/** Resolve duration from a remote HLS URL (for backfill jobs). */
export async function probeMediaDuration(mediaUrl) {
  if (!mediaUrl) return null;

  try {
    const fromPlaylist = await probeRemoteHlsDuration(mediaUrl);
    if (fromPlaylist) return fromPlaylist;
  } catch (error) {
    console.warn(
      `[FFMPEG] HLS playlist parse failed for ${mediaUrl}:`,
      error.message,
    );
  }

  try {
    const fromFfprobe = await probeWithFfprobe(mediaUrl);
    if (fromFfprobe) return roundTrackDuration(fromFfprobe);
  } catch (error) {
    console.warn(`[FFMPEG] ffprobe failed for ${mediaUrl}:`, error.message);
  }

  return null;
}

/**
 * Transcodes an audio file into a highly compatible HLS format.
 * @param {string} inputPath - The local path to the source audio file.
 * @param {string} outputDir - The directory where HLS files will be created.
 * @returns {Promise<string>} Path to the master HLS manifest file.
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
        .outputOptions([
          "-vn",
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
          "-bsf:a",
          "aac_adtstoasc",
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
        .format("hls")
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
        error,
      );
      reject(error);
    }
  });
};
