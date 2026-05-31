// backend/src/controller/admin.controller.js
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import {
  uploadToBunny,
  deleteFromBunny,
  getPathFromUrl,
  uploadDirectoryToBunny,
} from "../lib/media/bunny.service.js";
import * as mm from "music-metadata";

import {
  getAlbumDataFromSpotify,
  getArtistDataFromSpotify,
} from "../lib/integrations/spotifyService.js";
import { getLrcLyricsFromLrclib } from "../lib/integrations/lyricsService.js";
import {
  extractZip,
  parseTrackFileName,
  cleanUpTempDir,
} from "../lib/media/zipHandler.js";

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { getBatchTagsFromAI } from "../lib/integrations/ai.service.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { v4 as uuidv4 } from "uuid";
import {
  transcodeToHls,
  getDurationFromHlsManifest,
  roundTrackDuration,
} from "../lib/media/ffmpeg.service.js";
import axios from "axios";
import { createWriteStream } from "fs";
import { analyzeAudioFeatures } from "../lib/integrations/audioAnalysis.service.js";
import {
  enqueueAdminFileJob,
  getAdminFileQueueSnapshot,
} from "../lib/media/adminUploadQueue.service.js";
import {
  touchChunkAssemblyLease,
  releaseChunkAssemblyLease,
  getChunkAssemblyLeaseStats,
  getGlobalLeaseStats,
  sanitizeChunkUploadId,
} from "../lib/media/adminUploadLease.service.js";
import os from "os";
import {
  extractCoverAccentHexFromBuffer,
  isSkippableCoverImageUrl,
} from "../lib/media/coverAccent.service.js";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
} from "../constants/cdn.js";
import {
  deleteImageVariants,
  replaceEntityImageVariants,
  toImageFields,
  uploadImageVariantsFromSource,
} from "../lib/media/imageVariants.service.js";

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

const attachSongsToAlbums = (albums, songs) => {
  const songsByAlbumId = new Map();
  for (const song of songs) {
    if (!song.albumId) continue;
    const albumKey = song.albumId.toString();
    if (!songsByAlbumId.has(albumKey)) {
      songsByAlbumId.set(albumKey, []);
    }
    songsByAlbumId.get(albumKey).push(song);
  }

  return albums.map((album) => ({
    ...album,
    songs: songsByAlbumId.get(album._id.toString()) || [],
  }));
};

const processAndUploadSong = async (audioFilePath) => {
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

export const createSong = async (req, res, next) => {
  if (!req.files || !req.files.audioFile)
    return res.status(400).json({ message: "Audio file is required." });

  try {
    await enqueueAdminFileJob(async () => {
      const {
        title,
        artistIds: artistIdsJsonString,
        albumId,
        releaseYear,
        lyrics,
        genreIds: genreIdsJson,
        moodIds: moodIdsJson,
      } = req.body;

      const { hlsUrl, duration } =
        await processAndUploadSong(req.files.audioFile.tempFilePath);

      let imageFields = {
        imagePublicId: null,
        images: [],
      };
      let finalAlbumId = albumId && albumId !== "none" ? albumId : null;
      const artistIds = JSON.parse(artistIdsJsonString);
      let songCoverAccentHex = null;

      if (!finalAlbumId) {
        if (!req.files.imageFile)
          throw new Error("Image file is required for singles.");

        const coverBuf = await fs.readFile(req.files.imageFile.tempFilePath);
        const coverAccentHex =
          await extractCoverAccentHexFromBuffer(coverBuf);

        const variantUpload = await uploadImageVariantsFromSource(
          req.files.imageFile,
          "albums",
        );
        imageFields = toImageFields(variantUpload);

        const newAlbum = new Album({
          title,
          artist: artistIds,
          ...imageFields,
          releaseYear: releaseYear || new Date().getFullYear(),
          type: "Single",
          coverAccentHex,
        });
        await newAlbum.save();
        finalAlbumId = newAlbum._id;
        songCoverAccentHex = coverAccentHex;
      } else {
        const existingAlbum = await Album.findById(finalAlbumId);
        if (!existingAlbum) throw new Error("Album not found.");
        imageFields = toImageFields(existingAlbum);
        songCoverAccentHex = existingAlbum.coverAccentHex ?? null;
      }

      let trackNumber = 1;
      if (albumId && albumId !== "none") {
        const parsedTrackNumber = req.body.trackNumber
          ? parseInt(req.body.trackNumber, 10)
          : null;
        trackNumber =
          parsedTrackNumber ||
          (await Song.countDocuments({ albumId: finalAlbumId })) + 1;
      }

      const song = new Song({
        title,
        artist: artistIds,
        albumId: finalAlbumId,
        trackNumber,
        ...imageFields,
        coverAccentHex: songCoverAccentHex,
        hlsUrl,
        duration,
        lyrics: lyrics || null,
        genres: genreIdsJson ? JSON.parse(genreIdsJson) : [],
        moods: moodIdsJson ? JSON.parse(moodIdsJson) : [],
      });

      await song.save();

      // Попытка анализа аудио (не блокирующая)
      try {
        const audioFeatures = await analyzeAudioFeatures(
          req.files.audioFile.tempFilePath,
        );
        song.audioFeatures = audioFeatures;
        await song.save();
        console.log(
          `[AdminController] Аудио-характеристики сохранены для песни: ${song.title}`,
        );
      } catch (audioAnalysisError) {
        console.warn(
          `[AdminController] Не удалось проанализировать аудио для песни ${song.title}:`,
          audioAnalysisError.message,
        );
        // Не прерываем создание песни, если анализ не удался
      }

      res.status(201).json(song);
    });
  } catch (error) {
    console.log("Error in createSong", error);
    next(error);
  }
};

// Обновленная функция updateSong
export const updateSong = async (req, res, next) => {

  const { id } = req.params;
  let {
    title,
    artistIds: artistIdsJson,
    albumId,
    lyrics,
    genreIds: genreIdsJson,
    moodIds: moodIdsJson,
  } = req.body;
  const audioFile = req.files ? req.files.audioFile : null;
  const imageFile = req.files ? req.files.imageFile : null;

  const runQueuedUpload = audioFile
    ? (fn) => enqueueAdminFileJob(fn)
    : (fn) => fn();

  try {
    const existingSong = await Song.findById(id);
    if (!existingSong) {
      return res.status(404).json({ message: "Song not found." });
    }

    await runQueuedUpload(async () => {
      const song = await Song.findById(id);
      if (!song) {
        const err = new Error("Song not found.");
        err.statusCode = 404;
        throw err;
      }

      if (artistIdsJson) {
        song.artist = JSON.parse(artistIdsJson);
      }

      if (audioFile) {
        if (song.hlsUrl) {
          const hlsPath = getPathFromUrl(song.hlsUrl);
          if (hlsPath) {
            const hlsDir = path.dirname(hlsPath);
            await deleteFromBunny(hlsDir + "/");
          }
        }
        const { hlsUrl, duration } =
          await processAndUploadSong(audioFile.tempFilePath);
        song.hlsUrl = hlsUrl;
        song.duration = duration;

        try {
          const audioFeatures = await analyzeAudioFeatures(
            audioFile.tempFilePath,
          );
          song.audioFeatures = audioFeatures;
          await song.save();
          console.log(
            `[AdminController] Аудио-характеристики обновлены для песни: ${song.title}`,
          );
        } catch (audioAnalysisError) {
          console.warn(
            `[AdminController] Не удалось проанализировать новое аудио для песни ${song.title}:`,
            audioAnalysisError.message,
          );
        }
      }

      if (imageFile) {
        const coverBuf = await fs.readFile(imageFile.tempFilePath);
        song.coverAccentHex =
          await extractCoverAccentHexFromBuffer(coverBuf);
        await replaceEntityImageVariants(song, imageFile, "songs/images");
      }

      if (albumId !== undefined) {
        const newAlbumId =
          albumId === "none" || albumId === "" ? null : albumId;
        song.albumId = newAlbumId;
      }

      song.title = title || song.title;
      song.lyrics = lyrics !== undefined ? lyrics : song.lyrics;
      if (genreIdsJson) song.genres = JSON.parse(genreIdsJson);
      if (moodIdsJson) song.moods = JSON.parse(moodIdsJson);

      await song.save();
      res.status(200).json(song);
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: "Song not found." });
    }
    console.log("Error in updateSong", error);
    next(error);
  }
};

export const deleteSong = async (req, res, next) => {
  try {
    const { id } = req.params;
    const song = await Song.findById(id);

    if (!song) return res.status(404).json({ message: "Song not found." });

    // Удаляем HLS файлы из Bunny CDN
    if (song.hlsUrl) {
      const hlsPath = getPathFromUrl(song.hlsUrl);
      if (hlsPath) {
        // Удаляем master.m3u8 файл
        await deleteFromBunny(hlsPath);

        // Удаляем директорию HLS (включая все .ts сегменты)
        const hlsDir = hlsPath.replace("/master.m3u8", "");
        await deleteFromBunny(hlsDir + "/");
      }
    }

    if (song.albumId) {
      const album = await Album.findById(song.albumId);
      const songsInAlbum = await Song.countDocuments({ albumId: song.albumId });
      if (album && album.type === "Single" && songsInAlbum <= 1) {
        await deleteImageVariants(album);
        await Album.findByIdAndDelete(album._id);
      } else if (album) {
        const sameCover =
          song.imagePublicId &&
          album.imagePublicId &&
          song.imagePublicId === album.imagePublicId;
        if (!sameCover) {
          await deleteImageVariants(song);
        }
      }
    } else {
      await deleteImageVariants(song);
    }

    await Song.findByIdAndDelete(id);

    res
      .status(200)
      .json({ success: true, message: "Song deleted successfully" });
  } catch (error) {
    console.log("Error in deleteSong", error);
    next(error);
  }
};

export const createAlbum = async (req, res, next) => {
  try {
    if (!req.files || !req.files.imageFile)
      return res.status(400).json({ message: "Image file is required." });

    const {
      title,
      artistIds: artistIdsJsonString,
      releaseYear,
      type = "Album",
    } = req.body;
    const artistIds = JSON.parse(artistIdsJsonString);
    const coverBuf = await fs.readFile(req.files.imageFile.tempFilePath);
    const coverAccentHex = await extractCoverAccentHexFromBuffer(coverBuf);
    const imageUpload = await uploadImageVariantsFromSource(
      req.files.imageFile,
      "albums",
    );

    const album = new Album({
      title,
      artist: artistIds,
      ...toImageFields(imageUpload),
      releaseYear,
      type,
      coverAccentHex,
    });
    await album.save();

    res.status(201).json(album);
  } catch (error) {
    console.error("Error in createAlbum:", error);
    next(error);
  }
};

export const updateAlbum = async (req, res, next) => {
  try {

    const { id } = req.params;
    const {
      title,
      artistIds: artistIdsJsonString,
      releaseYear,
      type,
    } = req.body;
    const imageFile = req.files ? req.files.imageFile : null;

    const album = await Album.findById(id);
    if (!album) {
      return res.status(404).json({ message: "Album not found." });
    }

    let newArtistIds;
    try {
      newArtistIds = artistIdsJsonString ? JSON.parse(artistIdsJsonString) : [];
      if (!Array.isArray(newArtistIds)) {
        newArtistIds = [];
      }
    } catch (e) {
      console.error("Failed to parse artistIds JSON in updateAlbum:", e);
      newArtistIds = [];
    }

    if (newArtistIds.length > 0) {
      const existingArtists = await Artist.find({ _id: { $in: newArtistIds } });
      if (existingArtists.length !== newArtistIds.length) {
        return res
          .status(404)
          .json({ message: "One or more new artists not found." });
      }

      album.artist = newArtistIds;
    } else {
      return res
        .status(400)
        .json({ message: "Album must have at least one artist." });
    }

    if (imageFile) {
      const coverBuf = await fs.readFile(imageFile.tempFilePath);
      album.coverAccentHex = await extractCoverAccentHexFromBuffer(coverBuf);
      await replaceEntityImageVariants(album, imageFile, "albums");
    }

    album.title = title || album.title;
    album.releaseYear =
      releaseYear !== undefined ? releaseYear : album.releaseYear;
    album.type = type || album.type;

    await album.save();

    if (imageFile) {
      await Song.updateMany(
        { albumId: album._id },
        {
          $set: {
            ...toImageFields(album),
            coverAccentHex: album.coverAccentHex ?? null,
          },
        },
      );
    }
    res.status(200).json(album);
  } catch (error) {
    console.error("Error in updateAlbum:", error);
    next(error);
  }
};

export const deleteAlbum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const album = await Album.findById(id);

    if (!album) return res.status(404).json({ message: "Album not found." });

    await deleteImageVariants(album);

    const songsInAlbum = await Song.find({ albumId: id });
    for (const song of songsInAlbum) {
      if (song.hlsUrl) {
        const hlsPath = getPathFromUrl(song.hlsUrl);
        if (hlsPath) {
          await deleteFromBunny(hlsPath);
          const hlsDir = hlsPath.replace("/master.m3u8", "");
          await deleteFromBunny(hlsDir + "/");
        }
      }

      const sameCover =
        song.imagePublicId &&
        album.imagePublicId &&
        song.imagePublicId === album.imagePublicId;
      if (!sameCover) {
        await deleteImageVariants(song);
      }
    }

    // Удаляем все треки из базы данных
    await Song.deleteMany({ albumId: id });
    await Album.findByIdAndDelete(id);

    res
      .status(200)
      .json({ message: "Album and all associated files deleted successfully" });
  } catch (error) {
    console.log("Error in deleteAlbum", error);
    next(error);
  }
};

export const createArtist = async (req, res, next) => {
  try {
    const { name, bio } = req.body;
    if (!name || !req.files?.imageFile)
      return res
        .status(400)
        .json({ message: "Name and image file are required." });

    const imageUpload = await uploadImageVariantsFromSource(
      req.files.imageFile,
      "artists",
    );

    const newArtist = new Artist({
      name,
      bio,
      ...toImageFields(imageUpload),
    });
    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (error) {
    next(error);
  }
};

export const updateArtist = async (req, res, next) => {
  try {

    const { id } = req.params;
    const { name, bio } = req.body;
    const imageFile = req.files?.imageFile;

    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: "Artist not found." });

    if (imageFile) {
      await replaceEntityImageVariants(artist, imageFile, "artists");
    }

    artist.name = name || artist.name;
    artist.bio = bio !== undefined ? bio : artist.bio;

    await artist.save();
    res.status(200).json(artist);
  } catch (error) {
    next(error);
  }
};

export const deleteArtist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: "Artist not found." });

    const mockRes = { status: () => mockRes, json: () => {} };

    // Удаляем все сольные альбомы артиста (включая все треки и их файлы)
    const soloAlbums = await Album.find({
      artist: id,
      "artist.1": { $exists: false },
    });
    for (const album of soloAlbums) {
      await deleteAlbum(
        { params: { id: album._id.toString() }, user: req.user },
        mockRes,
        next,
      );
    }

    // Удаляем все сольные треки артиста (включая все файлы)
    const soloSongs = await Song.find({
      artist: id,
      "artist.1": { $exists: false },
    });
    for (const song of soloSongs) {
      await deleteSong(
        { params: { id: song._id.toString() }, user: req.user },
        mockRes,
        next,
      );
    }

    // Удаляем артиста из совместных альбомов и треков
    await Album.updateMany({ artist: id }, { $pull: { artist: id } });
    await Song.updateMany({ artist: id }, { $pull: { artist: id } });

    await deleteImageVariants(artist);

    await Artist.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Artist and their solo content deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const uploadChunk = async (req, res, next) => {
  try {
    // Если файла нет, express-fileupload выбросит ошибку, так что проверим:
    if (!req.files || !req.files.chunk) {
      return res.status(400).json({ message: "Chunk is missing" });
    }

    const { uploadId, chunkIndex, totalChunks } = req.body;

    if (!uploadId || String(uploadId).trim() === "") {
      return res.status(400).json({ message: "uploadId is required." });
    }

    const safeChunkUploadId = sanitizeChunkUploadId(uploadId);
    if (!safeChunkUploadId) {
      return res.status(400).json({ message: "uploadId invalid after sanitization." });
    }
    touchChunkAssemblyLease(safeChunkUploadId);

    const chunk = req.files.chunk;

    // Создаем папку для сборки файла
    const tempDir = path.join(
      process.cwd(),
      "temp",
      "chunks",
      safeChunkUploadId,
    );
    if (!fsSync.existsSync(tempDir)) {
      fsSync.mkdirSync(tempDir, { recursive: true });
    }

    // Дописываем кусочек в конец общего файла
    const assembledFilePath = path.join(tempDir, "album.zip");
    fsSync.appendFileSync(
      assembledFilePath,
      fsSync.readFileSync(chunk.tempFilePath),
    );

    // Удаляем временный файл чанка от express-fileupload
    fsSync.unlinkSync(chunk.tempFilePath);

    res.status(200).json({
      success: true,
      message: `Chunk ${chunkIndex}/${totalChunks} merged`,
    });
  } catch (error) {
    console.error("Chunk upload error:", error);
    next(error);
  }
};

export const uploadFullAlbumAuto = async (req, res, next) => {
  console.log("🚀 Reached HLS /admin/albums/upload-full-album route");

  const DEFAULT_ARTIST_IMAGE_URL = CDN_DEFAULT_ARTIST_IMAGE;
  const DEFAULT_ALBUM_IMAGE_URL = CDN_DEFAULT_ALBUM_COVER;


  const { spotifyAlbumUrl, uploadId } = req.body;
  const albumAudioZip = req.files ? req.files.albumAudioZip : null;
  const safeChunkUploadId = uploadId
    ? sanitizeChunkUploadId(uploadId)
    : null;

  if (!spotifyAlbumUrl) {
    return res
      .status(400)
      .json({ success: false, message: "Spotify URL is required." });
  }

  let zipFilePath;
  if (uploadId !== undefined && uploadId !== null && String(uploadId).trim()) {
    if (!safeChunkUploadId) {
      return res.status(400).json({
        success: false,
        message: "uploadId invalid after sanitization.",
      });
    }
    zipFilePath = path.join(
      process.cwd(),
      "temp",
      "chunks",
      safeChunkUploadId,
      "album.zip",
    );
    if (!fsSync.existsSync(zipFilePath)) {
      return res
        .status(400)
        .json({ success: false, message: "Assembled ZIP not found." });
    }
  } else if (albumAudioZip) {
    zipFilePath = albumAudioZip.tempFilePath;
  } else {
    return res
      .status(400)
      .json({ success: false, message: "ZIP file or uploadId is required." });
  }

  try {
    await enqueueAdminFileJob(async () => {
      const tempUnzipDir = path.join(
        process.cwd(),
        "temp_unzip_albums",
        `${Date.now()}_${uuidv4()}`,
      );

      const uploadedBunnyPaths = [];
      const newlyCreatedArtistIds = [];
      const createdSongIds = [];
      let album = null;

      try {
        const spotifyAlbumData = await getAlbumDataFromSpotify(spotifyAlbumUrl);
        if (!spotifyAlbumData) {
          throw new Error("Could not get album data from Spotify.");
        }

        const existingAlbum = await Album.findOne({
          title: spotifyAlbumData.name,
        });
        if (existingAlbum) {
          const conflict = new Error(
            `Альбом с названием "${spotifyAlbumData.name}" уже существует.`,
          );
          conflict.statusCode = 409;
          throw conflict;
        }

        const extractedFilePaths = await extractZip(zipFilePath, tempUnzipDir);
    const trackFilesMap = {};
    for (const filePath of extractedFilePaths) {
      const parsed = parseTrackFileName(filePath);
      if (parsed) {
        const normalizedSongName = parsed.songName
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]/gu, "");
        if (!trackFilesMap[normalizedSongName])
          trackFilesMap[normalizedSongName] = {};
        trackFilesMap[normalizedSongName][`${parsed.trackType}Path`] = filePath;
      }
    }

    const tracksToProcess =
      spotifyAlbumData.tracks.items || spotifyAlbumData.tracks;

    const findTrackFiles = (spotifyTrackName) => {
      const normalizedSpotifyName = spotifyTrackName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
      if (trackFilesMap[normalizedSpotifyName]) {
        return trackFilesMap[normalizedSpotifyName];
      }
      for (const fileKey in trackFilesMap) {
        if (
          normalizedSpotifyName.includes(fileKey) ||
          fileKey.includes(normalizedSpotifyName)
        ) {
          console.log(
            `[AdminController] Fuzzy match: Spotify track "${spotifyTrackName}" matched to file key "${fileKey}"`,
          );
          return trackFilesMap[fileKey];
        }
      }
      return null;
    };

    console.log(
      "[AdminController] Performing pre-flight check for all required audio files...",
    );
    for (const spotifyTrack of tracksToProcess) {
      const filesForTrack = findTrackFiles(spotifyTrack.name);
      if (!filesForTrack || !filesForTrack.audioPath) {
        throw new Error(
          `Validation failed: Audio file for track "${spotifyTrack.name}" could not be matched in the ZIP archive.`,
        );
      }
    }
    console.log(
      "[AdminController] Pre-flight check successful. All audio files matched.",
    );

    const albumArtistIds = [];
    for (const spotifyArtist of spotifyAlbumData.artists || []) {
      let artist = await Artist.findOne({ name: spotifyArtist.name });
      if (!artist) {
        const artistDetails = await getArtistDataFromSpotify(spotifyArtist.id);
        const artistImageUrl =
          artistDetails?.images?.[0]?.url || DEFAULT_ARTIST_IMAGE_URL;
        const imageUploadResult = await uploadImageVariantsFromSource(
          artistImageUrl,
          "artists",
        );
        for (const img of imageUploadResult.images) {
          uploadedBunnyPaths.push(getPathFromUrl(img.url));
        }
        artist = new Artist({
          name: spotifyArtist.name,
          ...toImageFields(imageUploadResult),
        });
        await artist.save();
        newlyCreatedArtistIds.push(artist._id);
      }
      albumArtistIds.push(artist._id);
    }

    const albumTypeFromSpotify = spotifyAlbumData.album_type;
    const totalTracks = spotifyAlbumData.total_tracks;
    let albumType;

    if (totalTracks === 1) {
      albumType = "Single";
    } else if (totalTracks >= 2 && totalTracks <= 6) {
      albumType = "EP";
    } else {
      albumType = "Album";
    }

    const albumImageUrl =
      spotifyAlbumData.images?.[0]?.url || DEFAULT_ALBUM_IMAGE_URL;
    let albumCoverAccentHex = null;
    let albumImageUpload;

    if (!isSkippableCoverImageUrl(albumImageUrl)) {
      const imgRes = await axios.get(albumImageUrl, DOWNLOAD_OPTS);
      const imgBuf = Buffer.from(imgRes.data);
      albumCoverAccentHex = await extractCoverAccentHexFromBuffer(imgBuf);
      albumImageUpload = await uploadImageVariantsFromSource(imgBuf, "albums");
    } else {
      albumImageUpload = await uploadImageVariantsFromSource(
        albumImageUrl,
        "albums",
      );
    }
    for (const img of albumImageUpload.images) {
      uploadedBunnyPaths.push(getPathFromUrl(img.url));
    }

    album = new Album({
      title: spotifyAlbumData.name,
      artist: albumArtistIds,
      ...toImageFields(albumImageUpload),
      releaseYear: parseInt(spotifyAlbumData.release_date.split("-")[0]),
      type: albumType,
      coverAccentHex: albumCoverAccentHex,
    });
    await album.save();
    console.log(`[AdminController] Album created in DB: ${album.title}`);

    const primaryAlbumArtistName =
      spotifyAlbumData.artists?.[0]?.name || "Unknown Artist";
    const tracksForAI = tracksToProcess.map((track, index) => {
      const artistName = track.artists?.[0]?.name || primaryAlbumArtistName;
      return {
        tempId: track.id || `track_${index}`,
        artistName: artistName,
        trackName: track.name,
      };
    });

    console.log(
      `[AdminController] Requesting batch AI tags for ${tracksForAI.length} tracks...`,
    );
    const batchTags = await getBatchTagsFromAI(tracksForAI);
    console.log(`[AdminController] Received batch AI tags.`);

    const createdSongs = [];
    let trackIndex = 0;

    for (const spotifyTrack of tracksToProcess) {
      const songName = spotifyTrack.name;
      const trackTempId = spotifyTrack.id || `track_${trackIndex}`;
      trackIndex++;

      console.log(`[AdminController] Processing track: ${songName}`);
      const filesForTrack = findTrackFiles(songName);

      // Проверяем, что файл все еще существует
      if (!filesForTrack || !filesForTrack.audioPath) {
        console.error(
          `[AdminController] Файл для трека "${songName}" не найден`,
        );
        continue;
      }

      try {
        const { hlsUrl, hlsRemotePath, duration } =
          await processAndUploadSong(filesForTrack.audioPath);
        uploadedBunnyPaths.push(hlsRemotePath + "/");

        const songArtistIds = [];
        for (const spotifyTrackArtist of spotifyTrack.artists || []) {
          let artist = await Artist.findOne({ name: spotifyTrackArtist.name });
          if (!artist) {
            const artistDetails = await getArtistDataFromSpotify(
              spotifyTrackArtist.id,
            );
            const artistImageUrl =
              artistDetails?.images?.[0]?.url || DEFAULT_ARTIST_IMAGE_URL;
            const imageUploadResult = await uploadImageVariantsFromSource(
              artistImageUrl,
              "artists",
            );
            for (const img of imageUploadResult.images) {
              uploadedBunnyPaths.push(getPathFromUrl(img.url));
            }
            artist = new Artist({
              name: spotifyTrackArtist.name,
              ...toImageFields(imageUploadResult),
            });
            await artist.save();
            newlyCreatedArtistIds.push(artist._id);
          }
          songArtistIds.push(artist._id);
        }

        const primaryArtistName = (await Artist.findById(songArtistIds[0]))
          .name;

        const aiTags = batchTags[trackTempId] || { genreIds: [], moodIds: [] };
        const { genreIds, moodIds } = aiTags;

        let lrcText = "";
        if (filesForTrack.lrcPath) {
          try {
            lrcText = await fs.readFile(filesForTrack.lrcPath, "utf8");
          } catch (readError) {
            console.error(`Error reading LRC file for ${songName}:`, readError);
          }
        }
        if (!lrcText) {
          lrcText = await getLrcLyricsFromLrclib({
            artistName: primaryArtistName,
            songName,
            albumName: album.title,
            songDuration: duration * 1000,
          });
        }

        const song = new Song({
          title: songName,
          artist: songArtistIds,
          albumId: album._id,
          trackNumber: spotifyTrack.track_number || trackIndex,
          hlsUrl,
          lyrics: lrcText || "",
          duration,
          ...toImageFields(album),
          coverAccentHex: albumCoverAccentHex,
          genres: genreIds,
          moods: moodIds,
        });

        await song.save();
        createdSongIds.push(song._id);
        createdSongs.push(song);

        // Попытка анализа аудио (не блокирующая)
        try {
          const audioFeatures = await analyzeAudioFeatures(
            filesForTrack.audioPath,
          );
          song.audioFeatures = audioFeatures;
          await song.save();
          console.log(
            `[AdminController] Аудио-характеристики сохранены для песни: ${song.title}`,
          );
        } catch (audioAnalysisError) {
          console.warn(
            `[AdminController] Не удалось проанализировать аудио для песни ${song.title}:`,
            audioAnalysisError.message,
          );
          // Не прерываем создание песни, если анализ не удался
        }
      } catch (trackError) {
        console.error(
          `[AdminController] Ошибка обработки трека "${songName}":`,
          trackError,
        );
        // Продолжаем обработку остальных треков
      }
    }

    res.status(200).json({
      success: true,
      message: `Album "${album.title}" (${album.type}) and ${createdSongs.length} tracks added successfully!`,
      album,
      songs: createdSongs.map((s) => ({ title: s.title, id: s._id })),
    });
  } catch (error) {
    if (error.statusCode === 409) {
      throw error;
    }

    console.error(
      "[AdminController] Critical error occurred. Starting rollback...",
      error,
    );

    await Promise.allSettled(
      uploadedBunnyPaths.map((bunnyPath) => {
        if (!bunnyPath) return Promise.resolve();
        if (bunnyPath.endsWith("/")) {
          return deleteFromBunny(bunnyPath);
        }
        return deleteFromBunny(bunnyPath);
      }),
    );

    if (createdSongIds.length > 0) {
      await Song.deleteMany({ _id: { $in: createdSongIds } });
    }
    if (album) {
      await Album.findByIdAndDelete(album._id);
    }
    if (newlyCreatedArtistIds.length > 0) {
      await Artist.deleteMany({ _id: { $in: newlyCreatedArtistIds } });
    }

    throw error;
  } finally {
      if (safeChunkUploadId) {
        releaseChunkAssemblyLease(safeChunkUploadId);
      }
      await cleanUpTempDir(tempUnzipDir);
      if (safeChunkUploadId) {
        await fs
          .rm(
            path.join(process.cwd(), "temp", "chunks", safeChunkUploadId),
            {
              recursive: true,
              force: true,
            },
          )
          .catch(() => {});
      }
    }
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getAdminUploadQueueStatus = async (req, res, next) => {
  try {
    res.status(200).json({
      fileJobQueue: getAdminFileQueueSnapshot(),
      globalLease: getGlobalLeaseStats(),
      chunkedZipSessions: getChunkAssemblyLeaseStats(),
    });
  } catch (error) {
    next(error);
  }
};

export const getGenres = async (req, res, next) => {
  try {
    const genres = await Genre.find().sort({ name: 1 });
    res.status(200).json(genres);
  } catch (error) {
    next(error);
  }
};

export const getMoods = async (req, res, next) => {
  try {
    const moods = await Mood.find().sort({ name: 1 });
    res.status(200).json(moods);
  } catch (error) {
    next(error);
  }
};

export const getPaginatedSongs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const songsQuery = Song.find()
      .populate("artist", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalSongsQuery = Song.countDocuments();

    const [songs, totalSongs] = await Promise.all([
      songsQuery.exec(),
      totalSongsQuery.exec(),
    ]);

    res.status(200).json({
      songs,
      totalPages: Math.ceil(totalSongs / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in getPaginatedSongs:", error);
    next(error);
  }
};

export const getPaginatedAlbums = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const albumsQuery = Album.find()
      .populate("artist", "name images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalAlbumsQuery = Album.countDocuments();

    const [albums, totalAlbums] = await Promise.all([
      albumsQuery.exec(),
      totalAlbumsQuery.exec(),
    ]);

    const albumIds = albums.map((album) => album._id);
    const songs = albumIds.length
      ? await Song.find({ albumId: { $in: albumIds } })
          .sort({ trackNumber: 1, createdAt: 1 })
          .lean()
      : [];

    res.status(200).json({
      albums: attachSongsToAlbums(albums, songs),
      totalPages: Math.ceil(totalAlbums / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in getPaginatedAlbums:", error);
    next(error);
  }
};

export const getPaginatedArtists = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const artistsQuery = Artist.find()
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const totalArtistsQuery = Artist.countDocuments();

    const [artists, totalArtists] = await Promise.all([
      artistsQuery.exec(),
      totalArtistsQuery.exec(),
    ]);

    res.status(200).json({
      artists,
      totalPages: Math.ceil(totalArtists / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error in getPaginatedArtists:", error);
    next(error);
  }
};

export const analyzeSongAudio = async (req, res, next) => {
  try {
    const { songId } = req.params;

    if (!songId) {
      return res.status(400).json({ message: "Song ID is required." });
    }

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }

    // Проверяем, есть ли уже аудио-характеристики
    if (song.audioFeatures && song.audioFeatures.bpm !== null) {
      return res.status(200).json({
        message: "Audio features already analyzed for this song.",
        audioFeatures: song.audioFeatures,
      });
    }

    // Получаем аудио файл из Bunny CDN
    const audioUrl = song.hlsUrl.replace("/master.m3u8", "");
    const audioFilePath = path.join(
      process.cwd(),
      "temp",
      `temp_audio_${songId}.mp3`,
    );

    try {
      // Скачиваем аудио файл
      const response = await axios.get(audioUrl, { responseType: "stream" });
      const writer = createWriteStream(audioFilePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Анализируем аудио
      const audioFeatures = await analyzeAudioFeatures(audioFilePath);
      song.audioFeatures = audioFeatures;
      await song.save();

      // Удаляем временный файл
      await fs
        .unlink(audioFilePath)
        .catch((err) => console.error("Error deleting temp audio file:", err));

      res.status(200).json({
        message: "Audio analysis completed successfully.",
        audioFeatures: song.audioFeatures,
      });
    } catch (downloadError) {
      console.error("Error downloading audio file:", downloadError);
      return res.status(500).json({
        message: "Failed to download audio file for analysis.",
      });
    } finally {
      // Удаляем временный файл в любом случае
      await fs
        .unlink(audioFilePath)
        .catch((err) => console.error("Error deleting temp audio file:", err));
    }
  } catch (error) {
    console.error("Error in analyzeSongAudio:", error);
    next(error);
  }
};

export const getSongAudioFeatures = async (req, res, next) => {
  try {
    const { songId } = req.params;

    if (!songId) {
      return res.status(400).json({ message: "Song ID is required." });
    }

    const song = await Song.findById(songId).select("title audioFeatures");
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }

    res.status(200).json({
      songId: song._id,
      title: song.title,
      audioFeatures: song.audioFeatures || null,
    });
  } catch (error) {
    console.error("Error in getSongAudioFeatures:", error);
    next(error);
  }
};
export const testAudioAnalysis = async (req, res, next) => {
  try {
    if (!req.files || !req.files.audioFile) {
      return res
        .status(400)
        .json({ message: "Audio file is required for testing." });
    }

    const audioFile = req.files.audioFile;
    const ANALYSIS_SERVICE_URL =
      process.env.ANALYSIS_SERVICE_URL || "http://127.0.0.1:5001";

    const fileBuffer = fsSync.readFileSync(audioFile.tempFilePath);
    const fileBlob = new Blob([fileBuffer], {
      type: audioFile.mimetype || "audio/mpeg",
    });

    const formData = new FormData();
    formData.append("file", fileBlob, audioFile.name);

    const response = await axios.post(
      `${ANALYSIS_SERVICE_URL}/analyze`,
      formData,
      {
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Analysis test error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to analyze audio",
      error: error.response?.data || error.message,
    });
  }
};

export const testEmbeddingExtraction = async (req, res) => {
  try {
    if (!req.files || !req.files.audioFile) {
      return res.status(400).json({ message: "Audio file is required." });
    }

    const audioFile = req.files.audioFile;
    const EMBEDDING_SERVICE_URL =
      process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:5006";

    const fileBuffer = fsSync.readFileSync(audioFile.tempFilePath);
    const fileBlob = new Blob([fileBuffer], {
      type: audioFile.mimetype || "audio/mpeg",
    });

    const formData = new FormData();
    formData.append("file", fileBlob, audioFile.name);

    const response = await axios.post(
      `${EMBEDDING_SERVICE_URL}/embed`,
      formData,
      {
        timeout: 300000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      },
    );

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Embedding test error:", error.message);
    res.status(500).json({
      success: false,
      message: "Embedding service error",
      error: error.response?.data || error.message,
    });
  }
};
