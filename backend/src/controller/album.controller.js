import { Album } from "../models/album.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

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

export const getTrendingAlbums = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 12
) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Получаем популярные песни за последние 7 дней с количеством прослушиваний
    const trendingSongIdsResult = await ListenHistory.aggregate([
      { $match: { listenedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$song", listenCount: { $sum: 1 } } },
      { $sort: { listenCount: -1 } },
      { $limit: limit * 3 }, // Берем больше песен для лучшего покрытия альбомов
    ]);

    // Создаем Map для быстрого доступа к количеству прослушиваний
    const songPopularityMap = new Map();
    trendingSongIdsResult.forEach((item) => {
      songPopularityMap.set(item._id.toString(), item.listenCount);
    });

    const trendingSongIds = trendingSongIdsResult
      .map((item) => item._id)
      .filter((id) => id);

    // Получаем альбомы, содержащие эти популярные песни
    const albumsWithTrendingSongs = await Album.find({
      songs: { $in: trendingSongIds },
    })
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

    // Подсчитываем популярность альбомов на основе популярности их песен
    const albumPopularity = new Map();

    albumsWithTrendingSongs.forEach((album) => {
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
          totalListenCount, // Общее количество прослушиваний песен альбома
          averageListenCount: totalListenCount / songCount, // Среднее количество прослушиваний
          songCount,
        });
      }
    });

    // Сортируем альбомы по популярности
    const sortedAlbums = Array.from(albumPopularity.values())
      .sort((a, b) => {
        // Сначала по общему количеству прослушиваний, затем по среднему количеству прослушиваний
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

    // Если недостаточно альбомов с трендовыми песнями, добавляем популярные альбомы
    if (sortedAlbums.length < limit) {
      const additionalAlbums = await Album.find({
        _id: { $nin: sortedAlbums.map((album) => album._id) },
      })
        .populate("artist", "name imageUrl")
        .populate({
          path: "songs",
          populate: {
            path: "artist",
            model: "Artist",
            select: "name imageUrl",
          },
        })
        .sort({ createdAt: -1 }) // Новые альбомы
        .limit(limit - sortedAlbums.length)
        .lean();

      sortedAlbums.push(...additionalAlbums);
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
