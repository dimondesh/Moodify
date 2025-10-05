// backend/src/routes/personalMix.route.js

import express from "express";
import {
  getPersonalMixes,
  getPersonalMixById,
} from "../controller/personalMix.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Получить персональные миксы пользователя
router.get("/", protectRoute, getPersonalMixes);

// Получить конкретный персональный микс по ID
router.get("/:id", protectRoute, getPersonalMixById);

export default router;
