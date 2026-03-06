// backend/src/routes/home.route.js

import { Router } from "express";
import { identifyUser } from "../middleware/identifyUser.middleware.js";
import {
  getPrimaryHomePageData,
  getSecondaryHomePageData,
  getBootstrapData,
} from "../controller/home.controller.js";
import { cacheRoute } from "../middleware/cache.middleware.js";

const router = Router();

router.get("/bootstrap", identifyUser, cacheRoute(900, true), getBootstrapData);
router.get(
  "/primary",
  identifyUser,
  cacheRoute(900, true),
  getPrimaryHomePageData,
);
router.get(
  "/secondary",
  identifyUser,
  cacheRoute(900, true),
  getSecondaryHomePageData,
);

export default router;
