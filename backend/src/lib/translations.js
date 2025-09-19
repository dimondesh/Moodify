// backend/src/lib/translations.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getNestedValue = (obj, keys) => {
  if (!obj || !keys) return undefined;
  return keys
    .split(".")
    .reduce(
      (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
      obj
    );
};

const loadTranslations = () => {
  const localesDir = path.resolve(
    __dirname,
    "../../../frontend/src/lib/locales"
  );
  const languages = {};

  try {
    if (!fs.existsSync(localesDir)) {
      console.error(`[Translations] Директория не найдена: ${localesDir}`);
      return {};
    }

    fs.readdirSync(localesDir).forEach((lang) => {
      const translationPath = path.join(localesDir, lang, "translation.json");
      if (fs.existsSync(translationPath)) {
        languages[lang] = JSON.parse(fs.readFileSync(translationPath, "utf-8"));
      }
    });
    console.log(
      `[Translations] Успешно загружены языки: ${Object.keys(languages).join(
        ", "
      )}`
    );
  } catch (error) {
    console.error("Не удалось загрузить файлы переводов для бэкенда.", error);
  }
  return languages;
};

const translations = loadTranslations();

export const getTranslationsForKey = (key) => {
  const allNames = new Set();
  for (const lang in translations) {
    const value = getNestedValue(translations[lang], key);
    if (value && typeof value === "string") {
      allNames.add(value);
    }
  }
  return Array.from(allNames);
};
