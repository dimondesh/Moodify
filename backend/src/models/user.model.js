import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    imageUrl: String,
    coverAccentHex: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, default: null },
    googleId: { type: String, sparse: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCodeHash: { type: String, default: null },
    emailVerificationCodeExpires: { type: Date, default: null },
    emailVerificationLastSentAt: { type: Date, default: null },
    passwordResetCodeHash: { type: String, default: null },
    passwordResetCodeExpires: { type: Date, default: null },
    passwordResetLastSentAt: { type: Date, default: null },
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
    showRecentlyListenedArtists: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
