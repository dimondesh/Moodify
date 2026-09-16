/**
 * Self-check: virtual playlist entityIds must not crash ListenHistory cast.
 * Run: node src/models/listenHistory.selfcheck.js
 */
import mongoose from "mongoose";
import {
  ListenHistory,
  coercePlaybackEntityId,
} from "./listenHistory.model.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const oid = new mongoose.Types.ObjectId();

assert(coercePlaybackEntityId("liked") === null, "liked must coerce to null");
assert(coercePlaybackEntityId(null) === null, "null stays null");
assert(
  String(coercePlaybackEntityId(String(oid))) === String(oid),
  "valid ObjectId must pass through",
);

const raw = new ListenHistory({
  user: oid,
  song: oid,
  playbackContext: { type: "playlist", entityId: "liked", entityTitle: "Liked" },
});
assert(
  raw.validateSync()?.errors?.["playbackContext.entityId"],
  "raw 'liked' entityId must fail schema cast",
);

const fixed = new ListenHistory({
  user: oid,
  song: oid,
  playbackContext: {
    type: "playlist",
    entityId: coercePlaybackEntityId("liked"),
    entityTitle: "Liked",
  },
});
assert(!fixed.validateSync(), "coerced liked context must validate");

console.log("listenHistory.selfcheck: ok");
