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
    const analysisServiceUrl = "https://moodify-analysis-service.onrender.com";

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    const response = await axios.get(analysisServiceUrl, { httpsAgent: agent });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Analysis service check failed:", error);

    res.status(502).json({ error: "Analysis service is unreachable" });
  }
};
