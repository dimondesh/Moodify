import { Album } from "../models/album.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

const SONG_MINIMAL_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt sourceShareUrl licenseCcUrl sourceProvider";

const attachSongsToAlbums = async (albums) => {
  if (!albums.length) return albums;

  const albumIds = albums.map((album) => album._id);
  const songs = await Song.find({ albumId: { $in: albumIds } })
    .select(SONG_MINIMAL_SELECT)
    .populate({
      path: "artist",
      model: "Artist",
      select: "name images",
    })
    .sort({ trackNumber: 1, createdAt: 1 })
    .lean();

  const songsByAlbumId = new Map();
  for (const song of songs) {
    if (!song.albumId) continue;
    const albumKey = song.albumId.toString();
    if (!songsByAlbumId.has(albumKey)) {
      songsByAlbumId.set(albumKey, []);
    }
    songsByAlbumId.get(albumKey).push(song);
  }

  return albums.map((album) => ({
    ...album,
    songs: songsByAlbumId.get(album._id.toString()) || [],
  }));
};

export const getAllAlbums = async (req, res, next) => {
  try {
    const albums = await Album.find()
      .populate("artist", "name images")
      .lean();

    res.status(200).json(await attachSongsToAlbums(albums));
  } catch (error) {
    next(error);
  }
};

export const getAlbumById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const album = await Album.findById(id)
      .populate("artist", "name images")
      .lean();

    if (!album) {
      return res
        .status(404)
        .json({ success: false, message: "Album not found" });
    }

    const [albumWithSongs] = await attachSongsToAlbums([album]);
    res.status(200).json({ album: albumWithSongs });
  } catch (error) {
    next(error);
  }
};

export const getTrendingAlbums = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 12,
) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingSongIdsResult = await ListenHistory.aggregate([
      { $match: { listenedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$song", listenCount: { $sum: 1 } } },
      { $sort: { listenCount: -1 } },
      { $limit: limit * 3 },
    ]);

    const songPopularityMap = new Map();
    trendingSongIdsResult.forEach((item) => {
      songPopularityMap.set(item._id.toString(), item.listenCount);
    });

    const trendingSongIds = trendingSongIdsResult
      .map((item) => item._id)
      .filter((id) => id);

    const trendingAlbumIds = await Song.distinct("albumId", {
      _id: { $in: trendingSongIds },
    });

    const albumsWithTrendingSongs = await Album.find({
      _id: { $in: trendingAlbumIds.filter(Boolean) },
    })
      .populate("artist", "name images")
      .lean();

    const albumsWithSongs = await attachSongsToAlbums(albumsWithTrendingSongs);

    const albumPopularity = new Map();

    albumsWithSongs.forEach((album) => {
      let totalListenCount = 0;
      let songCount = 0;

      album.songs.forEach((song) => {
        const songId = song._id.toString();
        const listenCount = songPopularityMap.get(songId);
        if (listenCount) {
          totalListenCount += listenCount;
          songCount++;
        }
      });

      if (songCount > 0) {
        albumPopularity.set(album._id.toString(), {
          album,
          totalListenCount,
          averageListenCount: totalListenCount / songCount,
          songCount,
        });
      }
    });

    const sortedAlbums = Array.from(albumPopularity.values())
      .sort((a, b) => {
        if (b.totalListenCount !== a.totalListenCount) {
          return b.totalListenCount - a.totalListenCount;
        }
        if (b.averageListenCount !== a.averageListenCount) {
          return b.averageListenCount - a.averageListenCount;
        }
        return b.songCount - a.songCount;
      })
      .slice(0, limit)
      .map((item) => item.album);

    if (sortedAlbums.length < limit) {
      const additionalAlbums = await Album.find({
        _id: { $nin: sortedAlbums.map((album) => album._id) },
      })
        .populate("artist", "name images")
        .sort({ createdAt: -1 })
        .limit(limit - sortedAlbums.length)
        .lean();

      sortedAlbums.push(...(await attachSongsToAlbums(additionalAlbums)));
    }

    if (returnInternal) {
      return sortedAlbums;
    }
    return res.json(sortedAlbums);
  } catch (error) {
    console.error("Error fetching trending albums:", error);
    if (returnInternal) {
      return [];
    }
    next(error);
  }
};
