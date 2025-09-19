// backend/src/models/mood.model.js

import mongoose from "mongoose";

const moodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});

export const Mood = mongoose.model("Mood", moodSchema);
