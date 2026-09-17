// backend/src/models/song.model.js
import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
        required: true,
      },
    ],
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },
    trackNumber: {
      type: Number,
      default: null,
    },
    discNumber: {
      type: Number,
      default: null,
    },
    explicit: {
      type: Boolean,
      default: false,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    images: imagesField,
    coverAccentHex: {
      type: String,
      default: null,
    },
    canvasUrl: {
      type: String,
      default: null,
    },
    canvasPublicId: {
      type: String,
      default: null,
    },
    hlsUrl: {
      type: String,
      required: true,
    },
    /** Bunny HLS URL for Demucs instrumental stem (lazy-generated). */
    instrumentalUrl: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      required: true,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lyrics: {
      type: String,
      default: null,
    },
    genres: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Genre",
      },
    ],
    moods: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Mood",
      },
    ],
    // Audio features from analysis service
    audioFeatures: {
      bpm: {
        type: Number,
        default: null,
      },
      camelot: {
        type: String,
        default: null,
      },
      beats: {
        type: [Number],
        default: [],
      },
      embedding: {
        type: [Number],
        default: null,
      },
    },
  },
  { timestamps: true },
);

songSchema.index({ title: 1 });
songSchema.index({ artist: 1 });
songSchema.index({ albumId: 1 });
// Prevent double-ingest from writing the same disc/track slot twice.
songSchema.index(
  { albumId: 1, discNumber: 1, trackNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      albumId: { $type: "objectId" },
      discNumber: { $type: "number" },
      trackNumber: { $type: "number" },
    },
  },
);
songSchema.index({ playCount: -1 });
songSchema.index({ genres: 1 });
songSchema.index({ moods: 1 });
songSchema.index({ title: "text" });
songSchema.index({ createdAt: -1 });

export const Song = mongoose.model("Song", songSchema);

import { registerEntityEmbeddingHooks } from "./hooks/entityEmbedding.hooks.js";
registerEntityEmbeddingHooks();
