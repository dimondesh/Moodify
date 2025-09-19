/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type { Message, User } from "../types";

import { io, Socket } from "socket.io-client";
import type { DefaultEventsMap } from "@socket.io/component-emitter";
import { auth } from "../lib/firebase";
import { useAuthStore } from "./useAuthStore";
import { useOfflineStore } from "./useOfflineStore";
interface ArtistInfo {
  artistId: string;
  artistName: string;
}

export interface UserActivity {
  songId: string;
  songTitle: string;
  artists: ArtistInfo[];
  albumId: string;
}

interface ChatStore {
  users: User[];
  isLoading: boolean;
  isChatPageActive: boolean;

  error: string | null;
  socket: Socket<DefaultEventsMap, DefaultEventsMap>;
  isConnected: boolean;
  onlineUsers: Set<string>;
  userActivities: Map<string, UserActivity | "Idle">;
  messages: Message[];
  selectedUser: User | null;
  unreadMessages: Map<string, number>;
  typingUsers: Map<string, boolean>;

  fetchUsers: () => Promise<void>;

  initSocket: (mongoDbUserId: string) => Promise<void>;
  disconnectSocket: () => void;
  sendMessage: (
    receiverId: string,
    senderId: string,
    content: string,
    type?: "text" | "share",
    shareDetails?: {
      entityType: "song" | "album" | "playlist" | "mix";
      entityId: string;
    }
  ) => void;
  fetchMessages: (userId: string) => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  setIsChatPageActive: (isActive: boolean) => void;

  setSelectedUser: (user: User | null) => void;
  markChatAsRead: (chatId: string) => void;
  startTyping: (receiverId: string) => void;
  stopTyping: (receiverId: string) => void;
  markMessagesAsRead: (chatPartnerId: string) => void;
}

const baseURL = import.meta.env.VITE_SOCKETIO_URL;

const socket: Socket<DefaultEventsMap, DefaultEventsMap> = io(baseURL, {
  autoConnect: false,
  auth: {},
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

let listenersRegistered = false;
export const useChatStore = create<ChatStore>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  socket: socket,
  isConnected: false,
  onlineUsers: new Set(),
  userActivities: new Map(),
  messages: [],
  selectedUser: null,
  unreadMessages: new Map(),
  typingUsers: new Map(),
  isChatPageActive: false,

  setSelectedUser: (user) => {
    set({ selectedUser: user });
    if (user) {
      get().markChatAsRead(user._id);
      get().markMessagesAsRead(user._id);
    }
  },

  setIsChatPageActive: (isActive) => set({ isChatPageActive: isActive }),

  markChatAsRead: (chatId: string) => {
    set((state) => {
      if (!state.unreadMessages.has(chatId)) return state;

      const newUnread = new Map(state.unreadMessages);
      newUnread.delete(chatId);
      return { unreadMessages: newUnread };
    });
  },

  fetchUnreadCounts: async () => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await axiosInstance.get("/users/unread-counts", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const countsMap = new Map<string, number>(Object.entries(response.data));
      set({ unreadMessages: countsMap });
      console.log("Unread counts fetched:", countsMap);
    } catch (error) {
      console.error("Failed to fetch unread message counts:", error);
    }
  },

  fetchUsers: async () => {
    if (useOfflineStore.getState().isOffline) return;

    const { user: authUser } = useAuthStore.getState();
    if (!authUser || !authUser.id) {
      console.warn(
        "fetchUsers: No authenticated user or user ID available. Skipping fetch."
      );
      set({
        isLoading: false,
        error: "Authentication required to fetch users.",
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(
          "No Firebase user is logged in to get ID token for fetching users."
        );
      }
      const token = await currentUser.getIdToken();
      const response = await axiosInstance.get("/users/mutuals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({
        users: Array.isArray(response.data)
          ? response.data
          : response.data.users || [],
      });
    } catch (error: any) {
      console.error("Failed to fetch users:", error);
      set({ error: error.response?.data?.message || "Failed to fetch users" });
    } finally {
      set({ isLoading: false });
    }
  },

  initSocket: async (mongoDbUserId: string) => {
    if (useOfflineStore.getState().isOffline) {
      console.log("[Offline] Skipping initSocket.");
      return;
    }
    if (!mongoDbUserId) {
      console.warn(
        "initSocket: MongoDB User ID is missing or invalid. Cannot initialize socket."
      );
      set({ error: "Socket.IO init failed: MongoDB User ID is missing." });
      return;
    }

    if (get().isConnected || socket.connected) {
      console.log(
        "initSocket: Socket already connected or connecting. Aborting init."
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn(
        "initSocket: No Firebase user is logged in. Cannot get ID token."
      );
      set({ error: "Socket.IO init failed: No Firebase user logged in." });
      return;
    }

    try {
      const idToken = await currentUser.getIdToken(true);
      socket.auth = { token: idToken };
      console.log(
        "initSocket: Firebase ID Token obtained, setting socket.auth."
      );

      if (!listenersRegistered) {
        console.log("initSocket: Registering Socket.IO listeners...");
        socket.on("connect", () => {
          set({ isConnected: true, error: null });
          console.log(
            "Socket.IO: 'connect' event - Socket connected. Emitting 'user_connected'."
          );
          socket.emit("user_connected", mongoDbUserId);
          get().fetchUnreadCounts();
        });

        socket.on("connect_error", (err: any) => {
          console.error(
            "Socket.IO: 'connect_error' event - Connection error:",
            err.message,
            err.data?.message || ""
          );
          set({
            isConnected: false,
            error: `Socket connection failed: ${err.message}. Details: ${
              err.data?.message || "N/A"
            }`,
          });
        });

        socket.on("disconnect", (reason: string) => {
          console.log(
            "Socket.IO: 'disconnect' event - Socket disconnected. Reason:",
            reason
          );
          set({
            isConnected: false,
            onlineUsers: new Set(),
            userActivities: new Map(),
            error: `Socket disconnected: ${reason}`,
          });
        });

        socket.on("users_online", (users: string[]) => {
          console.log(
            "Socket.IO: 'users_online' event - Received online users:",
            users
          );
          set({ onlineUsers: new Set(users) });
        });

        socket.on(
          "activities",
          (activities: [string, UserActivity | "Idle"][]) => {
            console.log(
              "Socket.IO: 'activities' event - Received activities:",
              activities
            );
            set({ userActivities: new Map(activities) });
          }
        );

        socket.on("user_connected", (userId: string) => {
          console.log(
            "Socket.IO: 'user_connected' event - User connected:",
            userId
          );
          set((state) => ({
            onlineUsers: new Set([...state.onlineUsers, userId]),
          }));
        });

        socket.on("user_disconnected", (userId: string) => {
          console.log(
            "Socket.IO: 'user_disconnected' event - User disconnected:",
            userId
          );
          set((state) => {
            const newOnlineUsers = new Set(state.onlineUsers);
            newOnlineUsers.delete(userId);
            return { onlineUsers: newOnlineUsers };
          });
        });

        socket.on("receive_message", (message: Message) => {
          console.log(
            "Socket.IO: 'receive_message' event - Received message:",
            message
          );
          const { selectedUser, isChatPageActive } = get();

          const isMessageReadNow =
            isChatPageActive && selectedUser?._id === message.senderId;

          if (isMessageReadNow) {
            set((state) => ({
              messages: [...state.messages, { ...message, isRead: true }],
            }));
            get().markMessagesAsRead(message.senderId);
          } else {
            set((state) => {
              const newUnread = new Map(state.unreadMessages);
              newUnread.set(
                message.senderId,
                (newUnread.get(message.senderId) || 0) + 1
              );
              return { unreadMessages: newUnread };
            });
          }
        });
        socket.on("messages_marked_read", ({ chatPartnerId }) => {
          const { selectedUser } = get();
          if (selectedUser && selectedUser._id === chatPartnerId) {
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.senderId === useAuthStore.getState().user?.id
                  ? { ...msg, isRead: true }
                  : msg
              ),
            }));
          }
        });
        socket.on("message_sent", (message: Message) => {
          console.log(
            "Socket.IO: 'message_sent' event - Message sent confirmation:",
            message
          );
          const currentMessages = get().messages;
          if (!currentMessages.some((m) => m._id === message._id)) {
            set((state) => ({
              messages: [...state.messages, message],
            }));
          }
        });

        socket.on("activity_updated", ({ userId, activity }) => {
          console.log(
            `Socket.IO: 'activity_updated' event - User ${userId} activity updated to ${activity}`
          );
          set((state) => {
            const newActivities = new Map(state.userActivities);
            newActivities.set(userId, activity);
            return { userActivities: newActivities };
          });
        });
        socket.on("messages_marked_read", ({ chatPartnerId }) => {
          const { selectedUser } = get();
          if (selectedUser && selectedUser._id === chatPartnerId) {
            set((state) => ({
              messages: state.messages.map((msg) =>
                msg.receiverId === chatPartnerId
                  ? { ...msg, isRead: true }
                  : msg
              ),
            }));
          }
        });

        socket.on("typing_started", ({ senderId }) => {
          set((state) => {
            const newTypingUsers = new Map(state.typingUsers);
            newTypingUsers.set(senderId, true);
            return { typingUsers: newTypingUsers };
          });
        });

        socket.on("typing_stopped", ({ senderId }) => {
          set((state) => {
            const newTypingUsers = new Map(state.typingUsers);
            newTypingUsers.delete(senderId);
            return { typingUsers: newTypingUsers };
          });
        });

        listenersRegistered = true;
      }

      console.log("initSocket: Attempting to connect socket...");
      socket.connect();
    } catch (error: any) {
      console.error(
        "initSocket: Error getting Firebase ID Token or connecting Socket.IO:",
        error
      );
      set({ error: `Socket.IO init failed: ${error.message}` });
    }
  },

  disconnectSocket: () => {
    if (socket.connected) {
      console.log("disconnectSocket: Disconnecting socket...");
      socket.disconnect();
      set({
        isConnected: false,
        onlineUsers: new Set(),
        userActivities: new Map(),
      });
    } else {
      console.log("disconnectSocket: Socket is not connected.");
    }
  },

  sendMessage: (receiverId, senderId, content, type = "text", shareDetails) => {
    const currentSocket = get().socket;
    if (!currentSocket || !get().isConnected) {
      console.error(
        "sendMessage: Socket not connected for sending message. Cannot send."
      );
      set({ error: "Cannot send message: Socket not connected." });
      return;
    }
    console.log(
      `sendMessage: Emitting 'send_message' to ${receiverId} from ${senderId}...`
    );
    currentSocket.emit("send_message", {
      receiverId,
      senderId,
      content,
      type,
      shareDetails,
    });
  },

  fetchMessages: async (userId: string) => {
    if (useOfflineStore.getState().isOffline) return;

    set({ isLoading: true, error: null });
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error(
          "No Firebase user is logged in to get ID token for fetching messages."
        );
      }
      const token = await currentUser.getIdToken();

      const response = await axiosInstance.get(`/users/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ messages: response.data });
      get().markMessagesAsRead(userId);
    } catch (error: any) {
      console.error("fetchMessages: Failed to fetch messages:", error);
      set({
        error: error.response?.data?.message || "Failed to fetch messages",
      });
    } finally {
      set({ isLoading: false });
    }
  },
  startTyping: (receiverId) => {
    get().socket.emit("typing_started", { receiverId });
  },

  stopTyping: (receiverId) => {
    get().socket.emit("typing_stopped", { receiverId });
  },

  markMessagesAsRead: (chatPartnerId) => {
    get().socket.emit("mark_messages_as_read", { chatPartnerId });
    get().markChatAsRead(chatPartnerId);
  },
}));
