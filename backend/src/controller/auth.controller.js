// backend/src/controller/auth.controller.js

import { User } from "../models/user.model.js";
import { firebaseAdmin } from "../lib/firebase.js";

export const syncUserWithDb = async (req, res) => {
  console.log("Start user sync");

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const { uid, email, name, picture } = decodedToken;

    if (!uid || !email) {
      return res.status(400).json({ error: "Token is missing UID or email" });
    }

    // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ЛОГИКИ ---

    // 1. Ищем пользователя в нашей БД
    let user = await User.findOne({ firebaseUid: uid });

    // 2. Если пользователя нет, создаем его
    if (!user) {
      console.log(`User with firebaseUid ${uid} not found. Creating new user.`);
      user = new User({
        firebaseUid: uid,
        email: email,
        fullName: name || email.split("@")[0], // Используем name или часть email как имя по умолчанию
        imageUrl: picture || null, // Картинка по умолчанию
        language: "en",
      });
      await user.save();
      console.log(
        `✅ New user created: ${user.email} with MongoDB ID: ${user._id}`
      );
    } else {
      console.log(
        `✅ User already exists, returning data from MongoDB for ${user.email}`
      );
    }

    // 3. Отправляем на фронтенд актуальные данные из НАШЕЙ базы данных
    res.status(200).json({
      message: "User synced successfully",
      user: {
        _id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        fullName: user.fullName,
        imageUrl: user.imageUrl,
        language: user.language,
      },
    });
  } catch (error) {
    // ... обработка ошибок остается прежней ...
    console.error("❌ User sync error caught on backend:", error);
    if (error.code === "auth/id-token-expired") {
      return res
        .status(401)
        .json({ error: "Token expired, please log in again." });
    }
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
