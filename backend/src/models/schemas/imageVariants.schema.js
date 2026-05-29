import mongoose from "mongoose";

export const imageVariantEntrySchema = new mongoose.Schema(
  {
    size: { type: Number, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

export const imagesField = {
  type: [imageVariantEntrySchema],
  default: [],
};
