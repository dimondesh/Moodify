/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { axiosInstance } from "../lib/axios";
import { auth, signOut as firebaseSignOut } from "../lib/firebase";
import { useChatStore } from "./useChatStore";
import { usePlayerStore } from "./usePlayerStore";

interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  fullName: string;
  imageUrl?: string | null;
  isAdmin?: boolean;
  language?: string;
  isAnonymous?: boolean;
}

interface UpdateProfileData {
  fullName?: string;
  imageUrl?: File | null;
}

interface FirebaseUserDataForSync {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  fullName?: string;
}

interface AuthStore {
  user: AuthUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;

  setUser: (user: AuthUser | null) => void;
  syncUser: (userData: FirebaseUserDataForSync) => Promise<void>;
  fetchUser: (firebaseUid: string) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
  updateUserProfile: (data: UpdateProfileData) => Promise<void>;
  updateUserLanguage: (language: string) => Promise<void>;
  updateUserPrivacy: (isAnonymous: boolean) => Promise<void>;
}

const getAuthHeaders = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return {};
  const token = await currentUser.getIdToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAdmin: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAdmin: user?.isAdmin ?? false }),

      updateUserLanguage: async (language: string) => {
        set({ isLoading: true, error: null });
        try {
          const authHeaders = await getAuthHeaders();
          await axiosInstance.put("/users/language", { language }, authHeaders);

          set((state) => ({
            user: state.user ? { ...state.user, language } : state.user,
            isLoading: false,
          }));
          console.log("AuthStore: User language updated.");
        } catch (error: any) {
          console.error("AuthStore: Update language error:", error);
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

          const authHeaders = await getAuthHeaders();

          const config = {
            headers: {
              ...authHeaders.headers,
              "Content-Type": "multipart/form-data",
            },
          };

          const response = await axiosInstance.put(
            "/users/me",
            formData,
            config
          );

          const updatedUser = response.data.user;

          set((state) => ({
            user: state.user ? { ...state.user, ...updatedUser } : updatedUser,
            isLoading: false,
          }));

          console.log("AuthStore: User profile updated.");
        } catch (error: any) {
          console.error("AuthStore: Update profile error:", error);
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

      syncUser: async (userData: FirebaseUserDataForSync) => {
        set({ isLoading: true, error: null });
        try {
          const payload = {
            firebaseUid: userData.uid,
            email: userData.email,
            fullName: userData.fullName || userData.displayName,
            imageUrl: userData.photoURL,
          };

          const headers = await getAuthHeaders();
          const response = await axiosInstance.post(
            "/auth/sync",
            payload,
            headers
          );

          const syncedUserFromBackend = response.data.user;

          if (
            !syncedUserFromBackend ||
            !syncedUserFromBackend._id ||
            !syncedUserFromBackend.firebaseUid
          ) {
            throw new Error(
              "Backend did not return a valid user with MongoDB ID or Firebase UID."
            );
          }

          const fullUser: AuthUser = {
            id: syncedUserFromBackend._id,
            firebaseUid: syncedUserFromBackend.firebaseUid,
            email: syncedUserFromBackend.email,
            fullName:
              syncedUserFromBackend.fullName || syncedUserFromBackend.email,
            imageUrl: syncedUserFromBackend.imageUrl || null,
            language: syncedUserFromBackend.language,
            isAnonymous: syncedUserFromBackend.isAnonymous,
            isAdmin: syncedUserFromBackend.isAdmin,
          };

          get().setUser(fullUser);
          set({ isLoading: false, error: null });
        } catch (error: any) {
          console.error("AuthStore: Sync error:", error);
          set({
            error: error.response?.data?.message || "Failed to sync user",
            isLoading: false,
            user: null,
            isAdmin: false,
          });
        }
      },

      fetchUser: async (firebaseUid: string) => {
        if (!navigator.onLine) {
          console.log(
            "AuthStore (fetchUser): Offline, skipping network request."
          );
          if (get().user) {
            set({ isLoading: false });
          }
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const currentUser = auth.currentUser;
          if (!currentUser || currentUser.uid !== firebaseUid) {
            throw new Error(
              "No active Firebase user or UID mismatch for fetchUser."
            );
          }

          await get().syncUser({
            uid: currentUser.uid,
            email: currentUser.email || "",
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          });

          set({ isLoading: false, error: null });
          console.log("AuthStore: User fetched via fetchUser.");
        } catch (error: any) {
          console.error(
            "AuthStore: Error fetching user data in fetchUser:",
            error
          );
          set({
            isLoading: false,
            user: null,
            error: error.message || "Failed to fetch user data.",
            isAdmin: false,
          });
        }
      },

      logout: async () => {
        set({ isLoading: true, error: null });
        try {
          await firebaseSignOut(auth);
          console.log("Firebase user signed out.");
          set({ user: null, isAdmin: false, isLoading: false, error: null });
        } catch (error: any) {
          console.error("Logout error:", error);
          set({
            isLoading: false,
            error: error.message || "Logout failed",
          });
        }
      },

      reset: () => {
        set({ user: null, isAdmin: false, isLoading: false, error: null });
      },
    }),
    {
      name: "moodify-studio-auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
