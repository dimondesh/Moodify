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
    playbackContext: {
      type: {
        type: String,
        enum: ["album", "playlist", "generated-playlist", "mix", "artist"],
        required: false, // Контекст необязателен - может быть null для подсчета без показа в истории
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false, // Может быть null для некоторых типов
      },
      entityTitle: {
        type: String,
        required: false,
      },
      // Примечание: entityImageUrl не сохраняется, так как обложки могут часто обновляться.
      // Актуальная обложка получается при каждом запросе истории.
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
