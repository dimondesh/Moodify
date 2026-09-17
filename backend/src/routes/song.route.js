import { Router } from "express";
import { protectRoute, attachUserIfPresent } from "../middleware/auth.middleware.js";
import {
  getAllSongs,
  getListenHistory,
  getMadeForYouSongs,
  getTrendingSongs,
  recordListen,
  getQuickPicks,
  getSongById,
  getSongLyrics,
  getRecommendedSongs,
  getSongInstrumental,
  requestSongInstrumental,
} from "../controller/song.controller.js";

const router = Router();

router.get("/", protectRoute, getAllSongs);
router.get("/featured", protectRoute, getQuickPicks);
router.get("/made-for-you", protectRoute, getMadeForYouSongs);
router.get("/trending", getTrendingSongs);
router.get("/:id/lyrics", getSongLyrics);
router.get("/:id/instrumental", protectRoute, getSongInstrumental);
router.post("/:id/instrumental", protectRoute, requestSongInstrumental);
router.post("/:id/listen", protectRoute, recordListen);
router.get("/:id/radio", attachUserIfPresent, getRecommendedSongs);
router.get("/history", protectRoute, getListenHistory);
router.get("/:id", getSongById);

export default router;
