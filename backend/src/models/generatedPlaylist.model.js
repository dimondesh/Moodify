// backend/src/models/generatedPlaylist.model.js
import mongoose from "mongoose";

const generatedPlaylistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["ON_REPEAT", "DISCOVER_WEEKLY", "ON_REPEAT_REWIND"],
      required: true,
    },
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    nameKey: {
      type: String,
      required: true,
    },
    descriptionKey: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    generatedOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

generatedPlaylistSchema.index({ user: 1, type: 1 });

export const GeneratedPlaylist = mongoose.model(
  "GeneratedPlaylist",
  generatedPlaylistSchema
);
