import mongoose from "mongoose";
import { HomeFeed } from "../../models/homeFeed.model.js";
import { ListenHistory } from "../../models/listenHistory.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { Album } from "../../models/album.model.js";
import { Song } from "../../models/song.model.js";
import { User } from "../../models/user.model.js";
import { SavedAlbum } from "../../models/savedAlbum.model.js";
import { GENERATED_PLAYLIST_TYPES } from "../../constants/playlistTypes.js";
import { EMBEDDING_DIM } from "../../constants/embedding.js";
import {
  meanPoolEmbeddings,
  cosineSimilarity,
} from "../recommendations/recommendation.service.js";
import { hasValidTasteVector } from "../recommendations/tasteProfile.service.js";

const QUICK_PICKS_LIMIT = 12;
const QUICK_PICKS_LOOKBACK_HOURS = 6;
const QUICK_PICKS_CANDIDATE_POOL = 150;
const TOP_MIXES_LIMIT = 12;
const MIX_HISTORY_LIMIT = 150;
const ALBUMS_LIMIT = 12;
const ALBUM_CANDIDATE_POOL = 400;

const GLOBAL_MIX_TYPES = ["GENRE_MIX", "MOOD_MIX"];

const MADE_FOR_YOU_TYPES = GENERATED_PLAYLIST_TYPES.filter(
  (type) => !GLOBAL_MIX_TYPES.includes(type),
);

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const extractValidEmbeddings = (songs) =>
  songs
    .map((s) => s.audioFeatures?.embedding)
    .filter((e) => Array.isArray(e) && e.length === EMBEDDING_DIM);

const hasValidEmbedding = (vec) =>
  Array.isArray(vec) && vec.length === EMBEDDING_DIM;

const blendVectors = (primary, secondary, primaryWeight = 0.7) => {
  if (!primary && !secondary) return null;
  if (!primary) return secondary;
  if (!secondary) return primary;

  const w1 = primaryWeight;
  const w2 = 1 - primaryWeight;
  const blended = new Array(EMBEDDING_DIM).fill(0);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    blended[i] = primary[i] * w1 + secondary[i] * w2;
  }
  return meanPoolEmbeddings([blended]);
};

const buildWeightedSessionVector = (entries) => {
  if (!entries.length) return null;

  const weighted = [];
  const maxIndex = entries.length - 1 || 1;

  for (let i = 0; i < entries.length; i++) {
    const embedding = entries[i].song?.audioFeatures?.embedding;
    if (!hasValidEmbedding(embedding)) continue;

    const recencyWeight = 1 + (maxIndex - i) / maxIndex;
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      const slot = weighted[d] ?? { sum: 0, weight: 0 };
      slot.sum += embedding[d] * recencyWeight;
      slot.weight += recencyWeight;
      weighted[d] = slot;
    }
  }

  if (!weighted.length) return null;

  const vec = new Array(EMBEDDING_DIM).fill(0);
  for (let d = 0; d < EMBEDDING_DIM; d++) {
    const slot = weighted[d];
    if (slot?.weight) vec[d] = slot.sum / slot.weight;
  }

  return meanPoolEmbeddings([vec]);
};

const countTagFrequency = (entries, field) => {
  const counts = new Map();
  for (const entry of entries) {
    for (const tagId of entry.song?.[field] || []) {
      const key = tagId.toString();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
};

const getTopTagIds = (counts, limit) =>
  [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id]) => toObjectId(id));

export const computeUserTasteVector = async (userId) => {
  const user = await User.findById(userId).select("tasteVector").lean();
  if (hasValidTasteVector(user)) return user.tasteVector;

  const history = await ListenHistory.find({ user: userId })
    .sort({ listenedAt: -1 })
    .limit(100)
    .lean();

  if (!history.length) return null;

  const songs = await Song.find({ _id: { $in: history.map((h) => h.song) } })
    .select("audioFeatures.embedding")
    .lean();

  return meanPoolEmbeddings(extractValidEmbeddings(songs));
};

export const generateQuickPicks = async (userId) => {
  const ownerId = toObjectId(userId);
  const lookbackStart = new Date(
    Date.now() - QUICK_PICKS_LOOKBACK_HOURS * 60 * 60 * 1000,
  );

  const [recentHistory, profileVector] = await Promise.all([
    ListenHistory.find({ user: ownerId })
      .sort({ listenedAt: -1 })
      .limit(80)
      .populate({ path: "song", select: "genres moods audioFeatures.embedding artist albumId" })
      .lean(),
    computeUserTasteVector(userId),
  ]);

  const validHistory = recentHistory.filter((entry) => entry.song);
  if (!validHistory.length) {
    if (profileVector) {
      return findSongsByTasteVector(profileVector, [], QUICK_PICKS_LIMIT);
    }
    return findTrendingSongIds(QUICK_PICKS_LIMIT);
  }

  const sessionHistory = validHistory.filter(
    (entry) => new Date(entry.listenedAt) >= lookbackStart,
  );
  const sessionEntries = sessionHistory.length ? sessionHistory : validHistory.slice(0, 30);

  const sessionVector = buildWeightedSessionVector(sessionEntries);
  const tasteVector = blendVectors(sessionVector, profileVector, 0.75);

  const excludeSongIds = new Set(
    validHistory.map((entry) => entry.song._id.toString()),
  );

  const genreCounts = countTagFrequency(sessionEntries, "genres");
  const moodCounts = countTagFrequency(sessionEntries, "moods");
  const topGenreIds = getTopTagIds(genreCounts, 4);
  const topMoodIds = getTopTagIds(moodCounts, 3);

  let candidates = [];

  if (topGenreIds.length || topMoodIds.length) {
    const tagMatch = [];
    if (topGenreIds.length) tagMatch.push({ genres: { $in: topGenreIds } });
    if (topMoodIds.length) tagMatch.push({ moods: { $in: topMoodIds } });

    candidates = await Song.aggregate([
      {
        $match: {
          _id: {
            $nin: [...excludeSongIds].map((id) => toObjectId(id)),
          },
          "audioFeatures.embedding": { $exists: true, $ne: null },
          $or: tagMatch,
        },
      },
      { $sample: { size: QUICK_PICKS_CANDIDATE_POOL } },
    ]);
  }

  if (candidates.length < QUICK_PICKS_LIMIT && tasteVector) {
    const embeddingCandidates = await Song.aggregate([
      {
        $match: {
          _id: {
            $nin: [...excludeSongIds].map((id) => toObjectId(id)),
          },
          "audioFeatures.embedding": { $exists: true, $ne: null },
        },
      },
      { $sample: { size: QUICK_PICKS_CANDIDATE_POOL } },
    ]);

    const seen = new Set(candidates.map((s) => s._id.toString()));
    for (const song of embeddingCandidates) {
      if (!seen.has(song._id.toString())) {
        candidates.push(song);
        seen.add(song._id.toString());
      }
    }
  }

  if (!candidates.length) {
    return findTrendingSongIds(QUICK_PICKS_LIMIT);
  }

  const scored = candidates
    .map((song) => {
      let score = 0;

      if (tasteVector && song.audioFeatures?.embedding) {
        score += cosineSimilarity(tasteVector, song.audioFeatures.embedding) * 3;
      }

      const sharedGenres = (song.genres || []).filter((g) =>
        genreCounts.has(g.toString()),
      ).length;
      const sharedMoods = (song.moods || []).filter((m) =>
        moodCounts.has(m.toString()),
      ).length;
      score += sharedGenres * 0.15 + sharedMoods * 0.1;

      return { _id: song._id, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const usedArtists = new Map();
  const usedAlbums = new Set();

  for (const item of scored) {
    if (picked.length >= QUICK_PICKS_LIMIT) break;

    const song = candidates.find((c) => c._id.toString() === item._id.toString());
    if (!song) continue;

    const primaryArtist = song.artist?.[0]?.toString();
    const albumKey = song.albumId?.toString();

    if (primaryArtist) {
      const artistCount = usedArtists.get(primaryArtist) || 0;
      if (artistCount >= 2) continue;
      usedArtists.set(primaryArtist, artistCount + 1);
    }

    if (albumKey) {
      if (usedAlbums.has(albumKey)) continue;
      usedAlbums.add(albumKey);
    }

    picked.push(item._id);
  }

  if (picked.length < QUICK_PICKS_LIMIT) {
    for (const item of scored) {
      if (picked.length >= QUICK_PICKS_LIMIT) break;
      if (!picked.some((id) => id.toString() === item._id.toString())) {
        picked.push(item._id);
      }
    }
  }

  return picked;
};

const findSongsByTasteVector = async (tasteVector, excludeIds, limit) => {
  const excludeSet = new Set(excludeIds.map(String));

  const candidates = await Song.aggregate([
    {
      $match: {
        "audioFeatures.embedding": { $exists: true, $ne: null },
        ...(excludeSet.size
          ? { _id: { $nin: [...excludeSet].map((id) => toObjectId(id)) } }
          : {}),
      },
    },
    { $sample: { size: QUICK_PICKS_CANDIDATE_POOL } },
  ]);

  return candidates
    .map((song) => ({
      _id: song._id,
      score: cosineSimilarity(tasteVector, song.audioFeatures?.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item._id);
};

const findTrendingSongIds = async (limit) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const trending = await ListenHistory.aggregate([
    { $match: { listenedAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: "$song", listenCount: { $sum: 1 } } },
    { $sort: { listenCount: -1 } },
    { $limit: limit },
    { $project: { _id: 1 } },
  ]);

  if (trending.length) {
    return trending.map((item) => item._id);
  }

  const fallback = await Song.find()
    .sort({ playCount: -1 })
    .limit(limit)
    .select("_id")
    .lean();

  return fallback.map((song) => song._id);
};

export const generateMadeForYou = async (userId) => {
  const playlists = await Playlist.find({
    madeFor: userId,
    type: { $in: MADE_FOR_YOU_TYPES },
  })
    .select("_id")
    .sort({ lastGeneratedAt: -1, updatedAt: -1 })
    .lean();

  return playlists.map((playlist) => playlist._id);
};

export const generateYourTopMixes = async (userId) => {
  const ownerId = toObjectId(userId);

  const listenHistory = await ListenHistory.find({ user: ownerId })
    .sort({ listenedAt: -1 })
    .limit(MIX_HISTORY_LIMIT)
    .populate({ path: "song", select: "genres moods" })
    .lean();

  const validHistory = listenHistory.filter((entry) => entry.song);
  const genreCounts = countTagFrequency(validHistory, "genres");
  const moodCounts = countTagFrequency(validHistory, "moods");

  const globalMixes = await Playlist.find({
    type: { $in: GLOBAL_MIX_TYPES },
    owner: null,
    isPublic: true,
  })
    .select("_id type sourceId")
    .lean();

  if (!globalMixes.length) return [];

  const scoreMix = (mix) => {
    if (!mix.sourceId) return 0;
    const sourceKey = mix.sourceId.toString();
    if (mix.type === "GENRE_MIX") return genreCounts.get(sourceKey) || 0;
    if (mix.type === "MOOD_MIX") return moodCounts.get(sourceKey) || 0;
    return 0;
  };

  const scored = globalMixes
    .map((mix) => ({ _id: mix._id, score: scoreMix(mix) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a._id.toString().localeCompare(b._id.toString());
    });

  const withSignal = scored.filter((item) => item.score > 0);
  const ordered = withSignal.length ? withSignal : scored;

  return ordered.slice(0, TOP_MIXES_LIMIT).map((item) => item._id);
};

export const generateAlbumsYouMightLike = async (userId, tasteVector) => {
  if (!hasValidEmbedding(tasteVector)) return [];

  const ownerId = toObjectId(userId);

  const [savedAlbums, recentHistory] = await Promise.all([
    SavedAlbum.find({ user: ownerId }).select("album").lean(),
    ListenHistory.find({ user: ownerId })
      .sort({ listenedAt: -1 })
      .limit(100)
      .populate({ path: "song", select: "albumId" })
      .lean(),
  ]);

  const excludeAlbumIds = new Set([
    ...savedAlbums.map((entry) => entry.album.toString()),
    ...recentHistory
      .map((entry) => entry.song?.albumId?.toString())
      .filter(Boolean),
  ]);

  const candidates = await Album.aggregate([
    {
      $match: {
        embedding: { $exists: true, $ne: null, $size: EMBEDDING_DIM },
        ...(excludeAlbumIds.size
          ? {
              _id: {
                $nin: [...excludeAlbumIds].map((id) => toObjectId(id)),
              },
            }
          : {}),
      },
    },
    { $sample: { size: ALBUM_CANDIDATE_POOL } },
  ]);

  if (!candidates.length) return [];

  return candidates
    .map((album) => ({
      _id: album._id,
      score: cosineSimilarity(tasteVector, album.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, ALBUMS_LIMIT)
    .map((item) => item._id);
};

export const orderByIds = (documents, orderedIds) => {
  if (!orderedIds?.length) return [];
  const docMap = new Map(
    (documents || []).map((doc) => [doc._id.toString(), doc]),
  );
  return orderedIds
    .map((id) => docMap.get(id.toString()))
    .filter(Boolean);
};

export const enqueueHomeFeedGeneration = (userId) => {
  setImmediate(() => {
    generateHomeFeedForUser(userId).catch((error) => {
      console.error(`[homeFeed] Async generation failed for ${userId}:`, error);
    });
  });
};

export const generateHomeFeedForUser = async (userId) => {
  const tasteVector = await computeUserTasteVector(userId);
  const now = new Date();

  const [songIds, madeForYouIds, topMixIds, albumIds] = await Promise.all([
    generateQuickPicks(userId),
    generateMadeForYou(userId),
    generateYourTopMixes(userId),
    generateAlbumsYouMightLike(userId, tasteVector),
  ]);

  await HomeFeed.findOneAndUpdate(
    { userId },
    {
      $set: {
        generatedAt: now,
        quickPicks: { songIds, updatedAt: now },
        madeForYou: { playlistIds: madeForYouIds, updatedAt: now },
        yourTopMixes: { playlistIds: topMixIds, updatedAt: now },
        albumsYouMightLike: { albumIds, updatedAt: now },
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return {
    userId,
    generatedAt: now,
    quickPicks: songIds,
    madeForYou: madeForYouIds,
    yourTopMixes: topMixIds,
    albumsYouMightLike: albumIds,
  };
};
