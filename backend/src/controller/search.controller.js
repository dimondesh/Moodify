// backend/src/controller/search.controller.js

import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Artist } from "../models/artist.model.js";
import { User } from "../models/user.model.js";
import { Mix } from "../models/mix.model.js";

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

    const matchingArtists = await Artist.find({ name: regex }).limit(50).lean();
    const matchingArtistIds = matchingArtists.map((artist) => artist._id);

    const [songsRaw, albumsRaw, playlistsRaw, usersRaw, mixesRaw] =
      await Promise.all([
        Song.find({
          $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
        })
          .populate("artist", "name imageUrl")
          .populate("albumId", "title imageUrl")
          .limit(50)
          .lean(),

        Album.find({
          $or: [{ title: regex }, { artist: { $in: matchingArtistIds } }],
        })
          .populate("artist", "name imageUrl")
          .limit(50)
          .lean(),

        Playlist.find({
          isPublic: true,
          $or: [{ title: regex }, { description: regex }],
        })
          .populate("owner", "fullName")
          .limit(50)
          .lean(),

        User.find({ fullName: regex })
          .limit(50)
          .select("fullName imageUrl")
          .lean(),

        Mix.find({ searchableNames: regex }).limit(50).lean(),
      ]);
    const songs = songsRaw.map((song) => ({
      ...song,
      albumId: song.albumId ? song.albumId._id.toString() : null,
      albumTitle: song.albumId ? song.albumId.title : null,
      albumImageUrl: song.albumId ? song.albumId.imageUrl : null,
      _id: song._id.toString(),
    }));

    const albums = albumsRaw.map((album) => ({
      ...album,
      _id: album._id.toString(),
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
      songs: playlist.songs ? playlist.songs.map((s) => s.toString()) : [],
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
    }));

    return res.json({ songs, albums, playlists, artists, users, mixes });
  } catch (error) {
    console.error("Search controller error:", error);
    next(error);
  }
};
