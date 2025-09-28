// backend/src/controller/mix.controller.js

import { Mix } from "../models/mix.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Song } from "../models/song.model.js";
import { ListenHistory } from "../models/listenHistory.model.js";
import { io } from "../lib/socket.js";
import { getTranslationsForKey } from "../lib/translations.js";

const getTodayDate = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const groupMixes = (mixes) => {
  return mixes.reduce(
    (acc, mix) => {
      if (mix.type === "Genre") {
        acc.genreMixes.push(mix);
      } else if (mix.type === "Mood") {
        acc.moodMixes.push(mix);
      }
      return acc;
    },
    { genreMixes: [], moodMixes: [] }
  );
};

export const updateDailyMixes = async () => {
  try {
    console.log("CRON JOB: Starting daily mixes update...");
    const today = getTodayDate();

    const genres = await Genre.find().lean();
    const moods = await Mood.find().lean();
    const sources = [
      ...genres.map((g) => ({ ...g, type: "Genre" })),
      ...moods.map((m) => ({ ...m, type: "Mood" })),
    ];

    const updatePromises = [];

    for (const source of sources) {
      const queryField = source.type === "Genre" ? "genres" : "moods";
      const songCount = await Song.countDocuments({
        [queryField]: source._id,
      });

      if (songCount < 5) continue;

      const randomSongs = await Song.aggregate([
        { $match: { [queryField]: source._id } },
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

      if (randomSongs.length === 0 || !randomSongs[0].artistDetails?.[0])
        continue;

      const mixKey = `mixes.${source.type.toLowerCase()}.${source.name
        .toLowerCase()
        .replace(/\s+/g, "_")}`;

      const searchableNames = getTranslationsForKey(mixKey);

      const updatePromise = Mix.updateOne(
        { sourceId: source._id },
        {
          $set: {
            name: mixKey,
            searchableNames: searchableNames,
            type: source.type,
            sourceName: source.name,
            songs: randomSongs.map((s) => s._id),
            imageUrl: randomSongs[0].artistDetails[0].imageUrl,
            generatedOn: today,
          },
        },
        { upsert: true }
      );
      updatePromises.push(updatePromise);
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);

      const upsertedMixes = await Mix.find({ generatedOn: today })
        .select("_id")
        .lean();
      const updatedMixIds = upsertedMixes.map((m) => m._id.toString());

      console.log(
        `CRON JOB: Successfully updated ${updatedMixIds.length} mixes.`
      );

      updatedMixIds.forEach((mixId) => {
        io.to(`mix-${mixId}`).emit("mix_updated", { mixId });
      });
    } else {
      console.log("CRON JOB: No mixes needed an update.");
    }
  } catch (error) {
    console.error("CRON JOB: Error updating daily mixes:", error);
  }
};

export const getDailyMixes = async (req, res, next, returnInternal = false) => {
  try {
    const today = getTodayDate();
    let mixes = await Mix.find({ generatedOn: { $gte: today } }).lean();

    if (mixes.length === 0) {
      console.log(
        "No mixes found for today. Triggering on-demand generation..."
      );
      await updateDailyMixes();
      mixes = await Mix.find({ generatedOn: { $gte: today } }).lean();
      console.log(
        `On-demand generation complete. Found ${mixes.length} new mixes.`
      );
    }

    if (req.user && req.user.id) {
      const userId = req.user.id;
      const listenHistory = await ListenHistory.find({ user: userId })
        .limit(150)
        .populate({ path: "song", select: "genres moods" })
        .lean();

      const validHistory = listenHistory.filter((item) => item.song);

      if (validHistory.length > 0) {
        const preferenceCounts = {};
        validHistory.forEach((item) => {
          (item.song.genres || []).forEach((genreId) => {
            preferenceCounts[genreId] = (preferenceCounts[genreId] || 0) + 1;
          });
          (item.song.moods || []).forEach((moodId) => {
            preferenceCounts[moodId] = (preferenceCounts[moodId] || 0) + 1;
          });
        });

        mixes.sort((a, b) => {
          const scoreA = preferenceCounts[a.sourceId.toString()] || 0;
          const scoreB = preferenceCounts[b.sourceId.toString()] || 0;
          return scoreB - scoreA;
        });
      }
    }

    const populatedMixes = await Mix.populate(mixes, {
      path: "songs",
      select:
        "title duration imageUrl artist albumId hlsUrl playCount genres moods",
      populate: { path: "artist", select: "name imageUrl" },
    });

    const groupedData = groupMixes(populatedMixes);

    if (returnInternal) {
      return groupedData;
    }
    return res.status(200).json(groupedData);
  } catch (error) {
    console.error("Error in getDailyMixes:", error);
    if (returnInternal) {
      return { genreMixes: [], moodMixes: [] };
    }
    next(error);
  }
};

export const getMixById = async (req, res, next) => {
  try {
    const mix = await Mix.findById(req.params.id).populate({
      path: "songs",
      select:
        "title duration imageUrl artist albumId hlsUrl playCount genres moods",
      populate: { path: "artist", model: "Artist", select: "name imageUrl" },
    });

    if (!mix) {
      return res.status(404).json({ message: "Mix not found" });
    }
    res.status(200).json(mix);
  } catch (error) {
    next(error);
  }
};
