// backend/src/models/mood.model.js

import mongoose from "mongoose";
import { localizedNamesSchema } from "./schemas/localizedNames.schema.js";

const moodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  localizedNames: localizedNamesSchema,
  // Усреднённый вектор (центроид) на основе треков этой категории
  embedding: {
    type: [Number],
    default: null,
  },
});

export const Mood = mongoose.model("Mood", moodSchema);
