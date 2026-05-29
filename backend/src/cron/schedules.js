import cron from "node-cron";
import { ListenHistory } from "../models/listenHistory.model.js";
import {
  generateOnRepeatPlaylistForUser,
  generateDiscoverWeeklyForUser,
  generateOnRepeatRewindForUser,
} from "../lib/playlistGenerator.service.js";
import { User } from "../models/user.model.js";
import { cleanAllTempDirectories } from "../lib/tempCleanup.service.js";

export function registerCronJobs() {
  const tasks = [];

  tasks.push(
    cron.schedule(
      "0 5 1 * *",
      async () => {
        console.log(
          'CRON JOB: Starting "On Repeat Rewind" playlist generation...',
        );
        try {
          const allUsers = await User.find({}).select("_id");
          for (const user of allUsers) {
            await generateOnRepeatRewindForUser(user._id);
          }
          console.log(
            `CRON JOB: "On Repeat Rewind" generation finished for ${allUsers.length} users.`,
          );
        } catch (error) {
          console.error(
            'CRON JOB: Error in "On Repeat Rewind" generation:',
            error,
          );
        }
      },
    ),
  );

  tasks.push(
    cron.schedule(
      "0 3 * * 1",
      async () => {
        console.log(
          'CRON JOB: Starting "Discover Weekly" playlist generation...',
        );
        try {
          const allUsers = await User.find({}).select("_id");
          for (const user of allUsers) {
            await generateDiscoverWeeklyForUser(user._id);
          }
          console.log(
            `CRON JOB: "Discover Weekly" generation finished for ${allUsers.length} users.`,
          );
        } catch (error) {
          console.error(
            'CRON JOB: Error in "Discover Weekly" generation:',
            error,
          );
        }
      },
    ),
  );

  tasks.push(
    cron.schedule("*/20 * * * *", () => {
      console.log("[CronJob] Запуск очистки временных директорий...");
      cleanAllTempDirectories();
    }),
  );

  // Раз в 3 дня в 04:00; пользователи с ≥30 прослушиваниями
  tasks.push(
    cron.schedule(
      "0 4 */3 * *",
      async () => {
        console.log('CRON JOB: Starting "On Repeat" playlist generation...');
        try {
          const eligibleUsers = await ListenHistory.aggregate([
            { $group: { _id: "$user", count: { $sum: 1 } } },
            { $match: { count: { $gte: 30 } } },
          ]);

          for (const user of eligibleUsers) {
            await generateOnRepeatPlaylistForUser(user._id);
          }
          console.log(
            `CRON JOB: "On Repeat" generation finished for ${eligibleUsers.length} users.`,
          );
        } catch (error) {
          console.error('CRON JOB: Error in "On Repeat" generation:', error);
        }
      },
    ),
  );

  return tasks;
}
