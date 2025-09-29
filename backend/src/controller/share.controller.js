import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Mix } from "../models/mix.model.js";

export const getSharedEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    let entity;
    const songPopulateOptions = {
      path: "songs",
      select:
        "title duration imageUrl artist albumId hlsUrl playCount genres moods lyrics",
      populate: {
        path: "artist",
        model: "Artist",
        select: "name imageUrl",
      },
    };

    switch (entityType) {
      case "song":
        entity = await Song.findById(entityId).populate("artist", "name");
        break;
      case "album":
        entity = await Album.findById(entityId)
          .populate("artist", "name")
          .populate(songPopulateOptions);
        break;
      case "playlist":
        entity = await Playlist.findById(entityId)
          .populate("owner", "fullName imageUrl")
          .populate(songPopulateOptions);
        break;
      case "mix":
        entity = await Mix.findById(entityId).populate(songPopulateOptions);
        break;
      default:
        return res.status(400).json({ message: "Invalid entity type" });
    }

    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }

    res.status(200).json(entity);
  } catch (error) {
    next(error);
  }
};
