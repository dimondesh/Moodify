import { Hub } from "../models/hub.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { populatePlaylistEmbeddedSongs } from "./playlist.controller.js";
import { orderByIds } from "../lib/home/homeFeedGenerator.service.js";
import { attachPreviewCoversToHubs } from "../lib/recommendations/hubGenerator.service.js";
import { HUB_SECTION_LIMIT } from "../constants/hub.js";

const HUB_LIST_SELECT =
  "_id name localizedNames categoryType accentColor previewCovers albumIds artistIds";
const HUB_DETAIL_SELECT =
  "_id name localizedNames categoryType accentColor albumIds artistIds playlistIds";

const toPublicHub = (hub) => {
  const {
    albumIds: _albumIds,
    artistIds: _artistIds,
    playlistIds: _playlistIds,
    ...publicHub
  } = hub;
  return publicHub;
};

const SONG_MINIMAL_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt trackNumber sourceShareUrl licenseCcUrl sourceProvider";

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

const toSectionPayload = (preview, items) => ({
  preview,
  total: items.length,
  items,
});

const buildAlbumSection = async (albumIds = []) => {
  if (!albumIds.length) {
    return toSectionPayload([], []);
  }

  const rawAlbums = await Album.find({ _id: { $in: albumIds } })
    .populate("artist", "name images")
    .lean();
  const ordered = orderByIds(rawAlbums, albumIds);
  const previewBase = ordered.slice(0, HUB_SECTION_LIMIT);
  const preview = await attachSongsToAlbums(previewBase);
  const previewById = new Map(
    preview.map((album) => [album._id.toString(), album]),
  );
  const items = ordered.map((album) => {
    const enriched = previewById.get(album._id.toString());
    return enriched ?? { ...album, songs: [] };
  });

  return toSectionPayload(preview, items);
};

const buildArtistSection = async (artistIds = []) => {
  if (!artistIds.length) {
    return toSectionPayload([], []);
  }

  const rawArtists = await Artist.find({ _id: { $in: artistIds } }).lean();
  const items = orderByIds(rawArtists, artistIds);
  const preview = items.slice(0, HUB_SECTION_LIMIT);

  return toSectionPayload(preview, items);
};

const buildPlaylistSection = async (playlistIds = []) => {
  if (!playlistIds.length) {
    return toSectionPayload([], []);
  }

  const rawPlaylists = await Playlist.find({ _id: { $in: playlistIds } })
    .populate(populatePlaylistEmbeddedSongs)
    .lean();
  const items = orderByIds(rawPlaylists, playlistIds);
  const preview = items.slice(0, HUB_SECTION_LIMIT);

  return toSectionPayload(preview, items);
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

    const [albums, artists, playlists] = await Promise.all([
      buildAlbumSection(hub.albumIds),
      buildArtistSection(hub.artistIds),
      buildPlaylistSection(hub.playlistIds),
    ]);

    res.status(200).json({
      hub: toPublicHub(hub),
      albums,
      artists,
      playlists,
    });
  } catch (error) {
    next(error);
  }
};
