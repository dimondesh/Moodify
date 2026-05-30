// backend/src/models/genre.model.js

import mongoose from "mongoose";
import { localizedNamesSchema } from "./schemas/localizedNames.schema.js";

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  localizedNames: localizedNamesSchema,
});

export const Genre = mongoose.model("Genre", genreSchema);
