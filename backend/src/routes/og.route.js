// src/routes/og.route.js
import { Router } from "express";
import { generateOGMeta } from "../controller/og.controller.js";

const router = Router();

// Перехватываем роуты фронтенда, которыми делятся пользователи
router.get(
  ["/track/:id", "/albums/:id", "/playlists/:id", "/mixes/:id"],
  generateOGMeta,
);

export default router;
