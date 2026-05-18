import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Artist } from "../models/artist.model.js";
import { User } from "../models/user.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl coverAccentHex duration playCount";

const TOP_RESULTS_LIMIT = 4;
const CATEGORY_DEFAULT_LIMIT = 10;
const CATEGORY_MAX_LIMIT = 50;

const formatSong = (song) => ({
  ...song,
  _id: song._id.toString(),
  albumId: song.albumId?._id
    ? song.albumId._id.toString()
    : song.albumId
      ? song.albumId.toString()
      : null,
  artist: song.artist
    ? song.artist.map((a) => ({ ...a, _id: a._id.toString() }))
    : [],
  genres: [],
  moods: [],
});

const formatSongWithAlbum = (song) => ({
  ...formatSong(song),
  albumTitle: song.albumId?.title || null,
  albumImageUrl: song.albumId?.imageUrl || null,
});

const formatAlbum = (album) => ({
  ...album,
  _id: album._id.toString(),
  songs: album.songs ? album.songs.map(formatSong) : [],
});

const formatArtist = (artist) => ({
  ...artist,
  _id: artist._id.toString(),
});

async function getSearchContext(q) {
  const regex = new RegExp(q.trim(), "i");
  const matchingArtists = await Artist.find({ name: regex })
    .populate({
      path: "songs",
      select: SONG_MINIMAL_SELECT,
      populate: { path: "artist", select: "name imageUrl" },
      options: { sort: { playCount: -1 }, limit: 5 },
    })
    .limit(50)
    .lean();

  const matchingArtistIds = matchingArtists.map((artist) => artist._id);

  const songMatch = {
    $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
  };
  const albumMatch = {
    $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
  };
  const artistMatch = { name: regex };

  return {
    regex,
    matchingArtists,
    matchingArtistIds,
    songMatch,
    albumMatch,
    artistMatch,
  };
}

/** Mix songs, albums, and artists in top results (not songs-only). */
function buildTopResults(songs, albums, artists, limit = TOP_RESULTS_LIMIT) {
  const pools = [
    { kind: "song", items: [...songs] },
    { kind: "album", items: [...albums] },
    { kind: "artist", items: [...artists] },
  ].filter((pool) => pool.items.length > 0);

  const topResults = [];
  let poolIndex = 0;
  let guard = 0;

  while (
    topResults.length < limit &&
    pools.some((pool) => pool.items.length > 0) &&
    guard < limit * pools.length
  ) {
    const pool = pools[poolIndex % pools.length];
    if (pool.items.length > 0) {
      const item = pool.items.shift();
      if (pool.kind === "song") {
        topResults.push({ kind: "song", ...formatSongWithAlbum(item) });
      } else if (pool.kind === "album") {
        topResults.push({ kind: "album", ...formatAlbum(item) });
      } else {
        topResults.push({ kind: "artist", ...formatArtist(item) });
      }
    }
    poolIndex += 1;
    guard += 1;
  }

  return topResults;
}

async function handleSearchPreview(q, res) {
  const { songMatch, albumMatch, artistMatch, matchingArtists } =
    await getSearchContext(q);

  const [
    songsRaw,
    albumsRaw,
    artistsFromName,
    songCount,
    albumCount,
    artistCount,
  ] = await Promise.all([
    Song.find(songMatch)
      .select(SONG_MINIMAL_SELECT)
      .populate("artist", "name imageUrl")
      .populate("albumId", "title imageUrl")
      .sort({ playCount: -1 })
      .limit(TOP_RESULTS_LIMIT)
      .lean(),
    Album.find(albumMatch)
      .populate("artist", "name imageUrl")
      .sort({ releaseYear: -1 })
      .limit(TOP_RESULTS_LIMIT)
      .lean(),
    Artist.find(artistMatch).limit(TOP_RESULTS_LIMIT).lean(),
    Song.countDocuments(songMatch),
    Album.countDocuments(albumMatch),
    Artist.countDocuments(artistMatch),
  ]);

  const artists = artistsFromName.length
    ? artistsFromName
    : matchingArtists.slice(0, TOP_RESULTS_LIMIT);

  const topResults = buildTopResults(songsRaw, albumsRaw, artists);

  return res.json({
    topResults,
    counts: {
      songs: songCount,
      albums: albumCount,
      artists: artistCount,
    },
  });
}

async function handleSearchByType(q, type, limit, res) {
  const { songMatch, albumMatch, artistMatch } = await getSearchContext(q);

  if (type === "songs") {
    const songsRaw = await Song.find(songMatch)
      .select(SONG_MINIMAL_SELECT)
      .populate("artist", "name imageUrl")
      .populate("albumId", "title imageUrl")
      .sort({ playCount: -1 })
      .limit(limit)
      .lean();
    return res.json({
      songs: songsRaw.map(formatSongWithAlbum),
    });
  }

  if (type === "albums") {
    const albumsRaw = await Album.find(albumMatch)
      .populate("artist", "name imageUrl")
      .sort({ releaseYear: -1 })
      .limit(limit)
      .lean();
    return res.json({
      albums: albumsRaw.map(formatAlbum),
    });
  }

  if (type === "artists") {
    const artistsRaw = await Artist.find(artistMatch)
      .sort({ name: 1 })
      .limit(limit)
      .lean();
    return res.json({
      artists: artistsRaw.map(formatArtist),
    });
  }

  return res.status(400).json({ message: "Invalid search type" });
}

export const searchSongs = async (req, res, next) => {
  try {
    const { q, preview, type, limit: limitParam } = req.query;

    if (!q || q.trim() === "") {
      if (preview === "1" || preview === "true") {
        return res.json({
          topResults: [],
          counts: { songs: 0, albums: 0, artists: 0 },
        });
      }
      if (type) {
        const empty = { songs: [], albums: [], artists: [] };
        return res.json(empty);
      }
      return res.json({
        songs: [],
        albums: [],
        playlists: [],
        artists: [],
        users: [],
      });
    }

    if (preview === "1" || preview === "true") {
      return handleSearchPreview(q, res);
    }

    if (type) {
      const parsedLimit = Math.min(
        Math.max(parseInt(limitParam, 10) || CATEGORY_DEFAULT_LIMIT, 1),
        CATEGORY_MAX_LIMIT,
      );
      return handleSearchByType(q, type, parsedLimit, res);
    }

    const {
      regex,
      matchingArtists,
      matchingArtistIds,
      songMatch,
      albumMatch,
    } = await getSearchContext(q);

    const [songsRaw, albumsRaw, playlistsRaw, usersRaw] = await Promise.all([
      Song.find(songMatch)
        .select(SONG_MINIMAL_SELECT)
        .populate("artist", "name imageUrl")
        .populate("albumId", "title imageUrl")
        .limit(50)
        .lean(),

      Album.find(albumMatch)
        .populate("artist", "name imageUrl")
        .populate({
          path: "songs",
          select: SONG_MINIMAL_SELECT,
          populate: { path: "artist", select: "name imageUrl" },
        })
        .limit(50)
        .lean(),

      Playlist.find({
        isPublic: true,
        $or: [
          { title: regex },
          { description: regex },
          { searchableNames: regex },
        ],
      })
        .populate("owner", "fullName")
        .populate({
          path: "songs",
          select: SONG_MINIMAL_SELECT,
          populate: { path: "artist", select: "name imageUrl" },
        })
        .limit(50)
        .lean(),

      User.find({ fullName: regex })
        .limit(50)
        .select("fullName imageUrl")
        .lean(),
    ]);

    const songs = songsRaw.map(formatSongWithAlbum);
    const albums = albumsRaw.map(formatAlbum);
    const playlists = playlistsRaw.map((playlist) => ({
      ...playlist,
      _id: playlist._id.toString(),
      owner: playlist.owner
        ? {
            _id: playlist.owner._id.toString(),
            fullName: playlist.owner.fullName,
          }
        : null,
      songs: playlist.songs ? playlist.songs.map(formatSong) : [],
    }));
    const artists = matchingArtists.map(formatArtist);
    const users = usersRaw.map((user) => ({
      _id: user._id.toString(),
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      type: "user",
    }));

    return res.json({ songs, albums, playlists, artists, users });
  } catch (error) {
    next(error);
  }
};
