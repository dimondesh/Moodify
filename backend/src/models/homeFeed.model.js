import mongoose from "mongoose";

const homeFeedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    generatedAt: {
      type: Date,
    },
    quickPicks: {
      songIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
        },
      ],
      updatedAt: Date,
    },
    madeForYou: {
      playlistIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Playlist",
        },
      ],
      updatedAt: Date,
    },
    yourTopMixes: {
      playlistIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Playlist",
        },
      ],
      updatedAt: Date,
    },
    albumsYouMightLike: {
      albumIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Album",
        },
      ],
      updatedAt: Date,
    },
  },
  { timestamps: false },
);

export const HomeFeed = mongoose.model("HomeFeed", homeFeedSchema);
