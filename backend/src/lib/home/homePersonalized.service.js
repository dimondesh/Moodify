import { Song } from "../../models/song.model.js";
import { Album } from "../../models/album.model.js";
import { Artist } from "../../models/artist.model.js";
import { Playlist } from "../../models/playlist.model.js";
import { HomeFeed } from "../../models/homeFeed.model.js";
import { populatePlaylistEmbeddedSongs } from "../../controller/playlist.controller.js";
import { USER_CREATED_PLAYLIST_TYPE } from "../../constants/playlistTypes.js";
import { getRecentEntities } from "../activity/recentActivity.service.js";
import {
  orderByIds,
} from "./homeFeedGenerator.service.js";
import { enqueueHomeFeedGeneration } from "./homeFeedQueue.service.js";

const HOME_SECTION_LIMIT = 12;
const USER_PLAYLISTS_MIN_COUNT = 3;

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

const ALBUM_SONG_SELECT =
  "_id title images coverAccentHex duration playCount albumId createdAt trackNumber";

const uniqueObjectIds = (ids) => {
  const seen = new Set();
  const result = [];
  for (const id of ids || []) {
    if (!id) continue;
    const key = id.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(id);
  }
  return result;
};

const attachSongsToAlbums = async (albums) => {
  if (!albums?.length) return [];

  const albumIds = albums.map((album) => album._id);
  const songs = await Song.find({ albumId: { $in: albumIds } })
    .select(ALBUM_SONG_SELECT)
    .populate({ path: "artist", select: "name images" })
    .sort({ trackNumber: 1, createdAt: 1 })
    .lean();

  const songsByAlbumId = new Map();
  for (const song of songs) {
    if (!song.albumId) continue;
    const albumKey = song.albumId.toString();
    if (!songsByAlbumId.has(albumKey)) {
      songsByAlbumId.set(albumKey, []);
    }
    songsByAlbumId.get(albumKey).push(song);
  }

  return albums.map((album) => ({
    ...album,
    songs: songsByAlbumId.get(album._id.toString()) || [],
  }));
};

const batchHydrateHomeEntities = async ({
  songIds,
  playlistIds,
  albumIds,
  artistIds,
}) => {
  const uniqueSongIds = uniqueObjectIds(songIds);
  const uniquePlaylistIds = uniqueObjectIds(playlistIds);
  const uniqueAlbumIds = uniqueObjectIds(albumIds);
  const uniqueArtistIds = uniqueObjectIds(artistIds);

  const [songs, playlists, albums, artists] = await Promise.all([
    uniqueSongIds.length
      ? Song.find({ _id: { $in: uniqueSongIds } })
          .select(SONG_MINIMAL_SELECT)
          .populate("artist", "name images")
          .lean()
      : [],
    uniquePlaylistIds.length
      ? Playlist.find({ _id: { $in: uniquePlaylistIds } })
          .populate(populatePlaylistEmbeddedSongs)
          .lean()
      : [],
    uniqueAlbumIds.length
      ? Album.find({ _id: { $in: uniqueAlbumIds } })
          .populate("artist", "name images")
          .lean()
      : [],
    uniqueArtistIds.length
      ? Artist.find({ _id: { $in: uniqueArtistIds } })
          .select("name images")
          .lean()
      : [],
  ]);

  const albumsWithSongs = await attachSongsToAlbums(albums);

  return {
    songById: new Map(songs.map((song) => [song._id.toString(), song])),
    playlistById: new Map(
      playlists.map((playlist) => [playlist._id.toString(), playlist]),
    ),
    albumById: new Map(
      albumsWithSongs.map((album) => [album._id.toString(), album]),
    ),
    artistById: new Map(
      artists.map((artist) => [artist._id.toString(), artist]),
    ),
  };
};

const mapSongsByIds = (songIds, songById) =>
  (songIds || [])
    .map((id) => songById.get(id.toString()))
    .filter(Boolean);

const buildRecentItems = (activities, songById) =>
  (activities || []).map((activity) => {
    const itemType = activity.entityType.toLowerCase();
    const { snapshot } = activity;
    const songs = mapSongsByIds(snapshot?.songIds, songById);

    const entity = {
      _id: activity.entityId,
      itemType,
      title: snapshot?.title || "Unknown",
      images: snapshot?.images || [],
      songs,
    };

    if (itemType === "album") {
      entity.type = snapshot?.albumType;
      entity.artist = snapshot?.artists;
    } else if (itemType === "playlist") {
      entity.owner = snapshot?.owner;
      entity.type = snapshot?.playlistType;
      if (snapshot?.localizedNames) {
        entity.localizedNames = snapshot.localizedNames;
      }
    } else if (itemType === "artist") {
      entity.name = snapshot?.title;
    }

    return entity;
  });

export const getUserPlaylists = async (userId) => {
  const count = await Playlist.countDocuments({
    owner: userId,
    type: USER_CREATED_PLAYLIST_TYPE,
  });

  if (count <= USER_PLAYLISTS_MIN_COUNT) {
    return [];
  }

  return Playlist.find({
    owner: userId,
    type: USER_CREATED_PLAYLIST_TYPE,
  })
    .sort({ updatedAt: -1 })
    .limit(HOME_SECTION_LIMIT)
    .populate("owner", "fullName images")
    .populate(populatePlaylistEmbeddedSongs)
    .lean();
};

const settledValue = (result, fallback) =>
  result.status === "fulfilled" ? result.value : fallback;

export const buildPersonalizedHomeSections = async (userId, { res } = {}) => {
  const [feedResult, recentResult, playlistsResult] = await Promise.allSettled([
    HomeFeed.findOne({ userId }).lean(),
    getRecentEntities(userId, HOME_SECTION_LIMIT),
    getUserPlaylists(userId),
  ]);

  const feed = settledValue(feedResult, null);
  const recentActivities = settledValue(recentResult, []);
  const userPlaylists = settledValue(playlistsResult, []);

  if (!feed) {
    enqueueHomeFeedGeneration(userId);
  }

  const quickPickIds = feed?.quickPicks?.songIds ?? [];
  if (!feed || quickPickIds.length === 0) {
    if (res) res.locals.skipCache = true;
  }

  if (feedResult.status === "rejected") {
    console.error("[home] HomeFeed read failed:", feedResult.reason);
  }
  if (recentResult.status === "rejected") {
    console.error("[home] RecentActivity read failed:", recentResult.reason);
  }
  if (playlistsResult.status === "rejected") {
    console.error("[home] User playlists read failed:", playlistsResult.reason);
  }

  const madeForYouIds = feed?.madeForYou?.playlistIds ?? [];
  const topMixIds = feed?.yourTopMixes?.playlistIds ?? [];
  const albumIds = feed?.albumsYouMightLike?.albumIds ?? [];
  const artistIds = feed?.artistsYouMightLike?.artistIds ?? [];

  const recentSongIds = recentActivities.flatMap(
    (activity) => activity.snapshot?.songIds ?? [],
  );

  const { songById, playlistById, albumById, artistById } =
    await batchHydrateHomeEntities({
      songIds: [...quickPickIds, ...recentSongIds],
      playlistIds: [...madeForYouIds, ...topMixIds],
      albumIds,
      artistIds,
    });

  const quickPicks = orderByIds(
    [...songById.values()],
    quickPickIds,
  );

  const madeForYouPlaylists = orderByIds(
    [...playlistById.values()],
    madeForYouIds,
  );

  const topMixPlaylists = orderByIds(
    [...playlistById.values()],
    topMixIds,
  );

  const albums = orderByIds([...albumById.values()], albumIds).map((album) => ({
    ...album,
    itemType: "album",
  }));

  const artists = orderByIds([...artistById.values()], artistIds).map(
    (artist) => ({
      ...artist,
      itemType: "artist",
    }),
  );

  const recentlyListened = buildRecentItems(recentActivities, songById);

  return [
    { id: "quickPicks", items: quickPicks },
    {
      id: "madeForYou",
      items: madeForYouPlaylists.map((playlist) => ({
        ...playlist,
        itemType: "playlist",
      })),
    },
    { id: "recentlyListened", items: recentlyListened },
    {
      id: "yourTopMixes",
      items: topMixPlaylists.map((playlist) => ({
        ...playlist,
        itemType: "playlist",
      })),
    },
    { id: "albumsYouMightLike", items: albums },
    { id: "artistsYouMightLike", items: artists },
    {
      id: "yourPlaylists",
      items: userPlaylists.map((playlist) => ({
        ...playlist,
        itemType: "playlist",
      })),
    },
  ];
};

export const getPersonalizedHomeData = async (userId, options = {}) => ({
  mode: "personalized",
  sections: await buildPersonalizedHomeSections(userId, options),
});
