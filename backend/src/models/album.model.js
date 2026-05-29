import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";

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
  },
  { timestamps: true }
);

albumSchema.index({ title: 1 });
albumSchema.index({ artist: 1 });

export const Album = mongoose.model("Album", albumSchema);
