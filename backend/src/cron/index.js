import "dotenv/config";
import { connectDB } from "../lib/core/db.js";
import { registerCronJobs } from "./schedules.js";

const tasks = registerCronJobs();
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received — stopping cron tasks...`);

  for (const task of tasks) {
    task.stop();
  }

  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await connectDB();
console.log(
  `Cron worker started (${tasks.length} schedules) in ${process.env.NODE_ENV || "development"} mode`,
);
