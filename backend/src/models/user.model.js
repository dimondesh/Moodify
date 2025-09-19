import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    imageUrl: String,
    email: { type: String, required: true },
    firebaseUid: { type: String, required: true, unique: true },
    language: {
      type: String,
      enum: ["ru", "uk", "en"],
      default: "ru",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    playlists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Playlist",
      },
    ],
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
