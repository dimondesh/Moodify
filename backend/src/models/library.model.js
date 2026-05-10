import mongoose from "mongoose";

const librarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    albums: [
      {
        albumId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Album",
          required: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    playlists: [
      {
        playlistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Playlist",
          required: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    followedArtists: [
      {
        artistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Artist",
          required: true,
        },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

librarySchema.index({ userId: 1 });
librarySchema.index({ "albums.albumId": 1 });

export const Library = mongoose.model("Library", librarySchema);
