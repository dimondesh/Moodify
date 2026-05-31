import mongoose from "mongoose";
import { Artist } from "../../models/artist.model.js";
import { User } from "../../models/user.model.js";
import { FollowedArtist } from "../../models/followedArtist.model.js";
import { Song } from "../../models/song.model.js";
import {
  EMBEDDING_DIM,
  TASTE_ONBOARDING_MIN_ARTISTS,
  ONBOARDING_ARTISTS_LIMIT,
  ONBOARDING_ARTISTS_POOL_SIZE,
  ONBOARDING_ARTISTS_PAGE_SIZE,
} from "../../constants/embedding.js";
import {
  meanPoolEmbeddings,
  cosineSimilarity,
} from "./recommendation.service.js";

export const hasValidTasteVector = (user) =>
  Array.isArray(user?.tasteVector) && user.tasteVector.length === EMBEDDING_DIM;

export const needsTasteOnboarding = async (userId) => {
  const [user, followedCount] = await Promise.all([
    User.findById(userId).select("tasteVector").lean(),
    FollowedArtist.countDocuments({ user: userId }),
  ]);

  if (!user) return true;
  if (!hasValidTasteVector(user)) return true;
  return followedCount < TASTE_ONBOARDING_MIN_ARTISTS;
};

export const computeTasteVectorFromArtistIds = async (artistIds) => {
  const objectIds = artistIds.map((id) => new mongoose.Types.ObjectId(id));
  const artists = await Artist.find({ _id: { $in: objectIds } })
    .select("embedding")
    .lean();

  if (artists.length !== artistIds.length) {
    const err = new Error("One or more artists were not found");
    err.statusCode = 400;
    throw err;
  }

  const tasteVector = meanPoolEmbeddings(artists.map((a) => a.embedding));
  if (!tasteVector) {
    const err = new Error("Failed to compute taste vector");
    err.statusCode = 500;
    throw err;
  }

  return tasteVector;
};

export const completeTasteOnboarding = async (userId, artistIds) => {
  const tasteVector = await computeTasteVectorFromArtistIds(artistIds);

  const bulkOps = artistIds.map((artistId) => ({
    updateOne: {
      filter: {
        user: new mongoose.Types.ObjectId(userId),
        artist: new mongoose.Types.ObjectId(artistId),
      },
      update: {
        $setOnInsert: {
          user: new mongoose.Types.ObjectId(userId),
          artist: new mongoose.Types.ObjectId(artistId),
          addedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  await FollowedArtist.bulkWrite(bulkOps);
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { tasteVector } },
    { new: true },
  );

  return user;
};

const dedupePoolByArtistId = (pool) => {
  const seen = new Set();
  const result = [];
  for (const item of pool) {
    const id = item._id?.toString();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
};

let cachedOnboardingArtistList = null;

const getOnboardingArtistList = async () => {
  if (cachedOnboardingArtistList) return cachedOnboardingArtistList;

  const pool = dedupePoolByArtistId(await loadOnboardingArtistPool());
  cachedOnboardingArtistList = buildDiverseArtistList(pool).map(
    ({ _id, name, images }) => ({
      _id,
      name,
      images: images || [],
    }),
  );
  return cachedOnboardingArtistList;
};

const pickFarthestArtist = (pool, selectedEmbeddings) => {
  let best = null;
  let bestMinDist = -1;

  for (const candidate of pool) {
    let minSim = Infinity;
    for (const selected of selectedEmbeddings) {
      const sim = cosineSimilarity(candidate.embedding, selected);
      if (sim < minSim) minSim = sim;
    }
    const minDist = 1 - minSim;
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = candidate;
    }
  }

  return best;
};

const loadOnboardingArtistPool = async () => {
  const topByPlayCount = await Song.aggregate([
    { $unwind: "$artist" },
    {
      $group: {
        _id: "$artist",
        totalPlayCount: { $sum: { $ifNull: ["$playCount", 0] } },
      },
    },
    { $sort: { totalPlayCount: -1 } },
    { $limit: ONBOARDING_ARTISTS_POOL_SIZE },
    {
      $lookup: {
        from: "artists",
        localField: "_id",
        foreignField: "_id",
        as: "artist",
      },
    },
    { $unwind: "$artist" },
    {
      $project: {
        _id: "$artist._id",
        name: "$artist.name",
        images: "$artist.images",
        embedding: "$artist.embedding",
        totalPlayCount: 1,
      },
    },
  ]);

  if (topByPlayCount.length >= ONBOARDING_ARTISTS_POOL_SIZE) {
    return topByPlayCount;
  }

  const existingIds = new Set(topByPlayCount.map((a) => a._id.toString()));
  const remaining = ONBOARDING_ARTISTS_POOL_SIZE - topByPlayCount.length;
  const filler = await Artist.find({
    _id: { $nin: [...existingIds].map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("name images embedding")
    .limit(remaining)
    .lean();

  return [
    ...topByPlayCount,
    ...filler.map((a) => ({ ...a, totalPlayCount: 0 })),
  ];
};

const buildDiverseArtistList = (pool) => {
  const maxCount = Math.min(ONBOARDING_ARTISTS_LIMIT, pool.length);
  let remaining = [...pool];
  const selected = [];

  remaining.sort((a, b) => (b.totalPlayCount ?? 0) - (a.totalPlayCount ?? 0));
  const first = remaining.shift();
  selected.push(first);
  const selectedEmbeddings = [first.embedding];
  const selectedIds = new Set([first._id.toString()]);
  remaining = remaining.filter((a) => !selectedIds.has(a._id.toString()));

  while (selected.length < maxCount && remaining.length > 0) {
    const next = pickFarthestArtist(remaining, selectedEmbeddings);
    if (!next) break;

    const nextId = next._id.toString();
    if (selectedIds.has(nextId)) {
      remaining = remaining.filter((a) => a._id.toString() !== nextId);
      continue;
    }

    selected.push(next);
    selectedIds.add(nextId);
    selectedEmbeddings.push(next.embedding);
    remaining = remaining.filter((a) => a._id.toString() !== nextId);
  }

  return selected;
};

export const selectDiverseOnboardingArtists = async ({
  skip = 0,
  limit = ONBOARDING_ARTISTS_PAGE_SIZE,
} = {}) => {
  const list = await getOnboardingArtistList();
  if (list.length === 0) {
    return { artists: [], hasMore: false };
  }

  const safeSkip = Math.max(0, skip);
  const safeLimit = Math.max(1, Math.min(limit, ONBOARDING_ARTISTS_PAGE_SIZE));
  const page = list.slice(safeSkip, safeSkip + safeLimit);

  return {
    artists: page,
    hasMore: safeSkip + safeLimit < list.length,
  };
};
