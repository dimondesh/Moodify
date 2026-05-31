import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Song } from "../models/song.model.js";
import { meanPoolEmbeddings } from "./recommendation.service.js";

const CATEGORY_TOP_TRACKS_LIMIT = 100;

const EMBEDDING_FILTER = {
  "audioFeatures.embedding": { $exists: true, $ne: null },
};

const computeCentroidForCategory = async (categoryId, tagField) => {
  const songs = await Song.find({
    [tagField]: categoryId,
    ...EMBEDDING_FILTER,
  })
    .select("audioFeatures.embedding")
    .sort({ playCount: -1 })
    .limit(CATEGORY_TOP_TRACKS_LIMIT)
    .lean();

  const vectors = songs.map((song) => song.audioFeatures?.embedding);
  return meanPoolEmbeddings(vectors);
};

const updateCategoryCentroids = async (categories, Model, tagField, label) => {
  for (const category of categories) {
    try {
      const embedding = await computeCentroidForCategory(category._id, tagField);
      await Model.updateOne({ _id: category._id }, { $set: { embedding } });

      if (embedding) {
        console.log(
          `[calculateCentroids] ${label} "${category.name}" updated (${embedding.length}d, ${CATEGORY_TOP_TRACKS_LIMIT} max tracks)`,
        );
      }
    } catch (error) {
      console.error(
        `[calculateCentroids] ${label} "${category.name}":`,
        error,
      );
    }
  }
};

export const calculateCentroids = async () => {
  try {
    const [genres, moods] = await Promise.all([
      Genre.find({}).select("_id name").lean(),
      Mood.find({}).select("_id name").lean(),
    ]);

    await updateCategoryCentroids(genres, Genre, "genres", "Genre");
    await updateCategoryCentroids(moods, Mood, "moods", "Mood");
  } catch (error) {
    console.error("[calculateCentroids]:", error);
    throw error;
  }
};
