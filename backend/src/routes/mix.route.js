import express from "express";
import { getDailyMixes, getMixById } from "../controller/mix.controller.js";
import { identifyUser } from "../middleware/identifyUser.middleware.js";
import { cacheRoute } from "../middleware/cache.middleware.js";

const router = express.Router();

router.get("/", identifyUser, cacheRoute(1800, true), getDailyMixes);
router.get("/:id", cacheRoute(3600), getMixById);

export default router;
