#!/usr/bin/env node
/**
 * Ручной запуск генерации системных плейлистов.
 *
 *   cd backend && npm run generate:playlists
 *   npm run generate:playlists -- --global
 *   npm run generate:playlists -- --personal
 *   npm run generate:playlists -- --smart
 *   npm run generate:playlists -- --user <userId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { ListenHistory } from "../models/listenHistory.model.js";
import { User } from "../models/user.model.js";
import {
  generateGlobalGenreAndMoodMixes,
  generatePersonalMixesForUser,
  generateOnRepeatPlaylistForUser,
  generateDiscoverWeeklyForUser,
  generateOnRepeatRewindForUser,
} from "../lib/playlistGenerator.service.js";

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const runAll = args.length === 0;
const runGlobal = runAll || hasFlag("--global");
const runPersonal = runAll || hasFlag("--personal");
const runSmart = runAll || hasFlag("--smart");
const userId = getArgValue("--user");

async function runSmartForUser(id) {
  await generateOnRepeatPlaylistForUser(id);
  await generateDiscoverWeeklyForUser(id);
  await generateOnRepeatRewindForUser(id);
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  if (runGlobal) {
    console.log("=== Global GENRE_MIX / MOOD_MIX ===");
    const count = await generateGlobalGenreAndMoodMixes();
    console.log(`Done: ${count} mixes updated\n`);
  }

  if (runPersonal) {
    console.log("=== PERSONAL_MIX ===");
    if (userId) {
      const mixes = await generatePersonalMixesForUser(userId);
      console.log(`User ${userId}: ${mixes.length} personal mix(es)\n`);
    } else {
      const eligibleUsers = await ListenHistory.aggregate([
        { $group: { _id: "$user", count: { $sum: 1 } } },
        { $match: { count: { $gte: 10 } } },
      ]);
      for (const { _id } of eligibleUsers) {
        await generatePersonalMixesForUser(_id);
      }
      console.log(`Done: ${eligibleUsers.length} users\n`);
    }
  }

  if (runSmart) {
    console.log("=== Smart playlists (ON_REPEAT, DISCOVER_WEEKLY, REWIND) ===");
    if (userId) {
      await runSmartForUser(userId);
      console.log(`Done for user ${userId}\n`);
    } else {
      const users = await User.find({}).select("_id").lean();
      for (const user of users) {
        await runSmartForUser(user._id);
      }
      console.log(`Done: ${users.length} users\n`);
    }
  }

  if (!runGlobal && !runPersonal && !runSmart) {
    console.log(
      "Usage: npm run generate:playlists [-- --global] [-- --personal] [-- --smart] [-- --user <id>]",
    );
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("Finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
