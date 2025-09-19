// backend/src/routes/generatedPlaylist.route.js
import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMyGeneratedPlaylists,
  getGeneratedPlaylistById,
} from "../controller/generatedPlaylist.controller.js";

const router = Router();

router.get("/me", protectRoute, getMyGeneratedPlaylists);
router.get("/:id", protectRoute, getGeneratedPlaylistById);

export default router;
