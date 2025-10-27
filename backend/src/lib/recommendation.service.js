// backend/src/lib/recommendation.service.js
import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Album } from "../models/album.model.js";
import { UserRecommendation } from "../models/userRecommendation.model.js";
import { User } from "../models/user.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";

export const generateNewReleasesForUser = async (userId) => {
  try {
    const library = await Library.findOne({ userId }).select(
      "followedArtists.artistId"
    );
    if (!library || library.followedArtists.length === 0) {
      return;
    }

    const followedArtistIds = library.followedArtists.map((a) => a.artistId);

    const twoWeeksAgo = new Date(new Date().setDate(new Date().getDate() - 14));

    const newReleases = await Album.find({
      artist: { $in: followedArtistIds },
      createdAt: { $gte: twoWeeksAgo },
    }).sort({ createdAt: -1 });

    if (newReleases.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "NEW_RELEASE" },
        {
          items: newReleases.map((album) => album._id),
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      console.log(
        `[New Releases] Found ${newReleases.length} new releases for user ${userId}`
      );
    }
  } catch (error) {
    console.error(`[New Releases] Error generating for user ${userId}:`, error);
  }
};
export const generatePlaylistRecommendationsForUser = async (userId) => {
  try {
    console.log(`[Playlist Recs] Starting generation for user: ${userId}`);

    const user = await User.findById(userId).select("playlists");
    const library = await Library.findOne({ userId }).select(
      "playlists.playlistId"
    );

    const userPlaylistIds = user ? user.playlists.map((p) => p.toString()) : [];
    const libraryPlaylistIds = library
      ? library.playlists.map((p) => p.playlistId.toString())
      : [];
    const allUserPlaylistIds = [
      ...new Set([...userPlaylistIds, ...libraryPlaylistIds]),
    ];

    if (allUserPlaylistIds.length === 0) {
      console.log(`[Playlist Recs] User ${userId} has no playlists. Skipping.`);
      return;
    }

    const userPlaylists = await Playlist.find({
      _id: { $in: allUserPlaylistIds },
    }).select("songs");
    const allSongIds = [...new Set(userPlaylists.flatMap((p) => p.songs))];

    if (allSongIds.length < 10) {
      console.log(
        `[Playlist Recs] User ${userId} has too few songs in playlists. Skipping.`
      );
      return;
    }

    const songsWithTags = await Song.find({ _id: { $in: allSongIds } }).select(
      "genres moods"
    );
    const genreCounts = {};
    const moodCounts = {};

    songsWithTags.forEach((song) => {
      song.genres.forEach((genreId) => {
        genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
      });
      song.moods.forEach((moodId) => {
        moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
      });
    });

    const getTopItems = (counts, limit) =>
      Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, limit);
    const userTopGenres = getTopItems(genreCounts, 5);
    const userTopMoods = getTopItems(moodCounts, 3);

    const candidatePlaylists = await Playlist.find({
      isPublic: true,
      owner: { $ne: userId },
      "songs.0": { $exists: true },
    }).populate("songs", "genres moods");

    const scoredPlaylists = [];
    for (const playlist of candidatePlaylists) {
      let score = 0;
      const playlistGenreSet = new Set(
        playlist.songs.flatMap((s) => s.genres.map((id) => id.toString()))
      );
      const playlistMoodSet = new Set(
        playlist.songs.flatMap((s) => s.moods.map((id) => id.toString()))
      );

      userTopGenres.forEach((genreId) => {
        if (playlistGenreSet.has(genreId)) score += 3;
      });
      userTopMoods.forEach((moodId) => {
        if (playlistMoodSet.has(moodId)) score += 2;
      });

      score += Math.log2(playlist.likes + 1);

      if (score > 3) {
        scoredPlaylists.push({ playlistId: playlist._id, score });
      }
    }

    scoredPlaylists.sort((a, b) => b.score - a.score);
    const recommendedPlaylistIds = scoredPlaylists
      .slice(0, 10)
      .map((p) => p.playlistId);

    if (recommendedPlaylistIds.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "PLAYLIST_FOR_YOU" },
        {
          items: recommendedPlaylistIds,
          generatedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(
        `[Playlist Recs] Saved ${recommendedPlaylistIds.length} recommendations for user ${userId}`
      );
    }
  } catch (error) {
    console.error(
      `[Playlist Recs] Error generating for user ${userId}:`,
      error
    );
  }
};

export const generateFeaturedSongsForUser = async (userId, limit = 8) => {
  try {
    const listenHistory = await ListenHistory.find({ user: userId })
      .sort({ listenedAt: -1 })
      .limit(50)
      .populate({
        path: "song",
        select: "genres moods artist",
      });

    let finalPicksIds = [];

    if (listenHistory.length >= 10) {
      const listenedSongIds = listenHistory
        .map((item) => item.song?._id)
        .filter(Boolean);

      const genreCounts = {};
      const moodCounts = {};
      const artistCounts = {};

      listenHistory.forEach((item) => {
        const { song } = item;
        if (song) {
          song.genres?.forEach((genreId) => {
            genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
          });
          song.moods?.forEach((moodId) => {
            moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
          });
          song.artist?.forEach((artistId) => {
            artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
          });
        }
      });

      const getTopItems = (counts, countLimit) =>
        Object.keys(counts)
          .sort((a, b) => counts[b] - counts[a])
          .slice(0, countLimit);

      const topGenreIds = getTopItems(genreCounts, 3);
      const topMoodIds = getTopItems(moodCounts, 2);
      const topArtistIds = getTopItems(artistCounts, 3);

      const recommendations = await Song.find({
        _id: { $nin: listenedSongIds },
        $or: [
          { genres: { $in: topGenreIds } },
          { moods: { $in: topMoodIds } },
          { artist: { $in: topArtistIds } },
        ],
      })
        .limit(50)
        .select("_id");

      finalPicksIds = recommendations
        .sort(() => 0.5 - Math.random())
        .map((s) => s._id)
        .slice(0, limit);
    }

    if (finalPicksIds.length < limit) {
      const trending = await Song.find({ _id: { $nin: finalPicksIds } })
        .sort({ playCount: -1 })
        .limit(limit - finalPicksIds.length)
        .select("_id");
      finalPicksIds.push(...trending.map((s) => s._id));
    }

    if (finalPicksIds.length > 0) {
      await UserRecommendation.findOneAndUpdate(
        { user: userId, type: "FEATURED_SONGS" },
        {
          items: finalPicksIds,
          generatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      console.log(
        `[Featured Songs] Generated ${finalPicksIds.length} picks for user ${userId}`
      );
    }
  } catch (error) {
    console.error(
      `[Featured Songs] Error generating for user ${userId}:`,
      error
    );
  }
};
