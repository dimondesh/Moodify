import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Playlist } from "../models/playlist.model.js";
import { LikedSong } from "../models/likedSong.model.js";
import { LIKED_PLAYLIST_ID } from "./playlist.controller.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

const sortByLibraryAddedAtDesc = (a, b) => {
  const ta = new Date(a.addedAt ?? 0).getTime();
  const tb = new Date(b.addedAt ?? 0).getTime();
  return tb - ta;
};

/** GET /library/summary — preserves addedAt and newest-first order. */
export async function buildLibrarySummaryForUser(userId) {
  if (!userId) {
    return { albums: [], playlists: [], followedArtists: [] };
  }

  const library = await Library.findOne({ userId }).lean();
  if (!library) {
    return { albums: [], playlists: [], followedArtists: [] };
  }

  const albumEntries = library.albums || [];
  const playlistEntries = library.playlists || [];
  const artistEntries = library.followedArtists || [];

  const albumIds = albumEntries.map((a) => a.albumId);
  const playlistIds = playlistEntries.map((p) => p.playlistId);
  const artistIds = artistEntries.map((a) => a.artistId);

  const [albumDocs, playlistDocs, artistDocs] = await Promise.all([
    mongoose
      .model("Album")
      .find({ _id: { $in: albumIds } })
      .select("title images type artist")
      .populate({ path: "artist", select: "name images" })
      .lean(),
    mongoose
      .model("Playlist")
      .find({ _id: { $in: playlistIds } })
      .select("title images owner isPublic type isSystem updatedAt")
      .populate({ path: "owner", select: "fullName images" })
      .lean(),
    mongoose
      .model("Artist")
      .find({ _id: { $in: artistIds } })
      .select("name images createdAt")
      .lean(),
  ]);

  const albumById = new Map(albumDocs.map((a) => [a._id.toString(), a]));
  const playlistById = new Map(
    playlistDocs.map((p) => [p._id.toString(), p]),
  );
  const artistById = new Map(artistDocs.map((a) => [a._id.toString(), a]));

  const albums = albumEntries
    .map((entry) => {
      const doc = albumById.get(entry.albumId.toString());
      if (!doc) return null;
      return { ...doc, addedAt: entry.addedAt };
    })
    .filter(Boolean)
    .sort(sortByLibraryAddedAtDesc);

  const playlists = playlistEntries
    .map((entry) => {
      const doc = playlistById.get(entry.playlistId.toString());
      if (!doc) return null;
      return { ...doc, addedAt: entry.addedAt };
    })
    .filter(Boolean)
    .sort(sortByLibraryAddedAtDesc);

  const followedArtists = artistEntries
    .map((entry) => {
      const doc = artistById.get(entry.artistId.toString());
      if (!doc) return null;
      return { ...doc, addedAt: entry.addedAt };
    })
    .filter(Boolean)
    .sort(sortByLibraryAddedAtDesc);

  return { albums, playlists, followedArtists };
}

export const getLibraryAlbums = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const library = await Library.findOne({ userId }).populate(
      "albums.albumId",
    );
    if (!library || !library.albums) return res.json({ albums: [] });

    const albums = library.albums
      .filter((a) => a.albumId && a.albumId._doc)
      .map((a) => ({ ...a.albumId._doc, addedAt: a.addedAt }))
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      );

    res.json({ albums });
  } catch (err) {
    next(err);
  }
};

export const toggleAlbumInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { albumId } = req.body;

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true },
    );
    if (!library.albums) library.albums = [];

    const exists = library.albums.some(
      (a) => a.albumId?.toString() === albumId,
    );
    if (exists) {
      library.albums = library.albums.filter(
        (a) => a.albumId?.toString() !== albumId,
      );
    } else {
      library.albums.push({
        albumId: new mongoose.Types.ObjectId(albumId),
        addedAt: new Date(),
      });
    }

    await library.save();
    res.json({ success: true, isAdded: !exists });
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
    const library = await Library.findOne({ userId }).populate({
      path: "playlists.playlistId",
      model: "Playlist",
      populate: { path: "owner", select: "fullName images" },
    });

    if (!library || !library.playlists) return res.json({ playlists: [] });

    const playlists = library.playlists
      .filter((item) => item.playlistId && item.playlistId._doc)
      .map((item) => ({ ...item.playlistId._doc, addedAt: item.addedAt }))
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      );

    res.json({ playlists });
  } catch (err) {
    next(err);
  }
};

export const togglePlaylistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { playlistId } = req.body;

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true },
    );
    if (!library.playlists) library.playlists = [];

    const exists = library.playlists.some(
      (p) => p.playlistId?.toString() === playlistId,
    );
    if (exists) {
      library.playlists = library.playlists.filter(
        (p) => p.playlistId?.toString() !== playlistId,
      );
    } else {
      library.playlists.push({
        playlistId: new mongoose.Types.ObjectId(playlistId),
        addedAt: new Date(),
      });
    }

    await library.save();
    res.json({ success: true, isAdded: !exists });
  } catch (err) {
    next(err);
  }
};

export const toggleArtistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { artistId } = req.body;

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true },
    );
    if (!library.followedArtists) library.followedArtists = [];

    const exists = library.followedArtists.some(
      (a) => a.artistId?.toString() === artistId,
    );
    if (exists) {
      library.followedArtists = library.followedArtists.filter(
        (a) => a.artistId?.toString() !== artistId,
      );
    } else {
      library.followedArtists.push({
        artistId: new mongoose.Types.ObjectId(artistId),
        addedAt: new Date(),
      });
    }

    await library.save();
    res.json({ success: true, isFollowed: !exists });
  } catch (err) {
    next(err);
  }
};

export const getFollowedArtists = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const library = await Library.findOne({ userId })
      .populate({
        path: "followedArtists.artistId",
        model: "Artist",
        select: "name images createdAt",
      })
      .lean();

    if (!library || !library.followedArtists) return res.json({ artists: [] });

    const artists = library.followedArtists
      .filter((item) => item.artistId && item.artistId._id)
      .map((item) => ({ ...item.artistId, addedAt: item.addedAt }))
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
      );

    res.json({ artists });
  } catch (err) {
    next(err);
  }
};

export const getOwnedPlaylists = async (req, res) => {
  try {
    const userId = req.user.id;
    // Ищем все плейлисты, которыми владеет пользователь (исключая системные, если фронт ожидает только обычные)
    const playlists = await Playlist.find({
      owner: userId,
      type: "USER_CREATED",
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
