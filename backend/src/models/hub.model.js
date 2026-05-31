import mongoose from "mongoose";
import { localizedNamesSchema } from "./schemas/localizedNames.schema.js";
import { imagesField } from "./schemas/imageVariants.schema.js";

const previewCoverSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["album", "artist"],
      required: true,
    },
    images: imagesField,
    imagePublicId: {
      type: String,
      default: null,
    },
    coverAccentHex: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const hubSchema = new mongoose.Schema(
  {
    categoryType: {
      type: String,
      enum: ["Genre", "Mood"],
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    localizedNames: localizedNamesSchema,
    embedding: {
      type: [Number],
      default: null,
    },
    trackCount: {
      type: Number,
      default: 0,
    },
    accentColor: {
      type: String,
      required: true,
    },
    albumIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Album" },
    ],
    artistIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Artist" },
    ],
    playlistIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Playlist" },
    ],
    previewCovers: {
      type: [previewCoverSchema],
      default: [],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

hubSchema.index({ categoryType: 1, categoryId: 1 }, { unique: true });
hubSchema.index({ generatedAt: -1 });

export const Hub = mongoose.model("Hub", hubSchema);
