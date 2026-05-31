import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";
import { Song } from "../../models/song.model.js";
import { VALID_SONG_EMBEDDING } from "../../constants/embedding.js";
import { meanPoolEmbeddings } from "./recommendation.service.js";
import { mapWithConcurrency } from "../core/asyncUtils.js";

const CATEGORY_TOP_TRACKS_LIMIT = 100;
const CENTROID_CONCURRENCY = 8;

export const CATEGORY_TAG_FIELD = {
  Genre: "genres",
  Mood: "moods",
};

export const getCategoryModel = (categoryType) =>
  categoryType === "Genre" ? Genre : Mood;

export const getCategoryTagField = (categoryType) =>
  CATEGORY_TAG_FIELD[categoryType] ?? null;

const computeCentroidForCategory = async (categoryId, tagField) => {
  const songs = await Song.find({
    [tagField]: categoryId,
    ...VALID_SONG_EMBEDDING,
  })
    .select("audioFeatures.embedding")
    .sort({ playCount: -1 })
    .limit(CATEGORY_TOP_TRACKS_LIMIT)
    .lean();

  const vectors = songs.map((song) => song.audioFeatures?.embedding);
  return meanPoolEmbeddings(vectors);
};

export const recomputeCentroidForCategory = async (categoryType, categoryId) => {
  const tagField = getCategoryTagField(categoryType);
  const Model = getCategoryModel(categoryType);
  if (!tagField || !Model) return null;

  const embedding = await computeCentroidForCategory(categoryId, tagField);
  await Model.updateOne({ _id: categoryId }, { $set: { embedding } });
  return embedding;
};

const updateCategoryCentroids = async (categories, Model, tagField, label) => {
  await mapWithConcurrency(
    categories,
    async (category) => {
      try {
        const embedding = await computeCentroidForCategory(
          category._id,
          tagField,
        );
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
    },
    CENTROID_CONCURRENCY,
  );
};

export const calculateCentroids = async () => {
  try {
    const [genres, moods] = await Promise.all([
      Genre.find({}).select("_id name").lean(),
      Mood.find({}).select("_id name").lean(),
    ]);

    await Promise.all([
      updateCategoryCentroids(genres, Genre, "genres", "Genre"),
      updateCategoryCentroids(moods, Mood, "moods", "Mood"),
    ]);
  } catch (error) {
    console.error("[calculateCentroids]:", error);
    throw error;
  }
};
