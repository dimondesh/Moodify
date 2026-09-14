import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";

const uploadProgressSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      enum: ["queued", "preparing", "downloading", "ingesting"],
      default: "queued",
    },
    tracksDone: { type: Number, default: 0 },
    tracksTotal: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
  },
  { _id: false },
);

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    artist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
        required: true,
      },
    ],
    imagePublicId: {
      type: String,
    },
    images: imagesField,
    coverAccentHex: {
      type: String,
      default: null,
    },
    releaseYear: {
      type: Number,
      required: false,
    },
    type: {
      type: String,
      enum: ["Album", "Single", "EP"],
      default: "Album",
    },
    embedding: {
      type: [Number],
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "completed"],
      default: "completed",
      index: true,
    },
    ingestJobId: {
      type: String,
      default: null,
    },
    spotifyAlbumUrl: {
      type: String,
      default: null,
    },
    upload: {
      type: uploadProgressSchema,
      default: null,
    },
  },
  { timestamps: true },
);

albumSchema.index({ title: 1 });
albumSchema.index({ artist: 1 });
albumSchema.index({ createdAt: -1 });

/** Hide in-progress stubs from public reads unless includeQueued: true. */
const excludeQueuedUnlessOptedIn = function () {
  if (this.getOptions()?.includeQueued) return;
  this.where({ status: { $ne: "queued" } });
};

albumSchema.pre(/^find/, excludeQueuedUnlessOptedIn);
albumSchema.pre("countDocuments", excludeQueuedUnlessOptedIn);

export const Album = mongoose.model("Album", albumSchema);
