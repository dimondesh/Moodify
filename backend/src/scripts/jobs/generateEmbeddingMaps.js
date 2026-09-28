/**
 * Rebuild cached embedding scatter maps.
 * Usage: node src/scripts/jobs/generateEmbeddingMaps.js
 *        node src/scripts/jobs/generateEmbeddingMaps.js --force
 */
import "dotenv/config";
import { connectDB } from "../../lib/core/db.js";
import { refreshEmbeddingMapsIfNeeded } from "../../lib/embeddings/embeddingMap.service.js";

const force = process.argv.includes("--force");

await connectDB();
const { rebuilt, skipped } = await refreshEmbeddingMapsIfNeeded({ force });
console.log(
  `[embedding-maps] rebuilt=${rebuilt.join(",") || "none"} skipped=${skipped.join(",") || "none"}`,
);
process.exit(0);
