import { Router } from "express";

import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getStats,
  getHealthStatus,
  checkAnalysisServiceHealth,
} from "../controller/stat.controller.js";

const router = Router();

router.get("/", protectRoute, getStats);
router.get("/health", getHealthStatus);
router.get("/health/analysis", checkAnalysisServiceHealth);

export default router;
