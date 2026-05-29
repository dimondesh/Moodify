import mongoose from "mongoose";

const savedAlbumSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

savedAlbumSchema.index({ user: 1, album: 1 }, { unique: true });
savedAlbumSchema.index({ user: 1, addedAt: -1 });

export const SavedAlbum = mongoose.model("SavedAlbum", savedAlbumSchema);
