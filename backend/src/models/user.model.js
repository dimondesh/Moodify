// backend/src/models/user.model.js

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    imageUrl: String,
    email: { type: String, required: true },
    firebaseUid: { type: String, required: true, unique: true },
    playlists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Playlist",
      },
    ],
    // --- НОВЫЕ ПОЛЯ ---
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    followingUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    followingArtists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
      },
    ],
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
