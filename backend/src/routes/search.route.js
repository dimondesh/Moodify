import { Router } from "express";
import { searchSongs } from "../controller/search.controller.js";

const router = Router();

router.get("/", searchSongs);

export default router;
