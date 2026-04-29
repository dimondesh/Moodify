import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Artist } from "../models/artist.model.js";
import { User } from "../models/user.model.js";
import { Mix } from "../models/mix.model.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId imageUrl duration playCount";

export const searchSongs = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json({
        songs: [],
        albums: [],
        playlists: [],
        artists: [],
        users: [],
        mixes: [],
      });
    }

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

    const [songsRaw, albumsRaw, playlistsRaw, usersRaw, mixesRaw] =
      await Promise.all([
        Song.find({
          $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
        })
          .select(SONG_MINIMAL_SELECT)
          .populate("artist", "name imageUrl")
          .populate("albumId", "title imageUrl")
          .limit(50)
          .lean(),

        Album.find({
          $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
        })
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
          $or: [{ title: regex }, { description: regex }],
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

        Mix.find({ searchableNames: regex })
          .populate({
            path: "songs",
            select: SONG_MINIMAL_SELECT,
            populate: { path: "artist", select: "name imageUrl" },
          })
          .limit(50)
          .lean(),
      ]);

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
      // Фолбэки, так как мы их не отдаем
      genres: [],
      moods: [],
    });

    const songs = songsRaw.map((song) => ({
      ...formatSong(song),
      albumTitle: song.albumId?.title || null,
      albumImageUrl: song.albumId?.imageUrl || null,
    }));

    const albums = albumsRaw.map((album) => ({
      ...album,
      _id: album._id.toString(),
      songs: album.songs ? album.songs.map(formatSong) : [],
    }));

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

    const artists = matchingArtists.map((artist) => ({
      ...artist,
      _id: artist._id.toString(),
    }));

    const users = usersRaw.map((user) => ({
      _id: user._id.toString(),
      fullName: user.fullName,
      imageUrl: user.imageUrl,
      type: "user",
    }));

    const mixes = mixesRaw.map((mix) => ({
      ...mix,
      _id: mix._id.toString(),
      songs: mix.songs ? mix.songs.map(formatSong) : [],
    }));

    return res.json({ songs, albums, playlists, artists, users, mixes });
  } catch (error) {
    next(error);
  }
};
