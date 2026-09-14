import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import {
  deleteFromBunny,
  getPathFromUrl,
} from "../media/bunny.service.js";
import {
  getAlbumDataFromSpotify,
  getArtistDataFromSpotify,
} from "../integrations/spotifyService.js";
import {
  extractCoverAccentHexFromBuffer,
  isSkippableCoverImageUrl,
} from "../media/coverAccent.service.js";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
} from "../../constants/cdn.js";
import {
  deleteImageVariants,
  toImageFields,
  uploadImageVariantsFromSource,
} from "../media/imageVariants.service.js";
import axios from "axios";

const DOWNLOAD_OPTS = {
  responseType: "arraybuffer",
  timeout: 20000,
  maxContentLength: 8 * 1024 * 1024,
};

const albumTypeFromTrackCount = (totalTracks) => {
  if (totalTracks === 1) return "Single";
  if (totalTracks >= 2 && totalTracks <= 6) return "EP";
  return "Album";
};

const resolveOrCreateArtists = async (spotifyArtists) => {
  const DEFAULT_ARTIST_IMAGE_URL = CDN_DEFAULT_ARTIST_IMAGE;
  const artistIds = [];
  const uploadedBunnyPaths = [];

  for (const spotifyArtist of spotifyArtists || []) {
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
    }
    artistIds.push(artist._id);
  }

  return { artistIds, uploadedBunnyPaths };
};

/**
 * Create a queued album stub from Spotify metadata (visible in admin table immediately).
 */
export const createQueuedAlbumStubFromSpotify = async (spotifyAlbumUrl) => {
  const spotifyAlbumData = await getAlbumDataFromSpotify(spotifyAlbumUrl);
  if (!spotifyAlbumData) {
    throw new Error("Could not get album data from Spotify.");
  }

  const existingAlbum = await Album.findOne({
    title: spotifyAlbumData.name,
  }).setOptions({ includeQueued: true });
  if (existingAlbum) {
    const err = new Error(
      `Альбом с названием "${spotifyAlbumData.name}" уже существует.`,
    );
    err.statusCode = 409;
    throw err;
  }

  const DEFAULT_ALBUM_IMAGE_URL = CDN_DEFAULT_ALBUM_COVER;
  const uploadedBunnyPaths = [];

  try {
    const { artistIds, uploadedBunnyPaths: artistPaths } =
      await resolveOrCreateArtists(spotifyAlbumData.artists);
    uploadedBunnyPaths.push(...artistPaths);

    if (artistIds.length === 0) {
      throw new Error("Spotify album has no artists.");
    }

    const tracks =
      spotifyAlbumData.tracks?.items || spotifyAlbumData.tracks || [];
    const tracksTotal =
      spotifyAlbumData.total_tracks || tracks.length || 0;

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

    const album = new Album({
      title: spotifyAlbumData.name,
      artist: artistIds,
      ...toImageFields(albumImageUpload),
      releaseYear: parseInt(
        String(spotifyAlbumData.release_date || "").split("-")[0],
        10,
      ),
      type: albumTypeFromTrackCount(tracksTotal),
      coverAccentHex: albumCoverAccentHex,
      status: "queued",
      spotifyAlbumUrl,
      upload: {
        phase: "queued",
        tracksDone: 0,
        tracksTotal,
        percent: 0,
      },
    });
    await album.save();

    return { album, spotifyAlbumData };
  } catch (error) {
    await Promise.allSettled(
      uploadedBunnyPaths.map((bunnyPath) => {
        if (!bunnyPath) return Promise.resolve();
        return deleteFromBunny(bunnyPath);
      }),
    );
    throw error;
  }
};

/**
 * Delete a queued/partial album and its songs + media (cancel or failed ingest).
 */
export const deleteAlbumStubAndMedia = async (albumId) => {
  const album = await Album.findById(albumId).setOptions({
    includeQueued: true,
  });
  if (!album) return;

  await deleteImageVariants(album);

  const songsInAlbum = await Song.find({ albumId });
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

  await Song.deleteMany({ albumId });
  await Album.deleteOne({ _id: albumId });
};
