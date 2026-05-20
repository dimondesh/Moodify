import { execFile } from "child_process";
import util from "util";

const execFilePromise = util.promisify(execFile);

const ENCODE_ARGS = ["-c:a", "libmp3lame", "-q:a", "2"];
const CLIP_DURATION_SEC = "60";
const LONG_TRACK_SEEK = "00:00:30";
const LONG_TRACK_MIN_DURATION_SEC = 90;

/**
 * Builds ffmpeg args for HLS → MP3. Input must come before -ss (output seek)
 * to avoid segfaults with HLS in some ffmpeg builds.
 */
export function buildHlsDownloadArgs(hlsUrl, outputPath, durationSec = 0) {
  const args = ["-y", "-i", hlsUrl];

  if (durationSec > LONG_TRACK_MIN_DURATION_SEC) {
    args.push("-ss", LONG_TRACK_SEEK, "-t", CLIP_DURATION_SEC);
  } else {
    args.push("-t", CLIP_DURATION_SEC);
  }

  args.push(...ENCODE_ARGS, outputPath);
  return args;
}

export async function downloadHlsAudio(hlsUrl, outputPath, durationSec = 0) {
  const args = buildHlsDownloadArgs(hlsUrl, outputPath, durationSec);
  await execFilePromise("ffmpeg", args);
}
