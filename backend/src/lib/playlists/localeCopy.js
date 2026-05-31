import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MIX_LOCALE_LANGS } from "./mixLocale.service.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const translationCache = new Map();

const loadTranslation = (lang) => {
  if (translationCache.has(lang)) {
    return translationCache.get(lang);
  }

  const filePath = path.join(
    repoRoot,
    "frontend/src/lib/locales",
    lang,
    "translation.json",
  );
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  translationCache.set(lang, data);
  return data;
};

const normalizeLang = (lang) => {
  const code = (lang || "en").split("-")[0];
  return MIX_LOCALE_LANGS.includes(code) ? code : "en";
};

export const getGenreMoodMixCopy = (lang) => {
  const code = normalizeLang(lang);
  const translations = loadTranslation(code);
  return translations.genreMoodMix ?? loadTranslation("en").genreMoodMix;
};

export const formatGenreMoodMixTitle = (name, lang) => {
  const template = getGenreMoodMixCopy(lang).title;
  return template.replace(/\{\{name\}\}/g, name);
};

export const stripGenreMoodMixSuffix = (value, lang) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const suffix = getGenreMoodMixCopy(lang).suffix;
  if (!suffix) return text;

  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\s+${escaped}\\s*$`, "iu"), "").trim();
};

/** Removes mix suffix from each locale; keeps category name only. */
export const stripCategoryLocalizedNames = (
  localizedNames = {},
  fallbackName = "",
) => {
  const result = { ...(localizedNames || {}) };

  for (const lang of MIX_LOCALE_LANGS) {
    const raw =
      localizedNames?.[lang]?.trim() ||
      (lang === "en" ? String(fallbackName ?? "").trim() : "");
    if (!raw) continue;
    const stripped = stripGenreMoodMixSuffix(raw, lang);
    if (stripped) {
      result[lang] = stripped;
    }
  }

  return result;
};

export const buildMixTitleLocalizedNames = (
  categoryLocalizedNames = {},
  fallbackName = "",
) => {
  const localizedNames = {};

  for (const lang of MIX_LOCALE_LANGS) {
    const raw =
      categoryLocalizedNames?.[lang]?.trim() ||
      (lang === "en" ? fallbackName.trim() : "");
    const base = raw
      ? stripGenreMoodMixSuffix(raw, lang)
      : fallbackName.trim();
    if (!base) continue;
    localizedNames[lang] = formatGenreMoodMixTitle(base, lang);
  }

  return localizedNames;
};
