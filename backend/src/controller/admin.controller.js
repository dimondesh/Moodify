// backend/src/controller/admin.controller.js
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import {
  uploadToBunny,
  deleteFromBunny,
  getPathFromUrl,
  uploadDirectoryToBunny,
} from "../lib/bunny.service.js";
import * as mm from "music-metadata";
import { getTagsFromAI } from "../lib/ai.service.js";

import {
  getAlbumDataFromSpotify,
  getArtistDataFromSpotify,
} from "../lib/spotifyService.js";
import { getLrcLyricsFromLrclib } from "../lib/lyricsService.js";
import {
  extractZip,
  parseTrackFileName,
  cleanUpTempDir,
} from "../lib/zipHandler.js";

import path from "path";
import fs from "fs/promises";
import { getGenresAndMoodsForTrack } from "../lib/lastfm.service.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { v4 as uuidv4 } from "uuid";
import { transcodeToHls } from "../lib/ffmpeg.service.js";
import axios from "axios";
import { createWriteStream } from "fs";
import { analyzeAudioFeatures } from "../lib/audioAnalysis.service.js";

const uploadFile = async (file, folder) => {
  try {
    const sourcePath = file.tempFilePath;
    const fileName = `${uuidv4()}${path.extname(file.name)}`;
    const result = await uploadToBunny(sourcePath, folder, fileName);

    return {
      url: result.url,
      publicId: result.path,
    };
  } catch (error) {
    console.error(
      `Error uploading to Bunny.net from source ${file.name}:`,
      error
    );
    throw new Error("Failed to upload file to Bunny.net");
  }
};

const updateArtistsContent = async (artistIds, contentId, contentType) => {
  if (!artistIds || artistIds.length === 0) return;
  const updateField = contentType === "songs" ? "songs" : "albums";
  await Artist.updateMany(
    { _id: { $in: artistIds } },
    { $addToSet: { [updateField]: contentId } }
  );
};

const removeContentFromArtists = async (artistIds, contentId, contentType) => {
  if (!artistIds || artistIds.length === 0) return;
  const updateField = contentType === "songs" ? "songs" : "albums";
  await Artist.updateMany(
    { _id: { $in: artistIds } },
    { $pull: { [updateField]: contentId } }
  );
};

const processAndUploadSong = async (audioFilePath) => {
  const tempHlsDir = path.join(process.cwd(), "temp_hls", uuidv4());

  try {
    const sourceAudioUpload = await uploadToBunny(
      { tempFilePath: audioFilePath, name: path.basename(audioFilePath) },
      "songs/source"
    );

    await transcodeToHls(audioFilePath, tempHlsDir);

    const hlsRemotePath = `songs/hls/${uuidv4()}`;
    await uploadDirectoryToBunny(tempHlsDir, hlsRemotePath);

    const hlsUrl = `https://${process.env.BUNNY_PULL_ZONE_HOSTNAME}/${hlsRemotePath}/master.m3u8`;

    const metadata = await mm.parseFile(audioFilePath);
    const duration = Math.floor(metadata.format.duration || 0);

    return {
      hlsUrl,
      sourceAudioPublicId: sourceAudioUpload.path, // ИСПРАВЛЕНО: используем .path
      hlsRemotePath,
      duration,
    };
  } finally {
    await fs
      .rm(tempHlsDir, { recursive: true, force: true })
      .catch((err) =>
        console.error(`Failed to cleanup temp HLS dir ${tempHlsDir}:`, err)
      );
  }
};

export const createSong = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin)
    return res.status(403).json({ message: "Access denied." });
  if (!req.files || !req.files.audioFile)
    return res.status(400).json({ message: "Audio file is required." });

  try {
    const {
      title,
      artistIds: artistIdsJsonString,
      albumId,
      releaseYear,
      lyrics,
      genreIds: genreIdsJson,
      moodIds: moodIdsJson,
    } = req.body;

    const { hlsUrl, sourceAudioPublicId, duration } =
      await processAndUploadSong(req.files.audioFile.tempFilePath);

    let imageUpload = { url: null, publicId: null };
    let finalAlbumId = albumId && albumId !== "none" ? albumId : null;
    const artistIds = JSON.parse(artistIdsJsonString);

    if (!finalAlbumId) {
      if (!req.files.imageFile)
        throw new Error("Image file is required for singles.");

      imageUpload = await uploadFile(req.files.imageFile, "songs/images");

      const newAlbum = new Album({
        title,
        artist: artistIds,
        imageUrl: imageUpload.url,
        imagePublicId: imageUpload.publicId,
        releaseYear: releaseYear || new Date().getFullYear(),
        type: "Single",
      });
      await newAlbum.save();
      finalAlbumId = newAlbum._id;
      await updateArtistsContent(artistIds, newAlbum._id, "albums");
    } else {
      const existingAlbum = await Album.findById(finalAlbumId);
      if (!existingAlbum) throw new Error("Album not found.");
      imageUpload.url = existingAlbum.imageUrl;
      imageUpload.publicId = existingAlbum.imagePublicId;
    }

    const song = new Song({
      title,
      artist: artistIds,
      albumId: finalAlbumId,
      imageUrl: imageUpload.url,
      imagePublicId: imageUpload.publicId,
      hlsUrl,
      sourceAudioPublicId,
      duration,
      lyrics: lyrics || null,
      genres: genreIdsJson ? JSON.parse(genreIdsJson) : [],
      moods: moodIdsJson ? JSON.parse(moodIdsJson) : [],
    });

    await song.save();
    await Album.findByIdAndUpdate(finalAlbumId, { $push: { songs: song._id } });
    await updateArtistsContent(artistIds, song._id, "songs");

    // Попытка анализа аудио (не блокирующая)
    try {
      const audioFeatures = await analyzeAudioFeatures(
        req.files.audioFile.tempFilePath
      );
      song.audioFeatures = audioFeatures;
      await song.save();
      console.log(
        `[AdminController] Аудио-характеристики сохранены для песни: ${song.title}`
      );
    } catch (audioAnalysisError) {
      console.warn(
        `[AdminController] Не удалось проанализировать аудио для песни ${song.title}:`,
        audioAnalysisError.message
      );
      // Не прерываем создание песни, если анализ не удался
    }

    res.status(201).json(song);
  } catch (error) {
    console.log("Error in createSong", error);
    next(error);
  }
};

// Обновленная функция updateSong
export const updateSong = async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Access denied. Admin privileges required." });
  }

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

  try {
    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }

    if (artistIdsJson) {
      const newArtistIds = JSON.parse(artistIdsJson);
      const oldArtistIds = song.artist.map((artist) => artist.toString());
      const artistsToRemove = oldArtistIds.filter(
        (oldId) => !newArtistIds.includes(oldId)
      );
      await removeContentFromArtists(artistsToRemove, song._id, "songs");
      const artistsToAdd = newArtistIds.filter(
        (newId) => !oldArtistIds.includes(newId)
      );
      await updateArtistsContent(artistsToAdd, song._id, "songs");
      song.artist = newArtistIds;
    }

    if (audioFile) {
      if (song.hlsUrl) {
        const hlsPath = getPathFromUrl(song.hlsUrl);
        if (hlsPath) {
          const hlsDir = path.dirname(hlsPath);
          await deleteFromBunny(hlsDir + "/");
        }
      }
      if (song.sourceAudioPublicId) {
        await deleteFromBunny(song.sourceAudioPublicId);
      }

      const { hlsUrl, sourceAudioPublicId, duration } =
        await processAndUploadSong(audioFile.tempFilePath);
      song.hlsUrl = hlsUrl;
      song.sourceAudioPublicId = sourceAudioPublicId;
      song.duration = duration;

      // Попытка анализа нового аудио (не блокирующая)
      try {
        const audioFeatures = await analyzeAudioFeatures(
          audioFile.tempFilePath
        );
        song.audioFeatures = audioFeatures;
        await song.save();
        console.log(
          `[AdminController] Аудио-характеристики обновлены для песни: ${song.title}`
        );
      } catch (audioAnalysisError) {
        console.warn(
          `[AdminController] Не удалось проанализировать новое аудио для песни ${song.title}:`,
          audioAnalysisError.message
        );
        // Не прерываем обновление песни, если анализ не удался
      }
    }

    if (imageFile) {
      if (song.imagePublicId) {
        await deleteFromBunny(getPathFromUrl(song.imageUrl));
      }
      const imageUpload = await uploadFile(imageFile, "songs/images");
      song.imageUrl = imageUpload.url;
      song.imagePublicId = imageUpload.publicId;
    }

    if (albumId !== undefined) {
      const oldAlbumId = song.albumId ? song.albumId.toString() : null;
      const newAlbumId = albumId === "none" || albumId === "" ? null : albumId;

      if (oldAlbumId && oldAlbumId !== newAlbumId) {
        await Album.findByIdAndUpdate(oldAlbumId, {
          $pull: { songs: song._id },
        });
      }
      if (newAlbumId && newAlbumId !== oldAlbumId) {
        await Album.findByIdAndUpdate(newAlbumId, {
          $addToSet: { songs: song._id },
        });
      }
      song.albumId = newAlbumId;
    }

    song.title = title || song.title;
    song.lyrics = lyrics !== undefined ? lyrics : song.lyrics;
    if (genreIdsJson) song.genres = JSON.parse(genreIdsJson);
    if (moodIdsJson) song.moods = JSON.parse(moodIdsJson);

    await song.save();
    res.status(200).json(song);
  } catch (error) {
    console.log("Error in updateSong", error);
    next(error);
  }
};

export const deleteSong = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied." });

    const { id } = req.params;
    const song = await Song.findById(id);

    if (!song) return res.status(404).json({ message: "Song not found." });

    if (song.instrumentalPublicId)
      await deleteFromBunny(song.instrumentalPublicId);
    if (song.vocalsPublicId) await deleteFromBunny(song.vocalsPublicId);

    if (song.albumId) {
      const album = await Album.findById(song.albumId);
      if (album && album.type === "Single" && album.songs.length <= 1) {
        if (album.imagePublicId) await deleteFromBunny(album.imagePublicId);
        await removeContentFromArtists(album.artist, album._id, "albums");
        await Album.findByIdAndDelete(album._id);
      } else if (album) {
        if (song.imagePublicId && song.imagePublicId !== album.imagePublicId) {
          await deleteFromBunny(song.imagePublicId);
        }
        await Album.findByIdAndUpdate(song.albumId, {
          $pull: { songs: song._id },
        });
      }
    } else if (song.imagePublicId) {
      await deleteFromBunny(song.imagePublicId);
    }

    await removeContentFromArtists(song.artist, song._id, "songs");
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
    if (!req.user || !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied." });
    if (!req.files || !req.files.imageFile)
      return res.status(400).json({ message: "Image file is required." });

    const {
      title,
      artistIds: artistIdsJsonString,
      releaseYear,
      type = "Album",
    } = req.body;
    const artistIds = JSON.parse(artistIdsJsonString);
    const imageUpload = await uploadToBunny(req.files.imageFile, "albums");

    const album = new Album({
      title,
      artist: artistIds,
      imageUrl: imageUpload.url,
      imagePublicId: imageUpload.publicId,
      releaseYear,
      type,
    });
    await album.save();
    await updateArtistsContent(artistIds, album._id, "albums");

    res.status(201).json(album);
  } catch (error) {
    console.error("Error in createAlbum:", error);
    next(error);
  }
};

export const updateAlbum = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

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

      const oldArtistIds = album.artist.map((id) => id.toString());

      const artistsToRemove = oldArtistIds.filter(
        (oldId) => !newArtistIds.includes(oldId)
      );
      await removeContentFromArtists(artistsToRemove, album._id, "albums");

      const artistsToAdd = newArtistIds.filter(
        (newId) => !oldArtistIds.includes(newId)
      );
      await updateArtistsContent(artistsToAdd, album._id, "albums");

      album.artist = newArtistIds;
    } else {
      return res
        .status(400)
        .json({ message: "Album must have at least one artist." });
    }

    if (imageFile) {
      if (album.imageUrl) {
        await deleteFromBunny(extractPublicId(album.imageUrl));
      }
      album.imageUrl = (await uploadToBunny(imageFile, "albums")).secure_url;
    }

    album.title = title || album.title;
    album.releaseYear =
      releaseYear !== undefined ? releaseYear : album.releaseYear;
    album.type = type || album.type;

    await album.save();
    res.status(200).json(album);
  } catch (error) {
    console.error("Error in updateAlbum:", error);
    next(error);
  }
};

export const deleteAlbum = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied." });

    const { id } = req.params;
    const album = await Album.findById(id);

    if (!album) return res.status(404).json({ message: "Album not found." });

    if (album.imagePublicId)
      await deleteFromBunny(album.imagePublicId, "image");

    const songsInAlbum = await Song.find({ albumId: id });
    for (const song of songsInAlbum) {
      if (song.instrumentalPublicId)
        await deleteFromBunny(song.instrumentalPublicId, "video");
      if (song.vocalsPublicId)
        await deleteFromBunny(song.vocalsPublicId, "video");
      if (song.imagePublicId && song.imagePublicId !== album.imagePublicId) {
        await deleteFromBunny(song.imagePublicId, "image");
      }
    }

    await Song.deleteMany({ albumId: id });
    await removeContentFromArtists(album.artist, album._id, "albums");
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
    if (!req.user?.isAdmin)
      return res.status(403).json({ message: "Access denied." });
    const { name, bio } = req.body;
    if (!name || !req.files?.imageFile)
      return res
        .status(400)
        .json({ message: "Name and image file are required." });

    const imageUpload = await uploadToBunny(req.files.imageFile, "artists");
    let bannerUpload = { url: null, publicId: null };
    if (req.files.bannerFile) {
      bannerUpload = await uploadToBunny(
        req.files.bannerFile,
        "artists/banners"
      );
    }

    const newArtist = new Artist({
      name,
      bio,
      imageUrl: imageUpload.url,
      imagePublicId: imageUpload.publicId,
      bannerUrl: bannerUpload.url,
      bannerPublicId: bannerUpload.publicId,
    });
    await newArtist.save();
    res.status(201).json(newArtist);
  } catch (error) {
    next(error);
  }
};

export const updateArtist = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin)
      return res.status(403).json({ message: "Access denied." });

    const { id } = req.params;
    const { name, bio, bannerUrl } = req.body;
    const imageFile = req.files?.imageFile;
    const bannerFile = req.files?.bannerFile;

    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: "Artist not found." });

    if (imageFile) {
      if (artist.imagePublicId)
        await deleteFromBunny(artist.imagePublicId, "image");
      const imageUpload = await uploadToBunny(imageFile, "artists");
      artist.imageUrl = imageUpload.url;
      artist.imagePublicId = imageUpload.publicId;
    }

    if (bannerFile) {
      if (artist.bannerPublicId)
        await deleteFromBunny(artist.bannerPublicId, "image");
      const bannerUpload = await uploadToBunny(bannerFile, "artists/banners");
      artist.bannerUrl = bannerUpload.url;
      artist.bannerPublicId = bannerUpload.publicId;
    } else if (bannerUrl === "") {
      if (artist.bannerPublicId)
        await deleteFromBunny(artist.bannerPublicId, "image");
      artist.bannerUrl = null;
      artist.bannerPublicId = null;
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
    if (!req.user?.isAdmin)
      return res.status(403).json({ message: "Access denied." });
    const { id } = req.params;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: "Artist not found." });

    const mockRes = { status: () => mockRes, json: () => {} };

    const soloAlbums = await Album.find({
      artist: id,
      "artist.1": { $exists: false },
    });
    for (const album of soloAlbums) {
      await deleteAlbum(
        { params: { id: album._id.toString() }, user: req.user },
        mockRes,
        next
      );
    }

    const soloSongs = await Song.find({
      artist: id,
      "artist.1": { $exists: false },
    });
    for (const song of soloSongs) {
      await deleteSong(
        { params: { id: song._id.toString() }, user: req.user },
        mockRes,
        next
      );
    }

    await Album.updateMany({ artist: id }, { $pull: { artist: id } });
    await Song.updateMany({ artist: id }, { $pull: { artist: id } });

    if (artist.imagePublicId)
      await deleteFromBunny(artist.imagePublicId, "image");
    if (artist.bannerPublicId)
      await deleteFromBunny(artist.bannerPublicId, "image");

    await Artist.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Artist and their solo content deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const uploadFullAlbumAuto = async (req, res, next) => {
  console.log("🚀 Reached HLS /admin/albums/upload-full-album route");

  const DEFAULT_ARTIST_IMAGE_URL = `https://moodify.b-cdn.net/artist.jpeg`;
  const DEFAULT_ALBUM_IMAGE_URL = `https://moodify.b-cdn.net/default-album-cover.png`;

  if (!req.user || !req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Access denied. Admin privileges required." });
  }

  const { spotifyAlbumUrl } = req.body;
  const albumAudioZip = req.files ? req.files.albumAudioZip : null;

  if (!spotifyAlbumUrl || !albumAudioZip) {
    return res.status(400).json({
      success: false,
      message: "Spotify URL and ZIP file are required.",
    });
  }

  const tempUnzipDir = path.join(
    process.cwd(),
    "temp_unzip_albums",
    Date.now().toString()
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

    const extractedFilePaths = await extractZip(
      albumAudioZip.tempFilePath,
      tempUnzipDir
    );
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
            `[AdminController] Fuzzy match: Spotify track "${spotifyTrackName}" matched to file key "${fileKey}"`
          );
          return trackFilesMap[fileKey];
        }
      }
      return null;
    };

    console.log(
      "[AdminController] Performing pre-flight check for all required audio files..."
    );
    for (const spotifyTrack of tracksToProcess) {
      const filesForTrack = findTrackFiles(spotifyTrack.name);
      if (!filesForTrack || !filesForTrack.audioPath) {
        throw new Error(
          `Validation failed: Audio file for track "${spotifyTrack.name}" could not be matched in the ZIP archive.`
        );
      }
    }
    console.log(
      "[AdminController] Pre-flight check successful. All audio files matched."
    );

    const albumArtistIds = [];
    for (const spotifyArtist of spotifyAlbumData.artists || []) {
      let artist = await Artist.findOne({ name: spotifyArtist.name });
      if (!artist) {
        const artistDetails = await getArtistDataFromSpotify(spotifyArtist.id);
        const artistImageUrl =
          artistDetails?.images?.[0]?.url || DEFAULT_ARTIST_IMAGE_URL;
        const imageUploadResult = await uploadToBunny(
          artistImageUrl,
          "artists"
        );
        uploadedBunnyPaths.push(imageUploadResult.path);
        artist = new Artist({
          name: spotifyArtist.name,
          imageUrl: imageUploadResult.url,
          imagePublicId: imageUploadResult.path,
          bannerUrl: imageUploadResult.url,
          bannerPublicId: imageUploadResult.path,
        });
        await artist.save();
        newlyCreatedArtistIds.push(artist._id);
      }
      albumArtistIds.push(artist._id);
    }

    const albumType =
      spotifyAlbumData.album_type === "single"
        ? "Single"
        : spotifyAlbumData.total_tracks <= 6
        ? "EP"
        : "Album";

    const albumImageUrl =
      spotifyAlbumData.images?.[0]?.url || DEFAULT_ALBUM_IMAGE_URL;
    const albumImageUpload = await uploadToBunny(albumImageUrl, "albums");
    uploadedBunnyPaths.push(albumImageUpload.path);

    album = new Album({
      title: spotifyAlbumData.name,
      artist: albumArtistIds,
      imageUrl: albumImageUpload.url,
      imagePublicId: albumImageUpload.path,
      releaseYear: parseInt(spotifyAlbumData.release_date.split("-")[0]),
      type: albumType,
      songs: [],
    });
    await album.save();
    console.log(`[AdminController] Album created in DB: ${album.title}`);
    await updateArtistsContent(albumArtistIds, album._id, "albums");

    const createdSongs = [];
    for (const spotifyTrack of tracksToProcess) {
      const songName = spotifyTrack.name;
      console.log(`[AdminController] Processing track: ${songName}`);
      const filesForTrack = findTrackFiles(songName);

      const { hlsUrl, sourceAudioPublicId, hlsRemotePath, duration } =
        await processAndUploadSong(filesForTrack.audioPath);
      uploadedBunnyPaths.push(sourceAudioPublicId);
      uploadedBunnyPaths.push(hlsRemotePath + "/");

      const songArtistIds = [];
      for (const spotifyTrackArtist of spotifyTrack.artists || []) {
        let artist = await Artist.findOne({ name: spotifyTrackArtist.name });
        if (!artist) {
          const artistDetails = await getArtistDataFromSpotify(
            spotifyTrackArtist.id
          );
          const artistImageUrl =
            artistDetails?.images?.[0]?.url || DEFAULT_ARTIST_IMAGE_URL;
          const imageUploadResult = await uploadToBunny(
            artistImageUrl,
            "artists"
          );
          uploadedBunnyPaths.push(imageUploadResult.path);
          artist = new Artist({
            name: spotifyTrackArtist.name,
            imageUrl: imageUploadResult.url,
            imagePublicId: imageUploadResult.path,
          });
          await artist.save();
          newlyCreatedArtistIds.push(artist._id);
        }
        songArtistIds.push(artist._id);
      }

      const primaryArtistName = (await Artist.findById(songArtistIds[0])).name;
      const { genreIds, moodIds } = await getTagsFromAI(
        primaryArtistName,
        songName
      );

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
        hlsUrl,
        sourceAudioPublicId,
        lyrics: lrcText || "",
        duration,
        imageUrl: album.imageUrl,
        imagePublicId: album.imagePublicId,
        genres: genreIds,
        moods: moodIds,
      });

      await song.save();
      createdSongIds.push(song._id);
      createdSongs.push(song);

      // Попытка анализа аудио (не блокирующая)
      try {
        const audioFeatures = await analyzeAudioFeatures(
          filesForTrack.audioPath
        );
        song.audioFeatures = audioFeatures;
        await song.save();
        console.log(
          `[AdminController] Аудио-характеристики сохранены для песни: ${song.title}`
        );
      } catch (audioAnalysisError) {
        console.warn(
          `[AdminController] Не удалось проанализировать аудио для песни ${song.title}:`,
          audioAnalysisError.message
        );
        // Не прерываем создание песни, если анализ не удался
      }

      await Album.findByIdAndUpdate(album._id, { $push: { songs: song._id } });
      await updateArtistsContent(songArtistIds, song._id, "songs");
    }

    res.status(200).json({
      success: true,
      message: `Album "${album.title}" (${album.type}) and ${createdSongs.length} tracks added successfully!`,
      album,
      songs: createdSongs.map((s) => ({ title: s.title, id: s._id })),
    });
  } catch (error) {
    console.error(
      "[AdminController] Critical error occurred. Starting rollback...",
      error
    );

    await Promise.allSettled(
      uploadedBunnyPaths.map((bunnyPath) => {
        if (!bunnyPath) return Promise.resolve();
        if (bunnyPath.endsWith("/")) {
          return deleteFromBunny(bunnyPath);
        }
        return deleteFromBunny(bunnyPath);
      })
    );

    if (createdSongIds.length > 0) {
      await Song.deleteMany({ _id: { $in: createdSongIds } });
    }
    if (album) {
      await removeContentFromArtists(album.artist, album._id, "albums");
      await Album.findByIdAndDelete(album._id);
    }
    if (newlyCreatedArtistIds.length > 0) {
      await Artist.deleteMany({ _id: { $in: newlyCreatedArtistIds } });
    }

    next(error);
  } finally {
    await cleanUpTempDir(tempUnzipDir);
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
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const songsQuery = Song.find()
      .populate("artist", "name imageUrl")
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
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const albumsQuery = Album.find()
      .populate("artist", "name imageUrl")
      .populate("songs")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAlbumsQuery = Album.countDocuments();

    const [albums, totalAlbums] = await Promise.all([
      albumsQuery.exec(),
      totalAlbumsQuery.exec(),
    ]);

    res.status(200).json({
      albums,
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
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }

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
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }

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
      `temp_audio_${songId}.mp3`
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
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied." });
    }

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
