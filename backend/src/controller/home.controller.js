// backend/src/controller/home.controller.js

import mongoose from "mongoose";
import {
  getQuickPicks,
  getTrendingSongs,
  getMadeForYouSongs,
  getListenHistory,
} from "./song.controller.js";
import { getTrendingAlbums } from "./album.controller.js";
import { getDailyMixes } from "./mix.controller.js";
import { getPublicPlaylists } from "./playlist.controller.js";
import {
  getFavoriteArtists,
  getNewReleases,
  getPlaylistRecommendations,
} from "./user.controller.js";
import { getMyGeneratedPlaylists } from "./generatedPlaylist.controller.js";
import { getPersonalMixes } from "./personalMix.controller.js";
import { Library } from "../models/library.model.js";

const HOME_SECTION_LIMIT = 12;

export const getPrimaryHomePageData = async (req, res, next) => {
  try {
    const featuredSongs = await getQuickPicks(req, res, next, true, 8);
    res.status(200).json({ featuredSongs });
  } catch (error) {
    console.error("Error fetching primary homepage data:", error);
    next(error);
  }
};

export const getSecondaryHomePageData = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    const commonPromises = [
      getTrendingSongs(req, res, next, true, HOME_SECTION_LIMIT),
      getDailyMixes(req, res, next, true, HOME_SECTION_LIMIT),
      getPublicPlaylists(req, res, next, true, HOME_SECTION_LIMIT),
      getMyGeneratedPlaylists(req, res, next, true, HOME_SECTION_LIMIT),
    ];

    const userSpecificPromises = userId
      ? [
          getMadeForYouSongs(req, res, next, true, HOME_SECTION_LIMIT),
          getListenHistory(req, res, next, true, HOME_SECTION_LIMIT),
          getFavoriteArtists(req, res, next, true, HOME_SECTION_LIMIT),
          getNewReleases(req, res, next, true, HOME_SECTION_LIMIT),
          getPlaylistRecommendations(req, res, next, true, HOME_SECTION_LIMIT),
        ]
      : [];

    const [trendingSongs, mixesData, publicPlaylists, allGeneratedPlaylists] =
      await Promise.all(commonPromises);

    const secondaryData = {
      trendingSongs,
      genreMixes: mixesData.genreMixes,
      moodMixes: mixesData.moodMixes,
      publicPlaylists,
      allGeneratedPlaylists,
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
      ] = await Promise.all(userSpecificPromises);

      secondaryData.madeForYouSongs = madeForYouSongs;
      secondaryData.recentlyListenedSongs = recentlyListened.songs;
      secondaryData.favoriteArtists = favoriteArtists;
      secondaryData.newReleases = newReleases;
      secondaryData.recommendedPlaylists = recommendedPlaylists;
    }

    res.status(200).json(secondaryData);
  } catch (error) {
    console.error("Error fetching secondary homepage data:", error);
    next(error);
  }
};

export const getBootstrapData = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    const promises = [
      getQuickPicks(req, res, next, true, 8),

      getTrendingAlbums(req, res, next, true, HOME_SECTION_LIMIT),

      getDailyMixes(req, res, next, true, HOME_SECTION_LIMIT),

      getPersonalMixes(req, res, next, true),

      getPublicPlaylists(req, res, next, true, HOME_SECTION_LIMIT),

      getMyGeneratedPlaylists(req, res, next, true, HOME_SECTION_LIMIT),

      getMadeForYouSongs(req, res, next, true, HOME_SECTION_LIMIT),
      getListenHistory(req, res, next, true, HOME_SECTION_LIMIT),
      getFavoriteArtists(req, res, next, true, HOME_SECTION_LIMIT),
      getNewReleases(req, res, next, true, HOME_SECTION_LIMIT),
      getPlaylistRecommendations(req, res, next, true, HOME_SECTION_LIMIT),

      getOptimizedLibrarySummary(userId),
    ];

    const [
      featuredSongs,
      trendingAlbums,
      mixesData,
      personalMixes,
      publicPlaylists,
      allGeneratedPlaylists,
      madeForYouSongs,
      recentlyListened,
      favoriteArtists,
      newReleases,
      recommendedPlaylists,
      librarySummary,
    ] = await Promise.all(promises);

    const bootstrapData = {
      featuredSongs,
      trendingAlbums,
      genreMixes: mixesData.genreMixes,
      moodMixes: mixesData.moodMixes,
      personalMixes,
      publicPlaylists,
      allGeneratedPlaylists,
      madeForYouSongs,
      recentlyListenedSongs: recentlyListened.songs,
      favoriteArtists,
      newReleases,
      recommendedPlaylists,
      library: librarySummary,
    };

    res.status(200).json(bootstrapData);
  } catch (error) {
    console.error("Error fetching bootstrap data:", error);
    next(error);
  }
};

async function getOptimizedLibrarySummary(userId) {
  const objectId = new mongoose.Types.ObjectId(userId);

  const libraryData = await Library.aggregate([
    { $match: { userId: objectId } },

    {
      $lookup: {
        from: "albums",
        localField: "albums.albumId",
        foreignField: "_id",
        as: "albumDetails",
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "likedSongs.songId",
        foreignField: "_id",
        as: "songDetails",
      },
    },
    {
      $lookup: {
        from: "playlists",
        localField: "playlists.playlistId",
        foreignField: "_id",
        as: "playlistDetails",
      },
    },
    {
      $lookup: {
        from: "artists",
        localField: "followedArtists.artistId",
        foreignField: "_id",
        as: "artistDetails",
      },
    },
    {
      $lookup: {
        from: "mixes",
        localField: "savedMixes.mixId",
        foreignField: "_id",
        as: "mixDetails",
      },
    },
    {
      $lookup: {
        from: "personalmixes",
        localField: "savedPersonalMixes.personalMixId",
        foreignField: "_id",
        as: "personalMixDetails",
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "mixDetails.songs",
        foreignField: "_id",
        as: "mixSongs",
        pipeline: [
          {
            $lookup: {
              from: "artists",
              localField: "artist",
              foreignField: "_id",
              as: "artist",
              pipeline: [{ $project: { name: 1, imageUrl: 1 } }],
            },
          },
          { $unwind: "$artist" },
          {
            $project: {
              title: 1,
              artist: 1,
              albumId: 1,
              imageUrl: 1,
              hlsUrl: 1,
              duration: 1,
              playCount: 1,
              genres: 1,
              moods: 1,
              lyrics: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "songs",
        localField: "personalMixDetails.songs",
        foreignField: "_id",
        as: "personalMixSongs",
        pipeline: [
          {
            $lookup: {
              from: "artists",
              localField: "artist",
              foreignField: "_id",
              as: "artist",
              pipeline: [{ $project: { name: 1, imageUrl: 1 } }],
            },
          },
          { $unwind: "$artist" },
          {
            $project: {
              title: 1,
              artist: 1,
              albumId: 1,
              imageUrl: 1,
              hlsUrl: 1,
              duration: 1,
              playCount: 1,
              genres: 1,
              moods: 1,
              lyrics: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "generatedplaylists",
        localField: "savedGeneratedPlaylists.playlistId",
        foreignField: "_id",
        as: "genPlaylistDetails",
      },
    },
    {
      $lookup: {
        from: "artists",
        localField: "albumDetails.artist",
        foreignField: "_id",
        as: "albumArtists",
      },
    },
    {
      $lookup: {
        from: "artists",
        localField: "songDetails.artist",
        foreignField: "_id",
        as: "songArtists",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "playlistDetails.owner",
        foreignField: "_id",
        as: "playlistOwners",
      },
    },

    {
      $project: {
        _id: 0,
        albums: {
          $map: {
            input: "$albumDetails",
            as: "album",
            in: {
              $mergeObjects: [
                "$$album",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$albums",
                                as: "a",
                                cond: { $eq: ["$$a.albumId", "$$album._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                  artist: {
                    $filter: {
                      input: "$albumArtists",
                      as: "art",
                      cond: { $in: ["$$art._id", "$$album.artist"] },
                    },
                  },
                },
              ],
            },
          },
        },
        likedSongs: {
          $map: {
            input: "$songDetails",
            as: "song",
            in: {
              $mergeObjects: [
                "$$song",
                {
                  likedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$likedSongs",
                                as: "s",
                                cond: { $eq: ["$$s.songId", "$$song._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                  artist: {
                    $filter: {
                      input: "$songArtists",
                      as: "art",
                      cond: { $in: ["$$art._id", "$$song.artist"] },
                    },
                  },
                },
              ],
            },
          },
        },
        playlists: {
          $map: {
            input: "$playlistDetails",
            as: "pl",
            in: {
              $mergeObjects: [
                "$$pl",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$playlists",
                                as: "p",
                                cond: { $eq: ["$$p.playlistId", "$$pl._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                  owner: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$playlistOwners",
                          as: "owner",
                          cond: { $eq: ["$$owner._id", "$$pl.owner"] },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
        followedArtists: {
          $map: {
            input: "$artistDetails",
            as: "artist",
            in: {
              $mergeObjects: [
                "$$artist",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$followedArtists",
                                as: "fa",
                                cond: {
                                  $eq: ["$$fa.artistId", "$$artist._id"],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                },
              ],
            },
          },
        },
        savedMixes: {
          $map: {
            input: "$mixDetails",
            as: "mix",
            in: {
              $mergeObjects: [
                "$$mix",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$savedMixes",
                                as: "sm",
                                cond: { $eq: ["$$sm.mixId", "$$mix._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                  songs: {
                    $filter: {
                      input: "$mixSongs",
                      as: "song",
                      cond: { $in: ["$$song._id", "$$mix.songs"] },
                    },
                  },
                },
              ],
            },
          },
        },
        savedPersonalMixes: {
          $map: {
            input: "$personalMixDetails",
            as: "personalMix",
            in: {
              $mergeObjects: [
                "$$personalMix",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$savedPersonalMixes",
                                as: "spm",
                                cond: {
                                  $eq: [
                                    "$$spm.personalMixId",
                                    "$$personalMix._id",
                                  ],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                  songs: {
                    $filter: {
                      input: "$personalMixSongs",
                      as: "song",
                      cond: { $in: ["$$song._id", "$$personalMix.songs"] },
                    },
                  },
                },
              ],
            },
          },
        },
        generatedPlaylists: {
          $map: {
            input: "$genPlaylistDetails",
            as: "gp",
            in: {
              $mergeObjects: [
                "$$gp",
                {
                  addedAt: {
                    $let: {
                      vars: {
                        libItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$savedGeneratedPlaylists",
                                as: "sgp",
                                cond: { $eq: ["$$sgp.playlistId", "$$gp._id"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: "$$libItem.addedAt",
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);

  if (libraryData.length === 0) {
    return {
      albums: [],
      likedSongs: [],
      playlists: [],
      followedArtists: [],
      savedMixes: [],
      savedPersonalMixes: [],
      generatedPlaylists: [],
    };
  }

  const finalData = libraryData[0];
  if (finalData.playlists) {
    finalData.playlists.forEach((pl) => {
      if (pl.owner) {
        pl.owner = {
          _id: pl.owner._id,
          fullName: pl.owner.fullName,
          imageUrl: pl.owner.imageUrl,
        };
      }
    });
  }

  return finalData;
}
