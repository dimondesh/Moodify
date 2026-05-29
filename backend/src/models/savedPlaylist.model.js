import mongoose from "mongoose";

const savedPlaylistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

savedPlaylistSchema.index({ user: 1, playlist: 1 }, { unique: true });
savedPlaylistSchema.index({ user: 1, addedAt: -1 });

export const SavedPlaylist = mongoose.model("SavedPlaylist", savedPlaylistSchema);
