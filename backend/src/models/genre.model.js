// backend/src/models/genre.model.js

import mongoose from "mongoose";

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});

export const Genre = mongoose.model("Genre", genreSchema);
