import { Router } from "express";
import {
  getAllAlbums,
  getAlbumById,
  getTrendingAlbums,
} from "../controller/album.controller.js";
import { cacheRoute } from "../middleware/cache.middleware.js";

const router = Router();

router.get("/", cacheRoute(3600), getAllAlbums);
router.get("/trending", cacheRoute(3600), getTrendingAlbums);
router.get("/:id", cacheRoute(3600), getAlbumById);
export default router;
