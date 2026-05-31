import { Hub } from "../models/hub.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { populatePlaylistEmbeddedSongs } from "./playlist.controller.js";
import { orderByIds } from "../lib/home/homeFeedGenerator.service.js";
import { attachPreviewCoversToHubs } from "../lib/hubGenerator.service.js";

const HUB_LIST_SELECT =
  "_id name localizedNames categoryType accentColor previewCovers albumIds artistIds";
const HUB_DETAIL_SELECT =
  "_id name localizedNames categoryType accentColor albumIds artistIds playlistIds";

const SONG_MINIMAL_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt trackNumber";

const attachSongsToAlbums = async (albums) => {
  if (!albums.length) return albums;

  const albumIds = albums.map((album) => album._id);
  const songs = await Song.find({ albumId: { $in: albumIds } })
    .select(SONG_MINIMAL_SELECT)
    .populate({
      path: "artist",
      model: "Artist",
      select: "name images",
    })
    .sort({ trackNumber: 1, createdAt: 1 })
    .lean();

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

export const getHubs = async (req, res, next) => {
  try {
    const hubs = await Hub.find({})
      .select(HUB_LIST_SELECT)
      .sort({ name: 1 })
      .lean();

    const publicHubs = await attachPreviewCoversToHubs(hubs);

    res.status(200).json({ hubs: publicHubs });
  } catch (error) {
    next(error);
  }
};

export const getHubById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hub = await Hub.findById(id).select(HUB_DETAIL_SELECT).lean();

    if (!hub) {
      return res.status(404).json({ message: "Hub not found" });
    }

    const [rawAlbums, rawArtists, rawPlaylists] = await Promise.all([
      hub.albumIds?.length
        ? Album.find({ _id: { $in: hub.albumIds } })
            .populate("artist", "name images")
            .lean()
        : [],
      hub.artistIds?.length
        ? Artist.find({ _id: { $in: hub.artistIds } }).lean()
        : [],
      hub.playlistIds?.length
        ? Playlist.find({ _id: { $in: hub.playlistIds } })
            .populate(populatePlaylistEmbeddedSongs)
            .lean()
        : [],
    ]);

    const albums = await attachSongsToAlbums(
      orderByIds(rawAlbums, hub.albumIds),
    );
    const artists = orderByIds(rawArtists, hub.artistIds);
    const playlists = orderByIds(rawPlaylists, hub.playlistIds);

    res.status(200).json({
      hub,
      albums,
      artists,
      playlists,
    });
  } catch (error) {
    next(error);
  }
};
