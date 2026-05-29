import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";

const SHARED_SONG_SELECT =
  "title duration images artist albumId hlsUrl playCount genres moods";

const playlistSongPopulateOptions = {
  path: "songs",
  select: SHARED_SONG_SELECT,
  populate: {
    path: "artist",
    model: "Artist",
    select: "name images",
  },
};

export const getSharedEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    let entity;

    switch (entityType) {
      case "song":
        entity = await Song.findById(entityId).populate("artist", "name");
        break;
      case "album": {
        const album = await Album.findById(entityId)
          .populate("artist", "name")
          .lean();
        if (!album) break;

        const songs = await Song.find({ albumId: entityId })
          .select(SHARED_SONG_SELECT)
          .populate({ path: "artist", select: "name images" })
          .sort({ trackNumber: 1, createdAt: 1 })
          .lean();

        entity = { ...album, songs };
        break;
      }
      case "playlist":
        entity = await Playlist.findById(entityId)
          .populate("owner", "fullName images")
          .populate(playlistSongPopulateOptions);
        if (entity && !entity.isPublic) {
          return res
            .status(403)
            .json({ message: "This playlist is private and cannot be shared." });
        }
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
