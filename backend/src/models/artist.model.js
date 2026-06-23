import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";

const artistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
    },
    images: imagesField,
    bio: {
      type: String,
      required: false,
      default: "",
    },
    embedding: {
      type: [Number],
      default: null,
      index: true,
    },
    sourceProvider: {
      type: String,
      default: null,
    },
    sourceExternalId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

artistSchema.index({ name: 1 });
artistSchema.index(
  { sourceProvider: 1, sourceExternalId: 1 },
  { unique: true, sparse: true },
);

export const Artist = mongoose.model("Artist", artistSchema);
