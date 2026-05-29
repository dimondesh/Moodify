// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Album } from "../models/album.model.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

// Вспомогательная функция для расчета разницы (чем меньше, тем лучше)

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
// Функция расчета дистанции по доступным признакам (теперь только BPM)
const calculateFeatureDistance = (target, candidate) => {
  let distance = 0;

  if (target.bpm !== null && candidate.bpm !== null) {
    const bpmDiff = Math.abs(target.bpm - candidate.bpm);

    // Проверяем, не является ли трек в два раза быстрее/медленнее (half-time / double-time)
    const isDoubleTime = Math.abs(target.bpm * 2 - candidate.bpm) < 5;
    const isHalfTime = Math.abs(target.bpm / 2 - candidate.bpm) < 5;

    if (isDoubleTime || isHalfTime) {
      // Даем небольшой штраф, но считаем такой переход допустимым
      distance += 0.05;
    } else {
      // Штрафуем за прямую разницу в BPM
      distance += (Math.min(bpmDiff, 50) / 50) * 0.5;
    }
  }

  return distance;
};

// Функция проверки гармонической совместимости по колесу Камелота (Camelot Wheel)
const isHarmonicallyCompatible = (target, candidate) => {
  if (!target.camelot || !candidate.camelot) return false;
  if (target.camelot === candidate.camelot) return true;

  // Парсим значения (например, "8A" -> число 8, буква "A")
  const matchTarget = target.camelot.match(/(\d+)([AB])/);
  const matchCandidate = candidate.camelot.match(/(\d+)([AB])/);

  if (!matchTarget || !matchCandidate) return false;

  const numT = parseInt(matchTarget[1], 10);
  const letT = matchTarget[2];
  const numC = parseInt(matchCandidate[1], 10);
  const letC = matchCandidate[2];

  // Правило 1: Изменение настроения (минор <-> мажор), та же цифра (например, 8A <-> 8B)
  if (numT === numC && letT !== letC) return true;

  // Правило 2: Идеальный переход (соседняя цифра, та же буква)
  if (letT === letC) {
    if (numT === numC + 1 || numT === numC - 1) return true;
    // Учитываем кольцевой переход 12 <-> 1
    if ((numT === 12 && numC === 1) || (numT === 1 && numC === 12)) return true;
  }

  // Правило 3 (опционально): Energy Boost (+2 цифры, та же буква). Хорошо звучит в миксах.
  if (letT === letC) {
    if (numT === numC + 2 || numT === numC - 2) return true;
    if ((numT === 11 && numC === 1) || (numT === 1 && numC === 11)) return true;
    if ((numT === 12 && numC === 2) || (numT === 2 && numC === 12)) return true;
  }

  return false;
};
export const getVibeMatchTracks = async (currentSongId, limit = 10) => {
  const currentSong = await Song.findById(currentSongId).lean();
  if (!currentSong) return [];

  const { genres, moods, audioFeatures } = currentSong;

  // Если у трека нет анализа аудио, падаем на строгий поиск по жанрам
  // Если у трека нет анализа аудио, падаем на строгий поиск по жанрам
  if (!audioFeatures || audioFeatures.bpm === null) {
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
      select: "name images",
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
    select: "name images",
  });

  // 3. Оценка кандидатов: применяем ЖАНРОВЫЙ ШТРАФ И КОСИНУСНОЕ СХОДСТВО
  const scoredCandidates = candidates.map((candidate) => {
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

    const sharedGenres = candidate.genres.filter((g) =>
      genres.some((tg) => tg.toString() === g.toString()),
    ).length;

    if (sharedGenres === 0) {
      score += 10;
    } else {
      score -= sharedGenres * 0.1;
    }

    if (
      currentSong.audioFeatures?.embedding &&
      candidate.audioFeatures?.embedding
    ) {
      const similarity = cosineSimilarity(
        currentSong.audioFeatures.embedding,
        candidate.audioFeatures.embedding,
      );
      score -= similarity * 2.0;
    }

    return { ...candidate, score };
  });

  // 4. Сортируем: треки с нулевым sharedGenres будут иметь score > 10 и окажутся внизу
  scoredCandidates.sort((a, b) => a.score - b.score);

  const topMatches = scoredCandidates.slice(0, limit * 2);
  return topMatches.sort(() => 0.5 - Math.random()).slice(0, limit);
};

const computeCentroidEmbedding = (embeddings) => {
  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  for (const vec of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }
  const n = embeddings.length;
  for (let i = 0; i < dim; i++) {
    sum[i] /= n;
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += sum[i] * sum[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return sum;
  return sum.map((v) => v / norm);
};

const scoreCandidateAgainstPlaylist = (
  centroidEmbedding,
  avgAudioFeatures,
  genreIds,
  moodIds,
  candidate,
) => {
  let score = calculateFeatureDistance(
    avgAudioFeatures,
    candidate.audioFeatures || {},
  );

  if (
    isHarmonicallyCompatible(
      avgAudioFeatures,
      candidate.audioFeatures || {},
    )
  ) {
    score -= 0.1;
  }

  const sharedMoods = (candidate.moods || []).filter((m) =>
    moodIds.some((tm) => tm.toString() === m.toString()),
  ).length;
  score -= sharedMoods * 0.05;

  const sharedGenres = (candidate.genres || []).filter((g) =>
    genreIds.some((tg) => tg.toString() === g.toString()),
  ).length;

  if (sharedGenres === 0) {
    score += 10;
  } else {
    score -= sharedGenres * 0.1;
  }

  if (candidate.audioFeatures?.embedding) {
    const similarity = cosineSimilarity(
      centroidEmbedding,
      candidate.audioFeatures.embedding,
    );
    score -= similarity * 2.0;
  }

  return score;
};

const formatPlaylistRecommendationSong = (song) => ({
  _id: song._id.toString(),
  title: song.title,
  images: song.images || [],
  coverAccentHex: song.coverAccentHex ?? null,
  duration: song.duration,
  playCount: song.playCount ?? 0,
  albumId: song.albumId?._id
    ? song.albumId._id.toString()
    : song.albumId
      ? song.albumId.toString()
      : null,
  albumTitle: song.albumId?.title ?? null,
  artist: song.artist
    ? song.artist.map((a) => ({
        _id: a._id.toString(),
        name: a.name,
        images: a.images || [],
      }))
    : [],
});

export const getPlaylistEmbeddingRecommendations = async (
  playlistId,
  limit = 10,
) => {
  try {
    const playlist = await Playlist.findById(playlistId).select("songs").lean();
    if (!playlist?.songs?.length || playlist.songs.length <= 3) {
      return null;
    }

    const playlistSongIds = playlist.songs.map((id) => id.toString());
    const playlistSongs = await Song.find({ _id: { $in: playlist.songs } })
      .select("genres moods audioFeatures")
      .lean();

    if (!playlistSongs.length) return null;

    const embeddings = playlistSongs
      .map((s) => s.audioFeatures?.embedding)
      .filter((e) => Array.isArray(e) && e.length > 0);

    if (embeddings.length === 0) return null;

    const centroidEmbedding = computeCentroidEmbedding(embeddings);

    const genreIds = [
      ...new Map(
        playlistSongs
          .flatMap((s) => s.genres || [])
          .map((g) => [g.toString(), g]),
      ).values(),
    ];
    const moodIds = [
      ...new Map(
        playlistSongs
          .flatMap((s) => s.moods || [])
          .map((m) => [m.toString(), m]),
      ).values(),
    ];

    const bpms = playlistSongs
      .map((s) => s.audioFeatures?.bpm)
      .filter((b) => b != null);
    const targetBpm =
      bpms.length > 0
        ? bpms.reduce((acc, b) => acc + b, 0) / bpms.length
        : null;

    const avgAudioFeatures = {
      bpm: targetBpm,
      camelot: null,
      embedding: centroidEmbedding,
    };

    const bpmTolerance = 20;
    const excludeIds = playlist.songs;

    let matchQuery = {
      _id: { $nin: excludeIds },
      "audioFeatures.embedding": { $exists: true, $ne: null },
    };

    if (genreIds.length > 0 && targetBpm != null) {
      matchQuery = {
        _id: { $nin: excludeIds },
        "audioFeatures.embedding": { $exists: true, $ne: null },
        $and: [
          { genres: { $in: genreIds } },
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
      };
    } else if (genreIds.length > 0) {
      matchQuery.genres = { $in: genreIds };
    }

    let candidatesAgg = await Song.aggregate([
      { $match: matchQuery },
      { $sample: { size: 100 } },
    ]);

    if (candidatesAgg.length < limit) {
      const fallbackMatch = {
        _id: { $nin: excludeIds },
        "audioFeatures.embedding": { $exists: true, $ne: null },
      };
      if (genreIds.length > 0 || moodIds.length > 0) {
        fallbackMatch.$or = [];
        if (genreIds.length > 0) {
          fallbackMatch.$or.push({ genres: { $in: genreIds } });
        }
        if (moodIds.length > 0) {
          fallbackMatch.$or.push({ moods: { $in: moodIds } });
        }
      }
      candidatesAgg = await Song.aggregate([
        { $match: fallbackMatch },
        { $sample: { size: 100 } },
      ]);
    }

    if (candidatesAgg.length === 0) return null;

    const candidates = await Song.populate(candidatesAgg, [
      { path: "artist", select: "name images" },
      { path: "albumId", select: "title images" },
    ]);

    const scoredCandidates = candidates.map((candidate) => ({
      ...candidate,
      score: scoreCandidateAgainstPlaylist(
        centroidEmbedding,
        avgAudioFeatures,
        genreIds,
        moodIds,
        candidate,
      ),
    }));

    scoredCandidates.sort((a, b) => a.score - b.score);
    const topMatches = scoredCandidates.slice(0, limit * 2);
    const shuffled = topMatches.sort(() => 0.5 - Math.random()).slice(0, limit);

    return shuffled.map(({ score: _score, ...song }) =>
      formatPlaylistRecommendationSong(song),
    );
  } catch (error) {
    console.error("getPlaylistEmbeddingRecommendations:", error);
    return null;
  }
};
