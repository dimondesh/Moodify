import { Router } from "express";
import {
  getAllAlbums,
  getAlbumById,
  getTrendingAlbums,
} from "../controller/album.controller.js";

const router = Router();

router.get("/", getAllAlbums);
router.get("/trending", getTrendingAlbums);
router.get("/:id", getAlbumById);
export default router;
