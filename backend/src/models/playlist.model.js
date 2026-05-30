import mongoose from "mongoose";
import { CDN_DEFAULT_ALBUM_COVER } from "../constants/cdn.js";
import { imagesField } from "./schemas/imageVariants.schema.js";
import { localizedNamesSchema } from "./schemas/localizedNames.schema.js";

const playlistSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    imagePublicId: { type: String, default: null },
    images: imagesField,
    coverAccentHex: { type: String, default: null },

    // owner === null — системные/сгенерированные плейлисты (Moodify Music как автор)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    madeFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],

    isPublic: { type: Boolean, default: false },

    // --- МАГИЯ УНИФИКАЦИИ ---
    type: {
      type: String,
      enum: [
        "USER_CREATED", // Обычный плейлист юзера
        "GENRE_MIX", // Глобальный микс по жанру
        "MOOD_MIX", // Глобальный микс по настроению
        "PERSONAL_MIX", // Daily Mix юзера
        "ON_REPEAT", // Часто слушаемое
        "DISCOVER_WEEKLY", // Новое для юзера
        "ON_REPEAT_REWIND", // Старое любимое
        "NEW_RELEASES", // Радар новинок
      ],
      default: "USER_CREATED",
    },

    // Флаг блокировки для фронтенда (запрещает менять название/картинку/удалять)
    isSystem: { type: Boolean, default: false },

    // Поля для глобальных миксов (раньше были в Mix)
    sourceName: { type: String }, // Например, "Phonk", "Sad"
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    localizedNames: localizedNamesSchema,

    lastGeneratedAt: { type: Date, default: Date.now },

    embedding: {
      type: [Number],
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// Оптимизированные индексы для мгновенной выборки
playlistSchema.index({ owner: 1, type: 1 });
playlistSchema.index({ madeFor: 1, type: 1 });
playlistSchema.index({ type: 1, isPublic: 1 });
playlistSchema.index({ title: "text" });

export const Playlist = mongoose.model("Playlist", playlistSchema);

import { registerEntityEmbeddingHooks } from "./hooks/entityEmbedding.hooks.js";
registerEntityEmbeddingHooks();
