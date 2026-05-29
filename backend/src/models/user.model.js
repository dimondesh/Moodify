import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";

const userSchema = new mongoose.Schema(
  {
    fullName: String,
    imagePublicId: { type: String, default: null },
    images: imagesField,
    coverAccentHex: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
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
    lastListeningActivity: {
      activity: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
