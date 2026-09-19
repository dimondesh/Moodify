// backend/src/controller/admin.controller.js
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import {
  deleteFromBunny,
  getPathFromUrl,
} from "../lib/media/bunny.service.js";
import { processAndUploadSong } from "../lib/media/songUpload.service.js";

import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import axios from "axios";
import { createWriteStream } from "fs";
import { analyzeAudioFeatures } from "../lib/integrations/audioAnalysis.service.js";
import {
  clearUploadInProgress,
  tryAcquireUploadLock,
  uploadBusyError,
} from "../lib/media/activeUploads.service.js";
import { extractCoverAccentHexFromBuffer } from "../lib/media/coverAccent.service.js";
import {
  deleteImageVariants,
  replaceEntityImageVariants,
  toImageFields,
  uploadImageVariantsFromSource,
  getSmallImageUrl
} from "../lib/media/imageVariants.service.js";
import { createQueuedAlbumStubFromSpotify } from "../lib/media/albumStub.service.js";
import {
  cancelAlbumIngest,
  enqueueAlbumIngest,
  getAlbumIngestJobStatus,
} from "../lib/media/albumIngestQueue.service.js";
import { projectEmbeddingsTo2d } from "../lib/embeddings/projectTo2d.js";

// List endpoints must not ship lyrics / beats / embeddings — those dominate payload size.
const ADMIN_SONG_LIST_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount explicit genres moods hlsUrl trackNumber discNumber canvasUrl createdAt updatedAt audioFeatures.bpm audioFeatures.camelot";
const ADMIN_ALBUM_LIST_SELECT =
  "_id title artist images coverAccentHex releaseYear type status ingestJobId spotifyAlbumUrl upload createdAt updatedAt";
const ADMIN_ARTIST_LIST_SELECT =
  "_id name images bio createdAt updatedAt";

export const createSong = async (req, res, next) => {
  if (!req.files || !req.files.audioFile)
    return res.status(400).json({ message: "Audio file is required." });

  if (!tryAcquireUploadLock()) {
    return res.status(409).json({ message: uploadBusyError().message });
  }

  try {
    const {
      title,
      artistIds: artistIdsJsonString,
      albumId,
      releaseYear,
      lyrics,
      genreIds: genreIdsJson,
      moodIds: moodIdsJson,
      explicit: explicitRaw,
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
    let discNumber = 1;
    if (albumId && albumId !== "none") {
      const parsedTrackNumber = req.body.trackNumber
        ? parseInt(req.body.trackNumber, 10)
        : null;
      trackNumber =
        parsedTrackNumber ||
        (await Song.countDocuments({ albumId: finalAlbumId })) + 1;
      const parsedDiscNumber = req.body.discNumber
        ? parseInt(req.body.discNumber, 10)
        : null;
      if (parsedDiscNumber && parsedDiscNumber > 0) {
        discNumber = parsedDiscNumber;
      }
    }

    const song = new Song({
      title,
      artist: artistIds,
      albumId: finalAlbumId,
      trackNumber,
      discNumber,
      explicit: explicitRaw === "true" || explicitRaw === true,
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
      console.log(`[Admin] Audio features saved: ${song.title}`);
    } catch (audioAnalysisError) {
      console.warn(
        `[Admin] Audio analysis failed for ${song.title}:`,
        audioAnalysisError.message,
      );
      // Не прерываем создание песни, если анализ не удался
    }

    res.status(201).json(song);
  } catch (error) {
    console.log("Error in createSong", error);
    next(error);
  } finally {
    clearUploadInProgress();
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
    trackNumber,
    discNumber,
    explicit: explicitRaw,
  } = req.body;
  const audioFile = req.files ? req.files.audioFile : null;
  const imageFile = req.files ? req.files.imageFile : null;
  let acquiredUploadLock = false;

  try {
    if (audioFile) {
      if (!tryAcquireUploadLock()) {
        return res.status(409).json({ message: uploadBusyError().message });
      }
      acquiredUploadLock = true;
    }

    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
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
        console.log(`[Admin] Audio features updated: ${song.title}`);
      } catch (audioAnalysisError) {
        console.warn(
          `[Admin] Audio analysis failed for ${song.title}:`,
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

    const parsedTrackNumber = trackNumber
      ? parseInt(trackNumber, 10)
      : null;
    if (parsedTrackNumber && parsedTrackNumber > 0) {
      song.trackNumber = parsedTrackNumber;
    }
    const parsedDiscNumber = discNumber
      ? parseInt(discNumber, 10)
      : null;
    if (parsedDiscNumber && parsedDiscNumber > 0) {
      song.discNumber = parsedDiscNumber;
    }
    if (explicitRaw !== undefined) {
      song.explicit = explicitRaw === "true" || explicitRaw === true;
    }

    await song.save();
    res.status(200).json(song);
  } catch (error) {
    console.log("Error in updateSong", error);
    next(error);
  } finally {
    if (acquiredUploadLock) {
      clearUploadInProgress();
    }
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

    if (song.instrumentalUrl) {
      const instrPath = getPathFromUrl(song.instrumentalUrl);
      if (instrPath) {
        await deleteFromBunny(instrPath);
        const instrDir = instrPath.replace("/master.m3u8", "");
        await deleteFromBunny(instrDir + "/");
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

    const album = await Album.findById(id).setOptions({ includeQueued: true });
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
    const album = await Album.findById(id).setOptions({ includeQueued: true });

    if (!album) return res.status(404).json({ message: "Album not found." });

    if (album.status === "queued") {
      const result = await cancelAlbumIngest(id);
      if (result.cancelled || result.reason === "not_found") {
        return res.status(200).json({
          message: "Queued album cancelled and deleted successfully",
        });
      }
    }

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

      if (song.instrumentalUrl) {
        const instrPath = getPathFromUrl(song.instrumentalUrl);
        if (instrPath) {
          await deleteFromBunny(instrPath);
          const instrDir = instrPath.replace("/master.m3u8", "");
          await deleteFromBunny(instrDir + "/");
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
    await Album.deleteOne({ _id: id });

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

    const chunk = req.files.chunk;

    // Создаем папку для сборки файла
    const tempDir = path.join(
      process.cwd(),
      "temp",
      "chunks",
      uploadId,
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
    console.log("[Admin] upload-full-album route");

  const { spotifyAlbumUrl, uploadId } = req.body;
  const albumAudioZip = req.files ? req.files.albumAudioZip : null;

  if (!spotifyAlbumUrl) {
    return res
      .status(400)
      .json({ success: false, message: "Spotify URL is required." });
  }

  let zipFilePath;
  if (uploadId) {
    zipFilePath = path.join(
      process.cwd(),
      "temp",
      "chunks",
      uploadId,
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

  let album = null;
  try {
    const stub = await createQueuedAlbumStubFromSpotify(spotifyAlbumUrl);
    album = stub.album;

    const ingestDir = path.join(
      process.cwd(),
      "temp",
      "album-ingest",
      album._id.toString(),
    );
    fsSync.mkdirSync(ingestDir, { recursive: true });
    const stableZipPath = path.join(ingestDir, "album.zip");
    try {
      fsSync.renameSync(zipFilePath, stableZipPath);
    } catch {
      fsSync.copyFileSync(zipFilePath, stableZipPath);
      fsSync.unlinkSync(zipFilePath);
    }

    if (uploadId) {
      await fs
        .rm(path.join(process.cwd(), "temp", "chunks", uploadId), {
          recursive: true,
          force: true,
        })
        .catch(() => {});
    }

    const jobId = await enqueueAlbumIngest({
      albumId: album._id.toString(),
      spotifyAlbumUrl,
      zipPath: stableZipPath,
    });

    const populated = await Album.findById(album._id)
      .populate("artist", "name images")
      .setOptions({ includeQueued: true })
      .lean();

    res.status(202).json({
      success: true,
      jobId,
      album: {
        ...populated,
        imageUrl: getSmallImageUrl(populated.images) || populated.imageUrl,
        songs: [],
      },
      message: "Album queued for ingest from ZIP.",
    });
  } catch (error) {
    if (album?._id) {
      try {
        await cancelAlbumIngest(album._id.toString());
      } catch {
        /* ignore */
      }
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    if (error?.isSpotifyRateLimit || error?.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
        retryAfter: error.retryAfterSec,
      });
    }
    next(error);
  }
};

export const uploadAlbumFromSpotifyUrl = async (req, res, next) => {
  let album = null;
  try {
    const { spotifyAlbumUrl } = req.body;
    if (!spotifyAlbumUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Spotify URL is required." });
    }

    const stub = await createQueuedAlbumStubFromSpotify(spotifyAlbumUrl);
    album = stub.album;

    const jobId = await enqueueAlbumIngest({
      albumId: album._id.toString(),
      spotifyAlbumUrl,
    });

    const populated = await Album.findById(album._id)
      .populate("artist", "name images")
      .setOptions({ includeQueued: true })
      .lean();

    res.status(202).json({
      success: true,
      jobId,
      album: {
        ...populated,
        imageUrl: getSmallImageUrl(populated.images) || populated.imageUrl,
        songs: [],
      },
      message: "Album ingest job queued.",
    });
  } catch (error) {
    if (album?._id) {
      try {
        await cancelAlbumIngest(album._id.toString());
      } catch {
        /* ignore */
      }
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    if (error?.isSpotifyRateLimit || error?.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
        retryAfter: error.retryAfterSec,
      });
    }
    next(error);
  }
};

export const cancelAlbumUpload = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await cancelAlbumIngest(id);
    if (result.reason === "not_found") {
      return res.status(404).json({ success: false, message: "Album not found." });
    }
    if (result.reason === "not_queued") {
      return res.status(400).json({
        success: false,
        message: "Album is not in the upload queue.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Album upload cancelled.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getAlbumUploadJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const status = await getAlbumIngestJobStatus(jobId);
    if (!status) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found." });
    }
    res.status(200).json({ success: true, ...status });
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

    const [songs, totalSongs] = await Promise.all([
      Song.find()
        .select(ADMIN_SONG_LIST_SELECT)
        .populate("artist", "name images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Song.countDocuments().exec(),
    ]);

    const formattedSongs = songs.map(song => ({
      ...song,
      imageUrl: getSmallImageUrl(song.images) || song.imageUrl,
      artist: song.artist ? song.artist.map(a => ({
        ...a,
        imageUrl: getSmallImageUrl(a.images) || a.imageUrl
      })) : []
    }));

    res.status(200).json({
      songs: formattedSongs,
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

    const [albums, totalAlbums] = await Promise.all([
      Album.find()
        .setOptions({ includeQueued: true })
        .select(ADMIN_ALBUM_LIST_SELECT)
        .populate("artist", "name images")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Album.countDocuments().setOptions({ includeQueued: true }).exec(),
    ]);

    // List UI only needs a count — shipping every track doc dominates latency.
    const albumIds = albums.map((album) => album._id);
    const songCounts = albumIds.length
      ? await Song.aggregate([
          { $match: { albumId: { $in: albumIds } } },
          { $group: { _id: "$albumId", count: { $sum: 1 } } },
        ])
      : [];
    const songCountByAlbumId = new Map(
      songCounts.map(({ _id, count }) => [_id.toString(), count]),
    );

    const formattedAlbums = albums.map((album) => ({
      ...album,
      songCount: songCountByAlbumId.get(album._id.toString()) ?? 0,
      songs: [],
      imageUrl: getSmallImageUrl(album.images) || album.imageUrl,
      artist: album.artist
        ? album.artist.map((a) => ({
            ...a,
            imageUrl: getSmallImageUrl(a.images) || a.imageUrl,
          }))
        : [],
    }));

    res.status(200).json({
      albums: formattedAlbums,
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

    const [artists, totalArtists] = await Promise.all([
      Artist.find()
        .select(ADMIN_ARTIST_LIST_SELECT)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Artist.countDocuments().exec(),
    ]);

    const artistIds = artists.map((artist) => artist._id);
    const albumCountByArtist =
      artistIds.length > 0
        ? await Album.aggregate([
            { $match: { artist: { $in: artistIds } } },
            { $unwind: "$artist" },
            { $match: { artist: { $in: artistIds } } },
            { $group: { _id: "$artist", albumCount: { $sum: 1 } } },
          ])
        : [];

    const albumCountMap = new Map(
      albumCountByArtist.map(({ _id, albumCount }) => [
        _id.toString(),
        albumCount,
      ]),
    );

    const formattedArtists = artists.map((artist) => ({
      ...artist,
      imageUrl: getSmallImageUrl(artist.images) || artist.imageUrl,
      albumCount: albumCountMap.get(artist._id.toString()) ?? 0,
    }));

    res.status(200).json({
      artists: formattedArtists,
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

function topPrediction(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return null;
  let best = predictions[0];
  for (const p of predictions) {
    if ((p?.probability ?? 0) > (best?.probability ?? 0)) best = p;
  }
  return best?.name || null;
}

function labelFromRefs(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return null;
  const first = refs[0];
  if (typeof first === "string") return first;
  return first?.name || null;
}

function majorityDim(items, getEmbedding) {
  const counts = new Map();
  for (const item of items) {
    const emb = getEmbedding(item);
    if (!Array.isArray(emb) || emb.length < 2) continue;
    counts.set(emb.length, (counts.get(emb.length) || 0) + 1);
  }
  let bestDim = null;
  let bestCount = 0;
  for (const [dim, count] of counts) {
    if (count > bestCount) {
      bestDim = dim;
      bestCount = count;
    }
  }
  return bestDim;
}

function projectEntityRows(rows, getEmbedding) {
  const dim = majorityDim(rows, getEmbedding);
  if (!dim) {
    return { points: [], dimensions: 0 };
  }

  const usable = rows.filter((row) => getEmbedding(row)?.length === dim);
  const embeddings = usable.map(getEmbedding);
  const projected = projectEmbeddingsTo2d(embeddings);

  const points = usable.map((row, i) => ({
    id: String(row._id),
    title: row._mapTitle || "Unknown",
    x: projected[i].x,
    y: projected[i].y,
    group: row._mapGroup || "Unknown",
    sub: row._mapSub || "Unknown",
  }));

  points.sort((a, b) => a.group.localeCompare(b.group));
  return { points, dimensions: dim };
}

async function loadTrackMapRows() {
  const songs = await Song.find({
    "audioFeatures.embedding.0": { $exists: true },
  })
    .select(
      "title genres moods audioFeatures.embedding audioFeatures.predictedGenres audioFeatures.predictedMoods",
    )
    .populate("genres", "name")
    .populate("moods", "name")
    .lean()
    .exec();

  return songs.map((song) => {
    const af = song.audioFeatures || {};
    return {
      ...song,
      _mapTitle: song.title || "Unknown",
      _mapGroup:
        topPrediction(af.predictedGenres) ||
        labelFromRefs(song.genres) ||
        "Unknown",
      _mapSub:
        topPrediction(af.predictedMoods) ||
        labelFromRefs(song.moods) ||
        "Unknown",
    };
  });
}

async function loadAlbumMapRows() {
  const albums = await Album.find({ "embedding.0": { $exists: true } })
    .select("title type artist embedding")
    .populate("artist", "name")
    .lean()
    .exec();

  return albums.map((album) => ({
    ...album,
    _mapTitle: album.title || "Unknown",
    _mapGroup: album.type || "Album",
    _mapSub: labelFromRefs(album.artist) || "Unknown",
  }));
}

async function loadArtistMapRows() {
  const artists = await Artist.find({ "embedding.0": { $exists: true } })
    .select("name embedding")
    .lean()
    .exec();

  return artists.map((artist) => ({
    ...artist,
    _mapTitle: artist.name || "Unknown",
    _mapGroup: "Artist",
    _mapSub: "Unknown",
  }));
}

async function loadPlaylistMapRows() {
  const playlists = await Playlist.find({ "embedding.0": { $exists: true } })
    .select("title type sourceName embedding")
    .lean()
    .exec();

  return playlists.map((playlist) => ({
    ...playlist,
    _mapTitle: playlist.title || "Unknown",
    _mapGroup: playlist.type || "USER_CREATED",
    _mapSub: playlist.sourceName || "Unknown",
  }));
}

const EMBEDDING_MAP_LOADERS = {
  tracks: {
    load: loadTrackMapRows,
    getEmbedding: (row) => row.audioFeatures?.embedding,
  },
  albums: {
    load: loadAlbumMapRows,
    getEmbedding: (row) => row.embedding,
  },
  artists: {
    load: loadArtistMapRows,
    getEmbedding: (row) => row.embedding,
  },
  playlists: {
    load: loadPlaylistMapRows,
    getEmbedding: (row) => row.embedding,
  },
};

/**
 * PCA→t-SNE map of embeddings (same pipeline as embedding-visual/main.py).
 * GET /api/admin/embeddings/map?entity=tracks|albums|artists|playlists
 */
export const getEmbeddingMap = async (req, res, next) => {
  try {
    const entityRaw = String(req.query.entity || "tracks").toLowerCase();
    const entity = EMBEDDING_MAP_LOADERS[entityRaw] ? entityRaw : "tracks";
    const { load, getEmbedding } = EMBEDDING_MAP_LOADERS[entity];

    const rows = await load();
    const { points, dimensions } = projectEntityRows(rows, getEmbedding);

    res.status(200).json({
      points,
      meta: {
        entity,
        count: points.length,
        dimensions,
        method: "pca+tsne",
      },
    });
  } catch (error) {
    console.error("Error in getEmbeddingMap:", error);
    next(error);
  }
};
