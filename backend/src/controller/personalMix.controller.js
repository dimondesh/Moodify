import mongoose from "mongoose";
import { PersonalMix } from "../models/personalMix.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl duration playCount";

const getTodayDate = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

export const generatePersonalMixes = async (userId) => {
  try {
    const today = getTodayDate();
    const listenHistory = await ListenHistory.find({ user: userId })
      .limit(200)
      .populate({ path: "song", select: "genres moods artist" })
      .lean();

    const validHistory = listenHistory.filter((item) => item.song);
    if (validHistory.length < 10) return [];

    const genreCounts = {};
    const moodCounts = {};
    const artistCounts = {};

    validHistory.forEach((item) => {
      (item.song.genres || []).forEach(
        (id) => (genreCounts[id] = (genreCounts[id] || 0) + 1),
      );
      (item.song.moods || []).forEach(
        (id) => (moodCounts[id] = (moodCounts[id] || 0) + 1),
      );
      (item.song.artist || []).forEach(
        (id) => (artistCounts[id] = (artistCounts[id] || 0) + 1),
      );
    });

    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => new mongoose.Types.ObjectId(id));
    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([id]) => new mongoose.Types.ObjectId(id));

    const mixes = [];

    for (let i = 0; i < topGenres.length; i++) {
      const genreId = topGenres[i];
      const genre = await Genre.findById(genreId).lean();
      if (!genre) continue;

      const songs = await Song.aggregate([
        { $match: { genres: genreId } },
        { $sample: { size: 30 } },
        {
          $lookup: {
            from: "artists",
            localField: "artist",
            foreignField: "_id",
            as: "artistDetails",
          },
        },
      ]);

      if (songs.length < 5) continue;

      const mixName = `Daily Mix ${i + 1}`;
      const personalMix = await PersonalMix.findOneAndUpdate(
        { user: userId, name: mixName },
        {
          $set: {
            name: mixName,
            songs: songs.map((s) => s._id),
            imageUrl: songs[0].artistDetails[0]?.imageUrl || songs[0].imageUrl,
            generatedOn: today,
          },
        },
        { upsert: true, new: true },
      );
      mixes.push(personalMix);
    }

    for (let i = 0; i < topMoods.length; i++) {
      const moodId = topMoods[i];
      const mood = await Mood.findById(moodId).lean();
      if (!mood) continue;

      const songs = await Song.aggregate([
        { $match: { moods: moodId } },
        { $sample: { size: 30 } },
        {
          $lookup: {
            from: "artists",
            localField: "artist",
            foreignField: "_id",
            as: "artistDetails",
          },
        },
      ]);

      if (songs.length < 5) continue;

      const mixName = `Daily Mix ${topGenres.length + i + 1}`;
      const personalMix = await PersonalMix.findOneAndUpdate(
        { user: userId, name: mixName },
        {
          $set: {
            name: mixName,
            songs: songs.map((s) => s._id),
            imageUrl: songs[0].artistDetails[0]?.imageUrl || songs[0].imageUrl,
            generatedOn: today,
          },
        },
        { upsert: true, new: true },
      );
      mixes.push(personalMix);
    }
    return mixes;
  } catch (error) {
    return [];
  }
};

export const getPersonalMixes = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();

    let personalMixes = await PersonalMix.find({
      user: userId,
      generatedOn: { $gte: today },
    }).lean();

    if (personalMixes.length === 0) {
      await generatePersonalMixes(userId);
      personalMixes = await PersonalMix.find({
        user: userId,
        generatedOn: { $gte: today },
      }).lean();
    }

    const populatedMixes = await PersonalMix.populate(personalMixes, {
      path: "songs",
      select: SONG_MINIMAL_SELECT,
      populate: { path: "artist", select: "name imageUrl" },
    });

    if (returnInternal) return populatedMixes;
    res.status(200).json(populatedMixes);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getPersonalMixById = async (req, res, next) => {
  try {
    const mixId = req.params.id;
    const personalMix = await PersonalMix.findOne({
      _id: mixId,
      user: req.user.id,
    }).populate({
      path: "songs",
      select: SONG_MINIMAL_SELECT,
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (!personalMix)
      return res.status(404).json({ message: "Personal mix not found" });
    res.status(200).json(personalMix);
  } catch (error) {
    next(error);
  }
};
