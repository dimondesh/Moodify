import path from "path";
import fs from "fs/promises";
import * as mm from "music-metadata";
import { v4 as uuidv4 } from "uuid";
import { uploadDirectoryToBunny } from "./bunny.service.js";
import {
  transcodeToHls,
  getDurationFromHlsManifest,
  roundTrackDuration,
} from "./ffmpeg.service.js";

export const processAndUploadSong = async (audioFilePath) => {
  const tempHlsDir = path.join(process.cwd(), "temp_hls", uuidv4());

  try {
    const manifestPath = await transcodeToHls(audioFilePath, tempHlsDir);

    const hlsRemotePath = `songs/hls/${uuidv4()}`;
    await uploadDirectoryToBunny(tempHlsDir, hlsRemotePath);

    const hlsUrl = `https://${process.env.BUNNY_PULL_ZONE_HOSTNAME}/${hlsRemotePath}/master.m3u8`;

    let duration = await getDurationFromHlsManifest(manifestPath);
    if (!duration) {
      const metadata = await mm.parseFile(audioFilePath);
      duration = roundTrackDuration(metadata.format.duration || 0);
    }

    return {
      hlsUrl,
      hlsRemotePath,
      duration,
    };
  } finally {
    await fs
      .rm(tempHlsDir, { recursive: true, force: true })
      .catch((err) =>
        console.error(`Failed to cleanup temp HLS dir ${tempHlsDir}:`, err),
      );
  }
};
