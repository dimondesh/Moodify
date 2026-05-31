import crypto from "crypto";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Hub } from "../models/hub.model.js";
import { EMBEDDING_DIM } from "../constants/embedding.js";
import { cosineSimilarity } from "./recommendation.service.js";
import { calculateCentroids } from "./categoryEmbedding.service.js";
import redisClient from "./redis.js";

export const HUBS_CACHE_KEY = "cache:/api/hubs";

export const invalidateHubsCache = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(HUBS_CACHE_KEY);
    }
  } catch (error) {
    console.error("[invalidateHubsCache]:", error);
  }
};

export const HUB_MIN_TRACKS = 51;
export const HUB_SECTION_LIMIT = 12;
export const HUB_CANDIDATE_POOL = 400;
export const HUB_PREVIEW_COUNT = 3;

const COVER_SELECT = "images imagePublicId coverAccentHex";

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

const EMBEDDING_FILTER = {
  "audioFeatures.embedding": { $exists: true, $ne: null },
};

const VALID_EMBEDDING_MATCH = {
  embedding: { $exists: true, $ne: null, $size: EMBEDDING_DIM },
};

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

const findNearestEntityIds = async (hubEmbedding, Model, extraMatch = {}) => {
  if (!hasValidEmbedding(hubEmbedding)) return [];

  const candidates = await Model.aggregate([
    { $match: { ...VALID_EMBEDDING_MATCH, ...extraMatch } },
    { $sample: { size: HUB_CANDIDATE_POOL } },
  ]);

  if (!candidates.length) return [];

  return candidates
    .map((entity) => ({
      _id: entity._id,
      score: cosineSimilarity(hubEmbedding, entity.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HUB_SECTION_LIMIT)
    .map((item) => item._id);
};

const findEligibleCategories = async (Model, categoryType, tagField) => {
  const categories = await Model.find({
    embedding: { $exists: true, $ne: null, $size: EMBEDDING_DIM },
  })
    .select("_id name localizedNames embedding")
    .lean();

  const eligible = [];

  for (const category of categories) {
    const trackCount = await Song.countDocuments({
      [tagField]: category._id,
      ...EMBEDDING_FILTER,
    });

    if (trackCount < HUB_MIN_TRACKS) continue;

    eligible.push({
      categoryType,
      categoryId: category._id,
      name: category.name,
      localizedNames: category.localizedNames,
      embedding: category.embedding,
      trackCount,
    });
  }

  return eligible;
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

export const generateHubs = async () => {
  const [genreCategories, moodCategories] = await Promise.all([
    findEligibleCategories(Genre, "Genre", "genres"),
    findEligibleCategories(Mood, "Mood", "moods"),
  ]);

  const eligible = [...genreCategories, ...moodCategories];
  const eligibleKeys = new Set();
  const now = new Date();

  for (const category of eligible) {
    const key = `${category.categoryType}:${category.categoryId}`;
    eligibleKeys.add(key);

    const [albumIds, artistIds, playlistIds] = await Promise.all([
      findNearestEntityIds(category.embedding, Album),
      findNearestEntityIds(category.embedding, Artist),
      findNearestEntityIds(category.embedding, Playlist, { isPublic: true }),
    ]);

    const previewCovers = await buildPreviewCovers(albumIds, artistIds);

    await Hub.findOneAndUpdate(
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
          generatedAt: now,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }

  const existingHubs = await Hub.find({}).select("_id categoryType categoryId").lean();
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
