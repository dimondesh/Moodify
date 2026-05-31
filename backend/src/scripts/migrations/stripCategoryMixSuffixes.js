#!/usr/bin/env node
/**
 * Strips Mix / Микс / Мікс suffix from Genre & Mood localizedNames.
 *
 *   cd backend && npm run strip:category-mix-suffixes
 *   npm run strip:category-mix-suffixes -- --dry-run
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Genre } from "../../models/genre.model.js";
import { Mood } from "../../models/mood.model.js";
import { Hub } from "../../models/hub.model.js";
import { MIX_LOCALE_LANGS } from "../../lib/playlists/mixLocale.service.js";
import {
  stripCategoryLocalizedNames,
  stripGenreMoodMixSuffix,
} from "../../lib/playlists/labels.js";
import { invalidateHubsCache } from "../../lib/recommendations/hubGenerator.service.js";

const dryRun = process.argv.includes("--dry-run");
const includeHubs = process.argv.includes("--hubs");

const localizedNamesChanged = (before = {}, after = {}) =>
  MIX_LOCALE_LANGS.some(
    (lang) => (before[lang] ?? "").trim() !== (after[lang] ?? "").trim(),
  );

const processModel = async (Model, label) => {
  const docs = await Model.find({}).select("name localizedNames").lean();
  let updated = 0;

  for (const doc of docs) {
    const cleaned = stripCategoryLocalizedNames(doc.localizedNames, doc.name);
    const nameCleaned = stripGenreMoodMixSuffix(doc.name, "en");
    const namesChanged = localizedNamesChanged(doc.localizedNames, cleaned);
    const nameChanged = nameCleaned !== (doc.name ?? "").trim();

    if (!namesChanged && !nameChanged) continue;

    updated += 1;

    if (namesChanged) {
      console.log(
        `[${label}] ${doc.name}:`,
        MIX_LOCALE_LANGS.map(
          (lang) =>
            `${lang}: "${doc.localizedNames?.[lang] ?? ""}" → "${cleaned[lang] ?? ""}"`,
        ).join(", "),
      );
    }
    if (nameChanged) {
      console.log(`[${label}] name: "${doc.name}" → "${nameCleaned}"`);
    }

    if (!dryRun) {
      const $set = { localizedNames: cleaned };
      if (nameChanged) {
        $set.name = nameCleaned;
      }
      await Model.updateOne({ _id: doc._id }, { $set });
    }
  }

  return { total: docs.length, updated };
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(dryRun ? "DRY RUN — no writes\n" : "Connected to MongoDB\n");

  const genres = await processModel(Genre, "Genre");
  console.log(`Genres: ${genres.updated}/${genres.total} updated\n`);

  const moods = await processModel(Mood, "Mood");
  console.log(`Moods: ${moods.updated}/${moods.total} updated\n`);

  if (includeHubs) {
    const hubs = await processModel(Hub, "Hub");
    console.log(`Hubs: ${hubs.updated}/${hubs.total} updated\n`);
    if (!dryRun && hubs.updated > 0) {
      await invalidateHubsCache();
      console.log("Hub list cache invalidated.");
    }
  }

  await mongoose.disconnect();

  if (dryRun) {
    console.log("\nDry run complete. Re-run without --dry-run to apply.");
  } else {
    console.log("\nDone. Run `npm run generate:hubs` to refresh hub metadata.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
