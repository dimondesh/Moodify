import mongoose from "mongoose";

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
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
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
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
        required: false,
      },
    ],
  },
  { timestamps: true }
);

albumSchema.index({ title: 1 });
albumSchema.index({ artist: 1 });

export const Album = mongoose.model("Album", albumSchema);
