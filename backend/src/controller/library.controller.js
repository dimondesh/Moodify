import { SavedAlbum } from "../models/savedAlbum.model.js";
import { SavedPlaylist } from "../models/savedPlaylist.model.js";
import { FollowedArtist } from "../models/followedArtist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { LikedSong } from "../models/likedSong.model.js";
import { LIKED_PLAYLIST_ID } from "./playlist.controller.js";
import { USER_CREATED_PLAYLIST_TYPE } from "../constants/playlistTypes.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

const mapPopulated = (rows, refPath) =>
  rows
    .filter((r) => r[refPath])
    .map((r) => ({
      ...(r[refPath].toObject?.() ?? r[refPath]),
      addedAt: r.addedAt,
    }));

function applyOptionalLimit(query, limit) {
  if (limit > 0) {
    return query.limit(limit);
  }
  return query;
}

const albumPopulate = {
  path: "album",
  select: "title images type artist",
  populate: { path: "artist", select: "name images" },
};

const playlistPopulate = {
  path: "playlist",
  select:
    "title images owner madeFor isPublic type isSystem updatedAt localizedNames localizedDescriptions",
  populate: { path: "owner", select: "fullName images" },
};

const playlistPopulateWithSongs = {
  path: "playlist",
  populate: [
    { path: "owner", select: "fullName images" },
    {
      path: "songs",
      select: SONG_MINIMAL_SELECT,
      populate: { path: "artist", select: "name images" },
    },
  ],
};

const artistPopulate = {
  path: "artist",
  select: "name images createdAt",
};

async function fetchLibraryRows(userId, { limit = 0 } = {}) {
  const [albumRows, playlistRows, artistRows] = await Promise.all([
    applyOptionalLimit(
      SavedAlbum.find({ user: userId })
        .sort({ addedAt: -1 })
        .populate(albumPopulate),
      limit,
    ).lean(),
    applyOptionalLimit(
      SavedPlaylist.find({ user: userId })
        .sort({ addedAt: -1 })
        .populate(playlistPopulate),
      limit,
    ).lean(),
    applyOptionalLimit(
      FollowedArtist.find({ user: userId })
        .sort({ addedAt: -1 })
        .populate(artistPopulate),
      limit,
    ).lean(),
  ]);

  return {
    albums: mapPopulated(albumRows, "album"),
    playlists: mapPopulated(playlistRows, "playlist"),
    followedArtists: mapPopulated(artistRows, "artist"),
  };
}

/** GET /library/summary — preserves addedAt and newest-first order. */
export async function buildLibrarySummaryForUser(userId) {
  if (!userId) {
    return { albums: [], playlists: [], followedArtists: [] };
  }
  return fetchLibraryRows(userId);
}

export const getLibraryAlbums = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const limit = Number(req.query.limit) || 0;
    const { albums } = await fetchLibraryRows(userId, { limit });
    res.json({ albums });
  } catch (err) {
    next(err);
  }
};

export const toggleAlbumInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { albumId } = req.body;

    const existing = await SavedAlbum.findOne({ user: userId, album: albumId });

    if (existing) {
      await SavedAlbum.deleteOne({ _id: existing._id });
      return res.json({ success: true, isAdded: false });
    }

    try {
      await SavedAlbum.create({
        user: userId,
        album: albumId,
        addedAt: new Date(),
      });
    } catch (err) {
      if (err?.code === 11000) {
        await SavedAlbum.deleteOne({ user: userId, album: albumId });
        return res.json({ success: true, isAdded: false });
      }
      throw err;
    }

    res.json({ success: true, isAdded: true });
  } catch (err) {
    next(err);
  }
};

export const toggleSongLikeInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.body;

    const existing = await LikedSong.findOne({ user: userId, song: songId });

    if (existing) {
      await LikedSong.deleteOne({ _id: existing._id });
      return res.json({
        success: true,
        isLiked: false,
        playlistId: LIKED_PLAYLIST_ID,
      });
    }

    try {
      await LikedSong.create({
        user: userId,
        song: songId,
        likedAt: new Date(),
      });
    } catch (err) {
      if (err?.code === 11000) {
        await LikedSong.deleteOne({ user: userId, song: songId });
        return res.json({
          success: true,
          isLiked: false,
          playlistId: LIKED_PLAYLIST_ID,
        });
      }
      throw err;
    }

    res.json({
      success: true,
      isLiked: true,
      playlistId: LIKED_PLAYLIST_ID,
    });
  } catch (err) {
    next(err);
  }
};

export const getPlaylistsInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const limit = Number(req.query.limit) || 0;

    const query = SavedPlaylist.find({ user: userId })
      .sort({ addedAt: -1 })
      .populate(playlistPopulateWithSongs);

    const playlistRows = await applyOptionalLimit(query, limit).lean();
    const playlists = mapPopulated(playlistRows, "playlist");

    res.json({ playlists });
  } catch (err) {
    next(err);
  }
};

export const togglePlaylistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { playlistId } = req.body;

    const existing = await SavedPlaylist.findOne({
      user: userId,
      playlist: playlistId,
    });

    if (existing) {
      await SavedPlaylist.deleteOne({ _id: existing._id });
      return res.json({ success: true, isAdded: false });
    }

    try {
      await SavedPlaylist.create({
        user: userId,
        playlist: playlistId,
        addedAt: new Date(),
      });
    } catch (err) {
      if (err?.code === 11000) {
        await SavedPlaylist.deleteOne({ user: userId, playlist: playlistId });
        return res.json({ success: true, isAdded: false });
      }
      throw err;
    }

    res.json({ success: true, isAdded: true });
  } catch (err) {
    next(err);
  }
};

export const toggleArtistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { artistId } = req.body;

    const existing = await FollowedArtist.findOne({
      user: userId,
      artist: artistId,
    });

    if (existing) {
      await FollowedArtist.deleteOne({ _id: existing._id });
      return res.json({ success: true, isFollowed: false });
    }

    try {
      await FollowedArtist.create({
        user: userId,
        artist: artistId,
        addedAt: new Date(),
      });
    } catch (err) {
      if (err?.code === 11000) {
        await FollowedArtist.deleteOne({ user: userId, artist: artistId });
        return res.json({ success: true, isFollowed: false });
      }
      throw err;
    }

    res.json({ success: true, isFollowed: true });
  } catch (err) {
    next(err);
  }
};

export const getFollowedArtists = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const limit = Number(req.query.limit) || 0;

    const query = FollowedArtist.find({ user: userId })
      .sort({ addedAt: -1 })
      .populate(artistPopulate);

    const artistRows = await applyOptionalLimit(query, limit).lean();
    const artists = mapPopulated(artistRows, "artist");

    res.json({ artists });
  } catch (err) {
    next(err);
  }
};

export const getOwnedPlaylists = async (req, res) => {
  try {
    const userId = req.user.id;
    const playlists = await Playlist.find({
      owner: userId,
      type: USER_CREATED_PLAYLIST_TYPE,
    })
      .populate({ path: "songs", select: SONG_MINIMAL_SELECT })
      .sort({ updatedAt: -1 });

    res.status(200).json(playlists);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getLibrarySummary = async (req, res, next) => {
  try {
    const data = await buildLibrarySummaryForUser(req.user?.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
