// backend/src/routes/playlist.route.js
import express from "express";
import {
  protectRoute,
  attachUserIfPresent,
} from "../middleware/auth.middleware.js";
import {
  createPlaylist,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getMyPlaylists,
  getPublicPlaylists,
  createPlaylistFromSong,
  getPlaylistRecommendations,
  createPlaylistWithAI,
} from "../controller/playlist.controller.js";

const router = express.Router();

router.get("/public", getPublicPlaylists);

router.get("/my", protectRoute, getMyPlaylists);
router.get("/:id/recommendations", protectRoute, getPlaylistRecommendations);
router.get("/:id", attachUserIfPresent, getPlaylistById);

router.use(protectRoute);

router.post("/", createPlaylist);
router.post("/generate-ai", createPlaylistWithAI);
router.put("/:id", updatePlaylist);
router.delete("/:id", deletePlaylist);

router.post("/:id/songs", addSongToPlaylist);
router.delete("/:playlistId/songs/:songId", removeSongFromPlaylist);
router.post("/from-song", createPlaylistFromSong);

export default router;
