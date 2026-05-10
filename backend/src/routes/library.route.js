import express from "express";
import {
  toggleAlbumInLibrary,
  getLibraryAlbums,
  getLikedSongs,
  toggleSongLikeInLibrary,
  getPlaylistsInLibrary,
  togglePlaylistInLibrary,
  toggleArtistInLibrary,
  getFollowedArtists,
  getOwnedPlaylists,
  getLibrarySummary,
} from "../controller/library.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/summary", protectRoute, getLibrarySummary);

router.get("/albums", protectRoute, getLibraryAlbums);
router.post("/albums/toggle", protectRoute, toggleAlbumInLibrary);

router.get("/liked-songs", protectRoute, getLikedSongs);
router.post("/songs/toggle-like", protectRoute, toggleSongLikeInLibrary);

router.get("/playlists", protectRoute, getPlaylistsInLibrary);
router.post("/playlists/toggle", protectRoute, togglePlaylistInLibrary);
router.get("/playlists/owned", protectRoute, getOwnedPlaylists);

router.get("/artists", protectRoute, getFollowedArtists);
router.post("/artists/toggle", protectRoute, toggleArtistInLibrary);

export default router;
