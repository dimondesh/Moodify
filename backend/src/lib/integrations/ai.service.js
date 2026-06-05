// backend/src/lib/ai.service.js

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";
import { localizeNewMixSource } from "../playlists/mixLocale.service.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const aiModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

const CORE_GENRES_LIST = [
  "Rock",
  "Pop",
  "Electronic",
  "Hip-Hop",
  "Jazz",
  "Classical",
  "R&B",
  "Reggae",
  "Metal",
  "Alternative",
  "Indie",
  "Punk",
  "Folk",
  "Country",
  "Blues",
  "Soul",
  "Funk",
  "Techno",
  "House",
  "Ambient",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Схемы для Структурированного Вывода (Structured Outputs) ---

const trackSchema = {
  type: SchemaType.OBJECT,
  properties: {
    primaryGenre: {
      type: SchemaType.STRING,
      description: "The ONE most fitting core genre",
    },
    subGenres: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1 or 2 specific sub-genres",
    },
    moods: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "1 to 3 moods",
    },
  },
  required: ["primaryGenre", "subGenres", "moods"],
};

const batchSchema = {
  type: SchemaType.ARRAY,
  description: "Array of analyzed tracks",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      tempId: {
        type: SchemaType.STRING,
        description: "The ID provided in the prompt",
      },
      primaryGenre: { type: SchemaType.STRING },
      subGenres: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      moods: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    },
    required: ["tempId", "primaryGenre", "subGenres", "moods"],
  },
};

// --- Вспомогательные функции ---

const findOrCreate = async (model, name) => {
  const cleanedName = name.trim();
  let entity = await model.findOne({
    name: { $regex: `^${cleanedName}$`, $options: "i" },
  });
  if (!entity) {
    entity = await new model({ name: cleanedName }).save();
    entity = await localizeNewMixSource(model, entity);
  }
  return entity;
};

const parseTagsForTrack = async (tags) => {
  if (!tags.primaryGenre || !tags.subGenres || !tags.moods) {
    return { genreIds: [], moodIds: [] };
  }

  const allGenreNames = new Set([tags.primaryGenre, ...tags.subGenres]);

  const genreIds = await Promise.all(
    [...allGenreNames].map((name) =>
      findOrCreate(Genre, name).then((g) => g._id),
    ),
  );
  const moodIds = await Promise.all(
    tags.moods.map((name) => findOrCreate(Mood, name).then((m) => m._id)),
  );

  return { genreIds, moodIds };
};

// --- Основные функции ---

export const getTagsFromAI = async (artistName, trackName) => {
  if (!GEMINI_API_KEY) {
    console.error("[AI Service] GEMINI_API_KEY не найден.");
    return { genreIds: [], moodIds: [] };
  }

  const prompt = `You are an expert musicologist. Analyze the provided artist and track.
Artist: "${artistName}"
Track: "${trackName}"
Core Genres List: [${CORE_GENRES_LIST.join(", ")}]

Constraints:
1. Determine the ONE most fitting core genre from the Core Genres List.
2. Identify 1 or 2 specific sub-genres (do not repeat the core genre).
3. Identify 1 to 3 moods.`;

  try {
    console.log(
      `[AI Service] Отправка запроса к Gemini: ${artistName} - ${trackName}`,
    );

    // Передаем схему в генерацию
    const result = await aiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: trackSchema,
      },
    });

    // SDK сам вернет нам чистый текст в формате JSON, без ```json
    const tags = JSON.parse(result.response.text());
    console.log(`[AI Service] Получены теги от Gemini:`, tags);

    return parseTagsForTrack(tags);
  } catch (error) {
    console.error(
      "[AI Service] Ошибка при обращении к Gemini API:",
      error.message,
    );

    if (error.status === 429) {
      console.log(
        "[AI Service] Достигнут лимит запросов. Пауза на 2 секунды...",
      );
      await sleep(2000);
    } else {
      await sleep(1000);
    }

    return { genreIds: [], moodIds: [] };
  }
};

export const getBatchTagsFromAI = async (tracks) => {
  if (!GEMINI_API_KEY) {
    console.error("[AI Service] GEMINI_API_KEY не найден.");
    return {};
  }

  if (!tracks || tracks.length === 0) return {};

  const tracksText = tracks
    .map(
      (t) =>
        `ID: ${t.tempId} | Artist: "${t.artistName}" | Track: "${t.trackName}"`,
    )
    .join("\n");

  const prompt = `You are an expert musicologist. Analyze the following list of tracks.
Core Genres List: [${CORE_GENRES_LIST.join(", ")}]

Tracks to analyze:
${tracksText}

Constraints for each track:
1. Determine the ONE most fitting Primary Core Genre from the list.
2. Determine 1 or 2 specific sub-genres. Do NOT repeat the core genre.
3. Determine 1 to 3 moods.
Return an array of objects corresponding to the tracks.`;

  try {
    console.log(
      `[AI Service] Отправка batch-запроса для ${tracks.length} треков`,
    );

    const result = await aiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: batchSchema,
      },
    });

    const tagsArray = JSON.parse(result.response.text());
    console.log(`[AI Service] Получены теги от Gemini (Batch):`, tagsArray);

    const resultMap = {};

    for (const tags of tagsArray) {
      const { tempId } = tags;
      if (!tempId) continue;

      resultMap[tempId] = await parseTagsForTrack(tags);
    }

    return resultMap;
  } catch (error) {
    console.error(
      "[AI Service] Ошибка при обращении к Gemini API (Batch):",
      error.message,
    );
    return {};
  }
};
