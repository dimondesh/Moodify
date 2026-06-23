/**
 * Jamendo Creative Commons catalog import (album-first, mirrors uploadFullAlbumAuto).
 *
 * Requires: JAMENDO_CLIENT_ID, MONGO_URI, Bunny + FFmpeg env vars.
 *
 * Usage:
 *   SKIP_EMBEDDING_HOOKS=true npm run import:jamendo -- --target 150 --resume
 *   npm run import:jamendo -- --target 5 --dry-run
 *
 * --target = number of full albums to import (not tracks). Default 150 (~1000 tracks).
 *
 * Post-import:
 *   npm run generate:missing-embeddings
 *   npm run pipeline:embeddings
 *   npm run generate:all
 */
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";
import { deleteFromBunny, getPathFromUrl } from "../../lib/media/bunny.service.js";
import { processAndUploadSong } from "../../lib/media/songUpload.service.js";
import {
  extractZip,
  buildTrackFilesMap,
  findTrackFiles,
  cleanUpTempDir,
} from "../../lib/media/zipHandler.js";
import {
  extractCoverAccentHexFromBuffer,
  isSkippableCoverImageUrl,
} from "../../lib/media/coverAccent.service.js";
import {
  toImageFields,
  uploadImageVariantsFromSource,
} from "../../lib/media/imageVariants.service.js";
import { analyzeAudioFeatures } from "../../lib/integrations/audioAnalysis.service.js";
import {
  fetchAlbumById,
  fetchAlbumTracks,
  fetchArtistById,
  fetchTracksByTag,
  buildAlbumSummariesFromTracks,
  validateFullAlbum,
  hasValidAlbumCover,
  downloadAlbumZip,
  downloadTrackAudio,
  resolveAlbumType,
  parseReleaseYear,
} from "../../lib/integrations/jamendo.service.js";
import { CDN_DEFAULT_ARTIST_IMAGE } from "../../constants/cdn.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const CHECKPOINT_PATH = path.resolve(
  __dirname,
  "../../../temp/jamendo-import-checkpoint.json",
);

const GENRE_TAGS = [
  "rock",
  "pop",
  "electronic",
  "jazz",
  "classical",
  "hiphop",
  "metal",
  "folk",
  "blues",
  "reggae",
  "ambient",
  "soundtrack",
  "latin",
  "funk",
  "soul",
  "punk",
  "country",
  "techno",
  "house",
  "indie",
  "world",
  "experimental",
  "acoustic",
  "rnb",
  "dance",
];

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    targetAlbums: 150,
    resume: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (
      (args[i] === "--target" || args[i] === "--albums") &&
      args[i + 1]
    ) {
      options.targetAlbums = parseInt(args[i + 1], 10) || 150;
      i++;
    } else if (args[i] === "--resume") {
      options.resume = true;
    } else if (args[i] === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
};

const normalizeCheckpoint = (checkpoint) => {
  if (!checkpoint.skippedAlbumIds) checkpoint.skippedAlbumIds = [];
  if (!checkpoint.importedAlbumIds) checkpoint.importedAlbumIds = [];
  if (!checkpoint.completedAlbumIds) {
    checkpoint.completedAlbumIds = [...checkpoint.importedAlbumIds];
  }
  if (!checkpoint.genreOffsets) {
    checkpoint.genreOffsets = initGenreOffsets();
    if (checkpoint.lastGenre && checkpoint.lastOffset != null) {
      checkpoint.genreOffsets[checkpoint.lastGenre] = checkpoint.lastOffset;
    }
  }
  for (const tag of GENRE_TAGS) {
    if (checkpoint.genreOffsets[tag] == null) {
      checkpoint.genreOffsets[tag] = 0;
    }
  }
  checkpoint.importedAlbumCount = checkpoint.completedAlbumIds.length;
  checkpoint.importedTrackCount = checkpoint.importedTrackCount || 0;
  return checkpoint;
};

const albumGoalReached = (checkpoint, targetAlbums) =>
  checkpoint.completedAlbumIds.length >= targetAlbums;

const shuffleArray = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const initGenreOffsets = () =>
  Object.fromEntries(GENRE_TAGS.map((tag) => [tag, 0]));

const pickRandomGenre = (genreOffsets) => {
  const available = GENRE_TAGS.filter((tag) => genreOffsets[tag] !== -1);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
};

const loadCheckpoint = async () => {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      importedAlbumIds: [],
      completedAlbumIds: [],
      skippedAlbumIds: [],
      importedAlbumCount: 0,
      importedTrackCount: 0,
      genreOffsets: initGenreOffsets(),
    };
  }
};

const saveCheckpoint = async (checkpoint) => {
  await fs.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
};

const findOrCreateTag = async (model, name) => {
  const cleanedName = String(name).trim();
  if (!cleanedName) return null;
  let entity = await model.findOne({
    name: { $regex: `^${cleanedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (!entity) {
    entity = await new model({ name: cleanedName }).save();
  }
  return entity._id;
};

const mapJamendoTags = async (musicinfo) => {
  const genreIds = [];
  const moodIds = [];
  const genres = musicinfo?.tags?.genres || [];
  const vartags = musicinfo?.tags?.vartags || [];

  for (const genreName of genres) {
    const id = await findOrCreateTag(Genre, genreName);
    if (id) genreIds.push(id);
  }
  for (const moodName of vartags) {
    const id = await findOrCreateTag(Mood, moodName);
    if (id) moodIds.push(id);
  }

  return { genreIds, moodIds };
};

const isAlbumAlreadyHandled = async (jamendoAlbumId, checkpoint) => {
  const id = String(jamendoAlbumId);
  if (checkpoint.completedAlbumIds?.includes(id)) return true;
  if (checkpoint.skippedAlbumIds?.includes(id)) return true;
  const existing = await Album.findOne({
    sourceProvider: "jamendo",
    sourceExternalId: id,
  }).select("_id");
  return Boolean(existing);
};

const markAlbumCompleted = (checkpoint, jamendoAlbumId, { dryRun, trackCount }) => {
  const id = String(jamendoAlbumId);
  if (!checkpoint.completedAlbumIds.includes(id)) {
    checkpoint.completedAlbumIds.push(id);
  }
  if (!dryRun && !checkpoint.importedAlbumIds.includes(id)) {
    checkpoint.importedAlbumIds.push(id);
  }
  checkpoint.importedAlbumCount = checkpoint.completedAlbumIds.length;
  checkpoint.importedTrackCount += trackCount;
};

const markAlbumSkipped = async (checkpoint, jamendoAlbumId) => {
  if (!checkpoint.skippedAlbumIds) checkpoint.skippedAlbumIds = [];
  const id = String(jamendoAlbumId);
  if (!checkpoint.skippedAlbumIds.includes(id)) {
    checkpoint.skippedAlbumIds.push(id);
  }
};

const prepareAudioFiles = async (albumMeta, tracks, tempBaseDir) => {
  const zipUrl = albumMeta?.zip;
  const tempUnzipDir = path.join(tempBaseDir, "unzipped");
  const zipPath = path.join(tempBaseDir, "album.zip");

  if (zipUrl) {
    try {
      await downloadAlbumZip(zipUrl, zipPath);
      const extracted = await extractZip(zipPath, tempUnzipDir);
      const trackFilesMap = buildTrackFilesMap(extracted);
      const matched = {};
      for (const track of tracks) {
        const files = findTrackFiles(trackFilesMap, track.name);
        if (!files?.audioPath) {
          return { ok: false, reason: `zip_match_failed:${track.name}` };
        }
        matched[track.id] = files.audioPath;
      }
      return { ok: true, matched, cleanupDir: tempBaseDir };
    } catch (zipError) {
      console.warn(
        `[JamendoImport] ZIP download failed for album ${albumMeta.id}, falling back to per-track download:`,
        zipError.message,
      );
    }
  }

  const perTrackDir = path.join(tempBaseDir, "tracks");
  await fs.mkdir(perTrackDir, { recursive: true });
  const matched = {};

  for (const track of tracks) {
    const destPath = path.join(perTrackDir, `${track.position}_${track.id}.mp3`);
    try {
      await downloadTrackAudio(track.audiodownload, destPath);
      matched[track.id] = destPath;
    } catch (err) {
      return { ok: false, reason: `track_download_failed:${track.name}` };
    }
  }

  return { ok: true, matched, cleanupDir: tempBaseDir };
};

const rollbackAlbumImport = async ({
  uploadedBunnyPaths,
  createdSongIds,
  album,
  newlyCreatedArtistIds,
}) => {
  await Promise.allSettled(
    uploadedBunnyPaths.map((bunnyPath) => {
      if (!bunnyPath) return Promise.resolve();
      return deleteFromBunny(bunnyPath);
    }),
  );

  if (createdSongIds.length > 0) {
    await Song.deleteMany({ _id: { $in: createdSongIds } });
  }
  if (album?._id) {
    await Album.findByIdAndDelete(album._id);
  }
  if (newlyCreatedArtistIds.length > 0) {
    await Artist.deleteMany({ _id: { $in: newlyCreatedArtistIds } });
  }
};

const importJamendoAlbum = async ({
  albumSummary,
  dryRun,
}) => {
  const jamendoAlbumId = String(albumSummary.id);
  const albumMeta =
    albumSummary.zip != null
      ? albumSummary
      : (await fetchAlbumById(jamendoAlbumId)) || albumSummary;

  if (!hasValidAlbumCover(albumMeta)) {
    return { status: "skipped", reason: "no_album_cover" };
  }
  if (isSkippableCoverImageUrl(albumMeta.image)) {
    return { status: "skipped", reason: "skippable_album_cover" };
  }

  const rawTracks = await fetchAlbumTracks(jamendoAlbumId);
  const validation = validateFullAlbum(rawTracks);
  if (!validation.ok) {
    return { status: "skipped", reason: validation.reason, detail: validation };
  }

  const tracks = validation.tracks;
  const artistId = String(
    albumMeta.artist_id || tracks[0]?.artist_id || "",
  );
  const artistName =
    albumMeta.artist_name || tracks[0]?.artist_name || "Unknown Artist";

  if (dryRun) {
    return {
      status: "dry_run",
      albumTitle: albumMeta.name,
      trackCount: tracks.length,
      artistName,
    };
  }

  const tempBaseDir = path.join(
    process.cwd(),
    "temp_jamendo_import",
    `${Date.now()}_${uuidv4()}`,
  );
  await fs.mkdir(tempBaseDir, { recursive: true });

  const audioPrep = await prepareAudioFiles(albumMeta, tracks, tempBaseDir);
  if (!audioPrep.ok) {
    await cleanUpTempDir(tempBaseDir);
    return { status: "skipped", reason: audioPrep.reason };
  }

  const uploadedBunnyPaths = [];
  const newlyCreatedArtistIds = [];
  const createdSongIds = [];
  let album = null;

  try {
    let artist = await Artist.findOne({
      sourceProvider: "jamendo",
      sourceExternalId: artistId,
    });
    if (!artist) {
      artist = await Artist.findOne({ name: artistName });
    }

    if (!artist) {
      const artistDetails = artistId ? await fetchArtistById(artistId) : null;
      const artistImageUrl =
        artistDetails?.image || CDN_DEFAULT_ARTIST_IMAGE;
      const imageUploadResult = await uploadImageVariantsFromSource(
        artistImageUrl,
        "artists",
      );
      for (const img of imageUploadResult.images) {
        uploadedBunnyPaths.push(getPathFromUrl(img.url));
      }
      artist = new Artist({
        name: artistName,
        sourceProvider: "jamendo",
        sourceExternalId: artistId || null,
        ...toImageFields(imageUploadResult),
      });
      await artist.save();
      newlyCreatedArtistIds.push(artist._id);
    } else if (!artist.sourceExternalId && artistId) {
      artist.sourceProvider = "jamendo";
      artist.sourceExternalId = artistId;
      await artist.save();
    }

    const albumImageUrl = albumMeta.image;
    let albumCoverAccentHex = null;
    let albumImageUpload;

    if (!isSkippableCoverImageUrl(albumImageUrl)) {
      const imgRes = await axios.get(albumImageUrl, DOWNLOAD_OPTS);
      const imgBuf = Buffer.from(imgRes.data);
      albumCoverAccentHex = await extractCoverAccentHexFromBuffer(imgBuf);
      albumImageUpload = await uploadImageVariantsFromSource(imgBuf, "albums");
    } else {
      return { status: "skipped", reason: "skippable_album_cover" };
    }

    for (const img of albumImageUpload.images) {
      uploadedBunnyPaths.push(getPathFromUrl(img.url));
    }

    album = new Album({
      title: albumMeta.name,
      artist: [artist._id],
      ...toImageFields(albumImageUpload),
      releaseYear: parseReleaseYear(albumMeta.releasedate),
      type: resolveAlbumType(tracks.length),
      coverAccentHex: albumCoverAccentHex,
      sourceProvider: "jamendo",
      sourceExternalId: jamendoAlbumId,
    });
    await album.save();

    for (const track of tracks) {
      const audioPath = audioPrep.matched[track.id];
      const { hlsUrl, hlsRemotePath, duration } =
        await processAndUploadSong(audioPath);
      uploadedBunnyPaths.push(`${hlsRemotePath}/`);

      const { genreIds, moodIds } = await mapJamendoTags(track.musicinfo);

      const song = new Song({
        title: track.name,
        artist: [artist._id],
        albumId: album._id,
        trackNumber: track.position,
        hlsUrl,
        duration,
        lyrics: track.lyrics || "",
        ...toImageFields(album),
        coverAccentHex: albumCoverAccentHex,
        genres: genreIds,
        moods: moodIds,
        sourceProvider: "jamendo",
        sourceExternalId: String(track.id),
        sourceShareUrl: track.shareurl || null,
        licenseCcUrl: track.license_ccurl || null,
      });

      await song.save();
      createdSongIds.push(song._id);

      try {
        const audioFeatures = await analyzeAudioFeatures(audioPath);
        song.audioFeatures = audioFeatures;
        await song.save();
      } catch (analysisError) {
        console.warn(
          `[JamendoImport] Audio analysis skipped for "${track.name}":`,
          analysisError.message,
        );
      }
    }

    await cleanUpTempDir(audioPrep.cleanupDir);

    return {
      status: "imported",
      albumTitle: album.title,
      trackCount: tracks.length,
      albumId: album._id,
    };
  } catch (error) {
    console.error(
      `[JamendoImport] Failed album "${albumMeta.name}", rolling back:`,
      error.message,
    );
    await rollbackAlbumImport({
      uploadedBunnyPaths,
      createdSongIds,
      album,
      newlyCreatedArtistIds,
    });
    await cleanUpTempDir(tempBaseDir);
    return { status: "error", reason: error.message };
  }
};

const run = async () => {
  const options = parseArgs();

  if (!MONGO_URL) {
    console.error("MONGO_URI / MONGODB_URI is required");
    process.exit(1);
  }
  if (!process.env.JAMENDO_CLIENT_ID) {
    console.error("JAMENDO_CLIENT_ID is required");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB");

  const checkpoint = normalizeCheckpoint(
    options.resume
      ? await loadCheckpoint()
      : {
          importedAlbumIds: [],
          completedAlbumIds: [],
          skippedAlbumIds: [],
          importedAlbumCount: 0,
          importedTrackCount: 0,
          genreOffsets: initGenreOffsets(),
        },
  );

  const pageSize = 200;
  const maxIdleRounds = GENRE_TAGS.length * 4;
  let idleRounds = 0;

  console.log(
    `Starting Jamendo import (targetAlbums=${options.targetAlbums}, resume=${options.resume}, dryRun=${options.dryRun}, randomGenres=true)`,
  );
  console.log(
    `Already completed: ${checkpoint.completedAlbumIds.length} albums (${checkpoint.importedTrackCount} tracks)`,
  );

  while (!albumGoalReached(checkpoint, options.targetAlbums)) {
    const genre = pickRandomGenre(checkpoint.genreOffsets);
    if (!genre) {
      console.warn("[JamendoImport] All genre queues exhausted.");
      break;
    }

    const offset = checkpoint.genreOffsets[genre];
    let tracks;
    try {
      tracks = await fetchTracksByTag({
        tag: genre,
        offset,
        limit: pageSize,
        order: "popularity_total",
      });
    } catch (error) {
      console.error(
        `[JamendoImport] Failed to fetch tracks for genre "${genre}" at offset ${offset}:`,
        error.message,
      );
      await saveCheckpoint(checkpoint);
      idleRounds++;
      if (idleRounds >= maxIdleRounds) break;
      continue;
    }

    checkpoint.genreOffsets[genre] = offset + pageSize;

    if (!tracks.length) {
      checkpoint.genreOffsets[genre] = -1;
      await saveCheckpoint(checkpoint);
      idleRounds++;
      if (idleRounds >= maxIdleRounds) break;
      continue;
    }

    const albumSummaries = shuffleArray(buildAlbumSummariesFromTracks(tracks));
    if (!albumSummaries.length) {
      idleRounds++;
      await saveCheckpoint(checkpoint);
      if (idleRounds >= maxIdleRounds) break;
      continue;
    }

    let progressed = false;

    for (const albumSummary of shuffleArray(albumSummaries)) {
      if (albumGoalReached(checkpoint, options.targetAlbums)) break;

      const jamendoAlbumId = String(albumSummary.id);
      if (await isAlbumAlreadyHandled(jamendoAlbumId, checkpoint)) {
        continue;
      }
      if (!hasValidAlbumCover(albumSummary)) {
        await markAlbumSkipped(checkpoint, jamendoAlbumId);
        continue;
      }

      console.log(
        `[JamendoImport] Processing album "${albumSummary.name}" (${jamendoAlbumId}) [${genre}]`,
      );

      let result;
      try {
        result = await importJamendoAlbum({
          albumSummary,
          dryRun: options.dryRun,
        });
      } catch (error) {
        console.error(
          `[JamendoImport] Error on album "${albumSummary.name}":`,
          error.message,
        );
        await saveCheckpoint(checkpoint);
        continue;
      }

      if (result.status === "imported" || result.status === "dry_run") {
        const trackCount = result.trackCount || 0;
        markAlbumCompleted(checkpoint, jamendoAlbumId, {
          dryRun: options.dryRun,
          trackCount,
        });
        await saveCheckpoint(checkpoint);
        const label = result.status === "dry_run" ? "dry-run" : "imported";
        console.log(
          `  ✓ ${label}: "${result.albumTitle}" (${trackCount} tracks) — albums ${checkpoint.completedAlbumIds.length}/${options.targetAlbums}, tracks ${checkpoint.importedTrackCount}`,
        );
        progressed = true;
        idleRounds = 0;
        break;
      }

      await markAlbumSkipped(checkpoint, jamendoAlbumId);
      const detail = result.detail
        ? `${result.reason} (${result.detail.blockReason || ""} ${result.detail.trackName || ""})`
        : result.reason;
      console.log(`  ⊘ skipped: ${detail}`);
    }

    if (!progressed) {
      idleRounds++;
    }

    await saveCheckpoint(checkpoint);

    if (idleRounds >= maxIdleRounds) {
      console.warn(
        "[JamendoImport] Stopping early: too many rounds without a successful album.",
      );
      break;
    }
  }

  console.log("\n=== Jamendo import finished ===");
  console.log(`Albums completed: ${checkpoint.completedAlbumIds.length}`);
  console.log(`Tracks total: ${checkpoint.importedTrackCount}`);
  if (!options.dryRun && checkpoint.completedAlbumIds.length > 0) {
    console.log("\nPost-import commands:");
    console.log("  npm run generate:missing-embeddings");
    console.log("  npm run pipeline:embeddings");
    console.log("  npm run generate:all");
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Fatal import error:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
