import mongoose from "mongoose";

const librarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    likedSongs: [
      {
        songId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedMixes: [
      {
        mixId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Mix",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedPersonalMixes: [
      {
        personalMixId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PersonalMix",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    albums: [
      {
        albumId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Album",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    playlists: [
      {
        playlistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Playlist",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    followedArtists: [
      {
        artistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Artist",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    savedGeneratedPlaylists: [
      {
        playlistId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GeneratedPlaylist",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export const Library = mongoose.model("Library", librarySchema);
