import redisClient from "../redis.js";
import { TRENDING_CACHE_TTL } from "../../constants/cache.js";
import { ListenHistory } from "../../models/listenHistory.model.js";
import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";

const DEFAULT_LIMIT = 12;
const TREND_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

const ALBUM_SONG_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt";

export const TRENDING_REDIS_KEYS = {
  songs: "trending:songs",
  artists: "trending:artists",
  albums: "trending:albums",
};

const getTrendLookbackDate = () => new Date(Date.now() - TREND_LOOKBACK_MS);

const attachSongsToAlbums = async (albums) => {
  if (!albums.length) return albums;

  const albumIds = albums.map((album) => album._id);
  const songs = await Song.find({ albumId: { $in: albumIds } })
    .select(ALBUM_SONG_SELECT)
    .populate({
      path: "artist",
      model: "Artist",
      select: "name images",
    })
    .sort({ trackNumber: 1, createdAt: 1 })
    .lean();

  const songsByAlbumId = new Map();
  for (const song of songs) {
    if (!song.albumId) continue;
    const albumKey = song.albumId.toString();
    if (!songsByAlbumId.has(albumKey)) {
      songsByAlbumId.set(albumKey, []);
    }
    songsByAlbumId.get(albumKey).push(song);
  }

  return albums.map((album) => ({
    ...album,
    songs: songsByAlbumId.get(album._id.toString()) || [],
  }));
};

const orderDocumentsByIds = (documents, orderedIds) => {
  const docMap = new Map(
    documents.map((doc) => [doc._id.toString(), doc]),
  );
  return orderedIds
    .map((id) => docMap.get(id.toString()))
    .filter(Boolean);
};

export const aggregateTrendingSongs = async (limit = DEFAULT_LIMIT) => {
  const sevenDaysAgo = getTrendLookbackDate();

  const trendingSongIdsResult = await ListenHistory.aggregate([
    { $match: { listenedAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: "$song", listenCount: { $sum: 1 } } },
    { $sort: { listenCount: -1 } },
    { $limit: limit * 2 },
    { $project: { _id: 1 } },
  ]);

  const orderedSongIds = trendingSongIdsResult
    .map((item) => item._id)
    .filter(Boolean);

  if (orderedSongIds.length === 0) {
    return Song.find()
      .sort({ playCount: -1 })
      .limit(limit)
      .select(SONG_MINIMAL_SELECT)
      .populate("artist", "name images")
      .lean();
  }

  const songs = await Song.find({ _id: { $in: orderedSongIds } })
    .select(SONG_MINIMAL_SELECT)
    .populate("artist", "name images")
    .lean();

  return orderDocumentsByIds(songs, orderedSongIds).slice(0, limit);
};

export const aggregateTrendingArtists = async (limit = DEFAULT_LIMIT) => {
  const sevenDaysAgo = getTrendLookbackDate();

  const trendingArtistsResult = await ListenHistory.aggregate([
    { $match: { listenedAt: { $gte: sevenDaysAgo } } },
    {
      $lookup: {
        from: "songs",
        localField: "song",
        foreignField: "_id",
        as: "songDoc",
      },
    },
    { $unwind: "$songDoc" },
    { $unwind: "$songDoc.artist" },
    {
      $group: {
        _id: "$songDoc.artist",
        listenCount: { $sum: 1 },
      },
    },
    { $sort: { listenCount: -1 } },
    { $limit: limit * 2 },
    { $project: { _id: 1 } },
  ]);

  const orderedArtistIds = trendingArtistsResult
    .map((item) => item._id)
    .filter(Boolean);

  if (orderedArtistIds.length === 0) {
    const fallback = await Song.aggregate([
      { $unwind: "$artist" },
      {
        $group: {
          _id: "$artist",
          totalPlayCount: { $sum: { $ifNull: ["$playCount", 0] } },
        },
      },
      { $sort: { totalPlayCount: -1 } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);

    const fallbackIds = fallback.map((item) => item._id);
    const artists = await Artist.find({ _id: { $in: fallbackIds } }).lean();
    return orderDocumentsByIds(artists, fallbackIds);
  }

  const artists = await Artist.find({ _id: { $in: orderedArtistIds } }).lean();
  return orderDocumentsByIds(artists, orderedArtistIds).slice(0, limit);
};

export const aggregateTrendingAlbums = async (limit = DEFAULT_LIMIT) => {
  const sevenDaysAgo = getTrendLookbackDate();

  const trendingSongIdsResult = await ListenHistory.aggregate([
    { $match: { listenedAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: "$song", listenCount: { $sum: 1 } } },
    { $sort: { listenCount: -1 } },
    { $limit: limit * 3 },
  ]);

  const songPopularityMap = new Map();
  trendingSongIdsResult.forEach((item) => {
    songPopularityMap.set(item._id.toString(), item.listenCount);
  });

  const trendingSongIds = trendingSongIdsResult
    .map((item) => item._id)
    .filter(Boolean);

  if (trendingSongIds.length === 0) {
    const fallbackAlbums = await Album.find()
      .populate("artist", "name images")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return attachSongsToAlbums(fallbackAlbums);
  }

  const trendingAlbumIds = await Song.distinct("albumId", {
    _id: { $in: trendingSongIds },
  });

  const albumsWithTrendingSongs = await Album.find({
    _id: { $in: trendingAlbumIds.filter(Boolean) },
  })
    .populate("artist", "name images")
    .lean();

  const albumsWithSongs = await attachSongsToAlbums(albumsWithTrendingSongs);
  const albumPopularity = new Map();

  albumsWithSongs.forEach((album) => {
    let totalListenCount = 0;
    let songCount = 0;

    album.songs.forEach((song) => {
      const listenCount = songPopularityMap.get(song._id.toString());
      if (listenCount) {
        totalListenCount += listenCount;
        songCount++;
      }
    });

    if (songCount > 0) {
      albumPopularity.set(album._id.toString(), {
        album,
        totalListenCount,
        averageListenCount: totalListenCount / songCount,
        songCount,
      });
    }
  });

  const sortedAlbums = Array.from(albumPopularity.values())
    .sort((a, b) => {
      if (b.totalListenCount !== a.totalListenCount) {
        return b.totalListenCount - a.totalListenCount;
      }
      if (b.averageListenCount !== a.averageListenCount) {
        return b.averageListenCount - a.averageListenCount;
      }
      return b.songCount - a.songCount;
    })
    .slice(0, limit)
    .map((item) => item.album);

  if (sortedAlbums.length < limit) {
    const additionalAlbums = await Album.find({
      _id: { $nin: sortedAlbums.map((album) => album._id) },
    })
      .populate("artist", "name images")
      .sort({ createdAt: -1 })
      .limit(limit - sortedAlbums.length)
      .lean();

    sortedAlbums.push(...(await attachSongsToAlbums(additionalAlbums)));
  }

  return sortedAlbums;
};

const readTrendingFromRedis = async (key) => {
  if (!redisClient.isOpen) return null;

  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error(`[TrendingService] Redis read failed for ${key}:`, err);
    return null;
  }
};

const writeTrendingToRedis = async (key, data) => {
  if (!redisClient.isOpen) return;

  try {
    await redisClient.setEx(key, TRENDING_CACHE_TTL, JSON.stringify(data));
  } catch (err) {
    console.error(`[TrendingService] Redis write failed for ${key}:`, err);
  }
};

export const getTrendingSongs = async (limit = DEFAULT_LIMIT) => {
  const cached = await readTrendingFromRedis(TRENDING_REDIS_KEYS.songs);
  if (cached) return cached.slice(0, limit);

  const fresh = await aggregateTrendingSongs(limit);
  await writeTrendingToRedis(TRENDING_REDIS_KEYS.songs, fresh);
  return fresh;
};

export const getTrendingArtists = async (limit = DEFAULT_LIMIT) => {
  const cached = await readTrendingFromRedis(TRENDING_REDIS_KEYS.artists);
  if (cached) return cached.slice(0, limit);

  const fresh = await aggregateTrendingArtists(limit);
  await writeTrendingToRedis(TRENDING_REDIS_KEYS.artists, fresh);
  return fresh;
};

export const getTrendingAlbums = async (limit = DEFAULT_LIMIT) => {
  const cached = await readTrendingFromRedis(TRENDING_REDIS_KEYS.albums);
  if (cached) return cached.slice(0, limit);

  const fresh = await aggregateTrendingAlbums(limit);
  await writeTrendingToRedis(TRENDING_REDIS_KEYS.albums, fresh);
  return fresh;
};

export const warmTrendingCache = async (limit = DEFAULT_LIMIT) => {
  const [trendingSongs, trendingArtists, trendingAlbums] = await Promise.all([
    aggregateTrendingSongs(limit),
    aggregateTrendingArtists(limit),
    aggregateTrendingAlbums(limit),
  ]);

  await Promise.all([
    writeTrendingToRedis(TRENDING_REDIS_KEYS.songs, trendingSongs),
    writeTrendingToRedis(TRENDING_REDIS_KEYS.artists, trendingArtists),
    writeTrendingToRedis(TRENDING_REDIS_KEYS.albums, trendingAlbums),
  ]);

  return { trendingSongs, trendingArtists, trendingAlbums };
};
