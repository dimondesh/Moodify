import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl duration playCount";

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

// --- НОВАЯ ЛОГИКА ЛАЙКОВ ТРЕКОВ ---
export const toggleSongLikeInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.body;

    // Ищем или создаем системный плейлист любимых треков
    let likedPlaylist = await Playlist.findOne({
      owner: userId,
      type: "LIKED_SONGS",
    });

    if (!likedPlaylist) {
      likedPlaylist = new Playlist({
        title: "Liked Songs", // Потом можно заменить на ключ локализации
        description: "Ваши сохраненные треки",
        imageUrl: "/liked.png", // Дефолтная картинка из папки public
        owner: userId,
        type: "LIKED_SONGS",
        isSystem: true,
        isPublic: false,
        songs: [],
      });
    }

    const songIndex = likedPlaylist.songs.indexOf(songId);
    let isLikedStatus;

    if (songIndex > -1) {
      likedPlaylist.songs.splice(songIndex, 1);
      isLikedStatus = false;
    } else {
      likedPlaylist.songs.push(songId);
      isLikedStatus = true;
    }

    await likedPlaylist.save();
    res.json({
      success: true,
      isLiked: isLikedStatus,
      playlistId: likedPlaylist._id,
    });
  } catch (err) {
    next(err);
  }
};

export const getLikedSongs = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const likedPlaylist = await Playlist.findOne({
      owner: userId,
      type: "LIKED_SONGS",
    })
      .populate({
        path: "songs",
        select: SONG_MINIMAL_SELECT,
        populate: { path: "artist", select: "name imageUrl" },
      })
      .lean();

    if (!likedPlaylist || !likedPlaylist.songs) return res.json({ songs: [] });

    // Разворачиваем массив, чтобы последние лайки были первыми
    const songs = likedPlaylist.songs.slice().reverse();
    res.json({ songs });
  } catch (err) {
    next(err);
  }
};
// ------------------------------------

export const getPlaylistsInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const library = await Library.findOne({ userId }).populate({
      path: "playlists.playlistId",
      model: "Playlist",
      populate: { path: "owner", select: "fullName imageUrl" },
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
        select: "name imageUrl createdAt",
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
    const userId = req.user?.id;
    const library = await Library.findOne({ userId }).lean();

    if (!library) {
      return res.json({ albums: [], playlists: [], followedArtists: [] });
    }

    const albumIds = library.albums?.map((a) => a.albumId) || [];
    const playlistIds = library.playlists?.map((p) => p.playlistId) || [];
    const artistIds = library.followedArtists?.map((a) => a.artistId) || [];

    const [albums, playlists, followedArtists] = await Promise.all([
      mongoose
        .model("Album")
        .find({ _id: { $in: albumIds } })
        .select("title imageUrl")
        .lean(),
      mongoose
        .model("Playlist")
        .find({ _id: { $in: playlistIds } })
        .select("title imageUrl owner isPublic")
        .lean(),
      mongoose
        .model("Artist")
        .find({ _id: { $in: artistIds } })
        .select("name imageUrl")
        .lean(),
    ]);

    res.json({ albums, playlists, followedArtists });
  } catch (err) {
    next(err);
  }
};
