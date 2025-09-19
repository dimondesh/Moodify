import { Router } from "express";
import {
  getArtistById,
  getAllArtists,
  getArtistAppearsOn,
} from "../controller/artist.controller.js";

const router = Router();

router.get("/", getAllArtists);

router.get("/:id", getArtistById);

router.get("/:id/appears-on", getArtistAppearsOn);

export default router;
