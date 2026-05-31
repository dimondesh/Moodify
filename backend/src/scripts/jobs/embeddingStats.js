#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";
import { printEmbeddingStats } from "../../lib/recommendations/embeddingStats.service.js";

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is required in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  await printEmbeddingStats();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
