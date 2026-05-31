// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { User } from "../../models/user.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { Song } from "../../models/song.model.js";
import { ListenHistory } from "../../models/listenHistory.model.js";
import { LikedSong } from "../../models/likedSong.model.js";
import { LIKED_PLAYLIST_ID } from "../../constants/playlistTypes.js";
import {
  EMBEDDING_DIM,
  ARTIST_TOP_TRACKS_LIMIT,
} from "../../constants/embedding.js";

const extractValidEmbeddings = (songs) =>
  songs
    .map((s) => s.audioFeatures?.embedding)
    .filter((e) => Array.isArray(e) && e.length === EMBEDDING_DIM);

const normalizeEmbedding = (vec) => {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
};

/** Mean pooling of 50d track vectors + L2 normalization (same as embedding service output). */
export const meanPoolEmbeddings = (vectors) => {
  const valid = vectors.filter(
    (v) => Array.isArray(v) && v.length === EMBEDDING_DIM,
  );
  if (valid.length === 0) return null;

  const sum = new Array(EMBEDDING_DIM).fill(0);
  for (const vec of valid) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      sum[i] += vec[i];
    }
  }
  const n = valid.length;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    sum[i] /= n;
  }
  return normalizeEmbedding(sum);
};

export const computeAlbumEmbedding = async (albumId) => {
  if (!albumId) return null;
  const songs = await Song.find({ albumId })
    .select("audioFeatures.embedding")
    .lean();
  return meanPoolEmbeddings(extractValidEmbeddings(songs));
};

export const computePlaylistEmbedding = async (playlistId) => {
  if (!playlistId) return null;
  const playlist = await Playlist.findById(playlistId).select("songs").lean();
  if (!playlist?.songs?.length) return null;

  const songs = await Song.find({ _id: { $in: playlist.songs } })
    .select("audioFeatures.embedding")
    .lean();
  return meanPoolEmbeddings(extractValidEmbeddings(songs));
};

export const computeArtistEmbedding = async (artistId) => {
  if (!artistId) return null;
  const songs = await Song.find({ artist: artistId })
    .select("audioFeatures.embedding")
    .sort({ playCount: -1 })
    .limit(ARTIST_TOP_TRACKS_LIMIT)
    .lean();
  return meanPoolEmbeddings(extractValidEmbeddings(songs));
};

export const updateAlbumEmbedding = async (albumId) => {
  if (!albumId) return;
  try {
    const embedding = await computeAlbumEmbedding(albumId);
    await Album.updateOne({ _id: albumId }, { $set: { embedding } });
  } catch (error) {
    console.error("updateAlbumEmbedding:", error);
  }
};

export const updatePlaylistEmbedding = async (playlistId) => {
  if (!playlistId) return;
  try {
    const embedding = await computePlaylistEmbedding(playlistId);
    await Playlist.updateOne({ _id: playlistId }, { $set: { embedding } });
  } catch (error) {
    console.error("updatePlaylistEmbedding:", error);
  }
};

export const updateArtistEmbedding = async (artistId) => {
  if (!artistId) return;
  try {
    const embedding = await computeArtistEmbedding(artistId);
    await Artist.updateOne({ _id: artistId }, { $set: { embedding } });
  } catch (error) {
    console.error("updateArtistEmbedding:", error);
  }
};

// Вспомогательная функция для расчета разницы (чем меньше, тем лучше)

export const cosineSimilarity = (vecA, vecB) => {
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

const MAX_EXCLUDE_IDS = 200;

const parseValidExcludeIds = (excludeIds) => {
  if (!Array.isArray(excludeIds)) return [];
  return excludeIds
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .slice(0, MAX_EXCLUDE_IDS)
    .map((id) => new mongoose.Types.ObjectId(id));
};

const buildIdMatch = (currentSongId, validExcludeIds) => {
  const idFilter = { $ne: currentSongId };
  if (validExcludeIds.length > 0) {
    idFilter.$nin = validExcludeIds;
  }
  return idFilter;
};

const getCandidateArtistIds = (candidate) =>
  (candidate.artist || []).map((a) => (a._id || a).toString());

export const buildRepeatContext = async ({
  userId,
  excludeIds = [],
  repeatMode = "default",
  currentSong,
}) => {
  const validExcludeIds = parseValidExcludeIds(excludeIds);
  const currentArtistIds = (currentSong.artist || []).map((a) => a.toString());
  const sessionArtistIds = new Set(currentArtistIds);

  if (validExcludeIds.length > 0) {
    const excludedSongs = await Song.find({ _id: { $in: validExcludeIds } })
      .select("artist albumId")
      .lean();
    for (const song of excludedSongs) {
      for (const artistId of song.artist || []) {
        sessionArtistIds.add(artistId.toString());
      }
    }
  }

  const context = {
    validExcludeIds,
    currentArtistIds,
    sessionArtistIds: [...sessionArtistIds],
    repeatMode,
    recentSongPenalties: new Map(),
    recentArtistPenalties: new Map(),
    recentAlbumPenalties: new Map(),
  };

  if (repeatMode === "fewerRepeats" && userId) {
    const listenHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .limit(80)
      .populate({ path: "song", select: "artist albumId" })
      .lean();

    listenHistory.forEach((entry, index) => {
      if (!entry.song) return;
      const songId = entry.song._id.toString();
      const isRecent = index < 20;
      const songPenalty = isRecent ? 2.0 : 0.8;
      context.recentSongPenalties.set(
        songId,
        Math.max(context.recentSongPenalties.get(songId) || 0, songPenalty),
      );

      for (const artistId of entry.song.artist || []) {
        const aid = artistId.toString();
        const artistPenalty = isRecent ? 0.5 : 0.2;
        context.recentArtistPenalties.set(
          aid,
          Math.max(
            context.recentArtistPenalties.get(aid) || 0,
            artistPenalty,
          ),
        );
      }

      if (entry.song.albumId) {
        context.recentAlbumPenalties.set(entry.song.albumId.toString(), 0.1);
      }
    });
  }

  return context;
};

const scoreVibeCandidate = (sourceSong, candidate, repeatContext) => {
  const { genres, moods, audioFeatures } = sourceSong;
  let score = calculateFeatureDistance(
    audioFeatures || {},
    candidate.audioFeatures || {},
  );

  if (
    isHarmonicallyCompatible(
      audioFeatures || {},
      candidate.audioFeatures || {},
    )
  ) {
    score -= 0.1;
  }

  const sharedMoods = (candidate.moods || []).filter((m) =>
    (moods || []).some((tm) => tm.toString() === m.toString()),
  ).length;
  score -= sharedMoods * 0.05;

  const sharedGenres = (candidate.genres || []).filter((g) =>
    (genres || []).some((tg) => tg.toString() === g.toString()),
  ).length;

  if (sharedGenres === 0) {
    score += 10;
  } else {
    score -= sharedGenres * 0.1;
  }

  if (
    sourceSong.audioFeatures?.embedding &&
    candidate.audioFeatures?.embedding
  ) {
    const similarity = cosineSimilarity(
      sourceSong.audioFeatures.embedding,
      candidate.audioFeatures.embedding,
    );
    score -= similarity * 2.0;
  }

  const candidateArtistIds = getCandidateArtistIds(candidate);

  for (const artistId of candidateArtistIds) {
    if (repeatContext.currentArtistIds.includes(artistId)) {
      score += 0.3;
      break;
    }
  }

  let sessionArtistPenalty = 0;
  for (const artistId of candidateArtistIds) {
    if (
      repeatContext.sessionArtistIds.includes(artistId) &&
      !repeatContext.currentArtistIds.includes(artistId)
    ) {
      sessionArtistPenalty += 0.15;
    }
  }
  score += Math.min(sessionArtistPenalty, 0.45);

  const candidateId = candidate._id.toString();
  if (repeatContext.recentSongPenalties.has(candidateId)) {
    score += repeatContext.recentSongPenalties.get(candidateId);
  }

  for (const artistId of candidateArtistIds) {
    if (repeatContext.recentArtistPenalties.has(artistId)) {
      score += repeatContext.recentArtistPenalties.get(artistId);
    }
  }

  if (candidate.albumId) {
    const albumId = (candidate.albumId._id || candidate.albumId).toString();
    if (repeatContext.recentAlbumPenalties.has(albumId)) {
      score += repeatContext.recentAlbumPenalties.get(albumId);
    }
  }

  return score;
};

const pickVibeMatchTracks = (scoredCandidates, limit, repeatMode) => {
  if (scoredCandidates.length === 0) return [];

  const temperature = repeatMode === "fewerRepeats" ? 0.25 : 0.4;
  const poolSize = Math.min(scoredCandidates.length, limit * 4);
  const pool = scoredCandidates.slice(0, poolSize);
  const picked = [];
  const usedArtistIds = new Set();
  let remaining = [...pool];

  while (picked.length < limit && remaining.length > 0) {
    let candidates = remaining;
    if (repeatMode === "fewerRepeats" && picked.length > 0) {
      const filtered = remaining.filter((c) => {
        const artistIds = getCandidateArtistIds(c);
        return !artistIds.some((id) => usedArtistIds.has(id));
      });
      if (filtered.length > 0) candidates = filtered;
    }

    const weights = candidates.map((c) => Math.exp(-c.score / temperature));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight === 0) {
      const selected = candidates[0];
      picked.push(selected);
      for (const artistId of getCandidateArtistIds(selected)) {
        usedArtistIds.add(artistId);
      }
      remaining = remaining.filter(
        (c) => c._id.toString() !== selected._id.toString(),
      );
      continue;
    }

    let r = Math.random() * totalWeight;
    let selectedIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        selectedIndex = i;
        break;
      }
    }

    const selected = candidates[selectedIndex];
    picked.push(selected);
    for (const artistId of getCandidateArtistIds(selected)) {
      usedArtistIds.add(artistId);
    }
    remaining = remaining.filter(
      (c) => c._id.toString() !== selected._id.toString(),
    );
  }

  return picked.map(({ score: _score, ...song }) => song);
};

export const getVibeMatchTracks = async (
  currentSongId,
  limit = 10,
  options = {},
) => {
  const { excludeIds = [], repeatMode = "default", userId = null } = options;

  const currentSong = await Song.findById(currentSongId).lean();
  if (!currentSong) return [];

  const repeatContext = await buildRepeatContext({
    userId,
    excludeIds,
    repeatMode,
    currentSong,
  });

  const { genres, moods, audioFeatures } = currentSong;
  const idMatch = buildIdMatch(currentSong._id, repeatContext.validExcludeIds);
  const sampleSize = Math.min(200, limit * 15);

  if (!audioFeatures || audioFeatures.bpm === null) {
    const fallbackAgg = await Song.aggregate([
      {
        $match: {
          _id: idMatch,
          genres: { $in: genres },
        },
      },
      { $sample: { size: sampleSize } },
    ]);
    const populated = await Song.populate(fallbackAgg, {
      path: "artist",
      select: "name images",
    });
    const scoredCandidates = populated.map((candidate) => ({
      ...candidate,
      score: scoreVibeCandidate(currentSong, candidate, repeatContext),
    }));
    scoredCandidates.sort((a, b) => a.score - b.score);
    return pickVibeMatchTracks(scoredCandidates, limit, repeatMode);
  }

  const targetBpm = audioFeatures.bpm;
  const bpmTolerance = 20;

  let candidatesAgg = await Song.aggregate([
    {
      $match: {
        _id: idMatch,
        $and: [
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
    { $sample: { size: sampleSize } },
  ]);

  if (candidatesAgg.length < limit) {
    candidatesAgg = await Song.aggregate([
      {
        $match: {
          _id: idMatch,
          $or: [{ genres: { $in: genres } }, { moods: { $in: moods } }],
          "audioFeatures.bpm": { $ne: null },
        },
      },
      { $sample: { size: sampleSize } },
    ]);
  }

  const candidates = await Song.populate(candidatesAgg, {
    path: "artist",
    select: "name images",
  });

  const scoredCandidates = candidates.map((candidate) => ({
    ...candidate,
    score: scoreVibeCandidate(currentSong, candidate, repeatContext),
  }));

  scoredCandidates.sort((a, b) => a.score - b.score);
  return pickVibeMatchTracks(scoredCandidates, limit, repeatMode);
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
    const playlist = await Playlist.findById(playlistId)
      .select("songs embedding")
      .lean();
    if (!playlist?.songs?.length || playlist.songs.length <= 3) {
      return null;
    }

    const playlistSongs = await Song.find({ _id: { $in: playlist.songs } })
      .select("genres moods audioFeatures")
      .lean();

    if (!playlistSongs.length) return null;

    const storedEmbedding =
      Array.isArray(playlist.embedding) &&
      playlist.embedding.length === EMBEDDING_DIM
        ? playlist.embedding
        : null;

    const centroidEmbedding =
      storedEmbedding ??
      meanPoolEmbeddings(extractValidEmbeddings(playlistSongs));

    if (!centroidEmbedding) return null;

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

const applySmartShuffleRepeatPenalties = (score, candidate, repeatContext) => {
  let nextScore = score;
  const candidateArtistIds = getCandidateArtistIds(candidate);

  for (const artistId of candidateArtistIds) {
    if (repeatContext.currentArtistIds.includes(artistId)) {
      nextScore += 0.3;
      break;
    }
  }

  let sessionArtistPenalty = 0;
  for (const artistId of candidateArtistIds) {
    if (
      repeatContext.sessionArtistIds.includes(artistId) &&
      !repeatContext.currentArtistIds.includes(artistId)
    ) {
      sessionArtistPenalty += 0.15;
    }
  }
  nextScore += Math.min(sessionArtistPenalty, 0.45);

  const candidateId = candidate._id.toString();
  if (repeatContext.recentSongPenalties.has(candidateId)) {
    nextScore += repeatContext.recentSongPenalties.get(candidateId);
  }

  for (const artistId of candidateArtistIds) {
    if (repeatContext.recentArtistPenalties.has(artistId)) {
      nextScore += repeatContext.recentArtistPenalties.get(artistId);
    }
  }

  if (candidate.albumId) {
    const albumId = (candidate.albumId._id || candidate.albumId).toString();
    if (repeatContext.recentAlbumPenalties.has(albumId)) {
      nextScore += repeatContext.recentAlbumPenalties.get(albumId);
    }
  }

  return nextScore;
};

const SMART_SHUFFLE_PROFILE_SAMPLE = 150;

async function resolveSmartShuffleSource(playlistId, userId) {
  if (playlistId === LIKED_PLAYLIST_ID) {
    if (!userId) return null;
    const songIds = await LikedSong.find({ user: userId }).distinct("song");
    if (!songIds.length) return null;
    return {
      songIds: songIds.map((id) => id.toString()),
      storedEmbedding: null,
    };
  }

  const playlist = await Playlist.findById(playlistId)
    .select("songs embedding")
    .lean();
  if (!playlist?.songs?.length) return null;

  return {
    songIds: playlist.songs.map((id) => id.toString()),
    storedEmbedding:
      Array.isArray(playlist.embedding) &&
      playlist.embedding.length === EMBEDDING_DIM
        ? playlist.embedding
        : null,
  };
}

async function loadSmartShuffleProfileSongs(songIds) {
  const objectIds = songIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) return [];

  if (objectIds.length <= SMART_SHUFFLE_PROFILE_SAMPLE) {
    return Song.find({ _id: { $in: objectIds } })
      .select("genres moods audioFeatures artist")
      .lean();
  }

  const sampled = await Song.aggregate([
    { $match: { _id: { $in: objectIds } } },
    { $sample: { size: SMART_SHUFFLE_PROFILE_SAMPLE } },
  ]);

  return Song.find({ _id: { $in: sampled.map((s) => s._id) } })
    .select("genres moods audioFeatures artist")
    .lean();
}

/** One-shot smart shuffle mix for a playlist (not infinite radio). */
export const getSmartShuffleTracks = async (
  playlistId,
  { limit = 10, excludeIds = [], repeatMode = "default", userId = null } = {},
) => {
  try {
    const source = await resolveSmartShuffleSource(playlistId, userId);
    if (!source?.songIds?.length) return [];

    const playlistSongs = await loadSmartShuffleProfileSongs(source.songIds);
    if (!playlistSongs.length) return [];

    const playlistSongIdSet = new Set(source.songIds);
    const extraExclude = (excludeIds || [])
      .map((id) => id.toString())
      .filter((id) => !playlistSongIdSet.has(id));

    const allExclude = [
      ...new Set([...source.songIds, ...extraExclude]),
    ];
    const validExcludeIds = allExclude
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const storedEmbedding = source.storedEmbedding;

    const centroidEmbedding =
      storedEmbedding ??
      meanPoolEmbeddings(extractValidEmbeddings(playlistSongs));

    if (!centroidEmbedding) return [];

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
    const excludeObjectIds = validExcludeIds;

    let matchQuery = {
      _id: { $nin: excludeObjectIds },
      "audioFeatures.embedding": { $exists: true, $ne: null },
    };

    if (genreIds.length > 0 && targetBpm != null) {
      matchQuery = {
        _id: { $nin: excludeObjectIds },
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
      matchQuery = {
        _id: { $nin: excludeObjectIds },
        "audioFeatures.embedding": { $exists: true, $ne: null },
        genres: { $in: genreIds },
      };
    }

    let candidatesAgg = await Song.aggregate([
      { $match: matchQuery },
      { $sample: { size: Math.min(150, limit * 15) } },
    ]);

    if (candidatesAgg.length < limit) {
      const fallbackMatch = {
        _id: { $nin: excludeObjectIds },
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
        { $sample: { size: Math.min(150, limit * 15) } },
      ]);
    }

    if (candidatesAgg.length === 0) return [];

    const candidates = await Song.populate(candidatesAgg, [
      { path: "artist", select: "name images" },
      { path: "albumId", select: "title images" },
    ]);

    const anchorSong = playlistSongs[0];
    const repeatContext = await buildRepeatContext({
      userId,
      excludeIds: allExclude,
      repeatMode,
      currentSong: anchorSong,
    });

    const scoredCandidates = candidates.map((candidate) => {
      let score = scoreCandidateAgainstPlaylist(
        centroidEmbedding,
        avgAudioFeatures,
        genreIds,
        moodIds,
        candidate,
      );
      score = applySmartShuffleRepeatPenalties(
        score,
        candidate,
        repeatContext,
      );
      return { ...candidate, score };
    });

    scoredCandidates.sort((a, b) => a.score - b.score);
    const picked = pickVibeMatchTracks(scoredCandidates, limit, repeatMode);

    return picked.map(({ score: _score, ...song }) =>
      formatPlaylistRecommendationSong(song),
    );
  } catch (error) {
    console.error("getSmartShuffleTracks:", error);
    return [];
  }
};
