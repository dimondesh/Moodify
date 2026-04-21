// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Album } from "../models/album.model.js";
import { UserRecommendation } from "../models/userRecommendation.model.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

// Вспомогательная функция для расчета разницы (чем меньше, тем лучше)
const calculateFeatureDistance = (target, candidate) => {
  let distance = 0;

  // 1. Сравниваем Energy (вес: 40%) - очень важно для сохранения настроения
  if (target.energy !== null && candidate.energy !== null) {
    distance += Math.abs(target.energy - candidate.energy) * 0.4;
  }

  // 2. Сравниваем Danceability (вес: 30%)
  if (target.danceability !== null && candidate.danceability !== null) {
    distance += Math.abs(target.danceability - candidate.danceability) * 0.3;
  }

  // 3. Сравниваем BPM (вес: 30%)
  if (target.bpm !== null && candidate.bpm !== null) {
    // Нормализуем BPM (предположим, максимум 200) чтобы значения были от 0 до 1
    const bpmDiff = Math.abs(target.bpm - candidate.bpm);
    // Если разница кратна ~половине (например 70 и 140), это тоже хорошо (half-time/double-time)
    const isDoubleTime = Math.abs(target.bpm * 2 - candidate.bpm) < 5;
    const isHalfTime = Math.abs(target.bpm / 2 - candidate.bpm) < 5;

    if (isDoubleTime || isHalfTime) {
      distance += 0.05; // Небольшой штраф, но допустимо
    } else {
      distance += (Math.min(bpmDiff, 50) / 50) * 0.3;
    }
  }

  return distance;
};

// Функция проверки гармонической совместимости (упрощенная)
const isHarmonicallyCompatible = (target, candidate) => {
  if (!target.key || !candidate.key || !target.scale || !candidate.scale)
    return false;

  // Точное совпадение тональности и лада (например, C minor -> C minor)
  if (target.key === candidate.key && target.scale === candidate.scale)
    return true;

  // Здесь можно расширить логику до полноценного Camelot Wheel (соседние тональности)
  return false;
};

export const getVibeMatchTracks = async (currentSongId, limit = 10) => {
  const currentSong = await Song.findById(currentSongId).lean();
  if (!currentSong) return [];

  const { genres, moods, audioFeatures } = currentSong;

  // Если у трека нет анализа аудио, падаем на строгий поиск по жанрам
  if (
    !audioFeatures ||
    audioFeatures.bpm === null ||
    audioFeatures.energy === null
  ) {
    const fallbackAgg = await Song.aggregate([
      {
        $match: {
          _id: { $ne: currentSong._id },
          genres: { $in: genres }, // Только тот же жанр! Никаких $or с настроением
        },
      },
      { $sample: { size: limit } },
    ]);
    const populated = await Song.populate(fallbackAgg, {
      path: "artist",
      select: "name imageUrl",
    });
    return populated.sort(() => 0.5 - Math.random());
  }

  const targetBpm = audioFeatures.bpm;
  const bpmTolerance = 20;

  // 1. ПЕРВИЧНЫЙ ПОИСК: ЖЕСТКО требуем совпадения жанра
  let candidatesAgg = await Song.aggregate([
    {
      $match: {
        _id: { $ne: currentSong._id },
        $and: [
          // ГЛАВНОЕ ИЗМЕНЕНИЕ 1: Жанр обязан совпадать. Moods убраны из $or
          { genres: { $in: genres } },
          {
            $or: [
              {
                "audioFeatures.bpm": {
                  $gte: targetBpm - bpmTolerance,
                  $lte: targetBpm + bpmTolerance,
                },
              },
              {
                "audioFeatures.bpm": {
                  $gte: targetBpm * 2 - bpmTolerance,
                  $lte: targetBpm * 2 + bpmTolerance,
                },
              },
              {
                "audioFeatures.bpm": {
                  $gte: targetBpm / 2 - bpmTolerance,
                  $lte: targetBpm / 2 + bpmTolerance,
                },
              },
            ],
          },
        ],
      },
    },
    { $sample: { size: 100 } },
  ]);

  // 2. Fallback: Если в этом жанре с таким BPM/Energy треков не нашлось,
  // расширяем поиск до настроений, чтобы очередь не остановилась
  if (candidatesAgg.length < limit) {
    candidatesAgg = await Song.aggregate([
      {
        $match: {
          _id: { $ne: currentSong._id },
          $or: [{ genres: { $in: genres } }, { moods: { $in: moods } }],
          "audioFeatures.bpm": { $ne: null },
        },
      },
      { $sample: { size: 100 } },
    ]);
  }

  const candidates = await Song.populate(candidatesAgg, {
    path: "artist",
    select: "name imageUrl",
  });

  // 3. Оценка кандидатов: применяем ЖАНРОВЫЙ ШТРАФ
  const scoredCandidates = candidates.map((candidate) => {
    // Базовая оценка по физике звука (чем меньше, тем лучше)
    let score = calculateFeatureDistance(
      audioFeatures,
      candidate.audioFeatures,
    );

    if (isHarmonicallyCompatible(audioFeatures, candidate.audioFeatures)) {
      score -= 0.1;
    }

    const sharedMoods = candidate.moods.filter((m) =>
      moods.some((tm) => tm.toString() === m.toString()),
    ).length;
    score -= sharedMoods * 0.05;

    // ГЛАВНОЕ ИЗМЕНЕНИЕ 2: Проверяем жанры
    const sharedGenres = candidate.genres.filter((g) =>
      genres.some((tg) => tg.toString() === g.toString()),
    ).length;

    if (sharedGenres === 0) {
      // МАССИВНЫЙ ШТРАФ: Если жанры вообще не пересекаются (Метал попал к Трэпу)
      // Мы прибавляем 10 к score. Этот трек гарантированно улетит в самый конец списка.
      score += 10;
    } else {
      // Бонус за каждый совпадающий жанр
      score -= sharedGenres * 0.1;
    }

    return { ...candidate, score };
  });

  // 4. Сортируем: треки с нулевым sharedGenres будут иметь score > 10 и окажутся внизу
  scoredCandidates.sort((a, b) => a.score - b.score);

  const topMatches = scoredCandidates.slice(0, limit * 2);
  return topMatches.sort(() => 0.5 - Math.random()).slice(0, limit);
};

export const generateNewReleasesForUser = async (userId) => {
  try {
    const library = await Library.findOne({ userId }).select(
      "followedArtists.artistId",
    );
    if (!library || library.followedArtists.length === 0) {
      return;
    }

    const followedArtistIds = library.followedArtists.map((a) => a.artistId);

    const twoWeeksAgo = new Date(new Date().setDate(new Date().getDate() - 14));

    const newReleases = await Album.find({
      artist: { $in: followedArtistIds },
      createdAt: { $gte: twoWeeksAgo },
    }).sort({ createdAt: -1 });

    if (newReleases.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "NEW_RELEASE" },
        {
          items: newReleases.map((album) => album._id),
          generatedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      console.log(
        `[New Releases] Found ${newReleases.length} new releases for user ${userId}`,
      );
    }
  } catch (error) {
    console.error(`[New Releases] Error generating for user ${userId}:`, error);
  }
};
export const generatePlaylistRecommendationsForUser = async (userId) => {
  try {
    console.log(`[Playlist Recs] Starting generation for user: ${userId}`);

    const user = await User.findById(userId).select("playlists");
    const library = await Library.findOne({ userId }).select(
      "playlists.playlistId",
    );

    const userPlaylistIds = user ? user.playlists.map((p) => p.toString()) : [];
    const libraryPlaylistIds = library
      ? library.playlists.map((p) => p.playlistId.toString())
      : [];
    const allUserPlaylistIds = [
      ...new Set([...userPlaylistIds, ...libraryPlaylistIds]),
    ];

    if (allUserPlaylistIds.length === 0) {
      console.log(`[Playlist Recs] User ${userId} has no playlists. Skipping.`);
      return;
    }

    const userPlaylists = await Playlist.find({
      _id: { $in: allUserPlaylistIds },
    }).select("songs");
    const allSongIds = [...new Set(userPlaylists.flatMap((p) => p.songs))];

    if (allSongIds.length < 10) {
      console.log(
        `[Playlist Recs] User ${userId} has too few songs in playlists. Skipping.`,
      );
      return;
    }

    const songsWithTags = await Song.find({ _id: { $in: allSongIds } }).select(
      "genres moods",
    );
    const genreCounts = {};
    const moodCounts = {};

    songsWithTags.forEach((song) => {
      song.genres.forEach((genreId) => {
        genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
      });
      song.moods.forEach((moodId) => {
        moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
      });
    });

    const getTopItems = (counts, limit) =>
      Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, limit);
    const userTopGenres = getTopItems(genreCounts, 5);
    const userTopMoods = getTopItems(moodCounts, 3);

    const candidatePlaylists = await Playlist.find({
      isPublic: true,
      owner: { $ne: userId },
      "songs.0": { $exists: true },
    }).populate("songs", "genres moods");

    const scoredPlaylists = [];
    for (const playlist of candidatePlaylists) {
      let score = 0;
      const playlistGenreSet = new Set(
        playlist.songs.flatMap((s) => s.genres.map((id) => id.toString())),
      );
      const playlistMoodSet = new Set(
        playlist.songs.flatMap((s) => s.moods.map((id) => id.toString())),
      );

      userTopGenres.forEach((genreId) => {
        if (playlistGenreSet.has(genreId)) score += 3;
      });
      userTopMoods.forEach((moodId) => {
        if (playlistMoodSet.has(moodId)) score += 2;
      });

      score += Math.log2(playlist.likes + 1);

      if (score > 3) {
        scoredPlaylists.push({ playlistId: playlist._id, score });
      }
    }

    scoredPlaylists.sort((a, b) => b.score - a.score);
    const recommendedPlaylistIds = scoredPlaylists
      .slice(0, 10)
      .map((p) => p.playlistId);

    if (recommendedPlaylistIds.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "PLAYLIST_FOR_YOU" },
        {
          items: recommendedPlaylistIds,
          generatedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(
        `[Playlist Recs] Saved ${recommendedPlaylistIds.length} recommendations for user ${userId}`,
      );
    }
  } catch (error) {
    console.error(
      `[Playlist Recs] Error generating for user ${userId}:`,
      error,
    );
  }
};

export const generateFeaturedSongsForUser = async (userId, limit = 8) => {
  try {
    const listenHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .limit(50)
      .populate({
        path: "song",
        select: "genres moods artist",
      });

    let finalPicksIds = [];

    if (listenHistory.length >= 10) {
      const listenedSongIds = listenHistory
        .map((item) => item.song?._id)
        .filter(Boolean);

      const genreCounts = {};
      const moodCounts = {};
      const artistCounts = {};

      listenHistory.forEach((item) => {
        const { song } = item;
        if (song) {
          song.genres?.forEach((genreId) => {
            genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
          });
          song.moods?.forEach((moodId) => {
            moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
          });
          song.artist?.forEach((artistId) => {
            artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
          });
        }
      });

      const getTopItems = (counts, countLimit) =>
        Object.keys(counts)
          .sort((a, b) => counts[b] - counts[a])
          .slice(0, countLimit);

      const topGenreIds = getTopItems(genreCounts, 3).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      const topMoodIds = getTopItems(moodCounts, 2).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      const topArtistIds = getTopItems(artistCounts, 3).map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      const recommendations = await Song.aggregate([
        {
          $match: {
            _id: { $nin: listenedSongIds },
            $or: [
              { genres: { $in: topGenreIds } },
              { moods: { $in: topMoodIds } },
              { artist: { $in: topArtistIds } },
            ],
          },
        },
        { $sample: { size: limit } },
        { $project: { _id: 1 } },
      ]);

      finalPicksIds = recommendations.map((s) => s._id);
    }

    if (finalPicksIds.length < limit) {
      const trendingCount = limit - finalPicksIds.length;
      const trending = await Song.aggregate([
        { $match: { _id: { $nin: finalPicksIds } } },
        { $sort: { playCount: -1 } },
        { $limit: trendingCount * 3 },
        { $sample: { size: trendingCount } },
        { $project: { _id: 1 } },
      ]);

      finalPicksIds.push(...trending.map((s) => s._id));
    }

    if (finalPicksIds.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "FEATURED_SONGS" },
        {
          items: finalPicksIds,
          generatedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      console.log(
        `[Featured Songs] Generated ${finalPicksIds.length} picks for user ${userId}`,
      );
    }
  } catch (error) {
    console.error(
      `[Featured Songs] Error generating for user ${userId}:`,
      error,
    );
  }
};
