// backend/src/controller/song.controller.js

import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";
import { User } from "../models/user.model.js";
import { UserRecommendation } from "../models/userRecommendation.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Mix } from "../models/mix.model.js";
import { Artist } from "../models/artist.model.js";
import { GeneratedPlaylist } from "../models/generatedPlaylist.model.js";
import { getVibeMatchTracks } from "../lib/recommendation.service.js";
import axios from "axios";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl duration playCount";

export const getAllSongs = async (req, res, next) => {
  try {
    const songs = await Song.find()
      .select(SONG_MINIMAL_SELECT)
      .populate("artist", "name imageUrl")
      .lean()
      .sort({ createdAt: -1 });

    res.status(200).json({ songs });
  } catch (error) {
    next(error);
  }
};

export const getQuickPicks = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 8,
) => {
  try {
    const userId = req.user?.id;
    let finalPicks = [];

    if (userId) {
      const recommendations = await UserRecommendation.findOne({
        user: userId,
        type: "FEATURED_SONGS",
      }).populate({
        path: "items",
        model: "Song",
        select: SONG_MINIMAL_SELECT,
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      });

      if (recommendations && recommendations.items.length > 0) {
        finalPicks = recommendations.items.slice(0, limit);
      }
    }

    if (finalPicks.length === 0) {
      finalPicks = await getTrendingSongs(req, res, next, true, limit);
    }

    if (returnInternal) return finalPicks;
    return res.json(finalPicks);
  } catch (error) {
    const trendingFallback = await getTrendingSongs(
      req,
      res,
      next,
      true,
      limit,
    );
    if (returnInternal) return trendingFallback;
    return res.json(trendingFallback);
  }
};

export const getTrendingSongs = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 12,
) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingSongIdsResult = await ListenHistory.aggregate([
      { $match: { listenedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$song", listenCount: { $sum: 1 } } },
      { $sort: { listenCount: -1 } },
      { $limit: limit * 2 },
      { $project: { _id: 1 } },
    ]);

    const orderedSongIds = trendingSongIdsResult
      .map((item) => item._id)
      .filter((id) => id);
    let finalSongs;

    if (orderedSongIds.length === 0) {
      finalSongs = await Song.find()
        .sort({ playCount: -1 })
        .limit(limit)
        .select(SONG_MINIMAL_SELECT)
        .populate("artist", "name imageUrl");
    } else {
      const unorderedSongs = await Song.find({ _id: { $in: orderedSongIds } })
        .select(SONG_MINIMAL_SELECT)
        .populate("artist", "name imageUrl");

      const songMap = new Map(
        unorderedSongs.map((song) => [song._id.toString(), song]),
      );
      finalSongs = orderedSongIds
        .map((id) => songMap.get(id.toString()))
        .filter(Boolean)
        .slice(0, limit);
    }

    if (returnInternal) return finalSongs;
    return res.json(finalSongs);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getMadeForYouSongs = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 12,
) => {
  try {
    const userId = req.user.id;
    const listenHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .limit(100)
      .populate({ path: "song", select: "genres moods artist" });

    if (listenHistory.length < 10) {
      const trendingFallback = await getTrendingSongs(
        req,
        res,
        next,
        true,
        limit,
      );
      if (returnInternal) return trendingFallback;
      return res.json(trendingFallback);
    }

    const validHistory = listenHistory.filter((item) => item.song !== null);
    if (validHistory.length === 0) {
      const trendingFallback = await getTrendingSongs(
        req,
        res,
        next,
        true,
        limit,
      );
      if (returnInternal) return trendingFallback;
      return res.json(trendingFallback);
    }

    const listenedSongIds = validHistory.map((item) => item.song._id);
    const genreCounts = {};
    const moodCounts = {};
    const artistCounts = {};

    validHistory.forEach((item) => {
      const { song } = item;
      if (song) {
        song.genres.forEach(
          (g) => (genreCounts[g] = (genreCounts[g] || 0) + 1),
        );
        song.moods.forEach((m) => (moodCounts[m] = (moodCounts[m] || 0) + 1));
        song.artist.forEach(
          (a) => (artistCounts[a] = (artistCounts[a] || 0) + 1),
        );
      }
    });

    const getTopItems = (counts, countLimit) =>
      Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, countLimit);

    const topGenreIds = getTopItems(genreCounts, 5);
    const topMoodIds = getTopItems(moodCounts, 3);
    const topArtistIds = getTopItems(artistCounts, 5);

    const recommendations = await Song.find({
      _id: { $nin: listenedSongIds },
      $or: [
        { genres: { $in: topGenreIds } },
        { moods: { $in: topMoodIds } },
        { artist: { $in: topArtistIds } },
      ],
    })
      .limit(50)
      .select(SONG_MINIMAL_SELECT)
      .populate("artist", "name imageUrl");

    const shuffledRecommendations = recommendations
      .sort(() => 0.5 - Math.random())
      .slice(0, limit);

    if (returnInternal) return shuffledRecommendations;
    return res.json(shuffledRecommendations);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const recordListen = async (req, res, next) => {
  try {
    const { id: songId } = req.params;
    const { playbackContext } = req.body;
    const userId = req.user.id;
    const user = await User.findById(userId).select("isAnonymous");

    if (user && user.isAnonymous) {
      return res.status(200).json({
        success: true,
        message: "Listen not recorded due to anonymous mode.",
      });
    }

    if (!songId || !userId)
      return res
        .status(400)
        .json({ message: "Song ID and User ID are required." });
    const songExists = await Song.findById(songId);
    if (!songExists)
      return res.status(404).json({ message: "Song not found." });

    const validContextTypes = [
      "album",
      "playlist",
      "generated-playlist",
      "mix",
      "artist",
    ];
    if (playbackContext && !validContextTypes.includes(playbackContext.type)) {
      return res.status(400).json({
        message: "Invalid playback context type.",
        validTypes: validContextTypes,
      });
    }

    const listenData = { user: userId, song: songId };
    if (playbackContext) {
      listenData.playbackContext = {
        type: playbackContext.type,
        entityId: playbackContext.entityId || null,
        entityTitle: playbackContext.entityTitle || null,
      };
    }

    const listen = new ListenHistory(listenData);
    await listen.save();
    await Song.updateOne({ _id: songId }, { $inc: { playCount: 1 } });

    res
      .status(200)
      .json({ success: true, message: "Listen recorded successfully." });
  } catch (error) {
    next(error);
  }
};

export const getListenHistory = async (
  req,
  res,
  next,
  returnInternal = false,
  limit = 12,
) => {
  try {
    const userId = req.user.id;
    const fullHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .populate({
        path: "song",
        populate: { path: "artist", model: "Artist", select: "name imageUrl" },
      })
      .lean();

    if (!fullHistory || fullHistory.length === 0) {
      const result = { entities: [] };
      if (returnInternal) return result;
      return res.json(result);
    }

    const uniqueEntities = [];
    const seenEntityKeys = new Set();

    for (const record of fullHistory) {
      if (!record.playbackContext) continue;

      const { type, entityId, entityTitle } = record.playbackContext;
      const entityKey = `${type}-${entityId}`;

      if (!seenEntityKeys.has(entityKey)) {
        seenEntityKeys.add(entityKey);

        const entity = {
          _id: entityId,
          itemType: type,
          title: entityTitle || "Unknown",
          imageUrl: null,
          songs: [],
        };

        if (entityId) {
          try {
            let entityData = null;
            switch (type) {
              case "album":
                entityData = await Album.findById(entityId)
                  .select("title imageUrl type artist")
                  .populate("artist", "name")
                  .populate({
                    path: "songs",
                    select: SONG_MINIMAL_SELECT,
                    populate: { path: "artist", select: "name imageUrl" },
                  })
                  .lean();
                break;
              case "playlist":
                entityData = await Playlist.findById(entityId)
                  .select("title imageUrl owner")
                  .populate("owner", "fullName")
                  .populate({
                    path: "songs",
                    select: SONG_MINIMAL_SELECT,
                    populate: { path: "artist", select: "name imageUrl" },
                  })
                  .lean();
                break;
              case "mix":
                entityData = await Mix.findById(entityId)
                  .select("name imageUrl type")
                  .populate({
                    path: "songs",
                    select: SONG_MINIMAL_SELECT,
                    populate: { path: "artist", select: "name imageUrl" },
                  })
                  .lean();
                if (entityData) entityData.title = entityData.name;
                break;
              case "generated-playlist":
                entityData = await GeneratedPlaylist.findById(entityId)
                  .select("nameKey imageUrl")
                  .populate({
                    path: "songs",
                    select: SONG_MINIMAL_SELECT,
                    populate: { path: "artist", select: "name imageUrl" },
                  })
                  .lean();
                if (entityData) entityData.title = entityData.nameKey;
                break;
              case "artist":
                entityData = await Artist.findById(entityId)
                  .select("name imageUrl")
                  .populate({
                    path: "songs",
                    select: SONG_MINIMAL_SELECT,
                    populate: { path: "artist", select: "name imageUrl" },
                    options: { sort: { playCount: -1 }, limit: 5 },
                  })
                  .lean();
                if (entityData) entityData.title = entityData.name;
                break;
            }

            if (entityData) {
              entity.title = entityData.title || entityTitle;
              entity.imageUrl = entityData.imageUrl;
              entity.songs = entityData.songs || [];
              if (type === "album") {
                entity.type = entityData.type;
                entity.artist = entityData.artist;
              } else if (type === "playlist") {
                entity.owner = entityData.owner;
              } else if (type === "mix") {
                entity.type = entityData.type;
              } else if (type === "generated-playlist") {
                entity.nameKey = entityData.nameKey;
              } else if (type === "artist") {
                entity.name = entityData.name;
              }
            }
          } catch (error) {
            entity.imageUrl = "/default-album-cover.png";
          }
        }
        uniqueEntities.push(entity);
      }
    }

    const result = { entities: uniqueEntities.slice(0, limit) };
    if (returnInternal) return result;
    return res.status(200).json(result);
  } catch (error) {
    if (returnInternal) return { entities: [] };
    next(error);
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getImageForColorAnalysis = async (req, res, next) => {
  const { url } = req.query;
  if (!url) return res.status(400).send({ message: "Image URL is required" });

  const decodedUrl = decodeURIComponent(url);
  const maxRetries = 3;
  const retryDelay = 500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        method: "get",
        url: decodedUrl,
        responseType: "stream",
        timeout: 5000,
      });

      res.setHeader("Content-Type", response.headers["content-type"]);
      response.data.pipe(res);
      return;
    } catch (error) {
      if (attempt === maxRetries)
        return next(new Error("Failed to proxy image after multiple attempts"));
      await delay(retryDelay);
    }
  }
};

export const getSongById = async (req, res, next) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.status(200).json(song);
  } catch (error) {
    next(error);
  }
};

export const getSongLyrics = async (req, res, next) => {
  try {
    const song = await Song.findById(req.params.id).select("lyrics");
    if (!song) return res.status(404).json({ message: "Song not found" });
    res.status(200).json({ lyrics: song.lyrics });
  } catch (error) {
    next(error);
  }
};

export const getRecommendedSongs = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const recommendations = await getVibeMatchTracks(id, parseInt(limit));
    if (!recommendations || recommendations.length === 0) {
      return res.status(404).json({ message: "No similar tracks found" });
    }
    res.json(recommendations);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error while fetching recommendations" });
  }
};
