// backend/src/lib/lastfm.service.js

import axios from "axios";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_API_URL = "http://ws.audioscrobbler.com/2.0/";

const EXPANDED_KNOWN_GENRES = [
  "rock",
  "pop",
  "electronic",
  "hip-hop",
  "jazz",
  "classical",
  "rnb",
  "reggae",
  "metal",
  "alternative",
  "indie",
  "punk",
  "folk",
  "country",
  "blues",
  "soul",
  "funk",
  "disco",
  "shoegaze",
  "post-rock",
  "metalcore",
  "death-metal",
  "black-metal",
  "grunge",
  "industrial",
  "post-punk",
  "hardcore",
  "emo",
  "pop-punk",
  "techno",
  "house",
  "trance",
  "ambient",
  "downtempo",
  "synthpop",
  "synthwave",
  "idm",
  "trap",
  "dubstep",
  "lo-fi",
  "chillwave",
  "vaporwave",
  "jungle",
  "soundtrack",
  "experimental",
];

const MOOD_MAPPINGS = {
  Energetic: [
    "techno",
    "trance",
    "drum and bass",
    "dnb",
    "jungle",
    "hardcore",
    "metalcore",
    "pop-punk",
    "party",
    "workout",
    "upbeat",
    "dance",
    "power-pop",
    "heavy-metal",
  ],
  Chill: [
    "chillwave",
    "lo-fi",
    "ambient",
    "downtempo",
    "mellow",
    "relaxing",
    "background-music",
    "easy-listening",
  ],
  Sad: [
    "sad",
    "melancholy",
    "melancholic",
    "bittersweet",
    "breakup",
    "emo",
    "slowcore",
    "sadcore",
  ],
  Happy: ["happy", "upbeat", "summer", "feel-good", "joyful"],
  Dreamy: [
    "dream-pop",
    "shoegaze",
    "atmospheric",
    "ethereal",
    "dreamy",
    "vaporwave",
  ],
  Romantic: ["love", "romantic", "ballad", "valentines"],
  Heavy: [
    "metal",
    "hard-rock",
    "industrial",
    "metalcore",
    "death-metal",
    "black-metal",
    "heavy",
    "intense",
  ],
  Focus: ["focus", "instrumental", "classical", "study", "ambient"],
  Sleep: ["sleep", "meditation", "relax"],
  Funky: ["funk", "funky", "groovy", "disco", "soul"],
};

const findOrCreate = async (model, name) => {
  let entity = await model.findOne({ name });
  if (!entity) {
    entity = new model({ name });
    await entity.save();
  }
  return entity;
};

const processTags = async (tags) => {
  if (!tags || tags.length === 0) {
    return { genreIds: [], moodIds: [] };
  }

  const lowerCaseTags = tags
    .map((tag) => (typeof tag.name === "string" ? tag.name.toLowerCase() : ""))
    .filter(Boolean);
  const matchedGenres = new Set();
  const matchedMoods = new Set();

  // 1. Обработка ЖАНРОВ (как и раньше)
  lowerCaseTags.forEach((tag) => {
    for (const knownGenre of EXPANDED_KNOWN_GENRES) {
      if (tag.includes(knownGenre)) {
        const mainGenre = knownGenre.split("-")[0];
        matchedGenres.add(mainGenre);
      }
    }
  });

  lowerCaseTags.forEach((tag) => {
    for (const [mood, keywords] of Object.entries(MOOD_MAPPINGS)) {
      for (const keyword of keywords) {
        if (tag.includes(keyword)) {
          matchedMoods.add(mood);
          break; 
        }
      }
    }
  });

  console.log(
    `[LastFM] Результат: Жанры [${[...matchedGenres].join(
      ", "
    )}], Настроения [${[...matchedMoods].join(", ")}]`
  );

  const genreIds = await Promise.all(
    [...matchedGenres].map((name) =>
      findOrCreate(Genre, name).then((g) => g._id)
    )
  );

  const moodIds = await Promise.all(
    [...matchedMoods].map((name) => findOrCreate(Mood, name).then((m) => m._id))
  );

  return { genreIds, moodIds };
};

export const getGenresAndMoodsForTrack = async (
  artistName,
  trackName,
  albumName
) => {
  if (!LASTFM_API_KEY) {
    console.warn(
      "[LastFM] LASTFM_API_KEY не установлен. Пропускаем получение тегов."
    );
    return { genreIds: [], moodIds: [] };
  }

  try {
    console.log(`[LastFM] Попытка 1: Поиск тегов для трека "${trackName}"`);
    const trackResponse = await axios.get(LASTFM_API_URL, {
      params: {
        method: "track.getTopTags",
        artist: artistName,
        track: trackName,
        api_key: LASTFM_API_KEY,
        format: "json",
        autocorrect: 1,
      },
    });
    if (trackResponse.data.toptags?.tag?.length > 0) {
      const result = await processTags(trackResponse.data.toptags.tag);
      if (result.genreIds.length > 0 || result.moodIds.length > 0)
        return result;
    }
  } catch (e) {
  }

  try {
    console.log(
      `[LastFM] Попытка 2 (Fallback): Поиск тегов для альбома "${albumName}"`
    );
    const albumResponse = await axios.get(LASTFM_API_URL, {
      params: {
        method: "album.getTopTags",
        artist: artistName,
        album: albumName,
        api_key: LASTFM_API_KEY,
        format: "json",
        autocorrect: 1,
      },
    });
    if (albumResponse.data.toptags?.tag?.length > 0) {
      const result = await processTags(albumResponse.data.toptags.tag);
      if (result.genreIds.length > 0 || result.moodIds.length > 0)
        return result;
    }
  } catch (e) {
  }

  try {
    console.log(
      `[LastFM] Попытка 3 (Fallback): Поиск тегов для артиста "${artistName}"`
    );
    const artistResponse = await axios.get(LASTFM_API_URL, {
      params: {
        method: "artist.getTopTags",
        artist: artistName,
        api_key: LASTFM_API_KEY,
        format: "json",
        autocorrect: 1,
      },
    });
    if (artistResponse.data.toptags?.tag?.length > 0) {
      return await processTags(artistResponse.data.toptags.tag);
    }
  } catch (e) {
  }

  console.log(
    `[LastFM] Теги не найдены ни для трека, ни для альбома, ни для артиста.`
  );
  return { genreIds: [], moodIds: [] };
};
