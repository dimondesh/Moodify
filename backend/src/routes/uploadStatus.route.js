// backend/src/routes/uploadStatus.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getUploadStats,
  hasActiveUploads,
  getAllActiveUploads,
  getUsedTempDirectories,
} from "../lib/activeUploads.service.js";

const router = express.Router();

// Получить статистику активных загрузок
router.get("/stats", protectRoute, (req, res) => {
  try {
    const stats = getUploadStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[UploadStatus] Ошибка получения статистики:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения статистики загрузок",
    });
  }
});

// Проверить, есть ли активные загрузки у пользователя
router.get("/user/:userId", protectRoute, (req, res) => {
  try {
    const { userId } = req.params;
    const hasActive = hasActiveUploads(userId);

    res.json({
      success: true,
      data: {
        userId,
        hasActiveUploads: hasActive,
      },
    });
  } catch (error) {
    console.error(
      "[UploadStatus] Ошибка проверки загрузок пользователя:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Ошибка проверки загрузок пользователя",
    });
  }
});

// Получить все активные загрузки (только для админов)
router.get("/all", protectRoute, (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Доступ запрещен. Требуются права администратора.",
      });
    }

    const activeUploads = getAllActiveUploads();
    const usedDirs = getUsedTempDirectories();

    res.json({
      success: true,
      data: {
        activeUploads: Array.from(activeUploads.entries()),
        usedDirectories: Array.from(usedDirs.entries()),
      },
    });
  } catch (error) {
    console.error("[UploadStatus] Ошибка получения всех загрузок:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения всех загрузок",
    });
  }
});

export default router;
