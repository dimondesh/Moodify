import mongoose from "mongoose";
import { imagesField } from "./schemas/imageVariants.schema.js";
import { localizedNamesSchema } from "./schemas/localizedNames.schema.js";

const snapshotArtistSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    name: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const snapshotOwnerSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    fullName: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const SnapshotSchema = new mongoose.Schema(
  {
    // Album, Artist — title; Playlist — title или localizedNames
    title: { type: String, trim: true },
    images: imagesField,

    // Album — subtitle и отображение артистов
    artists: [snapshotArtistSchema],

    // Album
    albumType: {
      type: String,
      enum: ["Album", "Single", "EP"],
    },

    // Playlist
    playlistType: {
      type: String,
      enum: [
        "USER_CREATED",
        "GENRE_MIX",
        "MOOD_MIX",
        "PERSONAL_MIX",
        "ON_REPEAT",
        "DISCOVER_WEEKLY",
        "ON_REPEAT_REWIND",
        "NEW_RELEASES",
      ],
    },
    localizedNames: localizedNamesSchema,
    owner: snapshotOwnerSchema,

    // Album / Playlist / Artist — треки для play-кнопки на карточке
    songIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
  },
  { _id: false },
);

const recentActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    entityType: {
      type: String,
      enum: ["Playlist", "Album", "Artist"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },
    snapshot: {
      type: SnapshotSchema,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false },
);

const hasLocalizedTitle = (localizedNames) =>
  !!(
    localizedNames?.en?.trim() ||
    localizedNames?.ru?.trim() ||
    localizedNames?.uk?.trim()
  );

recentActivitySchema.pre("validate", function (next) {
  const { entityType, snapshot } = this;
  if (!snapshot) return next();

  const hasTitle = !!snapshot.title?.trim();

  if (entityType === "Playlist") {
    if (!hasTitle && !hasLocalizedTitle(snapshot.localizedNames)) {
      return next(
        new Error("Playlist snapshot requires title or localizedNames"),
      );
    }
  } else if (!hasTitle) {
    return next(new Error("Snapshot requires title"));
  }

  next();
});

recentActivitySchema.index(
  { userId: 1, entityType: 1, entityId: 1 },
  { unique: true },
);
recentActivitySchema.index({ userId: 1, timestamp: -1 });
recentActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

export const RecentActivity = mongoose.model(
  "RecentActivity",
  recentActivitySchema,
);
