import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Инициализация официального SDK
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

export const MIX_LOCALE_LANGS = ["en", "ru", "uk"];
const BATCH_SIZE = 15;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const hasCompleteLocalizedNames = (localizedNames) =>
  MIX_LOCALE_LANGS.every((lang) => localizedNames?.[lang]?.trim());

// --- Схема для Structured Outputs ---
const localizationBatchSchema = {
  type: SchemaType.ARRAY,
  description: "Array of localized names for genres or moods",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: {
        type: SchemaType.STRING,
        description: "The ID provided in the prompt",
      },
      en: { type: SchemaType.STRING, description: "Standard English name" },
      ru: {
        type: SchemaType.STRING,
        description: "Russian translation/transliteration without 'Микс'",
      },
      uk: {
        type: SchemaType.STRING,
        description: "Ukrainian translation/transliteration without 'Мікс'",
      },
    },
    required: ["id", "en", "ru", "uk"],
  },
};

const buildBatchPrompt = (category, items) => {
  const list = items
    .map((item) => `ID: ${item.id} | Name: "${item.name}"`)
    .join("\n");

  return `You are a music streaming localization expert. Translate these music ${category} names into natural display names.

RULES:
1. English (en): standard genre/mood name (e.g. "Rock", "Deep House", "Melancholic").
2. Russian (ru): natural translation or transliteration of the name only — do NOT add "Микс".
3. Ukrainian (uk): natural translation or transliteration — do NOT add "Мікс".
4. These are category labels (for hubs and tags), NOT playlist titles — never append "Mix", "Микс", or "Мікс".
5. Return an array of objects corresponding to the provided items.

LIST:
${list}`;
};

/**
 * @param {"genre"|"mood"} category
 * @param {{ id: string, name: string }[]} items
 * @returns {Promise<Array>}
 */
const requestGeminiBatch = async (category, items) => {
  const prompt = buildBatchPrompt(category, items);

  const result = await aiModel.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: localizationBatchSchema,
    },
  });

  return JSON.parse(result.response.text());
};

export const translateMixSourcesBatch = async (category, items) => {
  if (!items.length) return {};
  if (!GEMINI_API_KEY) {
    console.warn(
      "[MixLocale] GEMINI_API_KEY missing — skip batch translation.",
    );
    return {};
  }

  try {
    const parsedArray = await requestGeminiBatch(category, items);

    // Преобразуем массив обратно в словарь { id: { en, ru, uk } }
    const result = {};
    for (const entry of parsedArray) {
      if (!entry || !entry.id) continue;

      const localizedNames = {};
      for (const lang of MIX_LOCALE_LANGS) {
        if (typeof entry[lang] === "string" && entry[lang].trim()) {
          localizedNames[lang] = entry[lang].trim();
        }
      }
      if (localizedNames.en) {
        result[entry.id] = localizedNames;
      }
    }
    return result;
  } catch (error) {
    const message = error.message || String(error);

    // Обработка лимитов (429) перед ретраем
    if (error.status === 429) {
      console.warn(`[MixLocale] Rate limit 429. Pausing for 2s...`);
      await sleep(2000);
    }

    // Рекурсивное деление батча пополам при ошибках (очень полезно, если какой-то спецсимвол ломает промпт)
    if (items.length > 1) {
      const mid = Math.ceil(items.length / 2);
      console.warn(
        `[MixLocale] Batch of ${items.length} failed (${message}), retrying in two halves...`,
      );
      const [first, second] = await Promise.all([
        translateMixSourcesBatch(category, items.slice(0, mid)),
        translateMixSourcesBatch(category, items.slice(mid)),
      ]);
      return { ...first, ...second };
    }

    console.error(
      "[MixLocale] Gemini batch translation failed completely for item:",
      items[0]?.id,
      message,
    );
    return {};
  }
};

const fillMissingForModel = async (Model, category) => {
  const docs = await Model.find({}).select("name localizedNames").lean();
  const missing = docs.filter(
    (d) => !hasCompleteLocalizedNames(d.localizedNames),
  );

  if (missing.length === 0) {
    return { total: docs.length, translated: 0 };
  }

  console.log(
    `[MixLocale] ${category}: translating ${missing.length} of ${docs.length} via Gemini...`,
  );

  let translated = 0;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
    }));

    const batchResult = await translateMixSourcesBatch(category, payload);

    for (const doc of chunk) {
      const localizedNames = batchResult[doc._id.toString()];
      if (!localizedNames) continue;

      await Model.updateOne({ _id: doc._id }, { $set: { localizedNames } });
      translated += 1;
    }
  }

  return { total: docs.length, translated };
};

const retranslateAllForModel = async (Model, category) => {
  const docs = await Model.find({}).select("_id name").lean();
  if (!docs.length) {
    return { total: 0, translated: 0 };
  }

  console.log(
    `[MixLocale] ${category}: re-translating all ${docs.length} via Gemini...`,
  );

  let translated = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
    }));

    const batchResult = await translateMixSourcesBatch(category, payload);

    for (const doc of chunk) {
      const localizedNames = batchResult[doc._id.toString()];
      if (!localizedNames) continue;

      await Model.updateOne({ _id: doc._id }, { $set: { localizedNames } });
      translated += 1;
    }
  }

  return { total: docs.length, translated };
};

/** Заполняет localizedNames у всех Genre/Mood, где переводов нет или они неполные. */
export const ensureGenreAndMoodLocalizedNames = async () => {
  const [genres, moods] = await Promise.all([
    fillMissingForModel(Genre, "genre"),
    fillMissingForModel(Mood, "mood"),
  ]);
  return { genres, moods };
};

/** Переводит заново все Genre/Mood (без суффикса Mix в названии категории). */
export const retranslateAllGenreAndMoodLocalizedNames = async () => {
  const [genres, moods] = await Promise.all([
    retranslateAllForModel(Genre, "genre"),
    retranslateAllForModel(Mood, "mood"),
  ]);
  return { genres, moods };
};

/**
 * Переводит один только что созданный жанр/настроение (вызывается из AI-тегирования).
 */
export const localizeNewMixSource = async (Model, doc) => {
  const category = Model.modelName === "Genre" ? "genre" : "mood";
  if (hasCompleteLocalizedNames(doc.localizedNames)) return doc;

  const batch = await translateMixSourcesBatch(category, [
    { id: doc._id.toString(), name: doc.name },
  ]);

  const localizedNames = batch[doc._id.toString()];
  if (!localizedNames) return doc;

  return Model.findByIdAndUpdate(
    doc._id,
    { $set: { localizedNames } },
    { new: true },
  );
};
