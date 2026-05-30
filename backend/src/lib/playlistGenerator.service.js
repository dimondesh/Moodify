// backend/src/lib/playlistGenerator.service.js
import mongoose from "mongoose";
import { ListenHistory } from "../models/listenHistory.model.js";
import { Song } from "../models/song.model.js";
import { LikedSong } from "../models/likedSong.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import {
  CDN_ON_REPEAT_IMAGE,
  CDN_DISCOVER_WEEKLY_IMAGE,
  CDN_ON_REPEAT_REWIND_IMAGE,
  CDN_DEFAULT_ALBUM_COVER,
} from "../constants/cdn.js";
import {
  buildStaticCdnImages,
  getLargeImageUrl,
} from "./imageVariants.service.js";
import { buildMixPlaylistLabels } from "./mixLocalization.js";
import { ensureGenreAndMoodLocalizedNames } from "./mixLocale.service.js";

const ON_REPEAT_SONG_COUNT = 30;
const MIX_SONG_COUNT = 30;
const MIN_SONGS_FOR_MIX = 5;
const PERSONAL_MIX_MIN_HISTORY = 10;
const DISCOVER_WEEKLY_MIN_HISTORY = 20;
const DISCOVER_WEEKLY_MIN_TRACKS = 10;

const SMART_PLAYLIST_COPY = {
  ON_REPEAT: {
    title: "On Repeat",
    description: "Songs you've been playing the most lately.",
  },
  DISCOVER_WEEKLY: {
    title: "Discover Weekly",
    description:
      "Your weekly mixtape of fresh music. Enjoy new discoveries and deep cuts chosen just for you.",
  },
  ON_REPEAT_REWIND: {
    title: "On Repeat Rewind",
    description: "Songs you loved in the past. Rediscover your old favorites.",
  },
};

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const pickMixCoverImages = (songWithArtists) => {
  const artistImages = songWithArtists?.artistDetails?.[0]?.images;
  if (artistImages?.length) return artistImages;

  const songCover = getLargeImageUrl(songWithArtists?.images);
  if (songCover) return buildStaticCdnImages(songCover);

  return buildStaticCdnImages(CDN_DEFAULT_ALBUM_COVER);
};

const upsertSystemPlaylist = (filter, data) =>
  Playlist.findOneAndUpdate(
    filter,
    {
      $set: {
        ...data,
        owner: data.owner ?? null,
        isSystem: true,
        lastGeneratedAt: data.lastGeneratedAt ?? new Date(),
      },
    },
    { upsert: true, new: true },
  );

const sampleSongsForSource = async (queryField, sourceId) => {
  const songCount = await Song.countDocuments({ [queryField]: sourceId });
  if (songCount < MIN_SONGS_FOR_MIX) return null;

  const randomSongs = await Song.aggregate([
    { $match: { [queryField]: sourceId } },
    { $sample: { size: MIX_SONG_COUNT } },
    {
      $lookup: {
        from: "artists",
        localField: "artist",
        foreignField: "_id",
        as: "artistDetails",
      },
    },
  ]);

  if (randomSongs.length === 0 || !randomSongs[0].artistDetails?.[0]) {
    return null;
  }

  return randomSongs;
};

/** Глобальные GENRE_MIX и MOOD_MIX (owner === null, isPublic). */
export const generateGlobalGenreAndMoodMixes = async () => {
  console.log("[PlaylistGenerator] Starting global genre and mood mixes...");
  const today = getTodayStart();

  await ensureGenreAndMoodLocalizedNames();

  const [genres, moods] = await Promise.all([
    Genre.find().lean(),
    Mood.find().lean(),
  ]);

  const sources = [
    ...genres.map((g) => ({ ...g, mixType: "GENRE_MIX" })),
    ...moods.map((m) => ({ ...m, mixType: "MOOD_MIX" })),
  ];

  let updatedCount = 0;

  for (const source of sources) {
    const queryField = source.mixType === "GENRE_MIX" ? "genres" : "moods";
    const randomSongs = await sampleSongsForSource(queryField, source._id);
    if (!randomSongs) continue;

    const { title, localizedNames } = buildMixPlaylistLabels(source);

    await upsertSystemPlaylist(
      { owner: null, type: source.mixType, sourceId: source._id },
      {
        owner: null,
        type: source.mixType,
        title,
        description: "",
        sourceName: source.name,
        sourceId: source._id,
        localizedNames,
        songs: randomSongs.map((s) => s._id),
        images: pickMixCoverImages(randomSongs[0]),
        isPublic: true,
        lastGeneratedAt: today,
      },
    );

    updatedCount += 1;
  }

  console.log(
    `[PlaylistGenerator] Global mixes updated: ${updatedCount} of ${sources.length} sources.`,
  );

  return updatedCount;
};

/** PERSONAL_MIX для конкретного пользователя (Daily Mix). */
export const generatePersonalMixesForUser = async (userId) => {
  try {
    console.log(`[PlaylistGenerator] Generating personal mixes for user: ${userId}`);
    const ownerId = toObjectId(userId);
    const today = getTodayStart();

    const listenHistory = await ListenHistory.find({ user: ownerId })
      .limit(200)
      .populate({ path: "song", select: "genres moods artist" })
      .lean();

    const validHistory = listenHistory.filter((item) => item.song);
    if (validHistory.length < PERSONAL_MIX_MIN_HISTORY) {
      console.log(
        `[PlaylistGenerator] Not enough listen history for user ${userId}: ${validHistory.length}`,
      );
      return [];
    }

    const genreCounts = {};
    const moodCounts = {};

    validHistory.forEach((item) => {
      const song = item.song;
      (song.genres || []).forEach((genreId) => {
        const key = genreId.toString();
        genreCounts[key] = (genreCounts[key] || 0) + 1;
      });
      (song.moods || []).forEach((moodId) => {
        const key = moodId.toString();
        moodCounts[key] = (moodCounts[key] || 0) + 1;
      });
    });

    const topGenreIds = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => toObjectId(id));

    const topMoodIds = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => toObjectId(id));

    const mixes = [];
    let mixIndex = 0;

    const createPersonalMix = async (sourceId, queryField, sourceLabel) => {
      const randomSongs = await sampleSongsForSource(queryField, sourceId);
      if (!randomSongs) return;

      mixIndex += 1;
      const title = `Daily Mix ${mixIndex}`;

      const personalMix = await upsertSystemPlaylist(
        { owner: ownerId, type: "PERSONAL_MIX", sourceId },
        {
          owner: ownerId,
          type: "PERSONAL_MIX",
          title,
          description: "A personal mix based on your listening habits.",
          sourceName: sourceLabel,
          sourceId,
          songs: randomSongs.map((s) => s._id),
          images: pickMixCoverImages(randomSongs[0]),
          isPublic: false,
          lastGeneratedAt: today,
        },
      );

      mixes.push(personalMix);
    };

    for (const genreId of topGenreIds) {
      const genre = await Genre.findById(genreId).lean();
      if (!genre) continue;
      await createPersonalMix(genreId, "genres", genre.name);
    }

    for (const moodId of topMoodIds) {
      const mood = await Mood.findById(moodId).lean();
      if (!mood) continue;
      await createPersonalMix(moodId, "moods", mood.name);
    }

    console.log(
      `[PlaylistGenerator] Generated ${mixes.length} personal mixes for user ${userId}`,
    );
    return mixes;
  } catch (error) {
    console.error(
      `[PlaylistGenerator] Error generating personal mixes for user ${userId}:`,
      error,
    );
    return [];
  }
};

export const generateOnRepeatPlaylistForUser = async (userId) => {
  console.log(`[PlaylistGenerator] Generating On Repeat for user: ${userId}`);
  const ownerId = toObjectId(userId);

  const listenHistory = await ListenHistory.aggregate([
    { $match: { user: ownerId } },
    { $group: { _id: "$song", listenCount: { $sum: 1 } } },
    { $sort: { listenCount: -1 } },
    { $limit: ON_REPEAT_SONG_COUNT },
  ]);

  if (listenHistory.length === 0) {
    await Playlist.deleteOne({ owner: ownerId, type: "ON_REPEAT" });
    console.log(
      `[PlaylistGenerator] No listen history for user ${userId}. Removed stale On Repeat.`,
    );
    return null;
  }

  const songIds = listenHistory.map((item) => item._id);
  const copy = SMART_PLAYLIST_COPY.ON_REPEAT;

  const onRepeatPlaylist = await upsertSystemPlaylist(
    { owner: ownerId, type: "ON_REPEAT" },
    {
      owner: ownerId,
      type: "ON_REPEAT",
      title: copy.title,
      description: copy.description,
      songs: songIds,
      images: buildStaticCdnImages(CDN_ON_REPEAT_IMAGE),
      isPublic: false,
    },
  );

  console.log(
    `[PlaylistGenerator] On Repeat for user ${userId}: ${songIds.length} songs.`,
  );
  return onRepeatPlaylist;
};

export const generateDiscoverWeeklyForUser = async (userId) => {
  try {
    console.log(`[PlaylistGenerator] Generating Discover Weekly for user: ${userId}`);
    const ownerId = toObjectId(userId);

    const listenHistory = await ListenHistory.find({ user: ownerId }).select(
      "song -_id",
    );
    const listenedSongIds = listenHistory.map((item) => item.song);
    const likedSongIds = await LikedSong.find({ user: ownerId }).distinct("song");
    const excludedSongIds = [...new Set([...listenedSongIds, ...likedSongIds])];

    if (listenedSongIds.length < DISCOVER_WEEKLY_MIN_HISTORY) {
      console.log(
        `[PlaylistGenerator] User ${userId} has insufficient listen history. Skipping Discover Weekly.`,
      );
      return null;
    }

    const tasteProfile = await ListenHistory.aggregate([
      { $match: { user: ownerId } },
      { $limit: 200 },
      {
        $lookup: {
          from: "songs",
          localField: "song",
          foreignField: "_id",
          as: "songDetails",
        },
      },
      { $unwind: "$songDetails" },
      {
        $project: {
          genres: "$songDetails.genres",
          artists: "$songDetails.artist",
        },
      },
      {
        $facet: {
          topGenres: [
            { $unwind: "$genres" },
            { $group: { _id: "$genres", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          topArtists: [
            { $unwind: "$artists" },
            { $group: { _id: "$artists", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ]);

    const topGenreIds = tasteProfile[0]?.topGenres?.map((g) => g._id) ?? [];
    const topArtistIds = tasteProfile[0]?.topArtists?.map((a) => a._id) ?? [];

    if (topGenreIds.length === 0 && topArtistIds.length === 0) {
      console.log(
        `[PlaylistGenerator] No taste signals for user ${userId}. Skipping Discover Weekly.`,
      );
      return null;
    }

    const candidates = await Song.find({
      _id: { $nin: excludedSongIds },
      $or: [
        ...(topGenreIds.length ? [{ genres: { $in: topGenreIds } }] : []),
        ...(topArtistIds.length ? [{ artist: { $in: topArtistIds } }] : []),
      ],
    })
      .select("_id")
      .sort({ playCount: -1 })
      .limit(200)
      .lean();

    const finalTracks = candidates.sort(() => 0.5 - Math.random()).slice(0, 30);

    if (finalTracks.length < DISCOVER_WEEKLY_MIN_TRACKS) {
      console.log(
        `[PlaylistGenerator] Not enough new tracks for user ${userId}. Skipping Discover Weekly.`,
      );
      return null;
    }

    const copy = SMART_PLAYLIST_COPY.DISCOVER_WEEKLY;
    const playlist = await upsertSystemPlaylist(
      { owner: ownerId, type: "DISCOVER_WEEKLY" },
      {
        owner: ownerId,
        type: "DISCOVER_WEEKLY",
        title: copy.title,
        description: copy.description,
        images: buildStaticCdnImages(CDN_DISCOVER_WEEKLY_IMAGE),
        songs: finalTracks.map((song) => song._id),
        isPublic: false,
      },
    );

    console.log(
      `[PlaylistGenerator] Discover Weekly for user ${userId}: ${finalTracks.length} tracks.`,
    );
    return playlist;
  } catch (error) {
    console.error(
      `[PlaylistGenerator] Error generating Discover Weekly for user ${userId}:`,
      error,
    );
    return null;
  }
};

export const generateOnRepeatRewindForUser = async (userId) => {
  try {
    console.log(`[PlaylistGenerator] Generating On Repeat Rewind for user: ${userId}`);
    const ownerId = toObjectId(userId);

    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const pastFavorites = await ListenHistory.aggregate([
      {
        $match: {
          user: ownerId,
          listenedAt: { $gte: sixMonthsAgo, $lt: oneMonthAgo },
        },
      },
      { $group: { _id: "$song", count: { $sum: 1 } } },
      { $match: { count: { $gt: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    const pastFavoriteSongIds = pastFavorites.map((item) => item._id);

    if (pastFavoriteSongIds.length < DISCOVER_WEEKLY_MIN_TRACKS) {
      console.log(
        `[PlaylistGenerator] Not enough past favorites for user ${userId}. Skipping On Repeat Rewind.`,
      );
      return null;
    }

    const recentListens = await ListenHistory.find({
      user: ownerId,
      listenedAt: { $gte: oneMonthAgo },
    }).select("song -_id");
    const recentSongIdSet = new Set(
      recentListens.map((item) => item.song.toString()),
    );

    const rewindSongIds = pastFavoriteSongIds.filter(
      (id) => !recentSongIdSet.has(id.toString()),
    );

    if (rewindSongIds.length < DISCOVER_WEEKLY_MIN_TRACKS) {
      console.log(
        `[PlaylistGenerator] Not enough forgotten tracks for user ${userId}. Skipping On Repeat Rewind.`,
      );
      return null;
    }

    const finalTracks = await Song.find({
      _id: { $in: rewindSongIds.slice(0, 30) },
    });

    const copy = SMART_PLAYLIST_COPY.ON_REPEAT_REWIND;
    const playlist = await upsertSystemPlaylist(
      { owner: ownerId, type: "ON_REPEAT_REWIND" },
      {
        owner: ownerId,
        type: "ON_REPEAT_REWIND",
        title: copy.title,
        description: copy.description,
        images: buildStaticCdnImages(CDN_ON_REPEAT_REWIND_IMAGE),
        songs: finalTracks.map((song) => song._id),
        isPublic: false,
      },
    );

    console.log(
      `[PlaylistGenerator] On Repeat Rewind for user ${userId}: ${finalTracks.length} tracks.`,
    );
    return playlist;
  } catch (error) {
    console.error(
      `[PlaylistGenerator] Error generating On Repeat Rewind for user ${userId}:`,
      error,
    );
    return null;
  }
};
