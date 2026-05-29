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
    bannerUrl: {
      type: String,
      required: false,
      default: null,
    },
    bannerPublicId: {
      type: String,
    },
  },
  { timestamps: true }
);

artistSchema.index({ name: 1 });

export const Artist = mongoose.model("Artist", artistSchema);
