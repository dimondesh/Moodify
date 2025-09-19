// backend/src/models/listenHistory.model.js

import mongoose from "mongoose";

const listenHistorySchema = new mongoose.Schema(
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
    listenedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

listenHistorySchema.index({ user: 1, listenedAt: -1 });
listenHistorySchema.index({ song: 1, listenedAt: -1 });

export const ListenHistory = mongoose.model(
  "ListenHistory",
  listenHistorySchema
);
