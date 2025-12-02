// backend/src/lib/ai.service.js

import axios from "axios";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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

const findOrCreate = async (model, name) => {
  const cleanedName = name.trim();
  let entity = await model.findOne({
    name: { $regex: `^${cleanedName}$`, $options: "i" },
  });
  if (!entity) {
    entity = await new model({ name: cleanedName }).save();
  }
  return entity;
};

export const getTagsFromAI = async (artistName, trackName) => {
  if (!GEMINI_API_KEY) {
    console.error("[AI Service] GEMINI_API_KEY не найден.");
    return { genreIds: [], moodIds: [] };
  }

  const prompt = `You are an expert musicologist. Your task is to analyze the provided artist and track and return its primary genre, specific sub-genres, and relevant moods.
Artist: "${artistName}"
Track: "${trackName}"
Constraints:
1.  **Determine the Primary Core Genre**: From the following list, choose the ONE most fitting core genre. Core Genres List: [${CORE_GENRES_LIST.join(
    ", "
  )}]
2.  **Determine Specific Sub-Genres**: Identify 1 or 2 more specific sub-genres (e.g., "Shoegaze", "Synthpop"). Do NOT repeat the core genre here.
3.  **Determine Moods**: Identify 1 to 3 moods that describe the feeling of the song (e.g., "Melancholic", "Energetic", "Dreamy").
4.  **Format the Output**: Your response MUST be ONLY a valid JSON object, starting with { and ending with }. Do not include any text, explanations, or markdown.
Example Response: { "primaryGenre": "Alternative", "subGenres": ["Indie Pop", "Jangle Pop"], "moods": ["Melancholic", "Nostalgic", "Bittersweet"] }`;

  try {
    console.log(
      `[AI Service] Отправка запроса к Gemini для трека: ${artistName} - ${trackName}`
    );

    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    const rawText = response.data.candidates[0].content.parts[0].text;
    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const tags = JSON.parse(cleanedText);

    if (!tags.primaryGenre || !tags.subGenres || !tags.moods) {
      console.warn("[AI Service] Gemini вернул JSON без обязательных полей.");
      return { genreIds: [], moodIds: [] };
    }

    console.log(`[AI Service] Получены теги от Gemini:`, tags);

    const allGenreNames = new Set([tags.primaryGenre, ...tags.subGenres]);

    const genreIds = await Promise.all(
      [...allGenreNames].map((name) =>
        findOrCreate(Genre, name).then((g) => g._id)
      )
    );
    const moodIds = await Promise.all(
      tags.moods.map((name) => findOrCreate(Mood, name).then((m) => m._id))
    );

    return { genreIds, moodIds };
  } catch (error) {
    console.error(
      "[AI Service] Ошибка при обращении к Gemini API:",
      error.response?.data?.error?.message || error.message
    );

    if (error.response && error.response.status === 429) {
      console.log(
        "[AI Service] Достигнут лимит запросов. Пауза на 2 секунды..."
      );
      await sleep(2000);
    } else {
      await sleep(1000);
    }

    return { genreIds: [], moodIds: [] };
  }
};

export const analyzePromptForPlaylistMetadata = async (prompt) => {
  if (!GEMINI_API_KEY) throw new Error("AI Service is not configured.");

  const systemPrompt = `You are a music expert. Analyze the user's request and provide metadata for a playlist.
  
  User Request: "${prompt}"

  Your instructions:
  1.  Create a creative title (max 5-7 words).
  2.  Write a short description (1-2 sentences).
  3.  Extract up to 3 relevant music genres.
  4.  Extract up to 3 relevant moods.
  5.  Your response MUST be ONLY a valid JSON object with keys: "title", "description", "genres", and "moods". Do not include any text or markdown.

  Example Response:
  {
    "title": "Rainy Day Jazz",
    "description": "Smooth and relaxing jazz for a cozy day indoors.",
    "genres": ["Jazz", "Lounge", "Soul"],
    "moods": ["Calm", "Relaxing", "Melancholic"]
  }`;

  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: systemPrompt }] }],
    });
    const rawText = response.data.candidates[0].content.parts[0].text;
    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const metadata = JSON.parse(cleanedText);

    if (
      !metadata.title ||
      !metadata.description ||
      !metadata.genres ||
      !metadata.moods
    ) {
      throw new Error("AI returned invalid metadata format.");
    }
    return metadata;
  } catch (error) {
    console.error(
      "[AI Service] Error in analyzePromptForPlaylistMetadata:",
      error.response?.data?.error?.message || error.message
    );
    throw new Error("Failed to analyze prompt with AI.");
  }
};

export const selectSongsFromCandidates = async (originalPrompt, candidates) => {
  if (!GEMINI_API_KEY) throw new Error("AI Service is not configured.");
  if (candidates.length === 0) return [];

  const candidateList = candidates
    .map(
      (c) =>
        `{"id": "${c._id}", "artist": "${c.artistName}", "title": "${c.title}"}`
    )
    .join(",\n");

  const systemPrompt = `You are an expert DJ. Your task is to curate the perfect playlist from a list of available songs based on a user's request.
  
  User's request: "${originalPrompt}"
  
  Available songs from the library:
  [
    ${candidateList}
  ]
  
  Your instructions:
  1.  From the provided list ONLY, select up to 20 songs that best fit the mood and theme of the request.
  2.  Try to create a diverse yet cohesive listening experience.
  3.  Your response MUST be ONLY a valid JSON array of the selected song objects (including their original "id"). Do not add any songs not in the provided list. Do not include any other text or explanations.
  
  Example Response:
  [
    {"id": "60d5ecb4e85c3e001f6d3a81"},
    {"id": "60d5ecb4e85c3e001f6d3a82"}
  ]`;

  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: systemPrompt }] }],
    });
    const rawText = response.data.candidates[0].content.parts[0].text;
    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const selectedSongs = JSON.parse(cleanedText);

    if (!Array.isArray(selectedSongs)) {
      throw new Error("AI returned a non-array format for song selection.");
    }
    return selectedSongs;
  } catch (error) {
    console.error(
      "[AI Service] Error in selectSongsFromCandidates:",
      error.response?.data?.error?.message || error.message
    );
    //Fallback
    return candidates
      .sort(() => 0.5 - Math.random())
      .slice(0, 20)
      .map((c) => ({ id: c._id }));
  }
};
