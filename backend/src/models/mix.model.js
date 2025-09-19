import mongoose from "mongoose";

const mixSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Genre", "Mood"],
      required: true,
    },
    searchableNames: {
      type: [String],
      index: true,
    },
    sourceName: {
      type: String,
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },

    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    imageUrl: {
      type: String,
      required: true,
    },
    generatedOn: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

mixSchema.index({ generatedOn: 1, type: 1 });

export const Mix = mongoose.model("Mix", mixSchema);
