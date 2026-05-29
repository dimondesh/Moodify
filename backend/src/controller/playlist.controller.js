import { Playlist } from "../models/playlist.model.js";
import { LikedSong } from "../models/likedSong.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { SavedPlaylist } from "../models/savedPlaylist.model.js";
import { getPlaylistEmbeddingRecommendations } from "../lib/recommendation.service.js";
import { deletePlaylistCoverFromCdn } from "../lib/playlistCover.service.js";
import {
  buildStaticCdnImages,
  toImageFields,
  replaceEntityImageVariants,
} from "../lib/imageVariants.service.js";
import fs from "fs/promises";
import {
  extractCoverAccentHexFromBuffer,
  extractCoverAccentHexFromUrl,
  isSkippableCoverImageUrl,
} from "../lib/coverAccent.service.js";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_LIKED_PLAYLIST_COVER,
} from "../constants/cdn.js";

export const LIKED_PLAYLIST_ID = "liked";

const SONG_MINIMAL_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt";

export const populatePlaylistEmbeddedSongs = {
  path: "songs",
  select: SONG_MINIMAL_SELECT,
  populate: {
    path: "artist",
    model: "Artist",
    select: "name images",
  },
};

const likedSongPopulate = {
  path: "song",
  select: SONG_MINIMAL_SELECT,
  populate: {
    path: "artist",
    model: "Artist",
    select: "name images",
  },
};

export async function buildVirtualLikedPlaylist(
  userId,
  { populateSongs = false } = {},
) {
  let query = LikedSong.find({ user: userId }).sort({ likedAt: -1 });
  if (populateSongs) {
    query = query.populate(likedSongPopulate);
  }

  const likedDocs = await query.lean();
  if (likedDocs.length === 0) {
    return null;
  }

  const owner = await User.findById(userId)
    .select("fullName images")
    .lean();

  const songs = populateSongs
    ? likedDocs
        .filter((d) => d.song)
        .map((d) => ({ ...d.song, likedAt: d.likedAt }))
    : likedDocs.map((d) => d.song).filter(Boolean);

  const latestLikedAt = likedDocs[0]?.likedAt;
  const now = new Date();

  return {
    _id: LIKED_PLAYLIST_ID,
    title: "Liked Songs",
    images: buildStaticCdnImages(CDN_LIKED_PLAYLIST_COVER),
    type: "LIKED_SONGS",
    isSystem: true,
    isPublic: false,
    owner: owner ?? { _id: userId },
    songs,
    createdAt: latestLikedAt ?? now,
    updatedAt: latestLikedAt ?? now,
  };
}

function rejectVirtualLikedPlaylistMutation(playlistId, res) {
  if (playlistId === LIKED_PLAYLIST_ID) {
    return res
      .status(400)
      .json({ message: "This playlist cannot be modified." });
  }
  return null;
}

export const createPlaylist = async (req, res, next) => {
  try {
    const { title, description, isPublic } = req.body;
    const ownerId = req.user.id;

    if (!title) {
      return res.status(400).json({ message: "Playlist title is required" });
    }

    let imageFields = {
      imagePublicId: null,
      images: buildStaticCdnImages(CDN_DEFAULT_ALBUM_COVER),
    };
    let coverAccentHex = null;

    if (req.files && req.files.image) {
      const coverBuf = await fs.readFile(req.files.image.tempFilePath);
      coverAccentHex = await extractCoverAccentHexFromBuffer(coverBuf);
      const imageUpload = await uploadImageVariantsFromSource(
        req.files.image,
        "playlist_covers",
      );
      imageFields = toImageFields(imageUpload);
    }

    const playlist = new Playlist({
      title,
      description,
      ...imageFields,
      coverAccentHex,
      owner: ownerId,
      isPublic: isPublic === "true",
      songs: [],
    });

    await playlist.save();

    res.status(201).json(playlist);
  } catch (error) {
    console.error("Error in createPlaylist:", error);
    next(error);
  }
};

export const getMyPlaylists = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const createdPlaylists = await Playlist.find({ owner: userId })
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    const savedRows = await SavedPlaylist.find({ user: userId })
      .sort({ addedAt: -1 })
      .populate({
        path: "playlist",
        populate: [
          { path: "owner", select: "fullName images" },
          populatePlaylistEmbeddedSongs,
        ],
      })
      .lean();

    const addedPlaylists = savedRows
      .filter((row) => row.playlist)
      .map((row) => ({
        ...row.playlist,
        addedAt: row.addedAt,
      }));

    const combinedPlaylistsMap = new Map();

    createdPlaylists.forEach((p) => {
      combinedPlaylistsMap.set(p._id.toString(), p);
    });

    addedPlaylists.forEach((p) => {
      combinedPlaylistsMap.set(p._id.toString(), p);
    });

    const allMyPlaylists = Array.from(combinedPlaylistsMap.values());
    const likedVirtual = await buildVirtualLikedPlaylist(userId, {
      populateSongs: false,
    });
    if (likedVirtual) {
      allMyPlaylists.unshift(likedVirtual);
    }

    res.status(200).json(allMyPlaylists);
  } catch (error) {
    console.error("Error in getMyPlaylists:", error);
    next(error);
  }
};

export const getPlaylistById = async (req, res, next) => {
  try {
    const playlistId = req.params.id;

    if (playlistId === LIKED_PLAYLIST_ID) {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const payload = await buildVirtualLikedPlaylist(req.user.id, {
        populateSongs: true,
      });
      if (!payload) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      return res.status(200).json(payload);
    }

    const playlist = await Playlist.findById(playlistId)
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const viewerId = req.user?.id?.toString();
    const ownerId = playlist.owner?._id?.toString();
    const isOwner = Boolean(ownerId && viewerId && ownerId === viewerId);

    if (!playlist.isPublic && !isOwner) {
      return res
        .status(403)
        .json({ message: "Access denied. This is a private playlist." });
    }

    res.status(200).json(playlist);
  } catch (error) {
    console.error("Error in getPlaylistById:", error);
    next(error);
  }
};

export const updatePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const rejected = rejectVirtualLikedPlaylistMutation(playlistId, res);
    if (rejected) return rejected;

    const { title, description, isPublic } = req.body;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Access denied. You are not the owner of this playlist.",
      });
    }

    if (title) playlist.title = title;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic === "true";

    if (req.files && req.files.image) {
      const previousCover = {
        imagePublicId: playlist.imagePublicId,
        images: playlist.images,
      };
      const coverBuf = await fs.readFile(req.files.image.tempFilePath);
      playlist.coverAccentHex =
        await extractCoverAccentHexFromBuffer(coverBuf);
      await replaceEntityImageVariants(
        playlist,
        req.files.image,
        "playlist_covers",
      );
    } else if (req.body.removeImage === "true") {
      const previousCover = {
        imagePublicId: playlist.imagePublicId,
        images: playlist.images,
      };
      playlist.imagePublicId = null;
      playlist.images = buildStaticCdnImages(CDN_DEFAULT_ALBUM_COVER);
      playlist.coverAccentHex = null;
      await deletePlaylistCoverFromCdn(previousCover);
    }

    await playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    res.status(200).json(updatedPlaylist);
  } catch (error) {
    console.error("Error in updatePlaylist:", error);
    next(error);
  }
};

export const deletePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const rejected = rejectVirtualLikedPlaylistMutation(playlistId, res);
    if (rejected) return rejected;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Access denied. You are not the owner of this playlist.",
      });
    }

    await deletePlaylistCoverFromCdn(playlist);

    await Playlist.findByIdAndDelete(playlistId);

    res.status(200).json({ message: "Playlist deleted successfully" });
  } catch (error) {
    console.error("Error in deletePlaylist:", error);
    next(error);
  }
};

export const addSongToPlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const rejected = rejectVirtualLikedPlaylistMutation(playlistId, res);
    if (rejected) return rejected;

    const { songId } = req.body;

    const playlist = await Playlist.findById(playlistId);
    const song = await Song.findById(songId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }
    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    if (playlist.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Access denied. You are not the owner of this playlist.",
      });
    }

    if (playlist.songs.includes(songId)) {
      return res.status(400).json({ message: "Song already in playlist" });
    }

    playlist.songs.push(songId);
    await playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    res.status(200).json({
      message: "Song added to playlist",
      playlist: updatedPlaylist,
    });
  } catch (error) {
    console.error("Error in addSongToPlaylist:", error);
    next(error);
  }
};

export const removeSongFromPlaylist = async (req, res, next) => {
  try {
    const { playlistId, songId } = req.params;
    const rejected = rejectVirtualLikedPlaylistMutation(playlistId, res);
    if (rejected) return rejected;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Access denied. You are not the owner of this playlist.",
      });
    }

    const initialSongCount = playlist.songs.length;
    playlist.songs = playlist.songs.filter(
      (song) => song.toString() !== songId,
    );

    if (playlist.songs.length === initialSongCount) {
      return res.status(404).json({ message: "Song not found in playlist" });
    }

    await playlist.save();
    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();
    res.status(200).json({ message: "Song removed from playlist", playlist });
  } catch (error) {
    console.error("Error in removeSongFromPlaylist:", error);
    next(error);
  }
};

export const likePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.likes.includes(userId)) {
      return res
        .status(400)
        .json({ message: "Playlist already liked by this user" });
    }

    playlist.likes.push(userId);
    await playlist.save();

    res.status(200).json({ message: "Playlist liked successfully", playlist });
  } catch (error) {
    console.error("Error in likePlaylist:", error);
    next(error);
  }
};

export const unlikePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const userId = req.user.id;

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const initialLikeCount = playlist.likes.length;
    playlist.likes = playlist.likes.filter((id) => id.toString() !== userId);

    if (playlist.likes.length === initialLikeCount) {
      return res
        .status(400)
        .json({ message: "Playlist was not liked by this user" });
    }

    await playlist.save();

    res
      .status(200)
      .json({ message: "Playlist unliked successfully", playlist });
  } catch (error) {
    console.error("Error in unlikePlaylist:", error);
    next(error);
  }
};

export const getPublicPlaylists = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    const publicPlaylists = await Playlist.find({ isPublic: true })
      .populate("owner", "fullName images")
      .populate(populatePlaylistEmbeddedSongs)
      .limit(18)
      .lean();

    if (returnInternal) {
      return publicPlaylists;
    }
    return res.status(200).json(publicPlaylists);
  } catch (error) {
    console.error("Error in getPublicPlaylists:", error);
    if (returnInternal) {
      return [];
    }
    next(error);
  }
};

export const createPlaylistFromSong = async (req, res, next) => {
  try {
    const { title, initialSongId } = req.body;
    const ownerId = req.user.id;

    if (!title || !initialSongId) {
      return res
        .status(400)
        .json({ message: "Title and initial song ID are required." });
    }

    const song = await Song.findById(initialSongId)
      .select("images coverAccentHex albumId")
      .populate({ path: "albumId", select: "images coverAccentHex" })
      .lean();

    const sourceImages =
      song?.images?.length > 0
        ? song.images
        : song?.albumId?.images?.length > 0
          ? song.albumId.images
          : buildStaticCdnImages(CDN_DEFAULT_ALBUM_COVER);

    const coverAccentHex =
      song?.coverAccentHex ?? song?.albumId?.coverAccentHex ?? null;

    const newPlaylist = new Playlist({
      title,
      description: ``,
      isPublic: true,
      owner: ownerId,
      imagePublicId: null,
      images: sourceImages,
      coverAccentHex,
      songs: [initialSongId],
    });

    await newPlaylist.save();

    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error("Error creating playlist from song:", error);
    next(error);
  }
};

export const getPlaylistRecommendations = async (req, res) => {
  try {
    const { id: playlistId } = req.params;

    if (playlistId === LIKED_PLAYLIST_ID) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const playlist = await Playlist.findById(playlistId).select("_id").lean();
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const result = await getPlaylistEmbeddingRecommendations(playlistId, 10);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting playlist recommendations:", error);
    res.status(200).json(null);
  }
};
