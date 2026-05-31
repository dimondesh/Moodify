import cron from "node-cron";
import { ListenHistory } from "../models/listenHistory.model.js";
import {
  generateGlobalGenreAndMoodMixes,
  generatePersonalMixesForUser,
  generateOnRepeatPlaylistForUser,
  generateDiscoverWeeklyForUser,
  generateOnRepeatRewindForUser,
} from "../lib/playlistGenerator.service.js";
import { generateHomeFeedForUser } from "../lib/home/homeFeedGenerator.service.js";
import { warmTrendingCache } from "../lib/home/trending.service.js";
import { User } from "../models/user.model.js";
import { cleanAllTempDirectories } from "../lib/tempCleanup.service.js";

const PERSONAL_MIX_MIN_LISTENS = 10;
const HOME_FEED_BATCH_SIZE = 20;

async function getUserIdsWithMinListens(minListens) {
  const rows = await ListenHistory.aggregate([
    { $group: { _id: "$user", count: { $sum: 1 } } },
    { $match: { count: { $gte: minListens } } },
  ]);
  return rows.map((row) => row._id);
}

async function getActiveUserIds() {
  return ListenHistory.distinct("user");
}

async function runSmartPlaylistsForUser(userId) {
  await generateOnRepeatPlaylistForUser(userId);
  await generateDiscoverWeeklyForUser(userId);
  await generateOnRepeatRewindForUser(userId);
}

async function generateHomeFeedForActiveUsers() {
  const userIds = await getActiveUserIds();

  for (let i = 0; i < userIds.length; i += HOME_FEED_BATCH_SIZE) {
    const batch = userIds.slice(i, i + HOME_FEED_BATCH_SIZE);

    for (const userId of batch) {
      try {
        await generateHomeFeedForUser(userId);
      } catch (error) {
        console.error(
          `CRON JOB: Home feed generation failed for user ${userId}:`,
          error,
        );
      }
    }
  }

  return userIds.length;
}

export function registerCronJobs() {
  const tasks = [];

  // 00:00 — PERSONAL_MIX (≥10 listens) + ON_REPEAT, DISCOVER_WEEKLY, ON_REPEAT_REWIND
  tasks.push(
    cron.schedule("0 0 * * *", async () => {
      console.log(
        'CRON JOB: Starting nightly user playlist generation (PERSONAL_MIX + smart playlists)...',
      );
      try {
        const personalMixUserIds = await getUserIdsWithMinListens(
          PERSONAL_MIX_MIN_LISTENS,
        );

        for (const userId of personalMixUserIds) {
          await generatePersonalMixesForUser(userId);
        }
        console.log(
          `CRON JOB: PERSONAL_MIX finished for ${personalMixUserIds.length} users.`,
        );

        const allUsers = await User.find({}).select("_id").lean();
        for (const user of allUsers) {
          await runSmartPlaylistsForUser(user._id);
        }
        console.log(
          `CRON JOB: Smart playlists finished for ${allUsers.length} users.`,
        );
      } catch (error) {
        console.error(
          "CRON JOB: Error in nightly user playlist generation:",
          error,
        );
      }
    }),
  );

  // 01:00 — global GENRE_MIX / MOOD_MIX (after user playlists)
  tasks.push(
    cron.schedule("0 1 * * *", async () => {
      console.log("CRON JOB: Starting global genre and mood mixes generation...");
      try {
        await generateGlobalGenreAndMoodMixes();
      } catch (error) {
        console.error("CRON JOB: Error in global mixes generation:", error);
      }
    }),
  );

  // 02:00, 08:00, 14:00, 20:00 — home feed for active users (after nightly playlist jobs)
  tasks.push(
    cron.schedule("0 2,8,14,20 * * *", async () => {
      console.log("CRON JOB: Starting home feed generation for active users...");
      try {
        const count = await generateHomeFeedForActiveUsers();
        console.log(`CRON JOB: Home feed generation finished for ${count} users.`);
      } catch (error) {
        console.error("CRON JOB: Error in home feed generation:", error);
      }
    }),
  );

  // Every 6 hours — warm trending cache in Redis
  tasks.push(
    cron.schedule("0 */6 * * *", async () => {
      console.log("CRON JOB: Warming trending cache...");
      try {
        await warmTrendingCache();
        console.log("CRON JOB: Trending cache warmed.");
      } catch (error) {
        console.error("CRON JOB: Error warming trending cache:", error);
      }
    }),
  );

  tasks.push(
    cron.schedule("*/20 * * * *", () => {
      console.log("[CronJob] Запуск очистки временных директорий...");
      cleanAllTempDirectories();
    }),
  );

  return tasks;
}
