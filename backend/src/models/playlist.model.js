// backend/src/models/playlist.model.js
import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "https://moodify.b-cdn.net/default-album-cover.png",
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

playlistSchema.index({ title: 1 });
playlistSchema.index({ description: 1 });
playlistSchema.index({ isPublic: 1 });
playlistSchema.index({ owner: 1 });

export const Playlist = mongoose.model("Playlist", playlistSchema);
