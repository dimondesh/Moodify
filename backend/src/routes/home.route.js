import { Router } from "express";
import { identifyUser } from "../middleware/identifyUser.middleware.js";
import { getBootstrapData } from "../controller/home.controller.js";
import { cacheRoute } from "../middleware/cache.middleware.js";
import {
  GUEST_HOME_CACHE_TTL,
  PERSONALIZED_HOME_CACHE_TTL,
} from "../constants/cache.js";

const router = Router();

const homeBootstrapCache = (req, res, next) => {
  if (req.user?.id) {
    return cacheRoute(PERSONALIZED_HOME_CACHE_TTL, true)(req, res, next);
  }
  return cacheRoute(GUEST_HOME_CACHE_TTL)(req, res, next);
};

router.get("/bootstrap", identifyUser, homeBootstrapCache, getBootstrapData);

export default router;
