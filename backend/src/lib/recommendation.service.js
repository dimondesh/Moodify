// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
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
