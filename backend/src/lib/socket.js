// backend/src/lib/socket.js
import { Server } from "socket.io";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { Song } from "../models/song.model.js";
import { Artist } from "../models/artist.model.js";
import { firebaseAdmin } from "./firebase.js";
import { clearUploadInProgress } from "./activeUploads.service.js";
export let io;

export const initializeSocket = (server) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN_URL;

  io = new Server(server, {
    cors: {
      origin: allowedOrigin,
      credentials: true,
    },
    connectTimeout: 10000,
  });

  const userSockets = new Map();
  const userActivities = new Map();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      const error = new Error("Authentication error: Token required.");
      error.data = { message: "No Firebase ID Token provided." };
      console.error("Socket.IO Auth Error: No token provided.");
      return next(error);
    }

    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
      console.log(
        "Socket.IO Middleware: Firebase ID Token decoded for UID:",
        decodedToken.uid
      );

      const user = await User.findOne({ firebaseUid: decodedToken.uid });

      if (!user) {
        const error = new Error("Authentication error: User not found.");
        error.data = {
          message: `User not found in DB for Firebase UID: ${decodedToken.uid}`,
        };
        console.error(
          "Socket.IO Auth Error: User not found in DB for Firebase UID:",
          decodedToken.uid
        );
        return next(error);
      }

      socket.userId = user._id.toString();
      console.log(
        `Socket.IO Middleware: User ${socket.userId} (MongoDB _id) authenticated.`
      );
      next();
    } catch (error) {
      const authError = new Error("Authentication error: Invalid token.");
      authError.data = { message: error.message };
      console.error("Socket.IO Auth Error: Invalid token", error.message);
      next(authError);
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    if (!userId) {
      console.error(
        "Socket connection established without a valid userId. Disconnecting."
      );
      socket.disconnect(true);
      return;
    }
    const user = await User.findById(userId).select("isAnonymous").lean();
    const isUserAnonymous = user?.isAnonymous || false;

    if (!isUserAnonymous) {
      userSockets.set(userId, socket.id);
      userActivities.set(userId, "Idle");
      io.emit("user_connected", userId);
    }

    const onlineUserIds = Array.from(userSockets.keys());
    const visibleOnlineUsers = await User.find({
      _id: { $in: onlineUserIds },
      isAnonymous: false,
    }).select("_id");
    io.emit(
      "users_online",
      visibleOnlineUsers.map((u) => u._id.toString())
    );
    io.emit("activities", Array.from(userActivities.entries()));

    console.log(`User ${userId} (MongoDB _id) connected via Socket.IO`);

    socket.on("update_activity", async ({ songId }) => {
      const userId = socket.userId;
      const user = await User.findById(userId).select("isAnonymous").lean();
      if (user?.isAnonymous) {
        if (userActivities.get(userId) !== "Idle") {
          userActivities.set(userId, "Idle");
          io.emit("activity_updated", { userId, activity: "Idle" });
        }
        return;
      }
      console.log(
        `[Socket] Received update_activity for userId: ${userId}, songId: ${songId}`
      );
      let activityData = "Idle";

      if (songId) {
        try {
          const song = await Song.findById(songId).populate({
            path: "artist",
            model: "Artist",
            select: "name _id",
          });

          if (song) {
            const artistsData = Array.isArray(song.artist)
              ? song.artist.map((a) => ({
                  artistId: a._id,
                  artistName: a.name,
                }))
              : [];

            activityData = {
              songId: song._id,
              songTitle: song.title,
              artists: artistsData,
              albumId: song.albumId,
            };
            console.log(`[Socket] Formatted activity object:`, activityData);
          }
        } catch (error) {
          console.error(
            "Ошибка при получении данных песни для активности:",
            error
          );
          activityData = "Idle";
        }
      }

      userActivities.set(userId, activityData);
      io.emit("activity_updated", { userId, activity: activityData });
      console.log(
        `[Socket] Emitting activity_updated: ${userId}`,
        activityData
      );
    });

    socket.on("send_message", async (data) => {
      try {
        const { receiverId, content, type, shareDetails } = data;

        const senderId = userId;

        if (!receiverId || !content) {
          console.error("send_message error: receiverId or content missing.");
          socket.emit(
            "message_error",
            "Receiver ID or message content missing."
          );
          return;
        }
        const sender = await User.findById(senderId)
          .select("followingUsers")
          .lean();
        const receiver = await User.findById(receiverId)
          .select("followingUsers")
          .lean();

        if (!sender || !receiver) {
          socket.emit("message_error", "User not found.");
          return;
        }

        const senderFollowsReceiver = sender.followingUsers.some((id) =>
          id.equals(receiverId)
        );
        const receiverFollowsSender = receiver.followingUsers.some((id) =>
          id.equals(senderId)
        );

        if (!senderFollowsReceiver || !receiverFollowsSender) {
          console.log(
            `Message blocked: User ${senderId} and ${receiverId} are not mutual followers.`
          );
          socket.emit(
            "message_error",
            "You can only message mutual followers."
          );
          return;
        }

        const messageData = {
          senderId,
          receiverId,
          content,
          type: type || "text",
        };

        if (type === "share" && shareDetails) {
          messageData.shareDetails = {
            entityType: shareDetails.entityType,
            entityId: shareDetails.entityId,
          };
        }

        const message = await Message.create(messageData);

        const receiverSocketId = userSockets.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", message);
        } else {
          console.log(`Receiver ${receiverId} not online to receive message.`);
        }

        socket.emit("message_sent", message);
      } catch (error) {
        console.error("Message error:", error);
        socket.emit("message_error", error.message);
      }
    });
    socket.on("typing_started", ({ receiverId }) => {
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing_started", { senderId: userId });
      }
    });

    socket.on("typing_stopped", ({ receiverId }) => {
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing_stopped", { senderId: userId });
      }
    });

    socket.on("mark_messages_as_read", async ({ chatPartnerId }) => {
      try {
        await Message.updateMany(
          { senderId: chatPartnerId, receiverId: userId, isRead: false },
          { $set: { isRead: true } }
        );

        const senderSocketId = userSockets.get(chatPartnerId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messages_marked_read", {
            chatPartnerId: userId,
          });
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    socket.on("join_playlist_room", (playlistId) => {
      socket.join(`playlist-${playlistId}`);
      console.log(`User ${userId} joined room for playlist ${playlistId}`);
    });

    socket.on("leave_playlist_room", (playlistId) => {
      socket.leave(`playlist-${playlistId}`);
      console.log(`User ${userId} left room for playlist ${playlistId}`);
    });

    socket.on("join_mix_room", (mixId) => {
      socket.join(`mix-${mixId}`);
      console.log(`User ${userId} joined room for mix ${mixId}`);
    });

    socket.on("leave_mix_room", (mixId) => {
      socket.leave(`mix-${mixId}`);
      console.log(`User ${userId} left room for mix ${mixId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        `User ${userId} (MongoDB _id) disconnected from Socket.IO. Reason: ${reason}`
      );

      if (userSockets.has(userId)) {
        userSockets.delete(userId);
        userActivities.delete(userId);
        // Снимаем флаг загрузки при отключении пользователя
        clearUploadInProgress();
        io.emit("user_disconnected", userId);
      }
    });
  });

  return { userSockets, userActivities };
};
