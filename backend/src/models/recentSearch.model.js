// backend/src/models/recentSearch.model.js

import mongoose from "mongoose";

const recentSearchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "itemType",
    },
    itemType: {
      type: String,
      required: true,
      enum: ["Artist", "Album", "Playlist", "User", "Mix"],
    },
  },
  { timestamps: true }
);

recentSearchSchema.index({ user: 1, item: 1, itemType: 1 }, { unique: true });

recentSearchSchema.index({ user: 1, updatedAt: -1 });

export const RecentSearch = mongoose.model("RecentSearch", recentSearchSchema);
