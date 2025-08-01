import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary"; // Для загрузки фото
import { Library } from "../models/library.model.js"; // <-- Убедитесь, что этот импорт есть
import { firebaseAdmin } from "../lib/firebase.js"; // <-- ДОБАВЬТЕ ЭТОТ ИМПОРТ

export const getAllUsers = async (req, res, next) => {
  try {
    const currentUserMongoId = req.user?.id;
    if (!currentUserMongoId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
    if (!myId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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
  if (!req.user) {
    return res.status(401).json({ message: "User not authenticated" });
  }
  res.status(200).json(req.user);
};
// backend/src/controller/user.controller.js

// --- НОВЫЕ КОНТРОЛЛЕРЫ ---

export const getUserProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profileUser = await User.findById(userId)
      .populate({
        path: "playlists",
        match: { isPublic: true },
        // --- ИЗМЕНЕНИЕ: Добавляем populate для owner ---
        populate: {
          path: "owner",
          model: "User",
          select: "fullName", // Получаем только имя владельца
        },
        select: "title imageUrl isPublic owner", // Убеждаемся, что owner выбран
      })
      .select("-email -firebaseUid");

    const library = await Library.findOne({ userId: userId }).lean();

    if (!profileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileData = profileUser.toObject();
    profileData.followersCount = profileUser.followers.length;
    profileData.followingUsersCount = profileUser.followingUsers.length;
    profileData.followingArtistsCount = library?.followedArtists?.length || 0;
    profileData.publicPlaylistsCount = profileUser.playlists.length;

    res.status(200).json(profileData);
  } catch (error) {
    next(error);
  }
};

export const getFollowers = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({
        path: "followers",
        select: "fullName imageUrl",
      })
      .select("followers");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // --- ИЗМЕНЕНИЕ: Приводим данные к универсальному виду { name, imageUrl, type } ---
    const followers = user.followers.map((f) => ({
      _id: f._id,
      name: f.fullName, // Переименовываем fullName в name
      imageUrl: f.imageUrl,
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

    const currentUser = await User.findById(currentUserMongoId);
    const userToFollow = await User.findById(userToFollowId);

    if (!userToFollow) {
      return res.status(404).json({ message: "User to follow not found" });
    }

    const isFollowing = currentUser.followingUsers.includes(userToFollowId);

    if (isFollowing) {
      // Отписаться
      await User.updateOne(
        { _id: currentUserMongoId },
        { $pull: { followingUsers: userToFollowId } }
      );
      await User.updateOne(
        { _id: userToFollowId },
        { $pull: { followers: currentUserMongoId } }
      );
      res.status(200).json({ message: "Unfollowed successfully" });
    } else {
      // Подписаться
      await User.updateOne(
        { _id: currentUserMongoId },
        { $addToSet: { followingUsers: userToFollowId } }
      );
      await User.updateOne(
        { _id: userToFollowId },
        { $addToSet: { followers: currentUserMongoId } }
      );
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
    const firebaseUid = req.user.firebaseUid; // Мы получаем его из protectRoute

    const updateDataMongo = {}; // Данные для обновления в MongoDB
    const updateDataFirebase = {}; // Данные для обновления в Firebase

    if (fullName) {
      updateDataMongo.fullName = fullName;
      updateDataFirebase.displayName = fullName;
    }

    if (req.files && req.files.imageUrl) {
      const file = req.files.imageUrl;
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "profile_pictures",
        public_id: `${userId}_${Date.now()}`,
      });
      updateDataMongo.imageUrl = result.secure_url;
      updateDataFirebase.photoURL = result.secure_url;
    }

    // Обновляем пользователя в MongoDB
    const updatedUser = await User.findByIdAndUpdate(userId, updateDataMongo, {
      new: true,
    }).select(
      "-email -firebaseUid -followers -followingUsers -followingArtists"
    ); // Отправляем только нужные данные

    // --- НОВОЕ: Обновляем пользователя в Firebase Auth ---
    if (Object.keys(updateDataFirebase).length > 0) {
      await firebaseAdmin.auth().updateUser(firebaseUid, updateDataFirebase);
      console.log(`Firebase user ${firebaseUid} updated.`);
    }

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
export const getMutualFollowers = async (req, res, next) => {
  try {
    const currentUserMongoId = req.user.id;
    const currentUser = await User.findById(currentUserMongoId).select(
      "followingUsers"
    );

    if (!currentUser)
      return res.status(404).json({ message: "Current user not found." });

    // Находим пользователей, на которых подписан текущий юзер
    const followedUsers = await User.find({
      _id: { $in: currentUser.followingUsers },
    }).select("fullName imageUrl followers");

    // Фильтруем, чтобы оставить только тех, кто подписан в ответ
    const mutuals = followedUsers.filter((user) =>
      user.followers.some((followerId) => followerId.equals(currentUserMongoId))
    );

    res.status(200).json({ users: mutuals });
  } catch (error) {
    next(error);
  }
};

export const getFollowing = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // 1. Получаем пользователей, на которых подписан
    const user = await User.findById(userId)
      .populate({
        path: "followingUsers",
        select: "fullName imageUrl",
      })
      .select("followingUsers");

    // 2. Получаем артистов, на которых подписан
    const library = await Library.findOne({ userId })
      .populate({
        path: "followedArtists.artistId",
        model: "Artist",
        select: "name imageUrl",
      })
      .select("followedArtists");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3. Форматируем и объединяем списки
    const followingUsers = user.followingUsers.map((u) => ({
      _id: u._id,
      name: u.fullName,
      imageUrl: u.imageUrl,
      type: "user",
    }));

    // --- КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Добавляем проверку на null ---
    const followedArtists =
      library?.followedArtists
        .filter((item) => item && item.artistId) // Отфильтровываем элементы, где артист был удален (artistId is null)
        .map((a) => ({
          _id: a.artistId._id, // Теперь это безопасно
          name: a.artistId.name,
          imageUrl: a.artistId.imageUrl,
          type: "artist",
        })) || [];

    const combinedFollowing = [...followingUsers, ...followedArtists];

    res.status(200).json({ items: combinedFollowing });
  } catch (error) {
    // Важно, чтобы глобальный обработчик ошибок ловил такие проблемы
    console.error("Error in getFollowing:", error);
    next(error);
  }
};

export const getPublicPlaylists = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate({
        path: "playlists",
        match: { isPublic: true },
        select: "title imageUrl owner",
      })
      .select("playlists");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const playlists = user.playlists.map((p) => ({
      ...p.toObject(),
      type: "playlist",
    }));

    res.status(200).json({ items: playlists });
  } catch (error) {
    next(error);
  }
};
