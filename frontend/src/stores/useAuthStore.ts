/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { axiosInstance } from "../lib/axios";
import { useChatStore } from "./useChatStore";
import { usePlayerStore } from "./usePlayerStore";

const migrateLocalStorageKey = (fromKey: string, toKey: string) => {
  try {
    if (typeof window === "undefined") return;
    const existingNew = localStorage.getItem(toKey);
    if (existingNew) return;
    const old = localStorage.getItem(fromKey);
    if (!old) return;
    localStorage.setItem(toKey, old);
    localStorage.removeItem(fromKey);
  } catch {
    // ignore
  }
};

migrateLocalStorageKey("moodify-studio-auth-storage", "moodify-auth-storage");

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  imageUrl?: string | null;
  coverAccentHex?: string | null;
  isAdmin?: boolean;
  language?: string;
  isAnonymous?: boolean;
  showRecentlyListenedArtists?: boolean;
}

interface UpdateProfileData {
  fullName?: string;
  imageUrl?: File | null;
}

function mapBackendUser(u: any): AuthUser {
  return {
    id: u._id,
    email: u.email,
    fullName: u.fullName || u.email,
    imageUrl: u.imageUrl || null,
    coverAccentHex: u.coverAccentHex ?? null,
    language: u.language,
    isAnonymous: u.isAnonymous,
    showRecentlyListenedArtists: u.showRecentlyListenedArtists,
    isAdmin: u.isAdmin,
  };
}

interface AuthStore {
  accessToken: string | null;
  user: AuthUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  tempEmail: string;
  setTempEmail: (email: string) => void;
  setUser: (user: AuthUser | null) => void;
  applyAuthResponse: (data: { token: string; user: any }) => void;
  bootstrapAuth: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerAccount: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  completeGoogleAccessToken: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
  updateUserProfile: (data: UpdateProfileData) => Promise<void>;
  updateUserLanguage: (language: string) => Promise<void>;
  updateUserPrivacy: (isAnonymous: boolean) => Promise<void>;
  updateRecentlyListenedArtistsPrivacy: (
    showRecentlyListenedArtists: boolean,
  ) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const getAuthHeaders = (get: () => AuthStore) => {
  const token = get().accessToken;
  if (!token) return {};
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAdmin: false,
      isLoading: false,
      error: null,
      tempEmail: "",
      setTempEmail: (email: string) => set({ tempEmail: email }),

      setUser: (user) => set({ user, isAdmin: user?.isAdmin ?? false }),

      applyAuthResponse: (data) => {
        const mapped = mapBackendUser(data.user);
        set({
          accessToken: data.token,
          user: mapped,
          isAdmin: mapped.isAdmin ?? false,
          isLoading: false,
          error: null,
        });
      },

      bootstrapAuth: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ isLoading: false });
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const response = await axiosInstance.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          get().applyAuthResponse(response.data);
        } catch (error: any) {
          const status = error?.response?.status;
          if (status === 401 || status === 404) {
            set({
              user: null,
              accessToken: null,
              isAdmin: false,
              isLoading: false,
              error: null,
            });
          } else {
            set({ isLoading: false });
          }
        }
      },

      loginWithPassword: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axiosInstance.post("/auth/login", {
            email: email.trim().toLowerCase(),
            password,
          });
          get().applyAuthResponse(response.data);
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || "Login failed",
          });
          throw error;
        }
      },

      registerAccount: async (email, password, fullName) => {
        set({ isLoading: true, error: null });
        try {
          await axiosInstance.post("/auth/register", {
            email: email.trim().toLowerCase(),
            password,
            fullName: fullName.trim(),
          });
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || "Registration failed",
          });
          throw error;
        }
      },

      verifyEmailCode: async (email, code) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axiosInstance.post("/auth/verify-email", {
            email: email.trim().toLowerCase(),
            code: String(code).trim(),
          });
          get().applyAuthResponse(response.data);
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || "Verification failed",
          });
          throw error;
        }
      },

      resendVerificationEmail: async (email) => {
        await axiosInstance.post("/auth/resend-verification", {
          email: email.trim().toLowerCase(),
        });
      },

      completeGoogleAccessToken: async (accessToken) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axiosInstance.post("/auth/google", {
            accessToken,
          });
          get().applyAuthResponse(response.data);
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.error || "Google sign-in failed",
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          useChatStore.getState().disconnectSocket();
        } catch {
          // ignore
        }
        set({
          user: null,
          accessToken: null,
          isAdmin: false,
          isLoading: false,
          error: null,
          tempEmail: "",
        });
        if (typeof window !== "undefined") {
          queueMicrotask(() => {
            window.location.reload();
          });
        }
      },

      reset: () => {
        set({
          user: null,
          accessToken: null,
          isAdmin: false,
          isLoading: false,
          error: null,
        });
      },

      updateUserLanguage: async (language: string) => {
        set({ isLoading: true, error: null });
        try {
          const authHeaders = getAuthHeaders(get);
          await axiosInstance.put("/users/language", { language }, authHeaders);

          set((state) => ({
            user: state.user ? { ...state.user, language } : state.user,
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.message || "Failed to update language",
            isLoading: false,
          });
          throw error;
        }
      },

      updateUserProfile: async (data: UpdateProfileData) => {
        set({ isLoading: true, error: null });
        try {
          const formData = new FormData();
          if (data.fullName) {
            formData.append("fullName", data.fullName);
          }
          if (data.imageUrl) {
            formData.append("imageUrl", data.imageUrl);
          }

          const authHeaders = getAuthHeaders(get);

          const config = {
            headers: {
              ...authHeaders.headers,
              "Content-Type": "multipart/form-data",
            },
          };

          const response = await axiosInstance.put(
            "/users/me",
            formData,
            config,
          );

          const updatedUser = response.data.user;

          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  ...mapBackendUser({
                    ...updatedUser,
                    email: state.user.email,
                  }),
                }
              : state.user,
            isLoading: false,
          }));
        } catch (error: any) {
          set({
            error: error.response?.data?.message || "Failed to update profile",
            isLoading: false,
          });
          throw error;
        }
      },

      updateUserPrivacy: async (isAnonymous: boolean) => {
        set({ isLoading: true });
        try {
          await axiosInstance.put("/users/privacy", { isAnonymous });
          set((state) => ({
            user: state.user ? { ...state.user, isAnonymous } : null,
            isLoading: false,
          }));

          const { socket } = useChatStore.getState();
          if (socket && socket.connected) {
            if (isAnonymous) {
              socket.emit("update_activity", { songId: null });
            } else {
              const { currentSong, isPlaying } = usePlayerStore.getState();
              if (isPlaying && currentSong) {
                socket.emit("update_activity", { songId: currentSong._id });
              } else {
                socket.emit("update_activity", { songId: null });
              }
            }
          }
        } catch (error) {
          console.error("Failed to update privacy settings:", error);
          set({ isLoading: false });
          throw error;
        }
      },

      updateRecentlyListenedArtistsPrivacy: async (
        showRecentlyListenedArtists: boolean,
      ) => {
        set({ isLoading: true });
        try {
          await axiosInstance.put("/users/recently-listened-artists-privacy", {
            showRecentlyListenedArtists,
          });
          set((state) => ({
            user: state.user
              ? { ...state.user, showRecentlyListenedArtists }
              : null,
            isLoading: false,
          }));
        } catch (error) {
          console.error(
            "Failed to update recently listened artists privacy:",
            error,
          );
          set({ isLoading: false });
          throw error;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        await axiosInstance.post(
          "/auth/change-password",
          { currentPassword, newPassword },
          getAuthHeaders(get),
        );
      },
    }),
    {
      name: "moodify-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAdmin: state.isAdmin,
        tempEmail: state.tempEmail,
        accessToken: state.accessToken,
      }),
    },
  ),
);
