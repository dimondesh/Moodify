import mongoose from "mongoose";

const followedUserSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

followedUserSchema.index({ follower: 1, following: 1 }, { unique: true });
followedUserSchema.index({ follower: 1, addedAt: -1 });
followedUserSchema.index({ following: 1, addedAt: -1 });

export const FollowedUser = mongoose.model("FollowedUser", followedUserSchema);
