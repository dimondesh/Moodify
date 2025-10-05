import mongoose from "mongoose";

const personalMixSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    imageUrl: {
      type: String,
      required: true,
    },
    generatedOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

personalMixSchema.index({ user: 1, generatedOn: -1 });

export const PersonalMix = mongoose.model("PersonalMix", personalMixSchema);
