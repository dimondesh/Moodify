/**
 * Repro for entity-embedding hook miss on ingest/admin path:
 *   song.audioFeatures = { ..., embedding }; await song.save();
 * isDirectModified("audioFeatures.embedding") stays false; isModified is true.
 *
 * Run: node src/models/hooks/entityEmbedding.hooks.selfcheck.js
 */
import mongoose from "mongoose";
import {
  songSaveShouldRefreshRelated,
  songSaveTouchesTrackEmbedding,
} from "./entityEmbedding.hooks.js";

const songSchema = new mongoose.Schema({
  title: String,
  albumId: mongoose.Schema.Types.ObjectId,
  artist: [{ type: mongoose.Schema.Types.ObjectId }],
  audioFeatures: {
    bpm: Number,
    camelot: String,
    beats: [Number],
    embedding: { type: [Number], default: null },
  },
});

const Song =
  mongoose.models.EntityEmbedSelfcheckSong ||
  mongoose.model("EntityEmbedSelfcheckSong", songSchema);

const clearModified = (doc) => {
  const obj = doc.toObject({ depopulate: true });
  doc.$__reset();
  doc.init(obj);
  doc.isNew = false;
};

const vec = (scale = 1) =>
  Array.from({ length: 50 }, (_, i) => (i / 50) * scale);

const fail = (msg) => {
  console.error("FAIL:", msg);
  process.exitCode = 1;
};

const song = new Song({
  title: "t",
  albumId: new mongoose.Types.ObjectId(),
  artist: [new mongoose.Types.ObjectId()],
});
clearModified(song);

// Ingest / admin path: replace whole audioFeatures subdoc
song.audioFeatures = {
  bpm: 120,
  camelot: "8A",
  beats: [0.1],
  embedding: vec(1),
};

const legacyWouldFire =
  song.isDirectModified("audioFeatures.embedding") || song.isModified("artist");
const fixedWouldFire = songSaveShouldRefreshRelated(song);

if (song.isDirectModified("audioFeatures.embedding") !== false) {
  fail("expected isDirectModified(embedding) false after whole-object assign");
}
if (songSaveTouchesTrackEmbedding(song) !== true) {
  fail("expected isModified(embedding) true after whole-object assign");
}
if (legacyWouldFire !== false) {
  fail("legacy hook must miss this path (red before fix)");
}
if (fixedWouldFire !== true) {
  fail("fixed hook must catch whole-object audioFeatures assign");
}

// Nested assign still works (different values so mongoose marks modified)
clearModified(song);
song.audioFeatures.embedding = vec(2);
if (songSaveShouldRefreshRelated(song) !== true) {
  fail("nested embedding assign must still refresh");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("entityEmbedding.hooks.selfcheck: ok");
