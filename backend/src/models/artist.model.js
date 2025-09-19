import mongoose from "mongoose";

const artistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
    },
    bio: {
      type: String,
      required: false,
      default: "",
    },
    bannerUrl: {
      type: String,
      required: false,
      default: null,
    },
    bannerPublicId: {
      type: String,
    },
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    albums: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Album",
      },
    ],
  },
  { timestamps: true }
);

artistSchema.index({ name: 1 });

export const Artist = mongoose.model("Artist", artistSchema);
