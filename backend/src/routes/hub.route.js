import { Router } from "express";
import { getHubs, getHubById } from "../controller/hub.controller.js";
import { cacheRoute } from "../middleware/cache.middleware.js";
import { GUEST_HOME_CACHE_TTL } from "../constants/cache.js";

const router = Router();

router.get("/", cacheRoute(GUEST_HOME_CACHE_TTL), getHubs);
router.get("/:id", getHubById);

export default router;
