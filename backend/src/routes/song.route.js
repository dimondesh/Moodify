import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getAllSongs,
  getImageForColorAnalysis,
  getListenHistory,
  getMadeForYouSongs,
  getTrendingSongs,
  recordListen,
  getQuickPicks,
} from "../controller/song.controller.js";

const router = Router();

router.get("/", protectRoute, getAllSongs);
router.get("/featured", protectRoute, getQuickPicks);
router.get("/made-for-you", protectRoute, getMadeForYouSongs);
router.get("/trending", getTrendingSongs);
router.post("/:id/listen", protectRoute, recordListen);
router.get("/history", protectRoute, getListenHistory);
router.get("/image-proxy", getImageForColorAnalysis);

export default router;
