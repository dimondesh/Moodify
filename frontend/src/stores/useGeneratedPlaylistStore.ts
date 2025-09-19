// src/stores/useGeneratedPlaylistStore.ts

import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import type { GeneratedPlaylist } from "@/types";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { useOfflineStore } from "./useOfflineStore";
import { useAuthStore } from "./useAuthStore";
import { getUserItem } from "@/lib/offline-db";

interface CachedGeneratedPlaylist {
  data: GeneratedPlaylist;
  timestamp: number;
}

interface GeneratedPlaylistStore {
  allGeneratedPlaylists: GeneratedPlaylist[];
  currentPlaylist: GeneratedPlaylist | null;
  cachedGeneratedPlaylists: Map<string, CachedGeneratedPlaylist>; 
  isLoading: boolean;
  error: string | null;

  fetchAllGeneratedPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<void>;
  reset: () => void;
}

const CACHE_DURATION =  60 * 60 * 1000;

export const useGeneratedPlaylistStore = create<GeneratedPlaylistStore>(
  (set, get) => ({
    allGeneratedPlaylists: [],
    currentPlaylist: null,
    cachedGeneratedPlaylists: new Map(), 
    isLoading: false,
    error: null,

    fetchAllGeneratedPlaylists: async () => {
      set({ isLoading: true, error: null });
      try {
        const response = await axiosInstance.get("/generated-playlists/me");
        set({ allGeneratedPlaylists: response.data || [], isLoading: false });
      } catch (err) {
        console.error("Failed to fetch all generated playlists:", err);
        set({ isLoading: false, allGeneratedPlaylists: [] });
      }
    },

    fetchPlaylistById: async (id: string) => {
      const { cachedGeneratedPlaylists } = get();
      const cachedEntry = cachedGeneratedPlaylists.get(id);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(`[Cache] Loading generated playlist ${id} from cache.`);
        set({
          currentPlaylist: cachedEntry.data,
          isLoading: false,
          error: null,
        });
        return;
      }

      set({ isLoading: true, error: null, currentPlaylist: null });

      const { isOffline } = useOfflineStore.getState();
      const { isDownloaded } = useOfflineStore.getState().actions;
      const userId = useAuthStore.getState().user?.id;

      if (isDownloaded(id) && userId) {
        console.log(
          `[Offline] Loading generated playlist ${id} from IndexedDB.`
        );
        try {
          const localPlaylist = await getUserItem("playlists", id, userId);
          if (localPlaylist) {
            set({
              currentPlaylist: localPlaylist as unknown as GeneratedPlaylist,
              isLoading: false,
            });
            return;
          }
        } catch (e) {
          console.error("Failed to load generated playlist from DB", e);
        }
      }

      if (isOffline) {
        const errorMsg =
          "This playlist is not downloaded and is unavailable offline.";
        set({ currentPlaylist: null, error: errorMsg, isLoading: false });
        toast.error(errorMsg);
        return;
      }

      try {
        const response = await axiosInstance.get(`/generated-playlists/${id}`);
        set((state) => ({
          currentPlaylist: response.data,
          isLoading: false,
          cachedGeneratedPlaylists: new Map(state.cachedGeneratedPlaylists).set(
            id,
            {
              data: response.data,
              timestamp: Date.now(),
            }
          ),
        }));
      } catch (err) {
        let errorMessage = "Failed to fetch this playlist";
        if (err instanceof AxiosError && err.response?.data?.message) {
          errorMessage = err.response.data.message;
        }
        set({ error: errorMessage, isLoading: false });
        toast.error(errorMessage);
      }
    },

    reset: () => {
      set({ currentPlaylist: null, isLoading: false, error: null });
    },
  })
);
