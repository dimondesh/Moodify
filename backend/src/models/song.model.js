// backend/src/models/song.model.js
import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
        required: true,
      },
    ],
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    hlsUrl: {
      type: String,
      required: true,
    },
    sourceAudioPublicId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lyrics: {
      type: String,
      default: null,
    },
    genres: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Genre",
      },
    ],
    moods: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Mood",
      },
    ],
  },
  { timestamps: true }
);

songSchema.index({ title: 1 });
songSchema.index({ artist: 1 });
songSchema.index({ albumId: 1 });
songSchema.index({ playCount: -1 });
songSchema.index({ genres: 1 });
songSchema.index({ moods: 1 });
songSchema.index({ title: "text" });

export const Song = mongoose.model("Song", songSchema);
