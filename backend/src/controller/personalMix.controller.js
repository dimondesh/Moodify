// backend/src/controller/personalMix.controller.js

import mongoose from "mongoose";
import { PersonalMix } from "../models/personalMix.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { io } from "../lib/socket.js";

const getTodayDate = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

export const generatePersonalMixes = async (userId) => {
  try {
    console.log(`Generating personal mixes for user: ${userId}`);
    const today = getTodayDate();

    // Получаем историю прослушивания пользователя
    const listenHistory = await ListenHistory.find({ user: userId })
      .limit(200)
      .populate({ path: "song", select: "genres moods artist" })
      .lean();

    const validHistory = listenHistory.filter((item) => item.song);

    if (validHistory.length < 10) {
      console.log(
        `Not enough listen history for user ${userId}: ${validHistory.length} songs`
      );
      return [];
    }

    // Анализируем предпочтения пользователя
    const genreCounts = {};
    const moodCounts = {};
    const artistCounts = {};

    validHistory.forEach((item) => {
      const song = item.song;

      // Подсчитываем жанры
      (song.genres || []).forEach((genreId) => {
        genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
      });

      // Подсчитываем настроения
      (song.moods || []).forEach((moodId) => {
        moodCounts[moodId] = (moodCounts[moodId] || 0) + 1;
      });

      // Подсчитываем артистов
      (song.artist || []).forEach((artistId) => {
        artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
      });
    });

    // Получаем топ жанры и настроения
    const topGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genreId]) => new mongoose.Types.ObjectId(genreId));

    const topMoods = Object.entries(moodCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([moodId]) => new mongoose.Types.ObjectId(moodId));

    const topArtists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([artistId]) => new mongoose.Types.ObjectId(artistId));

    const mixes = [];

    // Генерируем миксы на основе топ жанров
    for (let i = 0; i < topGenres.length; i++) {
      const genreId = topGenres[i];
      const genre = await Genre.findById(genreId).lean();

      if (!genre) continue;

      console.log(`Generating mix for genre: ${genre.name}`);

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

      console.log(`Found ${songs.length} songs for genre ${genre.name}`);

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
        { upsert: true, new: true }
      );

      mixes.push(personalMix);
    }

    // Генерируем миксы на основе топ настроений
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
        { upsert: true, new: true }
      );

      mixes.push(personalMix);
    }

    console.log(`Generated ${mixes.length} personal mixes for user ${userId}`);
    return mixes;
  } catch (error) {
    console.error(`Error generating personal mixes for user ${userId}:`, error);
    return [];
  }
};

export const getPersonalMixes = async (
  req,
  res,
  next,
  returnInternal = false
) => {
  try {
    const userId = req.user.id;
    const today = getTodayDate();

    let personalMixes = await PersonalMix.find({
      user: userId,
      generatedOn: { $gte: today },
    }).lean();

    // Если нет миксов на сегодня, генерируем их
    if (personalMixes.length === 0) {
      await generatePersonalMixes(userId);
      personalMixes = await PersonalMix.find({
        user: userId,
        generatedOn: { $gte: today },
      }).lean();
    }

    // Популируем песни
    const populatedMixes = await PersonalMix.populate(personalMixes, {
      path: "songs",
      select:
        "title duration imageUrl artist albumId hlsUrl playCount genres moods lyrics",
      populate: { path: "artist", select: "name imageUrl" },
    });

    if (returnInternal) {
      return populatedMixes;
    }
    res.status(200).json(populatedMixes);
  } catch (error) {
    console.error("Error in getPersonalMixes:", error);
    if (returnInternal) {
      return [];
    }
    next(error);
  }
};

export const getPersonalMixById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const mixId = req.params.id;

    const personalMix = await PersonalMix.findOne({
      _id: mixId,
      user: userId,
    }).populate({
      path: "songs",
      select:
        "title duration imageUrl artist albumId hlsUrl playCount genres moods lyrics",
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (!personalMix) {
      return res.status(404).json({ message: "Personal mix not found" });
    }

    res.status(200).json(personalMix);
  } catch (error) {
    next(error);
  }
};
