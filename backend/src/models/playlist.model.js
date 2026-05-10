import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    imageUrl: {
      type: String,
      default: "https://moodify.b-cdn.net/default-album-cover.png",
    },
    imagePublicId: { type: String, default: null }, // Для загруженных обложек

    // owner === null означает, что это глобальный системный микс (например, Жанр/Настроение)
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

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
        "LIKED_SONGS", // <--- ДОБАВЛЯЕМ СЮДА
      ],
      default: "USER_CREATED",
    },

    // Флаг блокировки для фронтенда (запрещает менять название/картинку/удалять)
    isSystem: { type: Boolean, default: false },

    // Поля для глобальных миксов (раньше были в Mix)
    sourceName: { type: String }, // Например, "Phonk", "Sad"
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    searchableNames: { type: [String], index: true },

    lastGeneratedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Оптимизированные индексы для мгновенной выборки
playlistSchema.index({ owner: 1, type: 1 });
playlistSchema.index({ type: 1, isPublic: 1 });
playlistSchema.index({ title: "text" });

export const Playlist = mongoose.model("Playlist", playlistSchema);
