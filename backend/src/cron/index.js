import "dotenv/config";
import { connectDB } from "../lib/core/db.js";
import { connectRedis } from "../lib/core/redis.js";
import { registerCronJobs } from "./schedules.js";
import {
  createHomeFeedWorker,
  closeHomeFeedWorker,
} from "../lib/home/homeFeedQueue.service.js";

const tasks = registerCronJobs();
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received — stopping cron tasks...`);

  for (const task of tasks) {
    task.stop();
  }

  await closeHomeFeedWorker();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await connectDB();
await connectRedis();
createHomeFeedWorker();
console.log(
  `Cron worker started (${tasks.length} schedules + home feed queue) in ${process.env.NODE_ENV || "development"} mode`,
);
