#!/usr/bin/env node
/**
 * Batch-перевод Genre/Mood без localizedNames через Gemini.
 *
 *   cd backend && npm run translate:mix-locales
 */
import "dotenv/config";
import mongoose from "mongoose";
import { ensureGenreAndMoodLocalizedNames } from "../lib/mixLocale.service.js";

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await ensureGenreAndMoodLocalizedNames();
  console.log(result);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
