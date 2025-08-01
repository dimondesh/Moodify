// backend/src/controller/song.controller.js
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

export const getAllSongs = async (req, res, next) => {
  try {
    const songs = await Song.find()
      .populate("artist", "name imageUrl")
      .populate("genres") // <-- ДОБАВИТЬ ЭТУ СТРОКУ
      .populate("moods") // <-- И ЭТУ СТРОКУ
      .sort({ createdAt: -1 });
    res.status(200).json({ songs });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedSongs = async (req, res, next) => {
  try {
    // Для Featured оставляем случайную выборку
    const songs = await Song.aggregate([
      { $sample: { size: 6 } },
      {
        $lookup: {
          from: "artists",
          localField: "artist",
          foreignField: "_id",
          as: "artistDetails",
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          artist: "$artistDetails",
          imageUrl: 1,
          instrumentalUrl: 1,
          vocalsUrl: 1,
          albumId: 1,
          lyrics: 1,
        },
      },
    ]);
    res.json(songs);
  } catch (error) {
    next(error);
  }
};

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ TRENDING ---
export const getTrendingSongs = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingSongIdsResult = await ListenHistory.aggregate([
      { $match: { listenedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$song", listenCount: { $sum: 1 } } },
      { $sort: { listenCount: -1 } },
      { $limit: 20 },
      { $project: { _id: 1 } },
    ]);

    // 1. Получаем ID песен в ПРАВИЛЬНОМ порядке популярности
    const orderedSongIds = trendingSongIdsResult
      .map((item) => item._id)
      .filter((id) => id);

    if (orderedSongIds.length === 0) {
      const popularSongs = await Song.find()
        .sort({ playCount: -1 })
        .limit(8)
        .populate("artist", "name imageUrl");
      return res.json(popularSongs);
    }

    // 2. Получаем документы песен. Они придут в НЕПРАВИЛЬНОМ, "естественном" порядке
    const unorderedSongs = await Song.find({
      _id: { $in: orderedSongIds },
    }).populate("artist", "name imageUrl");

    // 3. КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Принудительно сортируем полученные песни
    // в том же порядке, в котором были наши ID.
    // Для этого создаем карту для быстрого доступа.
    const songMap = new Map(
      unorderedSongs.map((song) => [song._id.toString(), song])
    );

    // Собираем итоговый массив, итерируясь по ПРАВИЛЬНО упорядоченному массиву ID
    const orderedSongs = orderedSongIds
      .map((id) => songMap.get(id.toString()))
      .filter(Boolean);

    res.json(orderedSongs);
  } catch (error) {
    console.error("Error fetching trending songs:", error);
    next(error);
  }
};

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ---
export const getMadeForYouSongs = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const listenHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .limit(100)
      .populate({
        path: "song",
        select: "genres moods artist",
      });

    if (listenHistory.length === 0) {
      return getTrendingSongs(req, res, next);
    }

    // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    // Фильтруем записи, где песня была удалена (item.song === null)
    const validHistory = listenHistory.filter((item) => item.song !== null);

    // Если после фильтрации история пуста, тоже возвращаем тренды
    if (validHistory.length === 0) {
      return getTrendingSongs(req, res, next);
    }

    const listenedSongIds = validHistory.map((item) => item.song._id);
    // ------------------------------------

    const genreCounts = {};
    const moodCounts = {};
    const artistCounts = {};

    // Используем отфильтрованную историю validHistory
    validHistory.forEach((item) => {
      const { song } = item;
      // Дополнительная проверка на всякий случай
      if (song) {
        song.genres.forEach((genreId) => {
          genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
        });
        song.moods.forEach((moodId) => {
          moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
        });
        song.artist.forEach((artistId) => {
          artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
        });
      }
    });

    const getTopItems = (counts, limit) =>
      Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, limit);

    const topGenreIds = getTopItems(genreCounts, 5);
    const topMoodIds = getTopItems(moodCounts, 3);
    const topArtistIds = getTopItems(artistCounts, 5);

    const recommendations = await Song.find({
      _id: { $nin: listenedSongIds },
      $or: [
        { genres: { $in: topGenreIds } },
        { moods: { $in: topMoodIds } },
        { artist: { $in: topArtistIds } },
      ],
    })
      .limit(50)
      .populate("artist", "name imageUrl");

    const shuffledRecommendations = recommendations.sort(
      () => 0.5 - Math.random()
    );

    res.json(shuffledRecommendations.slice(0, 8));
  } catch (error) {
    console.error("Error fetching 'Made For You' songs:", error);
    next(error);
  }
};

// --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ---
export const recordListen = async (req, res, next) => {
  try {
    const { id: songId } = req.params;

    // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ---
    // Берем ID пользователя из req.user.id, как вы и говорили.
    const userId = req.user.id;

    // Эта проверка теперь должна пройти успешно
    if (!songId || !userId) {
      console.error(
        `[recordListen] Validation Failed: songId=${songId}, userId=${userId}`
      );
      return res
        .status(400)
        .json({ message: "Song ID and User ID are required." });
    }

    const songExists = await Song.findById(songId);
    if (!songExists) {
      return res.status(404).json({ message: "Song not found." });
    }

    const listen = new ListenHistory({
      user: userId,
      song: songId,
    });
    await listen.save();

    await Song.updateOne({ _id: songId }, { $inc: { playCount: 1 } });

    res.status(200).json({
      success: true,
      message: "Listen recorded successfully.",
    });
  } catch (error) {
    console.error("Error in recordListen controller:", error);
    next(error);
  }
};
// Старую функцию incrementPlayCount можно полностью удалить
export const getListenHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Получаем всю историю, сортируя по последней дате прослушивания
    const fullHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .populate({
        path: "song",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean(); // .lean() для производительности

    if (!fullHistory || fullHistory.length === 0) {
      return res.json({ songs: [] });
    }

    // 2. Убираем дубликаты, сохраняя порядок последнего прослушивания
    const uniqueSongs = [];
    const seenSongIds = new Set();

    for (const record of fullHistory) {
      // Пропускаем, если песня была удалена или уже добавлена в наш список
      if (record.song && !seenSongIds.has(record.song._id.toString())) {
        seenSongIds.add(record.song._id.toString());
        uniqueSongs.push(record.song);
      }
    }

    res.status(200).json({ songs: uniqueSongs });
  } catch (error) {
    console.error("Error fetching listen history:", error);
    next(error);
  }
};
