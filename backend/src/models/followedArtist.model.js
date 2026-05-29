import mongoose from "mongoose";

const followedArtistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

followedArtistSchema.index({ user: 1, artist: 1 }, { unique: true });
followedArtistSchema.index({ user: 1, addedAt: -1 });

export const FollowedArtist = mongoose.model(
  "FollowedArtist",
  followedArtistSchema,
);
