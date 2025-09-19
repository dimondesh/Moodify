// frontend/src/stores/useMixesStore.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";
import type { Mix } from "@/types";
import { useLibraryStore } from "./useLibraryStore";
import { useOfflineStore } from "./useOfflineStore";
import { getUserItem } from "@/lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import i18n from "@/lib/i18n";

interface CachedMix {
  data: Mix;
  timestamp: number;
}

interface MixesData {
  genreMixes: Mix[];
  moodMixes: Mix[];
}

interface MixesStore {
  genreMixes: Mix[];
  moodMixes: Mix[];
  currentMix: Mix | null;
  cachedMixes: Map<string, CachedMix>;
  isLoading: boolean;
  error: string | null;
  fetchMixById: (id: string) => Promise<void>;
  fetchDailyMixes: () => Promise<void>;
  toggleMixInLibrary: (mixId: string) => Promise<void>;
}

const CACHE_DURATION = 60 * 60 * 1000;

export const useMixesStore = create<MixesStore>((set, get) => ({
  genreMixes: [],
  moodMixes: [],
  isLoading: false,
  error: null,
  currentMix: null,
  cachedMixes: new Map(),

  fetchDailyMixes: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get<MixesData>("/mixes");
      set({
        genreMixes: response.data.genreMixes,
        moodMixes: response.data.moodMixes,
        isLoading: false,
      });
    } catch (err: any) {
      console.error("Failed to fetch mixes inlibrary:", err);
      toast.error(
        err.response?.data?.message || i18n.t("errors.fetchMixesError")
      );
    }
  },

  toggleMixInLibrary: async (mixId: string) => {
    try {
      const response = await axiosInstance.post(`/library/mixes/toggle`, {
        mixId,
      });
      const { isSaved } = response.data;
      toast.success(
        isSaved
          ? i18n.t("toasts.mixAddedToLibrary")
          : i18n.t("toasts.mixRemovedFromLibrary")
      );

      useLibraryStore.getState().fetchLibrary();
    } catch (err: any) {
      console.error("Failed to toggle mix in library:", err);
      toast.error(
        err.response?.data?.message || i18n.t("errors.libraryUpdateError")
      );
    }
  },
  fetchMixById: async (id: string) => {
    const { cachedMixes } = get();
    const cachedEntry = cachedMixes.get(id);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
      console.log(`[Cache] Loading mix ${id} from cache.`);
      set({ currentMix: cachedEntry.data, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    const { isOffline } = useOfflineStore.getState();
    const { isDownloaded } = useOfflineStore.getState().actions;
    const userId = useAuthStore.getState().user?.id;

    if (isDownloaded(id) && userId) {
      console.log(`[Offline] Loading mix ${id} from IndexedDB.`);
      const localMix = await getUserItem("mixes", id, userId);
      if (localMix) {
        set({ currentMix: localMix, isLoading: false });
        return;
      }
    }

    if (isOffline) {
      const errorMsg = i18n.t("errors.mixNotAvailableOffline");
      set({ currentMix: null, error: errorMsg, isLoading: false });
      toast.error(errorMsg);
      return;
    }
    try {
      const response = await axiosInstance.get(`/mixes/${id}`);
      set((state) => ({
        currentMix: response.data,
        isLoading: false,
        cachedMixes: new Map(state.cachedMixes).set(id, {
          data: response.data,
          timestamp: Date.now(),
        }),
      }));
    } catch (err: any) {
      set({
        error: err.message || i18n.t("errors.fetchMixError"),
        isLoading: false,
      });
    }
  },
}));
