import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Настройка путей для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Указываем явный путь к .env файлу
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URL = process.env.MONGODB_URI || process.env.MONGO_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!MONGO_URL) {
  console.error(
    "❌ Ошибка: Не найдена переменная MONGODB_URI или MONGO_URI в файле .env",
  );
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ Ошибка: Не найдена переменная GEMINI_API_KEY в файле .env");
  process.exit(1);
}

// Модель Mix
const mixSchema = new mongoose.Schema(
  {
    name: String,
    sourceName: String,
    searchableNames: [String],
    type: String,
  },
  { strict: false },
);

const Mix = mongoose.model("Mix", mixSchema, "mixes");

// Пути к файлам локализаций фронтенда
const localesDir = path.resolve(__dirname, "../../../frontend/src/lib/locales");
const enPath = path.join(localesDir, "en", "translation.json");
const ruPath = path.join(localesDir, "ru", "translation.json");
const ukPath = path.join(localesDir, "uk", "translation.json");

// Вспомогательные функции для чтения и записи JSON
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, data) =>
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

// Функция для перевода батчем через Gemini API
async function translateBatch(terms) {
  console.log(`⏳ Отправляем ${terms.length} названий на перевод в Gemini...`);

  const prompt = `
Ты музыкальный эксперт-локализатор. Переведи список названий музыкальных жанров и настроений на русский и украинский языки, так как они используются в стриминговых сервисах.

ПРАВИЛА СТРОГО ОБЯЗАТЕЛЬНЫ:
1. Обязательно добавляй слово "Микс" для русского и "Мікс" для украинского.
2. Названия настроений переводи по смыслу (например: "Dark" -> "Мрачный Микс", "Rebellious" -> "Бунтарский Микс", "Chill" -> "Расслабляющий Микс").
3. Жанры обязательно транслитерируй, не оставляй их на английском! (например: "Deathcore" -> "Дэткор Микс", "Deep House" -> "Дип-хаус Микс", "Rock" -> "Рок Микс", "Pop" -> "Поп Микс").
4. ВЕРНИ ТОЛЬКО СТРОГИЙ RAW JSON. БЕЗ markdown-разметки (никаких \`\`\`json), без вступительных и прощальных слов. ТОЛЬКО объект {...}.

СПИСОК ДЛЯ ПЕРЕВОДА:
${JSON.stringify(terms)}

Ответ должен быть в формате:
{
  "Dark": { "ru": "Мрачный Микс", "uk": "Похмурий Мікс" }
}
`;

  let textResponse = "";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      },
    );

    if (!response.ok)
      throw new Error(`Gemini API error: ${response.statusText}`);

    const data = await response.json();
    textResponse = data.candidates[0].content.parts[0].text;

    // Надежное извлечение JSON: ищем всё от первой { до последней }
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        "Не удалось найти валидный JSON-объект в ответе от Gemini",
      );
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("❌ Ошибка при парсинге ответа от Gemini:", error.message);
    if (textResponse) {
      console.log("--- СЫРОЙ ОТВЕТ ОТ GEMINI ---");
      console.log(textResponse);
      console.log("-----------------------------");
    }
    return {};
  }
}

async function migrate() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Успешное подключение к MongoDB");

    const en = readJson(enPath);
    const ru = readJson(ruPath);
    const uk = readJson(ukPath);

    if (!en.mixes) en.mixes = { genre: {}, mood: {} };
    if (!ru.mixes) ru.mixes = { genre: {}, mood: {} };
    if (!uk.mixes) uk.mixes = { genre: {}, mood: {} };

    const mixes = await Mix.find({});
    console.log(`🔍 Найдено ${mixes.length} миксов для проверки.`);

    const termsToTranslate = new Set();

    // Этап 1: Находим пустые переводы и "плохие" переводы-заглушки
    for (const mix of mixes) {
      if (!mix.name || !mix.name.startsWith("mixes.")) continue;

      const nameParts = mix.name.split(".");
      if (nameParts.length < 3) continue;

      const category = nameParts[1];
      const key = nameParts[2];
      const sourceName = mix.sourceName || key;

      const ruName = ru.mixes[category]?.[key];
      const ukName = uk.mixes[category]?.[key];

      // Считаем перевод плохим, если он просто склеил англ. слово и "Микс"
      const isBadRu = ruName === `${sourceName} Микс`;
      const isBadUk = ukName === `${sourceName} Мікс`;

      if (!ruName || !ukName || isBadRu || isBadUk) {
        termsToTranslate.add(sourceName);
      }
    }

    let translations = {};
    if (termsToTranslate.size > 0) {
      const termsArray = Array.from(termsToTranslate);
      // Если терминов слишком много (больше 100), можно было бы разбить на чанки,
      // но 128 Gemini Flash переварит без проблем.
      translations = await translateBatch(termsArray);

      if (Object.keys(translations).length > 0) {
        console.log("✅ Переводы успешно получены и обработаны!");
      } else {
        console.log("⚠️ Переводы не были применены из-за ошибки парсинга.");
      }
    } else {
      console.log(
        "ℹ️ Все переводы выглядят корректно, обращаемся только к БД.",
      );
    }

    // Этап 2: Обновляем файлы локализаций и базу данных
    let updatedCount = 0;
    let jsonUpdated = false;

    for (const mix of mixes) {
      if (!mix.name || !mix.name.startsWith("mixes.")) continue;

      const nameParts = mix.name.split(".");
      if (nameParts.length < 3) continue;

      const category = nameParts[1];
      const key = nameParts[2];
      const sourceName = mix.sourceName || key;

      let enName = en.mixes[category]?.[key];
      let ruName = ru.mixes[category]?.[key];
      let ukName = uk.mixes[category]?.[key];

      const isBadRu = ruName === `${sourceName} Микс`;
      const isBadUk = ukName === `${sourceName} Мікс`;

      if (!enName) {
        enName = `${sourceName} Mix`;
        en.mixes[category][key] = enName;
        jsonUpdated = true;
      }

      // Обновляем русский перевод
      if (!ruName || isBadRu) {
        const newTranslation = translations[sourceName]?.ru;
        if (newTranslation && newTranslation !== ruName) {
          ruName = newTranslation;
          ru.mixes[category][key] = ruName;
          jsonUpdated = true;
        } else if (!ruName) {
          ruName = `${sourceName} Микс`;
          ru.mixes[category][key] = ruName;
          jsonUpdated = true;
        }
      }

      // Обновляем украинский перевод
      if (!ukName || isBadUk) {
        const newTranslation = translations[sourceName]?.uk;
        if (newTranslation && newTranslation !== ukName) {
          ukName = newTranslation;
          uk.mixes[category][key] = ukName;
          jsonUpdated = true;
        } else if (!ukName) {
          ukName = `${sourceName} Мікс`;
          uk.mixes[category][key] = ukName;
          jsonUpdated = true;
        }
      }

      const expectedSearchableNames = [enName, ruName, ukName];

      const isMissing =
        !mix.searchableNames || mix.searchableNames.length === 0;
      const isMismatched =
        JSON.stringify(mix.searchableNames) !==
        JSON.stringify(expectedSearchableNames);

      if (isMissing || isMismatched) {
        mix.searchableNames = expectedSearchableNames;
        await mix.save();
        updatedCount++;
        console.log(
          `🔄 Обновлен микс в БД: ${mix.name} ->`,
          expectedSearchableNames,
        );
      }
    }

    if (jsonUpdated) {
      writeJson(enPath, en);
      writeJson(ruPath, ru);
      writeJson(ukPath, uk);
      console.log("✅ Файлы translation.json успешно обновлены и исправлены!");
    }

    console.log(
      `✅ Миграция завершена. Обновлено миксов в базе: ${updatedCount}`,
    );
  } catch (error) {
    console.error("❌ Ошибка миграции:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrate();
