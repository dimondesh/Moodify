import { spawn } from "child_process";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import axios from "axios";
import { getAlbumDataFromSpotify } from "./spotifyService.js";
import {
  buildTrackFilesMap,
  findTrackFiles,
  listFilesRecursive,
  cleanUpTempDir,
} from "../media/zipHandler.js";

const DEEMIX_BITRATE = () => String(process.env.DEEMIX_BITRATE || "128");
const getDeezerArl = () => process.env.DEEZER_ARL;

const ABSOLUTE_DEEMIX_CANDIDATES = [
  () => process.env.DEEMIX_BIN,
];

/** Prefer DEEMIX_BIN if set; otherwise PATH `deemix`. */
const resolveDeemixBin = () => {
  for (const getCandidate of ABSOLUTE_DEEMIX_CANDIDATES) {
    const raw = getCandidate()?.trim();
    if (!raw) continue;
    if (raw.includes("/") || raw.startsWith(".")) {
      if (fsSync.existsSync(raw)) return raw;
      continue;
    }
    return raw;
  }
  return "deemix";
};

class DeemixBinaryMissingError extends Error {
  constructor(bin, cause) {
    super(
      `[Deemix] Failed to start "${bin}": ${cause}. Set DEEMIX_BIN in backend/.env to the absolute path of the deemix CLI.`,
    );
    this.name = "DeemixBinaryMissingError";
    this.isBinaryMissing = true;
  }
}

const runDeemix = (downloadUrl, downloadDir, homeDir) =>
  new Promise((resolve, reject) => {
    const deemixBin = resolveDeemixBin();
    const args = ["-p", downloadDir, "-b", DEEMIX_BITRATE(), downloadUrl];
    console.log(`[Deemix] Using binary: ${deemixBin}`);
    console.log(`[Deemix] Running: ${deemixBin} ${args.join(" ")}`);

    const child = spawn(deemixBin, args, {
      env: { ...process.env, HOME: homeDir },
      cwd: homeDir,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[Deemix] ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(`[Deemix] ${text}`);
    });

    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new DeemixBinaryMissingError(deemixBin, err.message));
        return;
      }
      reject(
        new Error(`[Deemix] Failed to start "${deemixBin}": ${err.message}`),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `[Deemix] Exit code ${code} for ${downloadUrl}. ${stderr.slice(-500)}`,
        ),
      );
    });
  });

const ensureDeemixHome = async (jobRoot) => {
  const configDir = path.join(jobRoot, ".config", "deemix");
  await fs.mkdir(configDir, { recursive: true });

  const arl = getDeezerArl();
  if (!arl) {
    throw new Error("DEEZER_ARL is not set in environment.");
  }
  await fs.writeFile(path.join(configDir, ".arl"), arl.trim(), "utf8");
  return configDir;
};

const getDownloadedAudioMap = async (downloadDir) => {
  if (!fsSync.existsSync(downloadDir)) {
    return { files: [], trackFilesMap: {} };
  }
  const files = await listFilesRecursive(downloadDir);
  return { files, trackFilesMap: buildTrackFilesMap(files) };
};

const missingSpotifyTracks = (spotifyTracks, trackFilesMap) => {
  const missing = [];
  for (const track of spotifyTracks) {
    const files = findTrackFiles(trackFilesMap, track.name);
    if (!files?.audioPath) {
      missing.push(track.name);
    }
  }
  return missing;
};

const searchDeezerAlbumUrl = async (artistName, albumName) => {
  const q = encodeURIComponent(`${artistName} ${albumName}`);
  const { data } = await axios.get(
    `https://api.deezer.com/search/album?q=${q}&limit=5`,
    { timeout: 15000 },
  );
  const albums = data?.data || [];
  if (albums.length === 0) return null;

  const normalize = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
  const wantAlbum = normalize(albumName);
  const wantArtist = normalize(artistName);

  const exact = albums.find(
    (a) =>
      normalize(a.title) === wantAlbum &&
      normalize(a.artist?.name).includes(wantArtist),
  );
  const byTitle = albums.find((a) => normalize(a.title) === wantAlbum);
  const pick = exact || byTitle || albums[0];
  console.log(
    `[Deemix] Deezer album match: "${pick.title}" by ${pick.artist?.name} (id ${pick.id})`,
  );
  return `https://www.deezer.com/album/${pick.id}`;
};

const searchAndDownloadMissingTracks = async (
  spotifyTracks,
  trackFilesMap,
  downloadDir,
  homeDir,
) => {
  const stillMissing = missingSpotifyTracks(spotifyTracks, trackFilesMap);
  for (const trackName of stillMissing) {
    const track = spotifyTracks.find((t) => t.name === trackName);
    const artistName = track?.artists?.[0]?.name || "";
    const q = encodeURIComponent(`${artistName} ${trackName}`);
    const { data } = await axios.get(
      `https://api.deezer.com/search/track?q=${q}&limit=3`,
      { timeout: 15000 },
    );
    const hit = data?.data?.[0];
    if (!hit?.link) {
      console.warn(
        `[Deemix] No Deezer track found for "${artistName} - ${trackName}"`,
      );
      continue;
    }
    console.log(
      `[Deemix] Fallback track download: ${hit.artist?.name} - ${hit.title}`,
    );
    try {
      await runDeemix(hit.link, downloadDir, homeDir);
    } catch (err) {
      if (err?.isBinaryMissing) throw err;
      console.warn(`[Deemix] Track download failed: ${err.message}`);
    }
  }
};

/**
 * Download album audio via deemix into temp/deemix/{jobId}/downloads.
 * Spotify URL is only used for our metadata API — deemix gets Deezer links
 * (avoids deemix Spotify plugin / scary stack traces).
 * @returns {{ downloadDir: string, jobRoot: string, spotifyAlbumData: object }}
 */
export const downloadAlbumWithDeemix = async (spotifyAlbumUrl, jobId) => {
  const jobRoot = path.join(process.cwd(), "temp", "deemix", jobId);
  const downloadDir = path.join(jobRoot, "downloads");

  await cleanUpTempDir(jobRoot);
  await fs.mkdir(downloadDir, { recursive: true });
  await ensureDeemixHome(jobRoot);

  const spotifyAlbumData = await getAlbumDataFromSpotify(spotifyAlbumUrl);
  if (!spotifyAlbumData) {
    throw new Error("Could not get album data from Spotify.");
  }

  const spotifyTracks =
    spotifyAlbumData.tracks?.items || spotifyAlbumData.tracks || [];
  const primaryArtist = spotifyAlbumData.artists?.[0]?.name || "";

  console.log(
    `[Deemix] Expecting ${spotifyTracks.length} tracks for "${spotifyAlbumData.name}" by ${primaryArtist}`,
  );

  let trackFilesMap = {};
  let missing = spotifyTracks.map((t) => t.name);

  // 1) Deezer album by Spotify metadata
  try {
    const deezerAlbumUrl = await searchDeezerAlbumUrl(
      primaryArtist,
      spotifyAlbumData.name,
    );
    if (!deezerAlbumUrl) {
      console.warn(`[Deemix] No Deezer album found for "${primaryArtist} - ${spotifyAlbumData.name}"`);
    } else {
      await runDeemix(deezerAlbumUrl, downloadDir, jobRoot);
      ({ trackFilesMap } = await getDownloadedAudioMap(downloadDir));
      missing = missingSpotifyTracks(spotifyTracks, trackFilesMap);
      console.log(
        `[Deemix] After Deezer album: ${spotifyTracks.length - missing.length}/${spotifyTracks.length} matched` +
          (missing.length ? `; missing: ${missing.join(", ")}` : ""),
      );
    }
  } catch (err) {
    if (err?.isBinaryMissing) {
      await cleanUpTempDir(jobRoot);
      throw err;
    }
    console.warn(`[Deemix] Deezer album download failed: ${err.message}`);
  }

  // 2) Per-track Deezer search for leftovers
  if (missing.length > 0) {
    try {
      await searchAndDownloadMissingTracks(
        spotifyTracks,
        trackFilesMap,
        downloadDir,
        jobRoot,
      );
    } catch (err) {
      if (err?.isBinaryMissing) {
        await cleanUpTempDir(jobRoot);
        throw err;
      }
      throw err;
    }
    ({ trackFilesMap } = await getDownloadedAudioMap(downloadDir));
    missing = missingSpotifyTracks(spotifyTracks, trackFilesMap);
    console.log(
      `[Deemix] After per-track: ${spotifyTracks.length - missing.length}/${spotifyTracks.length} matched` +
        (missing.length ? `; missing: ${missing.join(", ")}` : ""),
    );
  }

  if (missing.length > 0) {
    await cleanUpTempDir(jobRoot);
    throw new Error(
      `Deemix could not download all tracks. Missing: ${missing.join(", ")}`,
    );
  }

  return { downloadDir, jobRoot, spotifyAlbumData };
};

export const cleanupDeemixJob = async (jobRoot) => {
  if (jobRoot) await cleanUpTempDir(jobRoot);
};
