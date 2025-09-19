import { Album } from "../models/album.model.js";

export const getAllAlbums = async (req, res, next) => {
  try {
    const albums = await Album.find()
      .populate("artist", "name imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    res.status(200).json(albums);
  } catch (error) {
    next(error);
  }
};

export const getAlbumById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const album = await Album.findById(id)
      .populate("artist", "name imageUrl")
      .populate({
        path: "songs",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    if (!album) {
      return res
        .status(404)
        .json({ success: false, message: "Album not found" });
    }
    res.status(200).json({ album });
  } catch (error) {
    next(error);
  }
};
