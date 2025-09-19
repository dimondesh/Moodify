// backend/src/routes/playlist.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createPlaylist,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  likePlaylist,
  unlikePlaylist,
  getMyPlaylists,
  getPublicPlaylists,
  createPlaylistFromSong,
  getPlaylistRecommendations,
  createPlaylistWithAI,
} from "../controller/playlist.controller.js";

const router = express.Router();

router.get("/public", getPublicPlaylists);

router.use(protectRoute);

router.post("/", createPlaylist);
router.post("/generate-ai", createPlaylistWithAI);

router.get("/my", getMyPlaylists);
router.get("/:id/recommendations", getPlaylistRecommendations);

router.get("/:id", getPlaylistById);
router.put("/:id", updatePlaylist);
router.delete("/:id", deletePlaylist);

router.post("/:id/songs", addSongToPlaylist);
router.delete("/:playlistId/songs/:songId", removeSongFromPlaylist);
router.post("/from-song", createPlaylistFromSong);

export default router;
