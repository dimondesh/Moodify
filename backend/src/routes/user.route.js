import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getMessages,
  getCurrentUser,
  getUserProfile,
  followUser,
  updateUserProfile,
  getMutualFollowers,
  getFollowers,
  getFollowing,
  getPublicPlaylists,
  updateUserLanguage,
  getUnreadCounts,
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  updateUserPrivacy,
  getFavoriteArtists,
  getNewReleases,
  getPlaylistRecommendations,
  getRecentlyListenedArtists,
  updateRecentlyListenedArtistsPrivacy,
} from "../controller/user.controller.js";

const router = Router();

router.get("/me", protectRoute, getCurrentUser);
router.get("/mutuals", protectRoute, getMutualFollowers);
router.get("/unread-counts", protectRoute, getUnreadCounts);
router.get("/me/recent-searches", protectRoute, getRecentSearches);
router.post("/me/recent-searches", protectRoute, addRecentSearch);
router.get("/me/favorite-artists", protectRoute, getFavoriteArtists);
router.get("/me/recommendations/new-releases", protectRoute, getNewReleases);
router.get(
  "/me/recommendations/playlists",
  protectRoute,
  getPlaylistRecommendations
);

router.delete("/me/recent-searches/all", protectRoute, clearRecentSearches);
router.delete(
  "/me/recent-searches/:searchId",
  protectRoute,
  removeRecentSearch
);

router.get("/messages/:userId", protectRoute, getMessages);
router.get("/:userId", protectRoute, getUserProfile);
router.post("/:userId/follow", protectRoute, followUser);
router.get("/:userId/followers", protectRoute, getFollowers);
router.get("/:userId/following", protectRoute, getFollowing);
router.get("/:userId/playlists", protectRoute, getPublicPlaylists);
router.get(
  "/:userId/recently-listened-artists",
  protectRoute,
  getRecentlyListenedArtists
);

router.put("/me", protectRoute, updateUserProfile);
router.get("/", protectRoute, getAllUsers);
router.put("/language", protectRoute, updateUserLanguage);
router.put("/privacy", protectRoute, updateUserPrivacy);
router.put(
  "/recently-listened-artists-privacy",
  protectRoute,
  updateRecentlyListenedArtistsPrivacy
);
export default router;
