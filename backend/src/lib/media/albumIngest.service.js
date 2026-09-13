import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import {
  deleteFromBunny,
  getPathFromUrl,
} from "../media/bunny.service.js";
import { processAndUploadSong } from "../media/songUpload.service.js";
import {
  getAlbumDataFromSpotify,
  getArtistDataFromSpotify,
} from "../integrations/spotifyService.js";
import { getLrcLyricsFromLrclib } from "../integrations/lyricsService.js";
import {
  extractZip,
  buildTrackFilesMap,
  findTrackFiles,
  listFilesRecursive,
  cleanUpTempDir,
} from "../media/zipHandler.js";
import { getBatchTagsFromAI } from "../integrations/ai.service.js";
import { analyzeAudioFeatures } from "../integrations/audioAnalysis.service.js";
import {
  setUploadInProgress,
  clearUploadInProgress,
} from "../media/activeUploads.service.js";
import {
  extractCoverAccentHexFromBuffer,
  isSkippableCoverImageUrl,
} from "../media/coverAccent.service.js";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
} from "../../constants/cdn.js";
import {
  toImageFields,
  uploadImageVariantsFromSource,
} from "../media/imageVariants.service.js";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

/**
 * Ingest an album from Spotify metadata + local audio (ZIP or directory).
 *
 * @param {object} opts
 * @param {string} opts.spotifyAlbumUrl
 * @param {string} [opts.zipFilePath]
 * @param {string} [opts.audioDir]
 * @param {object} [opts.spotifyAlbumData] - skip Spotify fetch if already loaded
 * @returns {Promise<{ album: object, songs: object[] }>}
 */
export const ingestAlbumFromSpotify = async ({
  spotifyAlbumUrl,
  zipFilePath,
  audioDir,
  spotifyAlbumData: prefetchedAlbumData,
}) => {
  if (!spotifyAlbumUrl && !prefetchedAlbumData) {
    throw new Error("Spotify URL is required.");
  }
  if (!zipFilePath && !audioDir) {
    throw new Error("ZIP file path or audio directory is required.");
  }

  const DEFAULT_ARTIST_IMAGE_URL = CDN_DEFAULT_ARTIST_IMAGE;
  const DEFAULT_ALBUM_IMAGE_URL = CDN_DEFAULT_ALBUM_COVER;

  const tempUnzipDir = path.join(
    process.cwd(),
    "temp_unzip_albums",
    `${Date.now()}_${uuidv4()}`,
  );

  const uploadedBunnyPaths = [];
  const newlyCreatedArtistIds = [];
  const createdSongIds = [];
  let album = null;

  setUploadInProgress();

  try {
    const spotifyAlbumData =
      prefetchedAlbumData || (await getAlbumDataFromSpotify(spotifyAlbumUrl));
    if (!spotifyAlbumData) {
      throw new Error("Could not get album data from Spotify.");
    }

    const existingAlbum = await Album.findOne({ title: spotifyAlbumData.name });
    if (existingAlbum) {
      const err = new Error(
        `Альбом с названием "${spotifyAlbumData.name}" уже существует.`,
      );
      err.statusCode = 409;
      throw err;
    }

    let extractedFilePaths;
    if (audioDir) {
      extractedFilePaths = await listFilesRecursive(audioDir);
    } else {
      extractedFilePaths = await extractZip(zipFilePath, tempUnzipDir);
    }
    const trackFilesMap = buildTrackFilesMap(extractedFilePaths);

    const tracksToProcess =
      spotifyAlbumData.tracks?.items || spotifyAlbumData.tracks || [];

    console.log(
      "[AlbumIngest] Performing pre-flight check for all required audio files...",
    );
    for (const spotifyTrack of tracksToProcess) {
      const filesForTrack = findTrackFiles(trackFilesMap, spotifyTrack.name);
      if (!filesForTrack?.audioPath) {
        throw new Error(
          `Validation failed: Audio file for track "${spotifyTrack.name}" could not be matched.`,
        );
      }
    }
    console.log("[AlbumIngest] Pre-flight check successful.");

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
      releaseYear: parseInt(spotifyAlbumData.release_date.split("-")[0], 10),
      type: albumType,
      coverAccentHex: albumCoverAccentHex,
    });
    await album.save();
    console.log(`[AlbumIngest] Album created in DB: ${album.title}`);

    const primaryAlbumArtistName =
      spotifyAlbumData.artists?.[0]?.name || "Unknown Artist";
    const tracksForAI = tracksToProcess.map((track, index) => {
      const artistName = track.artists?.[0]?.name || primaryAlbumArtistName;
      return {
        tempId: track.id || `track_${index}`,
        artistName,
        trackName: track.name,
      };
    });

    console.log(
      `[AlbumIngest] Requesting batch AI tags for ${tracksForAI.length} tracks...`,
    );
    const batchTags = await getBatchTagsFromAI(tracksForAI);

    const createdSongs = [];
    let trackIndex = 0;

    for (const spotifyTrack of tracksToProcess) {
      const songName = spotifyTrack.name;
      const trackTempId = spotifyTrack.id || `track_${trackIndex}`;
      trackIndex++;

      console.log(`[AlbumIngest] Processing track: ${songName}`);
      const filesForTrack = findTrackFiles(trackFilesMap, songName);

      if (!filesForTrack?.audioPath) {
        throw new Error(`Файл для трека "${songName}" не найден`);
      }

      const { hlsUrl, hlsRemotePath, duration } = await processAndUploadSong(
        filesForTrack.audioPath,
      );
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

      const primaryArtistName = (await Artist.findById(songArtistIds[0])).name;

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

      try {
        const audioFeatures = await analyzeAudioFeatures(
          filesForTrack.audioPath,
        );
        song.audioFeatures = audioFeatures;
        await song.save();
      } catch (audioAnalysisError) {
        console.warn(
          `[AlbumIngest] Audio analysis failed for ${song.title}:`,
          audioAnalysisError.message,
        );
      }
    }

    if (createdSongs.length !== tracksToProcess.length) {
      throw new Error(
        `Not all tracks were ingested (${createdSongs.length}/${tracksToProcess.length}).`,
      );
    }

    return { album, songs: createdSongs };
  } catch (error) {
    console.error("[AlbumIngest] Critical error. Starting rollback...", error);

    await Promise.allSettled(
      uploadedBunnyPaths.map((bunnyPath) => {
        if (!bunnyPath) return Promise.resolve();
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
    clearUploadInProgress();
    await cleanUpTempDir(tempUnzipDir);
  }
};
