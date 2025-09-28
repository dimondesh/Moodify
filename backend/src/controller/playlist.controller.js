import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { Library } from "../models/library.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { uploadToBunny, deleteFromBunny } from "../lib/bunny.service.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { getMadeForYouSongs, getTrendingSongs } from "./song.controller.js";
import {
  analyzePromptForPlaylistMetadata,
  selectSongsFromCandidates,
} from "../lib/ai.service.js";
import { optimizeAndUploadImage } from "../lib/image.service.js";

const uploadImageToBunny = async (file) => {
  try {
    const fileName = `${uuidv4()}${path.extname(file.name)}`;
    const result = await uploadToBunny(
      file.tempFilePath,
      "playlist_covers",
      fileName
    );
    return result.url;
  } catch (error) {
    console.error("Error uploading image to Bunny.net:", error);
    throw new Error("Failed to upload image file to Bunny.net");
  }
};

export const createPlaylist = async (req, res, next) => {
  try {
    const { title, description, isPublic } = req.body;
    const ownerId = req.user.id;

    if (!title) {
      return res.status(400).json({ message: "Playlist title is required" });
    }

    let imageUrl = "https://moodify.b-cdn.net/default-album-cover.png";
    let imagePublicId = null;

    if (req.files && req.files.image) {
      const imageUpload = await optimizeAndUploadImage(
        req.files.image,
        req.files.image.name,
        "playlist_covers"
      );
      imageUrl = imageUpload.url;
      imagePublicId = imageUpload.path;
    }

    const playlist = new Playlist({
      title,
      description,
      imageUrl,
      imagePublicId,
      owner: ownerId,
      isPublic: isPublic === "true",
      songs: [],
    });

    await playlist.save();

    await User.findByIdAndUpdate(ownerId, {
      $push: { playlists: playlist._id },
    });

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
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    const userLibrary = await Library.findOne({ userId })
      .populate({
        path: "playlists.playlistId",
        model: "Playlist",
        populate: [
          {
            path: "owner",
            select: "fullName imageUrl",
          },
          {
            path: "songs",
            populate: {
              path: "artist",
              model: "Artist",
              select: "name imageUrl",
            },
          },
        ],
      })
      .lean();

    const addedPlaylists = userLibrary
      ? userLibrary.playlists
          .filter((item) => item.playlistId)
          .map((item) => ({
            ...item.playlistId,
            addedAt: item.addedAt,
          }))
      : [];

    const combinedPlaylistsMap = new Map();

    createdPlaylists.forEach((p) => {
      combinedPlaylistsMap.set(p._id.toString(), p);
    });

    addedPlaylists.forEach((p) => {
      combinedPlaylistsMap.set(p._id.toString(), p);
    });

    const allMyPlaylists = Array.from(combinedPlaylistsMap.values());

    res.status(200).json(allMyPlaylists);
  } catch (error) {
    console.error("Error in getMyPlaylists:", error);
    next(error);
  }
};

export const getPlaylistById = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const playlist = await Playlist.findById(playlistId)
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (
      !playlist.isPublic &&
      playlist.owner._id.toString() !== req.user.id.toString()
    ) {
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
      if (playlist.imagePublicId) {
        await deleteFromBunny(playlist.imagePublicId);
      }
      const imageUpload = await optimizeAndUploadImage(
        req.files.image,
        req.files.image.name,
        "playlist_covers"
      );
      playlist.imageUrl = imageUpload.url;
      playlist.imagePublicId = imageUpload.path;
    }

    await playlist.save();

    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    req.io
      .to(`playlist-${playlistId}`)
      .emit("playlist_updated", { playlist: updatedPlaylist });

    res.status(200).json(updatedPlaylist);
  } catch (error) {
    console.error("Error in updatePlaylist:", error);
    next(error);
  }
};

export const deletePlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    if (playlist.owner.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Access denied. You are not the owner of this playlist.",
      });
    }

    // Удаляем обложку плейлиста из Bunny CDN
    if (playlist.imagePublicId) {
      await deleteFromBunny(playlist.imagePublicId);
    }

    await Playlist.findByIdAndDelete(playlistId);
    await User.findByIdAndUpdate(playlist.owner, {
      $pull: { playlists: playlist._id },
    });
    req.io
      .to(`playlist-${playlistId}`)
      .emit("playlist_deleted", { playlistId });

    res.status(200).json({ message: "Playlist deleted successfully" });
  } catch (error) {
    console.error("Error in deletePlaylist:", error);
    next(error);
  }
};

export const addSongToPlaylist = async (req, res, next) => {
  try {
    const playlistId = req.params.id;
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
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: { path: "artist", model: "Artist", select: "name imageUrl" },
      })
      .lean();
    console.log(
      `[SOCKET EMIT] Sending 'playlist_updated' to room 'playlist-${playlistId}' after adding a song.`
    );
    req.io
      .to(`playlist-${playlistId}`)
      .emit("playlist_updated", { playlist: updatedPlaylist });

    res.status(200).json({ message: "Song added to playlist", playlist });
  } catch (error) {
    console.error("Error in addSongToPlaylist:", error);
    next(error);
  }
};

export const removeSongFromPlaylist = async (req, res, next) => {
  try {
    const { playlistId, songId } = req.params;

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
      (song) => song.toString() !== songId
    );

    if (playlist.songs.length === initialSongCount) {
      return res.status(404).json({ message: "Song not found in playlist" });
    }

    await playlist.save();
    const updatedPlaylist = await Playlist.findById(playlistId)
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: { path: "artist", model: "Artist", select: "name imageUrl" },
      })
      .lean();
    console.log(
      `[BACKEND] Emitting 'playlist_updated' to room 'playlist-${playlistId}' after removing a song. New song count: ${updatedPlaylist.songs.length}`
    );
    console.log(
      `[SOCKET EMIT] Sending 'playlist_updated' to room 'playlist-${playlistId}' after removing a song.`
    );
    req.io
      .to(`playlist-${playlistId}`)
      .emit("playlist_updated", { playlist: updatedPlaylist });
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
  returnInternal = false
) => {
  try {
    const publicPlaylists = await Playlist.find({ isPublic: true })
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
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
    const { title, imageUrl, initialSongId } = req.body;
    const ownerId = req.user.id;

    if (!title || !initialSongId) {
      return res
        .status(400)
        .json({ message: "Title and initial song ID are required." });
    }

    const newPlaylist = new Playlist({
      title,
      description: ``,
      isPublic: true,
      owner: ownerId,
      imageUrl: imageUrl || "https://moodify.b-cdn.net/default-album-cover.png",
      songs: [initialSongId],
    });

    await newPlaylist.save();

    await User.findByIdAndUpdate(ownerId, {
      $push: { playlists: newPlaylist._id },
    });

    res.status(201).json(newPlaylist);
  } catch (error) {
    console.error("Error creating playlist from song:", error);
    next(error);
  }
};

export const getPlaylistRecommendations = async (req, res, next) => {
  try {
    const { id: playlistId } = req.params;
    const userId = req.user.id;

    const playlist = await Playlist.findById(playlistId).select("songs").lean();

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    let recommendations = [];

    if (playlist.songs && playlist.songs.length > 0) {
      const songDetails = await Song.find({ _id: { $in: playlist.songs } })
        .select("genres moods artist")
        .lean();

      const genreIds = [...new Set(songDetails.flatMap((s) => s.genres))];
      const moodIds = [...new Set(songDetails.flatMap((s) => s.moods))];
      const artistIds = [...new Set(songDetails.flatMap((s) => s.artist))];

      recommendations = await Song.aggregate([
        { $match: { _id: { $nin: playlist.songs } } },
        {
          $match: {
            $or: [
              { genres: { $in: genreIds } },
              { moods: { $in: moodIds } },
              { artist: { $in: artistIds } },
            ],
          },
        },
        {
          $addFields: {
            score: {
              $add: [
                { $size: { $setIntersection: ["$genres", genreIds] } },
                { $size: { $setIntersection: ["$moods", moodIds] } },
                {
                  $multiply: [
                    { $size: { $setIntersection: ["$artist", artistIds] } },
                    2,
                  ],
                },
              ],
            },
          },
        },
        { $sort: { score: -1, playCount: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: "artists",
            localField: "artist",
            foreignField: "_id",
            as: "artist",
          },
        },
      ]);
    }

    if (recommendations.length === 0) {
      const mockReq = { user: { id: userId } };
      const mockRes = { json: (data) => (recommendations = data) };
      await getMadeForYouSongs(mockReq, mockRes, next);
    }

    if (recommendations.length === 0) {
      const mockReq = {};
      const mockRes = { json: (data) => (recommendations = data) };
      await getTrendingSongs(mockReq, mockRes, next);
    }

    res.status(200).json(recommendations);
  } catch (error) {
    console.error("Error getting playlist recommendations:", error);
    next(error);
  }
};

export const createPlaylistWithAI = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const ownerId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required" });
    }

    const metadata = await analyzePromptForPlaylistMetadata(prompt);

    const genreDocs = await Genre.find({
      name: { $in: metadata.genres.map((g) => new RegExp(`^${g}$`, "i")) },
    });
    const moodDocs = await Mood.find({
      name: { $in: metadata.moods.map((m) => new RegExp(`^${m}$`, "i")) },
    });
    const genreIds = genreDocs.map((g) => g._id);
    const moodIds = moodDocs.map((m) => m._id);

    const candidateSongs = await Song.find({
      $or: [{ genres: { $in: genreIds } }, { moods: { $in: moodIds } }],
    })
      .populate("artist", "name")
      .limit(150)
      .lean();

    if (candidateSongs.length < 10) {
      return res.status(404).json({
        message:
          "Недостаточно подходящих треков в библиотеке. Попробуйте другой запрос.",
      });
    }

    const formattedCandidates = candidateSongs.map((song) => ({
      _id: song._id.toString(),
      title: song.title,
      artistName: song.artist.map((a) => a.name).join(", "),
    }));

    const selectedSongsByAI = await selectSongsFromCandidates(
      prompt,
      formattedCandidates
    );

    const finalSongIds = selectedSongsByAI.map((s) => s.id);

    if (finalSongIds.length === 0) {
      return res.status(404).json({
        message:
          "ИИ не смог составить плейлист. Пожалуйста, попробуйте еще раз.",
      });
    }
    let playlistImageUrl = "https://moodify.b-cdn.net/default-album-cover.png";
    if (finalSongIds.length > 0) {
      const firstSong = await Song.findById(finalSongIds[0])
        .select("imageUrl")
        .lean();
      if (firstSong && firstSong.imageUrl) {
        playlistImageUrl = firstSong.imageUrl;
      }
    }

    const newPlaylist = new Playlist({
      title: metadata.title,
      description: metadata.description,
      owner: ownerId,
      songs: finalSongIds,
      isPublic: false,
      imageUrl: playlistImageUrl,
    });
    await newPlaylist.save();

    await User.findByIdAndUpdate(ownerId, {
      $push: { playlists: newPlaylist._id },
    });

    const populatedPlaylist = await Playlist.findById(newPlaylist._id)
      .populate("owner", "fullName imageUrl")
      .populate({
        path: "songs",
        populate: { path: "artist", model: "Artist", select: "name imageUrl" },
      })
      .lean();

    res.status(201).json(populatedPlaylist);
  } catch (error) {
    console.error("Error in createPlaylistWithAI:", error);
    next(error);
  }
};
