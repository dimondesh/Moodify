import mongoose from "mongoose";

const embeddingMapPointSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    group: { type: String, required: true },
    sub: { type: String, required: true },
  },
  { _id: false },
);

const embeddingMapSchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      enum: ["tracks", "albums", "artists", "playlists"],
      required: true,
      unique: true,
    },
    points: { type: [embeddingMapPointSchema], default: [] },
    dimensions: { type: Number, default: 0 },
    method: { type: String, default: "pca" },
    sourceFingerprint: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const EmbeddingMap = mongoose.model("EmbeddingMap", embeddingMapSchema);
