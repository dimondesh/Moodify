#!/usr/bin/env node
/**
 * Full embedding pipeline: stats → entity embeddings → centroids + hubs.
 *
 *   cd backend && npm run pipeline:embeddings
 *   npm run pipeline:embeddings -- --stats-only
 *   npm run pipeline:embeddings -- --entities --hubs
 *   SKIP_EMBEDDING_HOOKS=1 npm run pipeline:embeddings -- --entities
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectRedis } from "../lib/redis.js";
import { printEmbeddingStats } from "../lib/embeddingStats.service.js";
import { runCategoryEmbeddingsAndHubs } from "../lib/hubGenerator.service.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const statsOnly = hasFlag("--stats-only");
const runEntities = !statsOnly && (args.length === 0 || hasFlag("--entities"));
const runHubs = !statsOnly && (args.length === 0 || hasFlag("--hubs"));

const runScript = (scriptName) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: process.env,
      cwd: path.resolve(__dirname, "../.."),
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  await connectRedis();

  await printEmbeddingStats();

  if (statsOnly) {
    await mongoose.disconnect();
    return;
  }

  if (runEntities) {
    console.log("\n=== Entity embeddings (album / artist / playlist) ===");
    if (process.env.SKIP_EMBEDDING_HOOKS !== "1") {
      console.log(
        "Tip: set SKIP_EMBEDDING_HOOKS=1 during bulk song backfill, then run this step.",
      );
    }
    await runScript("generateEntityEmbeddings.js");
  }

  if (runHubs) {
    console.log("\n=== Category centroids + hubs ===");
    const hubCount = await runCategoryEmbeddingsAndHubs();
    console.log(`Done: ${hubCount} hub(s)`);
    await printEmbeddingStats();
  }

  await mongoose.disconnect();
  console.log("\nPipeline finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
