#!/usr/bin/env node
/**
 * One-time migration: frontend translation.json → Genre/Mood.localizedNames
 *
 *   cd backend && npm run migrate:locales
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { nameToMixLocaleKey } from "../lib/mixLocalization.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.resolve(
  __dirname,
  "../../../frontend/src/lib/locales",
);
const LANGS = ["en", "ru", "uk"];

const readLocaleMixes = () => {
  const byLang = {};
  for (const lang of LANGS) {
    const filePath = path.join(LOCALES_DIR, lang, "translation.json");
    if (!fs.existsSync(filePath)) {
      console.warn(`Skip missing locale file: ${filePath}`);
      continue;
    }
    const json = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    byLang[lang] = {
      genre: json.mixes?.genre ?? {},
      mood: json.mixes?.mood ?? {},
    };
  }
  return byLang;
};

const resolveMixLabel = (byLang, category, name) => {
  const key = nameToMixLocaleKey(name);
  const bucket = byLang.en?.[category] ?? {};
  const localizedNames = {};

  for (const lang of LANGS) {
    const label = byLang[lang]?.[category]?.[key];
    if (typeof label === "string" && label.trim()) {
      localizedNames[lang] = label.trim();
    }
  }

  if (!localizedNames.en && bucket[key]) {
    localizedNames.en = bucket[key].trim();
  }

  return { key, localizedNames };
};

const migrateCollection = async (Model, category, byLang) => {
  const docs = await Model.find({}).lean();
  let updated = 0;
  const missing = [];

  for (const doc of docs) {
    const { key, localizedNames } = resolveMixLabel(byLang, category, doc.name);
    const hasAny = LANGS.some((lang) => localizedNames[lang]);

    if (!hasAny) {
      missing.push({ name: doc.name, key });
      continue;
    }

    await Model.updateOne(
      { _id: doc._id },
      { $set: { localizedNames } },
    );
    updated += 1;
  }

  return { total: docs.length, updated, missing };
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  if (!fs.existsSync(LOCALES_DIR)) {
    console.error(`Locales directory not found: ${LOCALES_DIR}`);
    process.exit(1);
  }

  const byLang = readLocaleMixes();
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  const genreResult = await migrateCollection(Genre, "genre", byLang);
  const moodResult = await migrateCollection(Mood, "mood", byLang);

  console.log("Genres:", genreResult);
  console.log("Moods:", moodResult);

  const allMissing = [
    ...genreResult.missing.map((m) => ({ ...m, type: "genre" })),
    ...moodResult.missing.map((m) => ({ ...m, type: "mood" })),
  ];

  if (allMissing.length > 0) {
    console.log(`\nNo JSON match for ${allMissing.length} document(s):`);
    for (const item of allMissing.slice(0, 30)) {
      console.log(`  [${item.type}] name="${item.name}" key="${item.key}"`);
    }
    if (allMissing.length > 30) {
      console.log(`  ... and ${allMissing.length - 30} more`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
