// backend/src/lib/playlistGenerator.service.js
import mongoose from "mongoose";
import { ListenHistory } from "../models/listenHistory.model.js";
import { GeneratedPlaylist } from "../models/generatedPlaylist.model.js";
import { Song } from "../models/song.model.js";
import { Library } from "../models/library.model.js";

const ON_REPEAT_SONG_COUNT = 30;
const ON_REPEAT_IMAGE_URL = "https://moodify.b-cdn.net/on-repeat.png";

export const generateOnRepeatPlaylistForUser = async (userId) => {
  console.log(`Generating 'On Repeat' playlist for user: ${userId}`);

  const listenHistory = await ListenHistory.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: "$song", listenCount: { $sum: 1 } } },
    { $sort: { listenCount: -1 } },
    { $limit: ON_REPEAT_SONG_COUNT },
  ]);

  if (listenHistory.length === 0) {
    await GeneratedPlaylist.deleteOne({ user: userId, type: "ON_REPEAT" });
    console.log(
      `No listen history for user ${userId}. Deleting old 'On Repeat' if it exists.`
    );
    return null;
  }

  const songIds = listenHistory.map((item) => item._id);

  const onRepeatPlaylist = await GeneratedPlaylist.findOneAndUpdate(
    { user: userId, type: "ON_REPEAT" },
    {
      $set: {
        songs: songIds,
        nameKey: "generatedPlaylists.onRepeat.title",
        descriptionKey: "generatedPlaylists.onRepeat.description",
        imageUrl: ON_REPEAT_IMAGE_URL,
        generatedOn: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  console.log(
    `'On Repeat' playlist processed for user ${userId} with ${songIds.length} songs.`
  );
  return onRepeatPlaylist;
};

export const generateDiscoverWeeklyForUser = async (userId) => {
  try {
    console.log(`[Discover Weekly] Starting generation for user: ${userId}`);

    const listenHistory = await ListenHistory.find({ user: userId }).select(
      "song -_id"
    );
    const library = await Library.findOne({ userId }).select(
      "likedSongs.songId"
    );

    const listenedSongIds = listenHistory.map((item) => item.song);
    const likedSongIds = library
      ? library.likedSongs.map((item) => item.songId)
      : [];
    const excludedSongIds = [...new Set([...listenedSongIds, ...likedSongIds])];

    if (listenedSongIds.length < 20) {
      console.log(
        `[Discover Weekly] User ${userId} has insufficient listen history. Skipping.`
      );
      return;
    }

    const tasteProfile = await ListenHistory.aggregate([
      { $match: { user: userId } },
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

    const topGenreIds = tasteProfile[0].topGenres.map((g) => g._id);
    const topArtistIds = tasteProfile[0].topArtists.map((a) => a._id);

    const candidates = await Song.find({
      _id: { $nin: excludedSongIds }, 
      $or: [
        { genres: { $in: topGenreIds } },
        { artist: { $in: topArtistIds } },
      ],
    })
      .sort({ playCount: -1 }) 
      .limit(200) 
      .populate("artist", "name imageUrl");

    const finalTracks = candidates.sort(() => 0.5 - Math.random()).slice(0, 30);

    if (finalTracks.length < 10) {
      console.log(
        `[Discover Weekly] Not enough new tracks found for user ${userId}. Skipping.`
      );
      return;
    }

    const playlistData = {
      user: userId,
      type: "DISCOVER_WEEKLY",
      nameKey: "generatedPlaylists.discoverWeekly.title",
      descriptionKey: "generatedPlaylists.discoverWeekly.description",
      imageUrl: "https://moodify.b-cdn.net/discover-weekly.png", 
      songs: finalTracks.map((song) => song._id),
      generatedOn: new Date(),
    };

    await GeneratedPlaylist.findOneAndUpdate(
      { user: userId, type: "DISCOVER_WEEKLY" },
      playlistData,
      { upsert: true, new: true }
    );

    console.log(
      `[Discover Weekly] Successfully generated for user: ${userId} with ${finalTracks.length} tracks.`
    );
  } catch (error) {
    console.error(
      `[Discover Weekly] Error generating for user ${userId}:`,
      error
    );
  }
};
export const generateOnRepeatRewindForUser = async (userId) => {
  try {
    console.log(`[On Repeat Rewind] Starting generation for user: ${userId}`);

    const now = new Date();
    const oneMonthAgo = new Date(new Date().setMonth(now.getMonth() - 1));
    const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6));

    const pastFavorites = await ListenHistory.aggregate([
      {
        $match: {
          user: userId,
          listenedAt: { $gte: sixMonthsAgo, $lt: oneMonthAgo }, 
        },
      },
      { $group: { _id: "$song", count: { $sum: 1 } } },
      { $match: { count: { $gt: 3 } } }, 
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    const pastFavoriteSongIds = pastFavorites.map((item) => item._id);

    if (pastFavoriteSongIds.length < 10) {
      console.log(
        `[On Repeat Rewind] Not enough past favorites for user ${userId}. Skipping.`
      );
      return;
    }

    const recentListens = await ListenHistory.find({
      user: userId,
      listenedAt: { $gte: oneMonthAgo },
    }).select("song -_id");
    const recentSongIds = recentListens.map((item) => item.song);

    const rewindSongIds = pastFavoriteSongIds.filter(
      (id) => !recentSongIds.some((recentId) => recentId.equals(id))
    );

    if (rewindSongIds.length < 10) {
      console.log(
        `[On Repeat Rewind] Not enough "forgotten" tracks for user ${userId}. Skipping.`
      );
      return;
    }

    const finalTracks = await Song.find({
      _id: { $in: rewindSongIds.slice(0, 30) },
    });

    const playlistData = {
      user: userId,
      type: "ON_REPEAT_REWIND",
      nameKey: "generatedPlaylists.onRepeatRewind.title",
      descriptionKey: "generatedPlaylists.onRepeatRewind.description",
      imageUrl: "https://moodify.b-cdn.net/on-repeat-rewind2.png", 
      songs: finalTracks.map((song) => song._id),
      generatedOn: new Date(),
    };

    await GeneratedPlaylist.findOneAndUpdate(
      { user: userId, type: "ON_REPEAT_REWIND" },
      playlistData,
      { upsert: true, new: true }
    );

    console.log(
      `[On Repeat Rewind] Successfully generated for user: ${userId} with ${finalTracks.length} tracks.`
    );
  } catch (error) {
    console.error(
      `[On Repeat Rewind] Error generating for user ${userId}:`,
      error
    );
  }
};
