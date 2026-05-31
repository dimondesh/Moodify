#!/usr/bin/env node
/**
 * Ручной запуск всей генерации контента (как cron, но сразу).
 *
 *   cd backend && npm run generate:all
 *   npm run generate:all -- --user <userId>
 *   npm run generate:all -- --home --trending
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectRedis } from "../lib/redis.js";
import {
  runUserPlaylistGeneration,
  runGlobalMixesGeneration,
  runHomeFeedGeneration,
  runTrendingCacheWarmup,
  runHubGeneration,
} from "../cron/schedules.js";

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const userId = getArgValue("--user");
const runAll = args.length === 0 || (userId && args.length === 2);
const runPlaylists = runAll || hasFlag("--playlists");
const runGlobal = runAll || hasFlag("--global");
const runHome = runAll || hasFlag("--home");
const runTrending = runAll || hasFlag("--trending");
const runHubs = runAll || hasFlag("--hubs");

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  await connectRedis();

  const scope = userId ? { userId } : {};

  if (runPlaylists) {
    console.log("\n=== PERSONAL_MIX + smart playlists ===");
    const { personalMixUsers, smartUsers } =
      await runUserPlaylistGeneration(scope);
    console.log(`PERSONAL_MIX: ${personalMixUsers} user(s)`);
    console.log(`Smart playlists: ${smartUsers} user(s)`);
  }

  if (runHubs) {
    console.log("\n=== Category embeddings + hubs ===");
    const count = await runHubGeneration();
    console.log(`Done: ${count} hub(s)`);
  }

  if (runGlobal) {
    console.log("\n=== Global GENRE_MIX / MOOD_MIX ===");
    const count = await runGlobalMixesGeneration();
    console.log(`Done: ${count} mixes updated`);
  }

  if (runHome) {
    console.log("\n=== Home feed ===");
    const count = await runHomeFeedGeneration(scope);
    console.log(`Done: ${count} user(s)`);
  }

  if (runTrending) {
    console.log("\n=== Trending cache ===");
    await runTrendingCacheWarmup();
    console.log("Trending cache warmed");
  }

  if (!runPlaylists && !runGlobal && !runHome && !runTrending && !runHubs) {
    console.log(
      "Usage: npm run generate:all [-- --playlists] [-- --global] [-- --home] [-- --trending] [-- --hubs] [-- --user <id>]",
    );
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("\nFinished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
