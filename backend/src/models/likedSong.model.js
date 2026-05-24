import mongoose from "mongoose";

const likedSongSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
    },
    likedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

likedSongSchema.index({ user: 1, song: 1 }, { unique: true });
likedSongSchema.index({ user: 1, likedAt: -1 });

export const LikedSong = mongoose.model("LikedSong", likedSongSchema);
