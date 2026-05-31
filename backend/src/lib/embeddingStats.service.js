import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Genre } from "../models/genre.model.js";
import { Mood } from "../models/mood.model.js";
import { Hub } from "../models/hub.model.js";
import {
  VALID_SONG_EMBEDDING,
  VALID_ENTITY_EMBEDDING,
} from "../constants/embedding.js";
import { HUB_MIN_TRACKS } from "../constants/hub.js";

const countEligibleCategories = async (Model, tagField) => {
  const categories = await Model.find({ ...VALID_ENTITY_EMBEDDING })
    .select("_id name")
    .lean();

  let eligible = 0;
  for (const category of categories) {
    const trackCount = await Song.countDocuments({
      [tagField]: category._id,
      ...VALID_SONG_EMBEDDING,
    });
    if (trackCount >= HUB_MIN_TRACKS) eligible += 1;
  }

  return { total: categories.length, eligible };
};

export const collectEmbeddingStats = async () => {
  const [
    totalSongs,
    songsWithValidEmbedding,
    albumsWithEmbedding,
    artistsWithEmbedding,
    publicPlaylistsWithEmbedding,
    hubCount,
    latestHub,
    genreStats,
    moodStats,
  ] = await Promise.all([
    Song.countDocuments(),
    Song.countDocuments(VALID_SONG_EMBEDDING),
    Album.countDocuments(VALID_ENTITY_EMBEDDING),
    Artist.countDocuments(VALID_ENTITY_EMBEDDING),
    Playlist.countDocuments({ isPublic: true, ...VALID_ENTITY_EMBEDDING }),
    Hub.countDocuments(),
    Hub.findOne().sort({ generatedAt: -1 }).select("name generatedAt").lean(),
    countEligibleCategories(Genre, "genres"),
    countEligibleCategories(Mood, "moods"),
  ]);

  return {
    songs: {
      total: totalSongs,
      withValidEmbedding: songsWithValidEmbedding,
      coveragePct:
        totalSongs > 0
          ? Math.round((songsWithValidEmbedding / totalSongs) * 100)
          : 0,
    },
    entities: {
      albums: albumsWithEmbedding,
      artists: artistsWithEmbedding,
      publicPlaylists: publicPlaylistsWithEmbedding,
    },
    categories: {
      genres: genreStats,
      moods: moodStats,
    },
    hubs: {
      count: hubCount,
      latestGeneratedAt: latestHub?.generatedAt ?? null,
      latestName: latestHub?.name ?? null,
    },
  };
};

export const printEmbeddingStats = async () => {
  const stats = await collectEmbeddingStats();

  console.log("\n=== Embedding coverage ===");
  console.log(
    `Songs: ${stats.songs.withValidEmbedding}/${stats.songs.total} (${stats.songs.coveragePct}% with 50d embedding)`,
  );
  console.log(
    `Entities: albums=${stats.entities.albums}, artists=${stats.entities.artists}, publicPlaylists=${stats.entities.publicPlaylists}`,
  );
  console.log(
    `Genres: ${stats.categories.genres.eligible}/${stats.categories.genres.total} eligible (>= ${HUB_MIN_TRACKS} valid tracks + centroid)`,
  );
  console.log(
    `Moods: ${stats.categories.moods.eligible}/${stats.categories.moods.total} eligible`,
  );
  console.log(
    `Hubs: ${stats.hubs.count} total` +
      (stats.hubs.latestGeneratedAt
        ? `, last generated "${stats.hubs.latestName}" at ${stats.hubs.latestGeneratedAt.toISOString()}`
        : ""),
  );

  return stats;
};
