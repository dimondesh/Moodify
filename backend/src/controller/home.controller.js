import {
  getQuickPicks,
  getTrendingSongs,
  getMadeForYouSongs,
  getListenHistory,
} from "./song.controller.js";
import { getTrendingAlbums } from "./album.controller.js";
import {
  getFavoriteArtists,
  getNewReleases,
  getPlaylistRecommendations,
} from "./user.controller.js";
import { Playlist } from "../models/playlist.model.js";
import { buildLibrarySummaryForUser } from "./library.controller.js";
import { populatePlaylistEmbeddedSongs } from "./playlist.controller.js";

const HOME_SECTION_LIMIT = 12;

export const getPrimaryHomePageData = async (req, res, next) => {
  try {
    const featuredSongs = await getQuickPicks(req, res, next, true, 8);
    res.status(200).json({ featuredSongs });
  } catch (error) {
    next(error);
  }
};

export const getSecondaryHomePageData = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    // Берем публичные миксы (Жанры и Настроения) из единой таблицы Playlist
    const publicMixesPromise = Playlist.find({
      type: { $in: ["GENRE_MIX", "MOOD_MIX"] },
      isPublic: true,
    })
      .limit(HOME_SECTION_LIMIT)
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    // Обычные публичные плейлисты юзеров
    const publicPlaylistsPromise = Playlist.find({
      type: "USER_CREATED",
      isPublic: true,
    })
      .limit(HOME_SECTION_LIMIT)
      .populate("owner", "fullName")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    const commonPromises = [
      getTrendingSongs(req, res, next, true, HOME_SECTION_LIMIT),
      publicMixesPromise,
      publicPlaylistsPromise,
    ];

    let userSpecificPromises = [];
    if (userId) {
      // Ищем сгенерированные подборки чисто для этого юзера (Discover Weekly, On Repeat, Daily Mix)
      const userPlaylistsPromise = Playlist.find({
        owner: userId,
        type: {
          $in: [
            "PERSONAL_MIX",
            "ON_REPEAT",
            "DISCOVER_WEEKLY",
            "ON_REPEAT_REWIND",
          ],
        },
      })
        .limit(HOME_SECTION_LIMIT)
        .populate(populatePlaylistEmbeddedSongs)
        .lean();

      userSpecificPromises = [
        getMadeForYouSongs(req, res, next, true, HOME_SECTION_LIMIT),
        getListenHistory(req, res, next, true, HOME_SECTION_LIMIT),
        getFavoriteArtists(req, res, next, true, HOME_SECTION_LIMIT),
        getNewReleases(req, res, next, true, HOME_SECTION_LIMIT),
        getPlaylistRecommendations(req, res, next, true, HOME_SECTION_LIMIT),
        userPlaylistsPromise,
      ];
    }

    const [trendingSongs, publicMixes, publicPlaylists] =
      await Promise.all(commonPromises);

    const secondaryData = {
      trendingSongs,
      genreMixes: publicMixes.filter((p) => p.type === "GENRE_MIX"),
      moodMixes: publicMixes.filter((p) => p.type === "MOOD_MIX"),
      publicPlaylists,
      allGeneratedPlaylists: [],
      madeForYouSongs: [],
      recentlyListenedSongs: [],
      favoriteArtists: [],
      newReleases: [],
      recommendedPlaylists: [],
    };

    if (userId && userSpecificPromises.length > 0) {
      const [
        madeForYouSongs,
        recentlyListened,
        favoriteArtists,
        newReleases,
        recommendedPlaylists,
        userPlaylists,
      ] = await Promise.all(userSpecificPromises);

      secondaryData.madeForYouSongs = madeForYouSongs;
      secondaryData.recentlyListenedSongs = recentlyListened.songs || [];
      secondaryData.favoriteArtists = favoriteArtists;
      secondaryData.newReleases = newReleases;
      secondaryData.recommendedPlaylists = recommendedPlaylists;
      secondaryData.allGeneratedPlaylists = userPlaylists; // Отправляем все умные плейлисты на фронт
    }

    res.status(200).json(secondaryData);
  } catch (error) {
    next(error);
  }
};

export const getBootstrapData = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    const publicMixesPromise = Playlist.find({
      type: { $in: ["GENRE_MIX", "MOOD_MIX"] },
      isPublic: true,
    })
      .limit(HOME_SECTION_LIMIT)
      .populate(populatePlaylistEmbeddedSongs)
      .lean();
    const publicPlaylistsPromise = Playlist.find({
      type: "USER_CREATED",
      isPublic: true,
    })
      .limit(HOME_SECTION_LIMIT)
      .populate("owner", "fullName")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    const commonPromises = [
      getQuickPicks(req, res, next, true, 8),
      getTrendingAlbums(req, res, next, true, HOME_SECTION_LIMIT),
      publicMixesPromise,
      publicPlaylistsPromise,
    ];

    let userSpecificPromises = [];
    if (userId) {
      const userPlaylistsPromise = Playlist.find({
        owner: userId,
        type: {
          $in: [
            "PERSONAL_MIX",
            "ON_REPEAT",
            "DISCOVER_WEEKLY",
            "ON_REPEAT_REWIND",
          ],
        },
      })
        .limit(HOME_SECTION_LIMIT)
        .populate(populatePlaylistEmbeddedSongs)
        .lean();

      userSpecificPromises = [
        getMadeForYouSongs(req, res, next, true, HOME_SECTION_LIMIT),
        getListenHistory(req, res, next, true, HOME_SECTION_LIMIT),
        getFavoriteArtists(req, res, next, true, HOME_SECTION_LIMIT),
        getNewReleases(req, res, next, true, HOME_SECTION_LIMIT),
        getPlaylistRecommendations(req, res, next, true, HOME_SECTION_LIMIT),
        getOptimizedLibrarySummary(userId),
        userPlaylistsPromise,
      ];
    }

    const [featuredSongs, trendingAlbums, publicMixes, publicPlaylists] =
      await Promise.all(commonPromises);

    const bootstrapData = {
      featuredSongs,
      trendingAlbums,
      genreMixes: publicMixes.filter((p) => p.type === "GENRE_MIX"),
      moodMixes: publicMixes.filter((p) => p.type === "MOOD_MIX"),
      personalMixes: [],
      publicPlaylists,
      allGeneratedPlaylists: [],
      madeForYouSongs: [],
      recentlyListenedSongs: [],
      favoriteArtists: [],
      newReleases: [],
      recommendedPlaylists: [],
      library: {
        albums: [],
        likedSongs: [],
        playlists: [],
        followedArtists: [],
      },
    };

    if (userId && userSpecificPromises.length > 0) {
      const [
        madeForYouSongs,
        recentlyListened,
        favoriteArtists,
        newReleases,
        recommendedPlaylists,
        librarySummary,
        userPlaylists,
      ] = await Promise.all(userSpecificPromises);

      bootstrapData.personalMixes = userPlaylists.filter(
        (p) => p.type === "PERSONAL_MIX",
      );
      bootstrapData.allGeneratedPlaylists = userPlaylists.filter(
        (p) => p.type !== "PERSONAL_MIX",
      );
      bootstrapData.madeForYouSongs = madeForYouSongs;
      bootstrapData.recentlyListenedSongs = recentlyListened.songs || [];
      bootstrapData.favoriteArtists = favoriteArtists;
      bootstrapData.newReleases = newReleases;
      bootstrapData.recommendedPlaylists = recommendedPlaylists;
      bootstrapData.library = librarySummary;
    }

    res.status(200).json(bootstrapData);
  } catch (error) {
    next(error);
  }
};

// Очищенная от удаленных моделей агрегация
async function getOptimizedLibrarySummary(userId) {
  return buildLibrarySummaryForUser(userId);
}
