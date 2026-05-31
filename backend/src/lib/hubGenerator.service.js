import crypto from "crypto";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Hub } from "../models/hub.model.js";
import {
  EMBEDDING_DIM,
  VALID_SONG_EMBEDDING,
  VALID_ENTITY_EMBEDDING,
} from "../constants/embedding.js";
import { cosineSimilarity } from "./recommendation.service.js";
import {
  calculateCentroids,
  getCategoryModel,
  getCategoryTagField,
  recomputeCentroidForCategory,
} from "./categoryEmbedding.service.js";
import {
  HUB_MIN_TRACKS,
  HUB_STORE_LIMIT,
  HUB_CANDIDATE_POOL,
  HUB_PREVIEW_COUNT,
} from "../constants/hub.js";
import { mapWithConcurrency } from "./asyncUtils.js";
import redisClient from "./redis.js";

const HUB_UPSERT_CONCURRENCY = 5;

export {
  HUB_MIN_TRACKS,
  HUB_STORE_LIMIT,
  HUB_CANDIDATE_POOL,
  HUB_PREVIEW_COUNT,
};

export const HUBS_CACHE_KEY = "cache:/api/hubs";

const COVER_SELECT = "images imagePublicId coverAccentHex";

export const invalidateHubsCache = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(HUBS_CACHE_KEY);
    }
  } catch (error) {
    console.error("[invalidateHubsCache]:", error);
  }
};

const HUB_ACCENT_COLORS = [
  "#E13300",
  "#1E3264",
  "#8D67AB",
  "#27856A",
  "#509BF5",
  "#E8115B",
  "#148A08",
  "#777777",
  "#DC148C",
  "#E91429",
];

const hasValidEmbedding = (vec) =>
  Array.isArray(vec) && vec.length === EMBEDDING_DIM;

const pickAccentColor = (categoryId) => {
  const hash = crypto
    .createHash("md5")
    .update(categoryId.toString())
    .digest();
  const index = hash.readUInt32BE(0) % HUB_ACCENT_COLORS.length;
  return HUB_ACCENT_COLORS[index];
};

const rankBySimilarity = (hubEmbedding, entities, limit) =>
  entities
    .map((entity) => ({
      _id: entity._id,
      score: cosineSimilarity(hubEmbedding, entity.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item._id);

const getTopAlbumIdsByPlayCount = async (categoryId, tagField, limit) => {
  const rows = await Song.aggregate([
    {
      $match: {
        [tagField]: categoryId,
        albumId: { $ne: null },
        ...VALID_SONG_EMBEDDING,
      },
    },
    {
      $group: {
        _id: "$albumId",
        playCount: { $sum: "$playCount" },
      },
    },
    { $sort: { playCount: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => row._id);
};

const getTopArtistIdsByPlayCount = async (categoryId, tagField, limit) => {
  const rows = await Song.aggregate([
    {
      $match: {
        [tagField]: categoryId,
        ...VALID_SONG_EMBEDDING,
      },
    },
    { $unwind: "$artist" },
    {
      $group: {
        _id: "$artist",
        playCount: { $sum: "$playCount" },
      },
    },
    { $sort: { playCount: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => row._id);
};

const getSongIdsForCategory = async (categoryId, tagField) => {
  const songs = await Song.find({
    [tagField]: categoryId,
    ...VALID_SONG_EMBEDDING,
  })
    .select("_id")
    .lean();

  return songs.map((song) => song._id);
};

const findNearestAlbumIds = async (hubEmbedding, categoryId, tagField) => {
  if (!hasValidEmbedding(hubEmbedding)) return [];

  const albumIds = await getTopAlbumIdsByPlayCount(
    categoryId,
    tagField,
    HUB_CANDIDATE_POOL,
  );
  if (!albumIds.length) return [];

  const candidates = await Album.find({
    _id: { $in: albumIds },
    ...VALID_ENTITY_EMBEDDING,
  })
    .select("_id embedding")
    .lean();

  return rankBySimilarity(hubEmbedding, candidates, HUB_STORE_LIMIT);
};

const findNearestArtistIds = async (hubEmbedding, categoryId, tagField) => {
  if (!hasValidEmbedding(hubEmbedding)) return [];

  const artistIds = await getTopArtistIdsByPlayCount(
    categoryId,
    tagField,
    HUB_CANDIDATE_POOL,
  );
  if (!artistIds.length) return [];

  const candidates = await Artist.find({
    _id: { $in: artistIds },
    ...VALID_ENTITY_EMBEDDING,
  })
    .select("_id embedding")
    .lean();

  return rankBySimilarity(hubEmbedding, candidates, HUB_STORE_LIMIT);
};

const findNearestPlaylistIds = async (hubEmbedding, categoryId, tagField) => {
  if (!hasValidEmbedding(hubEmbedding)) return [];

  const songIds = await getSongIdsForCategory(categoryId, tagField);
  if (!songIds.length) return [];

  const candidates = await Playlist.find({
    songs: { $in: songIds },
    isPublic: true,
    ...VALID_ENTITY_EMBEDDING,
  })
    .select("_id embedding")
    .lean();

  const pool =
    candidates.length > HUB_CANDIDATE_POOL
      ? candidates.slice(0, HUB_CANDIDATE_POOL)
      : candidates;

  return rankBySimilarity(hubEmbedding, pool, HUB_STORE_LIMIT);
};

const findEligibleCategories = async (Model, categoryType, tagField) => {
  const categories = await Model.find({
    ...VALID_ENTITY_EMBEDDING,
  })
    .select("_id name localizedNames embedding")
    .lean();

  const eligible = await mapWithConcurrency(
    categories,
    async (category) => {
      const trackCount = await Song.countDocuments({
        [tagField]: category._id,
        ...VALID_SONG_EMBEDDING,
      });

      if (trackCount < HUB_MIN_TRACKS) return null;

      return {
        categoryType,
        categoryId: category._id,
        name: category.name,
        localizedNames: category.localizedNames,
        embedding: category.embedding,
        trackCount,
      };
    },
    HUB_UPSERT_CONCURRENCY,
  );

  return eligible.filter(Boolean);
};

const toPreviewCover = (entity, entityType) => {
  if (!entity?.images?.length) return null;
  return {
    entityType,
    images: entity.images,
    imagePublicId: entity.imagePublicId ?? null,
    coverAccentHex: entity.coverAccentHex ?? null,
  };
};

const buildPreviewCoversFromMaps = (
  albumIds = [],
  artistIds = [],
  albumsById,
  artistsById,
) => {
  const covers = [];

  for (const id of albumIds.slice(0, HUB_PREVIEW_COUNT)) {
    const cover = toPreviewCover(albumsById.get(id.toString()), "album");
    if (cover) covers.push(cover);
  }

  if (covers.length < HUB_PREVIEW_COUNT) {
    const needed = HUB_PREVIEW_COUNT - covers.length;
    for (const id of artistIds.slice(0, needed)) {
      const cover = toPreviewCover(artistsById.get(id.toString()), "artist");
      if (cover) covers.push(cover);
    }
  }

  return covers.slice(0, HUB_PREVIEW_COUNT);
};

export const buildPreviewCovers = async (albumIds = [], artistIds = []) => {
  const albumSlice = albumIds.slice(0, HUB_PREVIEW_COUNT);
  const neededArtists = Math.max(0, HUB_PREVIEW_COUNT - albumSlice.length);
  const artistSlice = artistIds.slice(0, neededArtists);

  const [albumDocs, artistDocs] = await Promise.all([
    albumSlice.length
      ? Album.find({ _id: { $in: albumSlice } }).select(COVER_SELECT).lean()
      : [],
    artistSlice.length
      ? Artist.find({ _id: { $in: artistSlice } }).select(COVER_SELECT).lean()
      : [],
  ]);

  const albumsById = new Map(
    albumDocs.map((album) => [album._id.toString(), album]),
  );
  const artistsById = new Map(
    artistDocs.map((artist) => [artist._id.toString(), artist]),
  );

  return buildPreviewCoversFromMaps(
    albumIds,
    artistIds,
    albumsById,
    artistsById,
  );
};

export const attachPreviewCoversToHubs = async (hubs) => {
  const albumsById = new Map();
  const artistsById = new Map();
  const albumIds = new Set();
  const artistIds = new Set();

  for (const hub of hubs) {
    if (hub.previewCovers?.length) continue;

    const albumSlice = hub.albumIds?.slice(0, HUB_PREVIEW_COUNT) || [];
    albumSlice.forEach((id) => albumIds.add(id.toString()));

    const neededArtists = Math.max(0, HUB_PREVIEW_COUNT - albumSlice.length);
    if (neededArtists > 0) {
      hub.artistIds
        ?.slice(0, neededArtists)
        .forEach((id) => artistIds.add(id.toString()));
    }
  }

  const [albumDocs, artistDocs] = await Promise.all([
    albumIds.size
      ? Album.find({ _id: { $in: [...albumIds] } }).select(COVER_SELECT).lean()
      : [],
    artistIds.size
      ? Artist.find({ _id: { $in: [...artistIds] } })
          .select(COVER_SELECT)
          .lean()
      : [],
  ]);

  albumDocs.forEach((album) => albumsById.set(album._id.toString(), album));
  artistDocs.forEach((artist) =>
    artistsById.set(artist._id.toString(), artist),
  );

  return hubs.map((hub) => {
    const previewCovers = hub.previewCovers?.length
      ? hub.previewCovers
      : buildPreviewCoversFromMaps(
          hub.albumIds,
          hub.artistIds,
          albumsById,
          artistsById,
        );

    const {
      albumIds: _albumIds,
      artistIds: _artistIds,
      embedding: _embedding,
      playlistIds: _playlistIds,
      trackCount: _trackCount,
      categoryId: _categoryId,
      generatedAt: _generatedAt,
      ...publicHub
    } = hub;

    return { ...publicHub, previewCovers };
  });
};

export const upsertHubForCategory = async (category, generatedAt = new Date()) => {
  const tagField = getCategoryTagField(category.categoryType);
  if (!tagField || !hasValidEmbedding(category.embedding)) {
    return null;
  }

  const [albumIds, artistIds, playlistIds] = await Promise.all([
    findNearestAlbumIds(category.embedding, category.categoryId, tagField),
    findNearestArtistIds(category.embedding, category.categoryId, tagField),
    findNearestPlaylistIds(category.embedding, category.categoryId, tagField),
  ]);

  const previewCovers = await buildPreviewCovers(albumIds, artistIds);

  return Hub.findOneAndUpdate(
    {
      categoryType: category.categoryType,
      categoryId: category.categoryId,
    },
    {
      $set: {
        name: category.name,
        localizedNames: category.localizedNames,
        embedding: category.embedding,
        trackCount: category.trackCount,
        accentColor: pickAccentColor(category.categoryId),
        albumIds,
        artistIds,
        playlistIds,
        previewCovers,
        generatedAt,
      },
    },
    { upsert: true, setDefaultsOnInsert: true, new: true },
  );
};

export const refreshHubForCategory = async (categoryType, categoryId) => {
  const tagField = getCategoryTagField(categoryType);
  const Model = getCategoryModel(categoryType);
  if (!tagField || !Model) return null;

  const embedding = await recomputeCentroidForCategory(categoryType, categoryId);
  const trackCount = await Song.countDocuments({
    [tagField]: categoryId,
    ...VALID_SONG_EMBEDDING,
  });

  if (!embedding || trackCount < HUB_MIN_TRACKS) {
    await Hub.deleteOne({ categoryType, categoryId });
    await invalidateHubsCache();
    return null;
  }

  const category = await Model.findById(categoryId)
    .select("name localizedNames")
    .lean();
  if (!category) return null;

  const hub = await upsertHubForCategory({
    categoryType,
    categoryId,
    name: category.name,
    localizedNames: category.localizedNames,
    embedding,
    trackCount,
  });

  await invalidateHubsCache();
  return hub;
};

export const generateHubs = async () => {
  const [genreCategories, moodCategories] = await Promise.all([
    findEligibleCategories(Genre, "Genre", "genres"),
    findEligibleCategories(Mood, "Mood", "moods"),
  ]);

  const eligible = [...genreCategories, ...moodCategories];
  const eligibleKeys = new Set();
  const now = new Date();

  await mapWithConcurrency(
    eligible,
    async (category) => {
      const key = `${category.categoryType}:${category.categoryId}`;
      eligibleKeys.add(key);
      await upsertHubForCategory(category, now);
    },
    HUB_UPSERT_CONCURRENCY,
  );

  const existingHubs = await Hub.find({})
    .select("_id categoryType categoryId")
    .lean();
  const staleIds = existingHubs
    .filter(
      (hub) => !eligibleKeys.has(`${hub.categoryType}:${hub.categoryId}`),
    )
    .map((hub) => hub._id);

  if (staleIds.length) {
    await Hub.deleteMany({ _id: { $in: staleIds } });
  }

  console.log(
    `[generateHubs] Upserted ${eligible.length} hub(s), removed ${staleIds.length} stale`,
  );

  await invalidateHubsCache();

  return eligible.length;
};

export const runCategoryEmbeddingsAndHubs = async () => {
  await calculateCentroids();
  return generateHubs();
};
