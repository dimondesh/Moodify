import { Song } from "../models/song.model.js";
import { User } from "../models/user.model.js";
import { Album } from "../models/album.model.js";
import { Artist } from "../models/artist.model.js";
import https from "https";
import axios from "axios";

export const getStats = async (req, res, next) => {
  try {
    const [totalSongs, totalUsers, totalAlbums, totalArtists] =
      await Promise.all([
        Song.countDocuments(),
        User.countDocuments(),
        Album.countDocuments(),
        Artist.countDocuments(),
      ]);

    res.status(200).json({
      totalSongs,
      totalUsers,
      totalAlbums,
      totalArtists,
    });
  } catch (error) {
    next(error);
  }
};
export const getHealthStatus = async (req, res, next) => {
  try {
    res.status(200).json({
      status: "ok",
      message: "Backend is awake and running.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
export const checkAnalysisServiceHealth = async (req, res, next) => {
  try {
    const analysisServiceUrl = process.env.ANALYSIS_SERVICE_URL;

    const response = await axios.get(analysisServiceUrl, {
      timeout: 50000,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    let status = 502;
    let message = "Analysis service is unreachable or timed out";

    if (error.response) {
      status = error.response.status;
      message = error.response.data || "Analysis service returned an error";
      console.error(
        `Analysis service responded with status ${status}:`,
        message,
      );
    } else if (error.code === "ECONNABORTED") {
      message = `Analysis service timed out after ${
        error.config.timeout / 1000
      }s.`;
      console.error(message);
    } else {
      console.error("Generic error checking analysis service:", error.message);
    }

    res.status(status).json({ error: message });
  }
};

export const checkEmbeddingServiceHealth = async (req, res, next) => {
  try {
    // Используем URL из переменной окружения или дефолтный 5003
    const EMBEDDING_SERVICE_URL =
      process.env.EMBEDDING_SERVICE_URL || "http://localhost:5006";

    const response = await axios.get(`${EMBEDDING_SERVICE_URL}/`, {
      timeout: 5000,
    });

    if (response.status === 200) {
      return res.status(200).json({ status: "OK", data: response.data });
    }

    res.status(503).json({
      status: "Error",
      message: "Embedding service returned non-200 status",
    });
  } catch (error) {
    console.error(
      "[StatController] Embedding Health Check Error:",
      error.message,
    );
    res
      .status(503)
      .json({ status: "Error", message: "Embedding service is unreachable" });
  }
};
