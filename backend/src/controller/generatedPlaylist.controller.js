// backend/src/controller/generatedPlaylist.controller.js

import { GeneratedPlaylist } from "../models/generatedPlaylist.model.js";

export const getMyGeneratedPlaylists = async (
  req,
  res,
  next,
  returnInternal = false
) => {
  try {
    const userId = req.user.id;
    const playlists = await GeneratedPlaylist.find({ user: userId }).populate({
      path: "songs",
      select:
        "title artist albumId imageUrl hlsUrl duration playCount genres moods",
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (returnInternal) {
      return playlists;
    }
    return res.status(200).json(playlists);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getGeneratedPlaylistById = async (req, res, next) => {
  try {
    const playlist = await GeneratedPlaylist.findById(req.params.id).populate({
      path: "songs",
      select:
        "title artist albumId imageUrl hlsUrl duration playCount genres moods",
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (!playlist) {
      console.log(
        `[DEBUG] Playlist with ID ${req.params.id} NOT FOUND in database.`
      );
      return res.status(404).json({ message: "Generated playlist not found." });
    }

    if (playlist.user.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .json({ message: "You do not have permission to view this playlist." });
    }

    res.status(200).json(playlist);
  } catch (error) {
    next(error);
  }
};
