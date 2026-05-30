// backend/src/controller/user.controller.js

import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { FollowedUser } from "../models/followedUser.model.js";
import { FollowedArtist } from "../models/followedArtist.model.js";
import { Album } from "../models/album.model.js";
import { RecentSearch } from "../models/recentSearch.model.js";
import {
  getPathFromUrl,
  deleteFromBunny,
  uploadToBunny,
} from "../lib/bunny.service.js";
import path from "path";
import fs from "fs/promises";
import { ListenHistory } from "../models/listenHistory.model.js";
import { Song } from "../models/song.model.js";
import { Playlist } from "../models/playlist.model.js";
import { populatePlaylistEmbeddedSongs } from "./playlist.controller.js";
import {
  toImageFields,
  replaceEntityImageVariants,
} from "../lib/imageVariants.service.js";
import { extractCoverAccentHexFromBuffer } from "../lib/coverAccent.service.js";
import { getPersistedActivity } from "../lib/activityPersistence.service.js";
import { buildAuthPayload } from "./auth.controller.js";
import {
  completeTasteOnboarding as completeTasteOnboardingService,
  selectDiverseOnboardingArtists,
} from "../lib/tasteProfile.service.js";
import {
  TASTE_ONBOARDING_MIN_ARTISTS,
  TASTE_ONBOARDING_MAX_ARTISTS,
  ONBOARDING_ARTISTS_PAGE_SIZE,
} from "../constants/embedding.js";

const SONG_MINIMAL_SELECT =
  "_id title artist albumId images coverAccentHex duration playCount";

export const getAllUsers = async (req, res, next) => {
  try {
    const currentUserMongoId = req.user?.id;
    if (!currentUserMongoId)
      return res.status(401).json({ message: "Unauthorized" });

    const users = await User.find({ _id: { $ne: currentUserMongoId } });
    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const myId = req.user?.id;
    const { userId } = req.params;
    if (!myId) return res.status(401).json({ message: "Unauthorized" });

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: myId },
        { senderId: myId, receiverId: userId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = (req, res) => {
  if (!req.user)
    return res.status(401).json({ message: "User not authenticated" });
  res.status(200).json(req.user);
};

export const getUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profileUser = await User.findById(userId).select(
      "-email -passwordHash",
    );

    if (!profileUser)
      return res.status(404).json({ message: "User not found" });

    const [
      followersCount,
      followingUsersCount,
      followingArtistsCount,
      publicPlaylistsCount,
      followerRows,
    ] = await Promise.all([
      FollowedUser.countDocuments({ following: userId }),
      FollowedUser.countDocuments({ follower: userId }),
      FollowedArtist.countDocuments({ user: userId }),
      Playlist.countDocuments({ owner: userId, isPublic: true }),
      FollowedUser.find({ following: userId }).select("follower").lean(),
    ]);

    const profileData = profileUser.toObject();
    profileData.followersCount = followersCount;
    profileData.followingUsersCount = followingUsersCount;
    profileData.followingArtistsCount = followingArtistsCount;
    profileData.publicPlaylistsCount = publicPlaylistsCount;
    profileData.followers = followerRows.map((row) =>
      row.follower.toString(),
    );

    if (
      req.user?.id &&
      userId.toString() === req.user.id.toString()
    ) {
      profileData.requires_onboarding = req.requiresOnboarding ?? false;
    }

    res.status(200).json(profileData);
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const rows = await FollowedUser.find({ following: userId })
      .sort({ addedAt: -1 })
      .populate({ path: "follower", select: "fullName images" })
      .lean();

    const followers = rows
      .filter((row) => row.follower)
      .map((row) => ({
        _id: row.follower._id,
        name: row.follower.fullName,
        images: row.follower.images || [],
        type: "user",
      }));

    res.status(200).json({ items: followers });
  } catch (error) {
    next(error);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const currentUserMongoId = req.user.id;
    const { userId: userToFollowId } = req.params;

    if (currentUserMongoId.toString() === userToFollowId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const userToFollow = await User.findById(userToFollowId);

    if (!userToFollow)
      return res.status(404).json({ message: "User to follow not found" });

    const existing = await FollowedUser.findOne({
      follower: currentUserMongoId,
      following: userToFollowId,
    });

    if (existing) {
      await FollowedUser.deleteOne({ _id: existing._id });
      res.status(200).json({ message: "Unfollowed successfully" });
    } else {
      try {
        await FollowedUser.create({
          follower: currentUserMongoId,
          following: userToFollowId,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
      res.status(200).json({ message: "Followed successfully" });
    }
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const { fullName } = req.body;
    const userId = req.user.id;
    const currentUser = await User.findById(userId);

    const updateDataMongo = {};

    if (fullName) {
      updateDataMongo.fullName = fullName;
    }

    if (req.files && req.files.imageUrl) {
      const file = req.files.imageUrl;
      const coverBuf = await fs.readFile(file.tempFilePath);
      updateDataMongo.coverAccentHex =
        await extractCoverAccentHexFromBuffer(coverBuf);
      const uploadResult = await replaceEntityImageVariants(
        currentUser,
        file,
        "profile_pictures",
      );
      Object.assign(updateDataMongo, toImageFields(uploadResult));
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateDataMongo, {
      new: true,
    }).select("-email -passwordHash");

    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const updateUserLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;
    const userId = req.user.id;

    if (!language || !["ru", "uk", "en"].includes(language)) {
      return res.status(400).json({ message: "Invalid language specified" });
    }

    await User.findByIdAndUpdate(userId, { language });
    res.status(200).json({ message: "Language updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateUserPrivacy = async (req, res, next) => {
  try {
    const { isAnonymous } = req.body;
    const userId = req.user.id;

    if (typeof isAnonymous !== "boolean")
      return res.status(400).json({ message: "Invalid isAnonymous value" });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isAnonymous },
      { new: true },
    );
    const { io, userSockets, userActivities } = req;
    const userIdStr = userId.toString();

    if (isAnonymous) {
      userSockets.delete(userIdStr);
      userActivities.delete(userIdStr);
      io.emit("user_disconnected", userIdStr);
    } else {
      const socket = Array.from(io.sockets.sockets.values()).find(
        (s) => s.userId === userIdStr,
      );
      if (socket) {
        userSockets.set(userIdStr, socket.id);
        userActivities.set(userIdStr, "Idle");
        io.emit("user_connected", userIdStr);
      }
    }
    const onlineUserIds = Array.from(userSockets.keys());
    const visibleOnlineUsers = await User.find({
      _id: { $in: onlineUserIds },
      isAnonymous: false,
    }).select("_id");
    io.emit(
      "users_online",
      visibleOnlineUsers.map((u) => u._id.toString()),
    );
    io.emit("activities", Array.from(userActivities.entries()));

    res.status(200).json({
      message: "Privacy settings updated",
      isAnonymous: updatedUser.isAnonymous,
    });
  } catch (error) {
    next(error);
  }
};

export const getMutualFollowers = async (req, res, next) => {
  try {
    const currentUserMongoId = req.user.id;

    const myFollowing = await FollowedUser.find({
      follower: currentUserMongoId,
    })
      .select("following")
      .lean();

    if (!myFollowing.length) {
      return res.status(200).json({ users: [] });
    }

    const followingIds = myFollowing.map((row) => row.following);

    const mutualRows = await FollowedUser.find({
      follower: { $in: followingIds },
      following: currentUserMongoId,
    })
      .select("follower")
      .lean();

    const mutualIds = mutualRows.map((row) => row.follower);

    const mutuals = await User.find({ _id: { $in: mutualIds } }).select(
      "fullName images isAnonymous lastListeningActivity",
    );

    const users = await Promise.all(
      mutuals.map(async (user) => {
        const base = {
          _id: user._id,
          fullName: user.fullName,
          images: user.images || [],
        };

        if (user.isAnonymous) return base;

        const persisted = await getPersistedActivity(
          user._id.toString(),
          user.lastListeningActivity,
        );

        return persisted ? { ...base, ...persisted } : base;
      }),
    );

    res.status(200).json({ users });
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const [userRows, artistRows] = await Promise.all([
      FollowedUser.find({ follower: userId })
        .sort({ addedAt: -1 })
        .populate({ path: "following", select: "fullName images" })
        .lean(),
      FollowedArtist.find({ user: userId })
        .sort({ addedAt: -1 })
        .populate({
          path: "artist",
          select: "name images",
        })
        .lean(),
    ]);

    const followedArtistDocs = artistRows
      .filter((row) => row.artist)
      .map((row) => row.artist);
    const artistsWithSongs = await (async () => {
      if (!followedArtistDocs.length) return new Map();

      const artistIdSet = new Set(
        followedArtistDocs.map((artist) => artist._id.toString()),
      );
      const songs = await Song.find({
        artist: { $in: followedArtistDocs.map((artist) => artist._id) },
      })
        .select(SONG_MINIMAL_SELECT)
        .populate({ path: "artist", select: "name images" })
        .sort({ playCount: -1 })
        .lean();

      const songsByArtistId = new Map(
        [...artistIdSet].map((id) => [id, []]),
      );

      for (const song of songs) {
        for (const artistRef of song.artist || []) {
          const artistKey = artistRef._id
            ? artistRef._id.toString()
            : artistRef.toString();
          if (!artistIdSet.has(artistKey)) continue;
          const bucket = songsByArtistId.get(artistKey);
          if (bucket.length < 5) {
            bucket.push(song);
          }
        }
      }

      return songsByArtistId;
    })();

    const followingUsers = userRows
      .filter((row) => row.following)
      .map((row) => ({
        _id: row.following._id,
        name: row.following.fullName,
        images: row.following.images || [],
        type: "user",
      }));

    const followedArtists = artistRows
      .filter((row) => row.artist)
      .map((row) => ({
        _id: row.artist._id,
        name: row.artist.name,
        images: row.artist.images || [],
        type: "artist",
        songs: artistsWithSongs.get(row.artist._id.toString()) || [],
      }));

    const combinedFollowing = [...followingUsers, ...followedArtists];
    res.status(200).json({ items: combinedFollowing });
  } catch (error) {
    next(error);
  }
};

export const getPublicPlaylists = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    const playlists = await Playlist.find({ owner: userId, isPublic: true })
      .select("title images owner")
      .populate({ path: "owner", model: "User", select: "fullName" })
      .lean();

    const items = playlists.map((p) => ({
      ...p,
      type: "playlist",
    }));
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCounts = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    if (!currentUserId)
      return res.status(401).json({ message: "Unauthorized" });

    const unreadCounts = await Message.aggregate([
      { $match: { receiverId: currentUserId, isRead: false } },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
      { $project: { _id: 0, senderId: "$_id", count: "$count" } },
    ]);

    const countsMap = unreadCounts.reduce((acc, item) => {
      acc[item.senderId] = item.count;
      return acc;
    }, {});

    res.status(200).json(countsMap);
  } catch (error) {
    next(error);
  }
};

export const getRecentSearches = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const searches = await RecentSearch.find({ user: userId })
      .sort("-updatedAt")
      .limit(10)
      .lean();

    const promises = searches.map(async (search) => {
      if (!search.itemType || !search.item) return null;

      const rawType = search.itemType;
      const effectiveType = rawType === "Mix" ? "Playlist" : rawType;

      let query;
      switch (effectiveType) {
        case "Playlist":
          query = Playlist.findById(search.item)
            .select("title images owner type sourceName")
            .populate("owner", "fullName");
          break;
        case "Album":
          query = mongoose
            .model("Album")
            .findById(search.item)
            .select("title images artist")
            .populate("artist", "name");
          break;
        case "Artist":
          query = mongoose
            .model("Artist")
            .findById(search.item)
            .select("name images");
          break;
        case "User":
          query = mongoose
            .model("User")
            .findById(search.item)
            .select("fullName images");
          break;
        case "Song":
          query = Song.findById(search.item)
            .select("title images artist albumId")
            .populate("artist", "name");
          break;
        default:
          return null;
      }

      const result = await query.lean();
      if (!result) return null;

      return {
        ...result,
        searchId: search._id,
        itemType: effectiveType,
        title: result.title || result.name || result.fullName,
        isTranslatable: false,
      };
    });

    const finalResults = (await Promise.all(promises)).filter(Boolean);
    res.status(200).json(finalResults);
  } catch (error) {
    next(error);
  }
};

export const addRecentSearch = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { itemId, itemType } = req.body;

    if (!itemId || !itemType)
      return res
        .status(400)
        .json({ message: "itemId and itemType are required" });

    if (itemType === "Mix") itemType = "Playlist";

    const allowed = ["Artist", "Album", "Playlist", "User", "Song"];
    if (!allowed.includes(itemType)) {
      return res.status(400).json({ message: "Invalid itemType" });
    }

    await RecentSearch.findOneAndUpdate(
      { user: userId, item: itemId, itemType: itemType },
      { updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const searches = await RecentSearch.find({ user: userId })
      .sort("-updatedAt")
      .skip(10)
      .select("_id")
      .lean();
    if (searches.length > 0) {
      const idsToDelete = searches.map((s) => s._id);
      await RecentSearch.deleteMany({ _id: { $in: idsToDelete } });
    }

    res.status(201).json({ message: "Recent search added" });
  } catch (error) {
    next(error);
  }
};

export const removeRecentSearch = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { searchId } = req.params;

    const result = await RecentSearch.findOneAndDelete({
      _id: searchId,
      user: userId,
    });
    if (!result)
      return res.status(404).json({ message: "Search item not found" });

    res.status(200).json({ message: "Recent search removed" });
  } catch (error) {
    next(error);
  }
};

export const clearRecentSearches = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await RecentSearch.deleteMany({ user: userId });
    res.status(200).json({ message: "All recent searches cleared" });
  } catch (error) {
    next(error);
  }
};

export const getFavoriteArtists = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    const userId = req.user.id;
    const listenHistory = await ListenHistory.find({
      user: new mongoose.Types.ObjectId(userId),
    })
      .sort({ listenedAt: -1 })
      .populate({
        path: "song",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name images bio bannerUrl createdAt updatedAt",
        },
      })
      .lean();

    if (!listenHistory || listenHistory.length === 0) {
      if (returnInternal) return [];
      return res.status(200).json([]);
    }

    const artistMap = new Map();
    for (const record of listenHistory) {
      if (
        !record.song ||
        !record.song.artist ||
        record.song.artist.length === 0
      )
        continue;
      const artist = record.song.artist[0];
      if (!artist || !artist._id) continue;

      const artistId = artist._id.toString();
      if (!artistMap.has(artistId)) {
        artistMap.set(artistId, {
          _id: artist._id,
          name: artist.name,
          images: artist.images || [],
          bio: artist.bio || "",
          bannerUrl: artist.bannerUrl || null,
          createdAt: artist.createdAt,
          updatedAt: artist.updatedAt,
          listenCount: 0,
        });
      }
      artistMap.get(artistId).listenCount += 1;
    }

    const favoriteArtists = Array.from(artistMap.values())
      .sort((a, b) => b.listenCount - a.listenCount)
      .slice(0, 10);

    for (const artist of favoriteArtists) {
      const songs = await Song.find({ artist: artist._id })
        .select(SONG_MINIMAL_SELECT)
        .populate({ path: "artist", select: "name images" })
        .sort({ playCount: -1 })
        .limit(5)
        .lean();
      artist.songs = songs;
    }

    if (returnInternal) return favoriteArtists;
    return res.status(200).json(favoriteArtists);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getNewReleases = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    // Пока отдаем просто 10 последних альбомов
    const albums = await Album.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("artist", "name images")
      .lean();

    if (returnInternal) return albums;
    return res.status(200).json(albums);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getPlaylistRecommendations = async (
  req,
  res,
  next,
  returnInternal = false,
) => {
  try {
    // Отдаем публичные миксы и плейлисты как рекомендации
    const playlists = await Playlist.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("owner", "fullName")
      .populate(populatePlaylistEmbeddedSongs)
      .lean();

    if (returnInternal) return playlists;
    return res.status(200).json(playlists);
  } catch (error) {
    if (returnInternal) return [];
    next(error);
  }
};

export const getRecentlyListenedArtists = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    const user = await User.findById(userId).select(
      "showRecentlyListenedArtists",
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    const currentUserIdString = currentUserId.toString();
    if (
      currentUserIdString !== userId &&
      user.showRecentlyListenedArtists === false
    ) {
      return res
        .status(403)
        .json({ message: "Recently listened artists are private" });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const listenHistory = await ListenHistory.find({
      user: new mongoose.Types.ObjectId(userId),
      listenedAt: { $gte: thirtyDaysAgo },
    })
      .sort({ listenedAt: -1 })
      .populate({
        path: "song",
        populate: {
          path: "artist",
          model: "Artist",
          select: "name images bio bannerUrl createdAt updatedAt",
        },
      })
      .lean();

    if (!listenHistory || listenHistory.length === 0)
      return res.status(200).json({ artists: [] });

    const artistMap = new Map();
    for (const record of listenHistory) {
      if (
        !record.song ||
        !record.song.artist ||
        record.song.artist.length === 0
      )
        continue;
      const artist = record.song.artist[0];
      if (!artist || !artist._id) continue;

      const artistId = artist._id.toString();
      if (!artistMap.has(artistId)) {
        artistMap.set(artistId, {
          _id: artist._id,
          name: artist.name,
          images: artist.images || [],
          bio: artist.bio || "",
          bannerUrl: artist.bannerUrl || null,
          createdAt: artist.createdAt,
          updatedAt: artist.updatedAt,
          listenCount: 0,
          lastListened: record.listenedAt,
          songs: [],
        });
      }
      const artistData = artistMap.get(artistId);
      artistData.listenCount += 1;
      if (record.listenedAt > artistData.lastListened)
        artistData.lastListened = record.listenedAt;
    }

    const recentlyListenedArtists = Array.from(artistMap.values())
      .sort((a, b) => new Date(b.lastListened) - new Date(a.lastListened))
      .slice(0, 12);

    for (const artist of recentlyListenedArtists) {
      const songs = await Song.find({ artist: artist._id })
        .select(SONG_MINIMAL_SELECT)
        .populate({ path: "artist", select: "name images" })
        .sort({ playCount: -1 })
        .limit(5)
        .lean();
      artist.songs = songs;
    }

    res.status(200).json({ artists: recentlyListenedArtists });
  } catch (error) {
    next(error);
  }
};

export const updateRecentlyListenedArtistsPrivacy = async (req, res, next) => {
  try {
    const { showRecentlyListenedArtists } = req.body;
    const userId = req.user.id;
    if (typeof showRecentlyListenedArtists !== "boolean")
      return res
        .status(400)
        .json({ message: "Invalid showRecentlyListenedArtists value" });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { showRecentlyListenedArtists },
      { new: true },
    ).select("showRecentlyListenedArtists");

    res.status(200).json({
      message: "Recently listened artists privacy updated",
      showRecentlyListenedArtists: updatedUser.showRecentlyListenedArtists,
    });
  } catch (error) {
    next(error);
  }
};

export const getTopTracksThisMonth = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    if (currentUserId.toString() !== userId) {
      return res.status(403).json({
        message: "Access denied. You can only view your own top tracks.",
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topTracks = await ListenHistory.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          listenedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$song",
          listenCount: { $sum: 1 },
          lastListened: { $max: "$listenedAt" },
        },
      },
      { $sort: { listenCount: -1, lastListened: -1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "songs",
          localField: "_id",
          foreignField: "_id",
          as: "songDetails",
        },
      },
      { $unwind: "$songDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "songDetails.artist",
          foreignField: "_id",
          as: "artists",
        },
      },
      { $addFields: { artist: "$artists" } },
      {
        $lookup: {
          from: "albums",
          localField: "songDetails.albumId",
          foreignField: "_id",
          as: "album",
        },
      },
      { $unwind: { path: "$album", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          artistName: {
            $cond: {
              if: { $gt: [{ $size: "$artist" }, 0] },
              then: { $arrayElemAt: ["$artist.name", 0] },
              else: "Unknown Artist",
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            _id: "$songDetails._id",
            title: "$songDetails.title",
            images: "$songDetails.images",
            duration: "$songDetails.duration",
            playCount: "$songDetails.playCount",
            listenCount: "$listenCount",
            lastListened: "$lastListened",
            artist: "$artist",
            album: {
              _id: "$album._id" || null,
              title: "$album.title" || "Unknown Album",
              images: "$album.images",
            },
          },
        },
      },
    ]);

    res.status(200).json({ tracks: topTracks });
  } catch (error) {
    next(error);
  }
};

export const getOnboardingArtists = async (req, res, next) => {
  try {
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const limit = Math.min(
      Math.max(1, parseInt(req.query.limit, 10) || ONBOARDING_ARTISTS_PAGE_SIZE),
      ONBOARDING_ARTISTS_PAGE_SIZE,
    );
    const result = await selectDiverseOnboardingArtists({ skip, limit });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const completeTasteOnboarding = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { artistIds } = req.body;
    if (!Array.isArray(artistIds)) {
      return res.status(400).json({ message: "artistIds must be an array" });
    }

    const uniqueIds = [...new Set(artistIds.map((id) => String(id).trim()))];
    if (uniqueIds.length !== artistIds.length) {
      return res.status(400).json({ message: "artistIds must be unique" });
    }

    if (uniqueIds.length < TASTE_ONBOARDING_MIN_ARTISTS) {
      return res.status(400).json({
        message: `Select at least ${TASTE_ONBOARDING_MIN_ARTISTS} artists`,
      });
    }

    if (uniqueIds.length > TASTE_ONBOARDING_MAX_ARTISTS) {
      return res.status(400).json({
        message: `Select at most ${TASTE_ONBOARDING_MAX_ARTISTS} artists`,
      });
    }

    const invalidId = uniqueIds.find(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidId) {
      return res.status(400).json({ message: "Invalid artist id" });
    }

    const user = await completeTasteOnboardingService(userId, uniqueIds);
    const payload = await buildAuthPayload(user, false);
    res.status(200).json(payload);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const getAllTopTracksThisMonth = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;

    if (currentUserId.toString() !== userId) {
      return res.status(403).json({
        message: "Access denied. You can only view your own top tracks.",
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topTracks = await ListenHistory.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          listenedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: "$song",
          listenCount: { $sum: 1 },
          lastListened: { $max: "$listenedAt" },
        },
      },
      { $sort: { listenCount: -1, lastListened: -1 } },
      {
        $lookup: {
          from: "songs",
          localField: "_id",
          foreignField: "_id",
          as: "songDetails",
        },
      },
      { $unwind: "$songDetails" },
      {
        $lookup: {
          from: "artists",
          localField: "songDetails.artist",
          foreignField: "_id",
          as: "artists",
        },
      },
      { $addFields: { artist: "$artists" } },
      {
        $lookup: {
          from: "albums",
          localField: "songDetails.albumId",
          foreignField: "_id",
          as: "album",
        },
      },
      { $unwind: { path: "$album", preserveNullAndEmptyArrays: true } },
      { $limit: 30 },
      {
        $addFields: {
          artistName: {
            $cond: {
              if: { $gt: [{ $size: "$artist" }, 0] },
              then: { $arrayElemAt: ["$artist.name", 0] },
              else: "Unknown Artist",
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            _id: "$songDetails._id",
            title: "$songDetails.title",
            images: "$songDetails.images",
            duration: "$songDetails.duration",
            playCount: "$songDetails.playCount",
            listenCount: "$listenCount",
            lastListened: "$lastListened",
            artist: "$artist",
            album: {
              _id: "$album._id" || null,
              title: "$album.title" || "Unknown Album",
              images: "$album.images",
            },
          },
        },
      },
    ]);

    res.status(200).json({ tracks: topTracks });
  } catch (error) {
    next(error);
  }
};
