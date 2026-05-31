import axios from "axios";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

export const MIX_LOCALE_LANGS = ["en", "ru", "uk"];
const BATCH_SIZE = 15;

export const hasCompleteLocalizedNames = (localizedNames) =>
  MIX_LOCALE_LANGS.every((lang) => localizedNames?.[lang]?.trim());

/** Первый сбалансированный JSON-объект (greedy regex ломается на хвосте ответа). */
const parseGeminiJson = (rawText) => {
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("No JSON object in Gemini response");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString && ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }

  throw new Error("Unclosed JSON object in Gemini response");
};

const mapBatchResponse = (parsed, items) => {
  const result = {};
  for (const item of items) {
    const entry = parsed[item.id];
    if (!entry || typeof entry !== "object") continue;

    const localizedNames = {};
    for (const lang of MIX_LOCALE_LANGS) {
      if (typeof entry[lang] === "string" && entry[lang].trim()) {
        localizedNames[lang] = entry[lang].trim();
      }
    }
    if (localizedNames.en) {
      result[item.id] = localizedNames;
    }
  }
  return result;
};

const buildBatchPrompt = (category, items) => {
  const list = items
    .map((item) => `${item.id}: "${item.name}"`)
    .join("\n");

  return `You are a music streaming localization expert. Translate these music ${category} names into natural display names.

RULES:
1. English (en): standard genre/mood name (e.g. "Rock", "Deep House", "Melancholic").
2. Russian (ru): natural translation or transliteration of the name only — do NOT add "Микс".
3. Ukrainian (uk): natural translation or transliteration — do NOT add "Мікс".
4. These are category labels (for hubs and tags), NOT playlist titles — never append "Mix", "Микс", or "Мікс".
5. Return ONLY a raw JSON object. Keys are the ids from the list. Values: { "en": "...", "ru": "...", "uk": "..." }.
6. No markdown, no explanations.

LIST:
${list}`;
};

/**
 * @param {"genre"|"mood"} category
 * @param {{ id: string, name: string }[]} items
 * @returns {Promise<Record<string, { en: string, ru: string, uk: string }>>}
 */
const requestGeminiBatch = async (category, items) => {
  const response = await axios.post(
    GEMINI_API_URL,
    {
      contents: [{ parts: [{ text: buildBatchPrompt(category, items) }] }],
      generationConfig: { response_mime_type: "application/json" },
    },
    { timeout: 120_000 },
  );

  const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Empty Gemini response");
  return parseGeminiJson(rawText);
};

export const translateMixSourcesBatch = async (category, items) => {
  if (!items.length) return {};
  if (!GEMINI_API_KEY) {
    console.warn("[MixLocale] GEMINI_API_KEY missing — skip batch translation.");
    return {};
  }

  try {
    const parsed = await requestGeminiBatch(category, items);
    return mapBatchResponse(parsed, items);
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;

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

    console.error("[MixLocale] Gemini batch translation failed:", message);
    return {};
  }
};

const fillMissingForModel = async (Model, category) => {
  const docs = await Model.find({}).select("name localizedNames").lean();
  const missing = docs.filter((d) => !hasCompleteLocalizedNames(d.localizedNames));

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

      await Model.updateOne(
        { _id: doc._id },
        { $set: { localizedNames } },
      );
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

      await Model.updateOne(
        { _id: doc._id },
        { $set: { localizedNames } },
      );
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
