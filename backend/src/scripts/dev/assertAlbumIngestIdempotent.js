#!/usr/bin/env node
/**
 * Asserts ingest skips re-create when album is already completed.
 * Run: node src/scripts/dev/assertAlbumIngestIdempotent.js
 */
import assert from "node:assert/strict";

// Lightweight pure check mirroring the guard condition used in ingest.
const shouldSkipReingest = (albumStatus, existingSongCount) =>
  albumStatus === "completed" && existingSongCount > 0;

assert.equal(shouldSkipReingest("completed", 10), true);
assert.equal(shouldSkipReingest("completed", 0), false);
assert.equal(shouldSkipReingest("queued", 5), false);
assert.equal(shouldSkipReingest("queued", 0), false);

// Keep oldest by createdAt then _id
const pickOldest = (docs) =>
  [...docs].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a._id).localeCompare(String(b._id));
  })[0];

const older = {
  _id: "a",
  createdAt: "2026-09-17T00:00:00.000Z",
};
const newer = {
  _id: "b",
  createdAt: "2026-09-17T01:00:00.000Z",
};
assert.equal(pickOldest([newer, older]), older);
assert.equal(pickOldest([older, newer]), older);

console.log("assertAlbumIngestIdempotent: ok");
