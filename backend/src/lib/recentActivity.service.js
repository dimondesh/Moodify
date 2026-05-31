import mongoose from "mongoose";
import { RecentActivity } from "../models/recentActivity.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Artist } from "../models/artist.model.js";
import { Song } from "../models/song.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

const LEGACY_TO_PLAYLIST = {
  mix: "playlist",
  "generated-playlist": "playlist",
  "personal-mix": "playlist",
};

const PLAYLIST_LIKE_TYPES = new Set([
  "playlist",
  "mix",
  "generated-playlist",
  "personal-mix",
]);

const VALID_CONTEXT_TYPES = ["album", "playlist", "artist"];

const CONTEXT_TO_ENTITY_TYPE = {
  album: "Album",
  playlist: "Playlist",
  artist: "Artist",
};

export const normalizePlaybackContextType = (rawType) => {
  if (!rawType) return null;
  if (PLAYLIST_LIKE_TYPES.has(rawType)) return "playlist";
  return LEGACY_TO_PLAYLIST[rawType] || rawType;
};

const buildAlbumSnapshot = async (entityId) => {
  const album = await Album.findById(entityId)
    .select("title images type artist")
    .populate("artist", "name")
    .lean();
  if (!album) return null;

  const songs = await Song.find({ albumId: entityId })
    .select("_id")
    .sort({ trackNumber: 1, createdAt: 1 })
    .lean();

  return {
    title: album.title,
    images: album.images,
    artists: (album.artist || []).map((artist) => ({
      _id: artist._id,
      name: artist.name,
    })),
    albumType: album.type,
    songIds: songs.map((song) => song._id),
  };
};

const buildPlaylistSnapshot = async (entityId) => {
  const playlist = await Playlist.findById(entityId)
    .select("title images owner type localizedNames songs")
    .populate("owner", "fullName")
    .lean();
  if (!playlist) return null;

  const snapshot = {
    title: playlist.title,
    images: playlist.images,
    playlistType: playlist.type,
    localizedNames: playlist.localizedNames,
    songIds: playlist.songs || [],
  };

  if (playlist.owner) {
    snapshot.owner = {
      _id: playlist.owner._id,
      fullName: playlist.owner.fullName,
    };
  }

  return snapshot;
};

const buildArtistSnapshot = async (entityId) => {
  const artist = await Artist.findById(entityId).select("name images").lean();
  if (!artist) return null;

  const songs = await Song.find({ artist: entityId })
    .select("_id")
    .sort({ playCount: -1 })
    .limit(5)
    .lean();

  return {
    title: artist.name,
    images: artist.images,
    songIds: songs.map((song) => song._id),
  };
};

const buildSnapshot = async (entityType, entityId) => {
  switch (entityType) {
    case "Album":
      return buildAlbumSnapshot(entityId);
    case "Playlist":
      return buildPlaylistSnapshot(entityId);
    case "Artist":
      return buildArtistSnapshot(entityId);
    default:
      return null;
  }
};

const fetchSongsByIds = async (songIds) => {
  if (!songIds?.length) return [];

  const songs = await Song.find({ _id: { $in: songIds } })
    .select(SONG_MINIMAL_SELECT)
    .populate({ path: "artist", select: "name images" })
    .lean();

  const songMap = new Map(songs.map((song) => [song._id.toString(), song]));
  return songIds
    .map((id) => songMap.get(id.toString()))
    .filter(Boolean);
};

const hydrateActivityEntity = async (activity) => {
  const itemType = activity.entityType.toLowerCase();
  const { snapshot } = activity;
  const songs = await fetchSongsByIds(snapshot.songIds);

  const entity = {
    _id: activity.entityId,
    itemType,
    title: snapshot.title || "Unknown",
    images: snapshot.images || [],
    songs,
  };

  if (itemType === "album") {
    entity.type = snapshot.albumType;
    entity.artist = snapshot.artists;
  } else if (itemType === "playlist") {
    entity.owner = snapshot.owner;
    entity.type = snapshot.playlistType;
    if (snapshot.localizedNames) {
      entity.localizedNames = snapshot.localizedNames;
    }
  } else if (itemType === "artist") {
    entity.name = snapshot.title;
  }

  return entity;
};

export const recordRecentActivity = async (userId, playbackContext) => {
  if (!playbackContext?.type || !playbackContext?.entityId) return;

  const normalizedType = normalizePlaybackContextType(playbackContext.type);
  if (!VALID_CONTEXT_TYPES.includes(normalizedType)) return;

  const entityType = CONTEXT_TO_ENTITY_TYPE[normalizedType];
  const entityId = playbackContext.entityId;

  if (!mongoose.Types.ObjectId.isValid(entityId)) return;

  const snapshot = await buildSnapshot(entityType, entityId);
  if (!snapshot) return;

  await RecentActivity.findOneAndUpdate(
    { userId, entityType, entityId },
    { $set: { snapshot, timestamp: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );
};

export const getRecentActivityEntities = async (userId, limit = 12) => {
  const activities = await RecentActivity.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  if (!activities.length) return [];

  return Promise.all(activities.map((activity) => hydrateActivityEntity(activity)));
};
