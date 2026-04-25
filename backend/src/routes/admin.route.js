import { Router } from "express";
import {
  createSong,
  updateSong,
  deleteSong,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  createArtist,
  updateArtist,
  deleteArtist,
  uploadFullAlbumAuto,
  getGenres,
  getMoods,
  getPaginatedSongs,
  getPaginatedAlbums,
  getPaginatedArtists,
  analyzeSongAudio,
  getSongAudioFeatures,
  uploadChunk,
  testAudioAnalysis,
  testEmbeddingExtraction,
} from "../controller/admin.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.use(protectRoute);

router.post("/songs", createSong);
router.put("/songs/:id", updateSong);
router.delete("/songs/:id", deleteSong);

router.post("/albums", createAlbum);
router.put("/albums/:id", updateAlbum);
router.delete("/albums/:id", deleteAlbum);
router.post("/albums/upload-chunk", uploadChunk);
router.post("/albums/upload-full-album", uploadFullAlbumAuto);

router.post("/artists", createArtist);
router.put("/artists/:id", updateArtist);
router.delete("/artists/:id", deleteArtist);

router.get("/genres", getGenres);
router.get("/moods", getMoods);

router.get("/songs/paginated", getPaginatedSongs);
router.get("/albums/paginated", getPaginatedAlbums);
router.get("/artists/paginated", getPaginatedArtists);

// Audio analysis routes
router.post("/test-analysis", testAudioAnalysis);
router.post("/songs/:songId/analyze", analyzeSongAudio);
router.get("/songs/:songId/audio-features", getSongAudioFeatures);
router.post("/test-embedding", testEmbeddingExtraction);

export default router;
