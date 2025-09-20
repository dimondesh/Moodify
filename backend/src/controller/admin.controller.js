// backend/src/controller/admin.controller.js
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import {
  uploadToBunny,
  deleteFromBunny,
  getPathFromUrl,
  deleteFolderFromBunny,
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
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { v4 as uuidv4 } from "uuid";
import { convertToHlsAndUpload } from "../lib/hls.service.js"; // --- ДОБАВЛЕНО ---

const uploadFile = async (file, folder) => {
  try {
    const sourcePath = file.tempFilePath;
    const result = await uploadToBunny(sourcePath, folder);

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
  console.log(
    `[updateArtistsContent] Successfully updated ${contentType} for artists: ${artistIds}`
  );
};

const removeContentFromArtists = async (artistIds, contentId, contentType) => {
  if (!artistIds || artistIds.length === 0) return;

  const updateField = contentType === "songs" ? "songs" : "albums";

  await Artist.updateMany(
    { _id: { $in: artistIds } },
    { $pull: { [updateField]: contentId } }
  );
  console.log(
    `[removeContentFromArtists] Successfully removed ${contentType} for artists: ${artistIds}`
  );
};

// --- ФУНКЦИЯ ПОЛНОСТЬЮ ПЕРЕПИСАНА ---
export const createSong = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied." });
    if (!req.files || !req.files.audioFile)
      return res.status(400).json({ message: "Audio file is required." });

    const {
      title,
      artistIds: artistIdsJsonString,
      albumId,
      releaseYear,
      lyrics,
      genreIds: genreIdsJson,
      moodIds: moodIdsJson,
    } = req.body;

    // 1. Конвертируем аудио в HLS и загружаем
    const { hlsPlaylistUrl, hlsFolderPath } = await convertToHlsAndUpload(
      req.files.audioFile.tempFilePath
    );

    // 2. Обработка изображения и альбома
    let imageUpload = { url: null, publicId: null };
    let finalAlbumId = albumId && albumId !== "none" ? albumId : null;
    const artistIds = JSON.parse(artistIdsJsonString);

    if (!finalAlbumId) {
      if (!req.files.imageFile)
        return res
          .status(400)
          .json({ message: "Image file is required for singles." });

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
      if (!existingAlbum)
        return res.status(404).json({ message: "Album not found." });

      imageUpload.url = existingAlbum.imageUrl;
      imageUpload.publicId = existingAlbum.imagePublicId;
    }

    // 3. Получение метаданных
    const metadata = await mm.parseFile(req.files.audioFile.tempFilePath);
    const duration = Math.floor(metadata.format.duration || 0);

    // 4. Создание и сохранение песни
    const song = new Song({
      title,
      artist: artistIds,
      albumId: finalAlbumId,
      hlsPlaylistUrl,
      hlsFolderPath,
      imageUrl: imageUpload.url,
      imagePublicId: imageUpload.publicId,
      duration,
      lyrics: lyrics || null,
      genres: genreIdsJson ? JSON.parse(genreIdsJson) : [],
      moods: moodIdsJson ? JSON.parse(moodIdsJson) : [],
    });

    await song.save();
    await Album.findByIdAndUpdate(finalAlbumId, { $push: { songs: song._id } });
    await updateArtistsContent(artistIds, song._id, "songs");

    res.status(201).json(song);
  } catch (error) {
    console.log("Error in createSong", error);
    next(error);
  }
};

// --- ФУНКЦИЯ ПОЛНОСТЬЮ ПЕРЕПИСАНА ---
export const updateSong = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { id } = req.params;
    const {
      title,
      artistIds: artistIdsJson,
      albumId,
      lyrics,
      genreIds: genreIdsJson,
      moodIds: moodIdsJson,
    } = req.body;
    const audioFile = req.files ? req.files.audioFile : null;
    const imageFile = req.files ? req.files.imageFile : null;

    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: "Song not found." });
    }

    // Обновление аудио, если новый файл загружен
    if (audioFile) {
      if (song.hlsFolderPath) {
        await deleteFolderFromBunny(song.hlsFolderPath);
      }
      const { hlsPlaylistUrl, hlsFolderPath } = await convertToHlsAndUpload(
        audioFile.tempFilePath
      );
      song.hlsPlaylistUrl = hlsPlaylistUrl;
      song.hlsFolderPath = hlsFolderPath;
      const metadata = await mm.parseFile(audioFile.tempFilePath);
      song.duration = Math.floor(metadata.format.duration || 0);
    }

    // Обновление изображения
    if (imageFile) {
      if (song.imagePublicId) {
        await deleteFromBunny(getPathFromUrl(song.imageUrl));
      }
      const uploadResult = await uploadFile(imageFile, "songs/images");
      song.imageUrl = uploadResult.url;
      song.imagePublicId = uploadResult.publicId;
    }

    // Остальные поля
    song.title = title || song.title;
    song.lyrics = lyrics !== undefined ? lyrics : song.lyrics;
    if (artistIdsJson) song.artist = JSON.parse(artistIdsJson);
    if (genreIdsJson) song.genres = JSON.parse(genreIdsJson);
    if (moodIdsJson) song.moods = JSON.parse(moodIdsJson);
    if (albumId !== undefined)
      song.albumId = albumId === "none" ? null : albumId;

    await song.save();
    res.status(200).json(song);
  } catch (error) {
    console.log("Error in updateSong", error);
    next(error);
  }
};

// --- ФУНКЦИЯ ПОЛНОСТЬЮ ПЕРЕПИСАНА ---
export const deleteSong = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin)
      return res.status(403).json({ message: "Access denied." });

    const { id } = req.params;
    const song = await Song.findById(id);

    if (!song) return res.status(404).json({ message: "Song not found." });

    // Удаляем папку с HLS сегментами
    if (song.hlsFolderPath) {
      await deleteFolderFromBunny(song.hlsFolderPath);
    }

    if (song.albumId) {
      await Album.findByIdAndUpdate(song.albumId, {
        $pull: { songs: song._id },
      });
    } else if (song.imagePublicId) {
      // Если это сингл, удаляем его обложку
      await deleteFromBunny(getPathFromUrl(song.imageUrl));
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

// --- ОСТАЛЬНЫЕ ФУНКЦИИ БЕЗ ИЗМЕНЕНИЙ, НО ПЕРЕНОСИМ ИХ ДЛЯ ПОЛНОТЫ ФАЙЛА ---

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

    // ВНИМАНИЕ: getPathFromUrl может быть неверным для старых URL без publicId
    if (imageFile) {
      if (album.imagePublicId) {
        await deleteFromBunny(album.imagePublicId);
      }
      const uploadResult = await uploadFile(imageFile, "albums");
      album.imageUrl = uploadResult.url;
      album.imagePublicId = uploadResult.publicId;
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
      if (song.hlsFolderPath) {
        await deleteFolderFromBunny(song.hlsFolderPath);
      }
      // Если у сингла была своя обложка, отличная от альбомной
      if (song.imagePublicId && song.imagePublicId !== album.imagePublicId) {
        await deleteFromBunny(song.imagePublicId);
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

    const imageUpload = await uploadFile(req.files.imageFile, "artists");
    let bannerUpload = { url: null, publicId: null };
    if (req.files.bannerFile) {
      bannerUpload = await uploadFile(req.files.bannerFile, "artists/banners");
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
      if (artist.imagePublicId) await deleteFromBunny(artist.imagePublicId);
      const imageUpload = await uploadFile(imageFile, "artists");
      artist.imageUrl = imageUpload.url;
      artist.imagePublicId = imageUpload.publicId;
    }

    if (bannerFile) {
      if (artist.bannerPublicId) await deleteFromBunny(artist.bannerPublicId);
      const bannerUpload = await uploadFile(bannerFile, "artists/banners");
      artist.bannerUrl = bannerUpload.url;
      artist.bannerPublicId = bannerUpload.publicId;
    } else if (bannerUrl === "") {
      if (artist.bannerPublicId) await deleteFromBunny(artist.bannerPublicId);
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

    if (artist.imagePublicId) await deleteFromBunny(artist.imagePublicId);
    if (artist.bannerPublicId) await deleteFromBunny(artist.bannerPublicId);

    await Artist.findByIdAndDelete(id);
    res.status(200).json({
      success: true,
      message: "Artist and their solo content deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// --- ФУНКЦИЯ ПОЛНОСТЬЮ ПЕРЕПИСАНА ---
export const uploadFullAlbumAuto = async (req, res, next) => {
  console.log("🚀 Reached /admin/albums/upload-full-album route - AUTO UPLOAD");

  const DEFAULT_ARTIST_IMAGE_URL = `https://moodify.b-cdn.net/artist.jpeg`;
  const DEFAULT_ALBUM_IMAGE_URL = `https://moodify.b-cdn.net/default-album-cover.png`;

  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Access denied." });
  }

  const { spotifyAlbumUrl } = req.body;
  const albumAudioZip = req.files ? req.files.albumAudioZip : null;

  if (!spotifyAlbumUrl || !albumAudioZip) {
    return res
      .status(400)
      .json({ message: "Spotify URL and ZIP file are required." });
  }

  const tempUnzipDir = path.join(
    process.cwd(),
    "temp_unzip_albums",
    Date.now().toString()
  );
  const uploadedFilePaths = [];
  const createdSongIds = [];
  let album = null;

  try {
    const spotifyAlbumData = await getAlbumDataFromSpotify(spotifyAlbumUrl);
    if (!spotifyAlbumData)
      throw new Error("Could not get album data from Spotify.");

    const extractedFilePaths = await extractZip(
      albumAudioZip.tempFilePath,
      tempUnzipDir
    );

    // Упрощенная логика мэтчинга треков, ищет аудиофайл по названию трека
    const findTrackFile = (spotifyTrackName) => {
      const normalizedSpotifyName = spotifyTrackName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, "");
      return extractedFilePaths.find((filePath) => {
        const fileName = path
          .basename(filePath)
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]/gu, "");
        return fileName.includes(normalizedSpotifyName);
      });
    };

    const albumArtistIds = await Promise.all(
      spotifyAlbumData.artists.map(async (spotifyArtist) => {
        let artist = await Artist.findOne({ name: spotifyArtist.name });
        if (!artist) {
          const artistDetails = await getArtistDataFromSpotify(
            spotifyArtist.id
          );
          const artistImageUrl =
            artistDetails?.images?.[0]?.url || DEFAULT_ARTIST_IMAGE_URL;
          const imageUploadResult = await uploadToBunny(
            artistImageUrl,
            "artists"
          );
          uploadedFilePaths.push(imageUploadResult.path);
          artist = new Artist({
            name: spotifyArtist.name,
            imageUrl: imageUploadResult.url,
            imagePublicId: imageUploadResult.path,
          });
          await artist.save();
        }
        return artist._id;
      })
    );

    const albumImageUrl =
      spotifyAlbumData.images?.[0]?.url || DEFAULT_ALBUM_IMAGE_URL;
    const albumImageUpload = await uploadToBunny(albumImageUrl, "albums");
    uploadedFilePaths.push(albumImageUpload.path);

    album = new Album({
      title: spotifyAlbumData.name,
      artist: albumArtistIds,
      imageUrl: albumImageUpload.url,
      imagePublicId: albumImageUpload.path,
      releaseYear: parseInt(spotifyAlbumData.release_date.split("-")[0]),
      type: spotifyAlbumData.album_type === "single" ? "Single" : "Album",
    });
    await album.save();
    await updateArtistsContent(albumArtistIds, album._id, "albums");

    for (const spotifyTrack of spotifyAlbumData.tracks.items) {
      const audioFilePath = findTrackFile(spotifyTrack.name);
      if (!audioFilePath) {
        console.warn(
          `Audio file for track "${spotifyTrack.name}" not found in ZIP. Skipping.`
        );
        continue;
      }

      const { hlsPlaylistUrl, hlsFolderPath } = await convertToHlsAndUpload(
        audioFilePath
      );
      uploadedFilePaths.push(hlsFolderPath);

      const songArtistIds = await Promise.all(
        spotifyTrack.artists.map(async (sa) => {
          const artist = await Artist.findOne({ name: sa.name });
          return artist._id;
        })
      );

      const { genreIds, moodIds } = await getTagsFromAI(
        spotifyTrack.artists[0].name,
        spotifyTrack.name
      );
      const lrcText = await getLrcLyricsFromLrclib({
        artistName: spotifyTrack.artists[0].name,
        songName: spotifyTrack.name,
        albumName: album.title,
        songDuration: spotifyTrack.duration_ms,
      });

      const song = new Song({
        title: spotifyTrack.name,
        artist: songArtistIds,
        albumId: album._id,
        hlsPlaylistUrl,
        hlsFolderPath,
        imageUrl: album.imageUrl,
        imagePublicId: album.imagePublicId,
        duration: Math.round(spotifyTrack.duration_ms / 1000),
        lyrics: lrcText || "",
        genres: genreIds,
        moods: moodIds,
      });
      await song.save();
      createdSongIds.push(song._id);
      album.songs.push(song._id);
      await updateArtistsContent(songArtistIds, song._id, "songs");
    }
    await album.save();

    res.status(200).json({ message: "Album uploaded successfully.", album });
  } catch (error) {
    // Rollback
    await Promise.allSettled(
      uploadedFilePaths.map((path) =>
        path.endsWith("/") ? deleteFolderFromBunny(path) : deleteFromBunny(path)
      )
    );
    if (createdSongIds.length > 0)
      await Song.deleteMany({ _id: { $in: createdSongIds } });
    if (album) await Album.findByIdAndDelete(album._id);
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
