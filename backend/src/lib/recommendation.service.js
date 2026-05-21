// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Album } from "../models/album.model.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

// Ranking: cosine similarity first, then BPM/camelot, then predicted tag tweaks.
const EMBEDDING_DIM = 1280;
const LEGACY_EMBEDDING_DIMS = [50, 39];
const GENRE_POOL_K = 10;
const MOOD_POOL_K = 10;
const EMBEDDING_SCORE_WEIGHT = 2.0;
const GENRE_OVERLAP_BONUS = 0.1;
const MOOD_OVERLAP_BONUS = 0.05;
const TAG_PROB_BONUS_WEIGHT = 0.05;
const NO_GENRE_POOL_PENALTY = 10;
const CANDIDATE_SAMPLE_SIZE = 300;
const TOP_SLICE_MULTIPLIER = 3;

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

const isKnownEmbeddingDim = (len) =>
  len === EMBEDDING_DIM || LEGACY_EMBEDDING_DIMS.includes(len);

const embeddingSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  if (!isKnownEmbeddingDim(vecA.length)) return 0;
  return cosineSimilarity(vecA, vecB);
};

const getPredictedTagNames = (tags) =>
  (tags || []).map((t) => t.name).filter(Boolean);

const getTopPredictedTags = (tags, k) => (tags || []).slice(0, k);

const countTagNameOverlap = (poolNames, candidateTags) => {
  if (!poolNames.length || !candidateTags?.length) return 0;
  const candNames = new Set(getPredictedTagNames(candidateTags));
  return poolNames.filter((name) => candNames.has(name)).length;
};

const computePredictedTagOverlapScore = (targetTags, candidateTags) => {
  if (!targetTags?.length || !candidateTags?.length) return 0;
  const candidateByName = new Map(
    candidateTags.map((t) => [t.name, t.probability]),
  );
  let bonus = 0;
  for (let i = 0; i < targetTags.length; i++) {
    const target = targetTags[i];
    const candidateProb = candidateByName.get(target.name);
    if (candidateProb != null) {
      const rankWeight = 1 / (i + 1);
      bonus += rankWeight * target.probability * candidateProb;
    }
  }
  return bonus;
};

const mergePredictedTags = (tagLists) => {
  const byName = new Map();
  for (const list of tagLists) {
    for (const tag of list || []) {
      if (!tag?.name) continue;
      const existing = byName.get(tag.name);
      if (!existing || tag.probability > existing.probability) {
        byName.set(tag.name, {
          name: tag.name,
          probability: tag.probability,
        });
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.probability - a.probability);
};

const buildBpmMatchClause = (targetBpm, bpmTolerance) => ({
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
});

const hasValidEmbedding = (embedding) =>
  Array.isArray(embedding) && isKnownEmbeddingDim(embedding.length);

const scoreRecommendationCandidate = ({
  sourceAudioFeatures,
  sourcePredictedGenres,
  sourcePredictedMoods,
  genrePoolNames,
  moodPoolNames,
  candidate,
  referenceEmbedding = null,
}) => {
  const candidateFeatures = candidate.audioFeatures || {};
  const audioFeatures = sourceAudioFeatures || {};
  let score = calculateFeatureDistance(audioFeatures, candidateFeatures);

  if (isHarmonicallyCompatible(audioFeatures, candidateFeatures)) {
    score -= 0.1;
  }

  const embedRef = referenceEmbedding ?? audioFeatures.embedding;
  const similarity = embeddingSimilarity(
    embedRef,
    candidateFeatures.embedding,
  );
  score -= similarity * EMBEDDING_SCORE_WEIGHT;

  const candidateGenres = candidateFeatures.predictedGenres ?? [];
  const candidateMoods = candidateFeatures.predictedMoods ?? [];
  const sharedGenres = countTagNameOverlap(genrePoolNames, candidateGenres);

  if (sharedGenres === 0 && genrePoolNames.length > 0) {
    score += NO_GENRE_POOL_PENALTY;
  } else {
    score -= sharedGenres * GENRE_OVERLAP_BONUS;
  }

  const sharedMoods = countTagNameOverlap(moodPoolNames, candidateMoods);
  score -= sharedMoods * MOOD_OVERLAP_BONUS;

  score -=
    computePredictedTagOverlapScore(
      getTopPredictedTags(sourcePredictedGenres, GENRE_POOL_K),
      getTopPredictedTags(candidateGenres, GENRE_POOL_K),
    ) * TAG_PROB_BONUS_WEIGHT;
  score -=
    computePredictedTagOverlapScore(
      getTopPredictedTags(sourcePredictedMoods, MOOD_POOL_K),
      getTopPredictedTags(candidateMoods, MOOD_POOL_K),
    ) * TAG_PROB_BONUS_WEIGHT;

  return score;
};

const filterCandidatesByEmbeddingDim = (candidates, sourceEmbedding) => {
  const dim = sourceEmbedding?.length;
  if (!dim || !isKnownEmbeddingDim(dim)) return candidates;
  return candidates.filter(
    (c) => c.audioFeatures?.embedding?.length === dim,
  );
};

const buildEmbeddingPoolMatch = (excludeId, targetBpm, bpmTolerance) => {
  const match = {
    _id: { $ne: excludeId },
    "audioFeatures.embedding": { $exists: true, $ne: null },
  };
  if (targetBpm != null) {
    match.$and = [buildBpmMatchClause(targetBpm, bpmTolerance)];
  }
  return match;
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

  const audioFeatures = currentSong.audioFeatures ?? {};
  const predictedGenres = audioFeatures.predictedGenres ?? [];
  const predictedMoods = audioFeatures.predictedMoods ?? [];
  const genrePoolNames = getPredictedTagNames(
    getTopPredictedTags(predictedGenres, GENRE_POOL_K),
  );
  const moodPoolNames = getPredictedTagNames(
    getTopPredictedTags(predictedMoods, MOOD_POOL_K),
  );
  const sourceEmbedding = audioFeatures.embedding;
  const bpmTolerance = 20;
  const excludeId = currentSong._id;

  if (!hasValidEmbedding(sourceEmbedding)) {
    if (genrePoolNames.length === 0) return [];
    const fallbackAgg = await Song.aggregate([
      {
        $match: {
          _id: { $ne: excludeId },
          "audioFeatures.predictedGenres.name": { $in: genrePoolNames },
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

  let candidatesAgg = await Song.aggregate([
    {
      $match: buildEmbeddingPoolMatch(
        excludeId,
        audioFeatures.bpm,
        bpmTolerance,
      ),
    },
    { $sample: { size: CANDIDATE_SAMPLE_SIZE } },
  ]);

  if (candidatesAgg.length < limit) {
    candidatesAgg = await Song.aggregate([
      {
        $match: {
          _id: { $ne: excludeId },
          "audioFeatures.embedding": { $exists: true, $ne: null },
        },
      },
      { $sample: { size: CANDIDATE_SAMPLE_SIZE } },
    ]);
  }

  candidatesAgg = filterCandidatesByEmbeddingDim(
    candidatesAgg,
    sourceEmbedding,
  );

  const populated = await Song.populate(candidatesAgg, {
    path: "artist",
    select: "name imageUrl",
  });

  const scoredCandidates = populated.map((candidate) => ({
    ...candidate,
    score: scoreRecommendationCandidate({
      sourceAudioFeatures: audioFeatures,
      sourcePredictedGenres: predictedGenres,
      sourcePredictedMoods: predictedMoods,
      genrePoolNames,
      moodPoolNames,
      candidate,
    }),
  }));

  scoredCandidates.sort((a, b) => a.score - b.score);

  const topMatches = scoredCandidates.slice(0, limit * TOP_SLICE_MULTIPLIER);
  return topMatches.sort(() => 0.5 - Math.random()).slice(0, limit);
};

const computeCentroidEmbedding = (embeddings) => {
  const valid = embeddings.filter((e) => hasValidEmbedding(e));
  if (valid.length === 0) return null;

  const dim = valid[0].length;
  if (!isKnownEmbeddingDim(dim)) return null;
  const sum = new Array(dim).fill(0);
  for (const vec of valid) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }
  const n = valid.length;
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


const formatPlaylistRecommendationSong = (song) => ({
  _id: song._id.toString(),
  title: song.title,
  imageUrl: song.imageUrl,
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
        imageUrl: a.imageUrl,
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

    const playlistSongs = await Song.find({ _id: { $in: playlist.songs } })
      .select("audioFeatures")
      .lean();

    if (!playlistSongs.length) return null;

    const embeddings = playlistSongs
      .map((s) => s.audioFeatures?.embedding)
      .filter((e) => hasValidEmbedding(e));

    if (embeddings.length === 0) return null;

    const centroidEmbedding = computeCentroidEmbedding(embeddings);
    if (!centroidEmbedding) return null;

    const playlistPredictedGenres = mergePredictedTags(
      playlistSongs.map((s) => s.audioFeatures?.predictedGenres),
    );
    const playlistPredictedMoods = mergePredictedTags(
      playlistSongs.map((s) => s.audioFeatures?.predictedMoods),
    );
    const genrePoolNames = getPredictedTagNames(
      getTopPredictedTags(playlistPredictedGenres, GENRE_POOL_K),
    );
    const moodPoolNames = getPredictedTagNames(
      getTopPredictedTags(playlistPredictedMoods, MOOD_POOL_K),
    );

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

    let candidatesAgg = await Song.aggregate([
      {
        $match: {
          _id: { $nin: excludeIds },
          "audioFeatures.embedding": { $exists: true, $ne: null },
          ...(targetBpm != null
            ? { $and: [buildBpmMatchClause(targetBpm, bpmTolerance)] }
            : {}),
        },
      },
      { $sample: { size: CANDIDATE_SAMPLE_SIZE } },
    ]);

    if (candidatesAgg.length < limit) {
      candidatesAgg = await Song.aggregate([
        {
          $match: {
            _id: { $nin: excludeIds },
            "audioFeatures.embedding": { $exists: true, $ne: null },
          },
        },
        { $sample: { size: CANDIDATE_SAMPLE_SIZE } },
      ]);
    }

    candidatesAgg = filterCandidatesByEmbeddingDim(
      candidatesAgg,
      centroidEmbedding,
    );

    if (candidatesAgg.length === 0) return null;

    const populated = await Song.populate(candidatesAgg, [
      { path: "artist", select: "name imageUrl" },
      { path: "albumId", select: "title imageUrl" },
    ]);

    const scoredCandidates = populated.map((candidate) => ({
      ...candidate,
      score: scoreRecommendationCandidate({
        sourceAudioFeatures: avgAudioFeatures,
        sourcePredictedGenres: playlistPredictedGenres,
        sourcePredictedMoods: playlistPredictedMoods,
        genrePoolNames,
        moodPoolNames,
        candidate,
        referenceEmbedding: centroidEmbedding,
      }),
    }));

    scoredCandidates.sort((a, b) => a.score - b.score);
    const topMatches = scoredCandidates.slice(0, limit * TOP_SLICE_MULTIPLIER);
    const shuffled = topMatches.sort(() => 0.5 - Math.random()).slice(0, limit);

    return shuffled.map(({ score: _score, ...song }) =>
      formatPlaylistRecommendationSong(song),
    );
  } catch (error) {
    console.error("getPlaylistEmbeddingRecommendations:", error);
    return null;
  }
};
