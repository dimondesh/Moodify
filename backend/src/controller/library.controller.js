import mongoose from "mongoose";
import { Library } from "../models/library.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Song } from "../models/song.model.js";
import { Artist } from "../models/artist.model.js";
import { Mix } from "../models/mix.model.js";
import { User } from "../models/user.model.js";
import { GeneratedPlaylist } from "../models/generatedPlaylist.model.js";

export const getLibraryAlbums = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const library = await Library.findOne({ userId }).populate(
      "albums.albumId"
    );

    if (!library) {
      return res.json({ albums: [] });
    }

    if (!library.albums) {
      library.albums = [];
    }

    const albums = library.albums
      .filter((a) => a.albumId && a.albumId._doc)
      .map((a) => ({
        ...a.albumId._doc,
        addedAt: a.addedAt,
      }))
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );

    res.json({ albums });
  } catch (err) {
    console.error("❌ Error in getLibraryAlbums:", err);
    next(err);
  }
};

export const getLikedSongs = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const library = await Library.findOne({ userId })
      .populate({
        path: "likedSongs.songId",
        model: "Song",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name imageUrl",
        },
      })
      .lean();

    if (!library) {
      return res.json({ songs: [] });
    }

    if (!library.likedSongs) {
      library.likedSongs = [];
    }

    const songs = library.likedSongs
      .filter((item) => item.songId)
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      )
      .map((item) => ({
        ...item.songId,
        likedAt: item.addedAt,
      }));

    res.json({ songs });
  } catch (err) {
    console.error("❌ Error in getLikedSongs:", err);
    next(err);
  }
};

export const toggleAlbumInLibrary = async (req, res, next) => {
  try {
    console.log("▶️ toggleAlbumInLibrary called with:", req.body);

    const userId = req.user?.id;
    console.log("UserId from req.user:", userId);
    const { albumId } = req.body;

    if (!userId || !albumId) {
      return res.status(400).json({ message: "Missing userId or albumId" });
    }

    if (!mongoose.Types.ObjectId.isValid(albumId)) {
      return res.status(400).json({ message: "Invalid albumId format" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.albums) {
      library.albums = [];
    }

    const exists = library.albums.some(
      (a) => a.albumId?.toString() === albumId
    );

    if (exists) {
      library.albums = library.albums.filter(
        (a) => a.albumId?.toString() !== albumId
      );
    } else {
      library.albums.push({
        albumId: new mongoose.Types.ObjectId(albumId),
        addedAt: new Date(),
      });
    }

    await library.save();

    res.json({ success: true, isAdded: !exists });
  } catch (err) {
    console.error("❌ toggleAlbumInLibrary error:", err);
    next(err);
  }
};

export const toggleSongLikeInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { songId } = req.body;

    if (!userId || !songId) {
      return res.status(400).json({ message: "Missing userId or songId" });
    }

    if (!mongoose.Types.ObjectId.isValid(songId)) {
      return res.status(400).json({ message: "Invalid songId format" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.likedSongs) {
      library.likedSongs = [];
    }

    const exists = library.likedSongs.some(
      (s) => s.songId?.toString() === songId
    );

    let isLikedStatus;

    if (exists) {
      library.likedSongs = library.likedSongs.filter(
        (s) => s.songId?.toString() !== songId
      );
      isLikedStatus = false;
    } else {
      library.likedSongs.push({
        songId: new mongoose.Types.ObjectId(songId),
        addedAt: new Date(),
      });
      isLikedStatus = true;
    }

    await library.save();

    res.json({ success: true, isLiked: isLikedStatus });
  } catch (err) {
    console.error("❌ toggleSongLikeInLibrary error:", err);
    next(err);
  }
};

export const getPlaylistsInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    console.log("UserId from req.user (in getPlaylistsInLibrary):", userId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const library = await Library.findOne({ userId }).populate({
      path: "playlists.playlistId",
      model: "Playlist",
      match: { isPublic: true },

      populate: {
        path: "owner",
        select: "fullName imageUrl",
      },
    });

    if (!library) {
      return res.json({ playlists: [] });
    }

    if (!library.playlists) {
      library.playlists = [];
    }

    const playlists = library.playlists
      .filter((item) => item.playlistId && item.playlistId._doc)
      .map((item) => ({
        ...item.playlistId._doc,
        addedAt: item.addedAt,
      }))
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );

    res.json({ playlists });
  } catch (err) {
    console.error("❌ Error in getPlaylistsInLibrary:", err);
    next(err);
  }
};

export const togglePlaylistInLibrary = async (req, res, next) => {
  try {
    console.log("▶️ togglePlaylistInLibrary called with:", req.body);

    const userId = req.user?.id;
    console.log("UserId from req.user:", userId);
    const { playlistId } = req.body;
    const playlistToUpdate = await Playlist.findById(playlistId);

    if (!userId || !playlistId) {
      return res.status(400).json({ message: "Missing userId or playlistId" });
    }

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({ message: "Invalid playlistId format" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.playlists) {
      library.playlists = [];
    }

    const exists = library.playlists.some(
      (p) => p.playlistId?.toString() === playlistId
    );

    let message;
    let isAdded;

    if (exists) {
      library.playlists = library.playlists.filter(
        (p) => p.playlistId?.toString() !== playlistId
      );
      message = "Playlist removed from library";
      isAdded = false;
      if (playlistToUpdate.likes > 0) {
        playlistToUpdate.likes -= 1;
      }
    } else {
      library.playlists.push({
        playlistId: new mongoose.Types.ObjectId(playlistId),
        addedAt: new Date(),
      });
      message = "Playlist added to library";
      isAdded = true;
      playlistToUpdate.likes += 1;
    }

    await playlistToUpdate.save();
    await library.save();

    res.json({ success: true, isAdded, message });
  } catch (err) {
    console.error("❌ togglePlaylistInLibrary error:", err);
    next(err);
  }
};

export const toggleArtistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { artistId } = req.body;

    if (!userId || !artistId) {
      return res.status(400).json({ message: "Missing userId or artistId" });
    }

    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      return res.status(400).json({ message: "Invalid artistId format" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.followedArtists) {
      library.followedArtists = [];
    }

    const exists = library.followedArtists.some(
      (a) => a.artistId?.toString() === artistId
    );

    let isFollowedStatus;

    if (exists) {
      library.followedArtists = library.followedArtists.filter(
        (a) => a.artistId?.toString() !== artistId
      );
      isFollowedStatus = false;
    } else {
      library.followedArtists.push({
        artistId: new mongoose.Types.ObjectId(artistId),
        addedAt: new Date(),
      });
      isFollowedStatus = true;
    }

    await library.save();

    res.json({ success: true, isFollowed: isFollowedStatus });
  } catch (err) {
    console.error("❌ toggleArtistInLibrary error:", err);
    next(err);
  }
};

export const getFollowedArtists = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const library = await Library.findOne({ userId })
      .populate({
        path: "followedArtists.artistId",
        model: "Artist",
        select: "name imageUrl createdAt",
      })
      .lean();

    if (!library) {
      console.log("No library found for user:", userId);
      return res.json({ artists: [] });
    }

    if (!library.followedArtists) {
      console.log(
        "library.followedArtists is undefined. Initializing to empty array."
      );
      library.followedArtists = [];
    }

    console.log(
      "Fetched library.followedArtists before filter:",
      JSON.stringify(library.followedArtists, null, 2)
    );

    const artists = library.followedArtists
      .filter((item) => {
        if (!item.artistId) {
          console.log("Filtering out item with missing artistId:", item);
          return false;
        }
        if (typeof item.artistId !== "object" || !item.artistId._id) {
          console.log("Filtering out malformed artistId item:", item.artistId);
          return false;
        }
        return true;
      })
      .sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      )
      .map((item) => {
        console.log("Processing artist item:", JSON.stringify(item, null, 2));
        return {
          _id: item.artistId._id,
          name: item.artistId.name,
          imageUrl: item.artistId.imageUrl,
          createdAt: item.artistId.createdAt || new Date().toISOString(),
          addedAt: item.addedAt,
        };
      });

    console.log("Final processed artists:", JSON.stringify(artists, null, 2));

    res.json({ artists });
  } catch (err) {
    console.error("❌ Error in getFollowedArtists:", err);
    next(err);
  }
};
export const toggleMixInLibrary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { mixId } = req.body;

    if (!mixId || !mongoose.Types.ObjectId.isValid(mixId)) {
      return res.status(400).json({ message: "Valid Mix ID is required" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.savedMixes) library.savedMixes = [];

    const exists = library.savedMixes.some(
      (m) => m.mixId?.toString() === mixId
    );
    let isSaved;

    if (exists) {
      library.savedMixes = library.savedMixes.filter(
        (m) => m.mixId?.toString() !== mixId
      );
      isSaved = false;
    } else {
      library.savedMixes.push({
        mixId: new mongoose.Types.ObjectId(mixId),
        addedAt: new Date(),
      });
      isSaved = true;
    }

    await library.save();
    res.json({ success: true, isSaved });
  } catch (err) {
    console.error("❌ toggleMixInLibrary error:", err);
    next(err);
  }
};

export const getSavedMixes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const library = await Library.findOne({ userId })
      .populate({
        path: "savedMixes.mixId",
        model: "Mix",
      })
      .lean();

    if (!library || !library.savedMixes) {
      return res.json({ mixes: [] });
    }

    const mixes = library.savedMixes
      .filter((item) => item.mixId)
      .map((item) => ({
        ...item.mixId,
        addedAt: item.addedAt,
      }));

    res.json({ mixes });
  } catch (err) {
    console.error("❌ Error in getSavedMixes:", err);
    next(err);
  }
};

export const getOwnedPlaylists = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userWithPlaylists = await User.findById(userId).populate({
      path: "playlists",
      populate: {
        path: "songs",
        model: "Song",
      },
    });

    if (!userWithPlaylists) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(userWithPlaylists.playlists || []);
  } catch (error) {
    console.error("Error fetching owned playlists:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSavedGeneratedPlaylists = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const library = await Library.findOne({ userId })
      .populate({
        path: "savedGeneratedPlaylists.playlistId",
        model: "GeneratedPlaylist",
      })
      .lean();

    if (!library || !library.savedGeneratedPlaylists) {
      return res.json({ playlists: [] });
    }

    const playlists = library.savedGeneratedPlaylists
      .filter((item) => item.playlistId)
      .map((item) => ({
        ...item.playlistId,
        addedAt: item.addedAt,
      }));

    res.json({ playlists });
  } catch (err) {
    console.error("❌ Error in getSavedGeneratedPlaylists:", err);
    next(err);
  }
};

export const toggleGeneratedPlaylistInLibrary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { playlistId } = req.body;

    if (!playlistId || !mongoose.Types.ObjectId.isValid(playlistId)) {
      return res.status(400).json({ message: "Valid Playlist ID is required" });
    }

    const library = await Library.findOneAndUpdate(
      { userId },
      {},
      { upsert: true, new: true }
    );

    if (!library.savedGeneratedPlaylists) library.savedGeneratedPlaylists = [];

    const exists = library.savedGeneratedPlaylists.some(
      (p) => p.playlistId?.toString() === playlistId
    );
    let isSaved;

    if (exists) {
      library.savedGeneratedPlaylists = library.savedGeneratedPlaylists.filter(
        (p) => p.playlistId?.toString() !== playlistId
      );
      isSaved = false;
    } else {
      library.savedGeneratedPlaylists.push({
        playlistId: new mongoose.Types.ObjectId(playlistId),
        addedAt: new Date(),
      });
      isSaved = true;
    }

    await library.save();
    res.json({ success: true, isSaved });
  } catch (err) {
    console.error("❌ toggleGeneratedPlaylistInLibrary error:", err);
    next(err);
  }
};
export const getLibrarySummary = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const library = await Library.findOne({ userId }).lean();

    if (!library) {
      return res.json({
        albums: [],
        likedSongs: [],
        playlists: [],
        followedArtists: [],
        savedMixes: [],
        generatedPlaylists: [],
      });
    }

    const albumIds = library.albums?.map((a) => a.albumId) || [];
    const likedSongIds = library.likedSongs?.map((s) => s.songId) || [];
    const playlistIds = library.playlists?.map((p) => p.playlistId) || [];
    const artistIds = library.followedArtists?.map((a) => a.artistId) || [];
    const mixIds = library.savedMixes?.map((m) => m.mixId) || [];
    const genPlaylistIds =
      library.savedGeneratedPlaylists?.map((p) => p.playlistId) || [];

    const [
      albums,
      likedSongs,
      playlists,
      followedArtists,
      savedMixes,
      generatedPlaylists,
    ] = await Promise.all([
      mongoose
        .model("Album")
        .find({ _id: { $in: albumIds } })
        .populate("artist", "name")
        .select("title imageUrl artist type releaseYear songs")
        .lean(),
      mongoose
        .model("Song")
        .find({ _id: { $in: likedSongIds } })
        .populate("artist", "name")
        .select(
          "title imageUrl artist duration playCount albumId createdAt albumTitle"
        )
        .lean(),
      mongoose
        .model("Playlist")
        .find({ _id: { $in: playlistIds } })
        .populate("owner", "fullName")
        .select("title imageUrl owner isPublic description songs")
        .lean(),
      mongoose
        .model("Artist")
        .find({ _id: { $in: artistIds } })
        .select("name imageUrl")
        .lean(),
      mongoose
        .model("Mix")
        .find({ _id: { $in: mixIds } })
        .select("name imageUrl sourceName type generatedOn")
        .lean(),
      mongoose
        .model("GeneratedPlaylist")
        .find({ _id: { $in: genPlaylistIds } })
        .select("nameKey descriptionKey imageUrl generatedOn songs")
        .lean(),
    ]);

    const addAddedAt = (items, libraryField) => {
      const lookup = new Map(
        libraryField.map((i) => [i[Object.keys(i)[0]].toString(), i.addedAt])
      );
      return items.map((item) => ({
        ...item,
        addedAt: lookup.get(item._id.toString()),
      }));
    };

    res.json({
      albums: addAddedAt(albums, library.albums),
      likedSongs: addAddedAt(likedSongs, library.likedSongs),
      playlists: addAddedAt(playlists, library.playlists),
      followedArtists: addAddedAt(followedArtists, library.followedArtists),
      savedMixes: addAddedAt(savedMixes, library.savedMixes),
      generatedPlaylists: addAddedAt(
        generatedPlaylists,
        library.savedGeneratedPlaylists
      ),
    });
  } catch (err) {
    console.error("❌ Error in getLibrarySummary:", err);
    next(err);
  }
};
