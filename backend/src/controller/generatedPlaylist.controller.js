import { GeneratedPlaylist } from "../models/generatedPlaylist.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl duration playCount";

export const getMyGeneratedPlaylists = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    const userId = req.user.id;
    const playlists = await GeneratedPlaylist.find({ user: userId }).populate({
      path: "songs",
      select: SONG_MINIMAL_SELECT,
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
      select: SONG_MINIMAL_SELECT,
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (!playlist) {
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
