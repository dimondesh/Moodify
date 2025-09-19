// frontend/src/stores/usePlayCountStore.ts
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

interface PlayCountStore {
  incrementPlayCount: (songId: string) => Promise<void>;
}

export const usePlayCountStore = create<PlayCountStore>(() => ({
  incrementPlayCount: async (songId: string) => {
    try {
      await axiosInstance.post(`/songs/${songId}/play`);
    } catch (error) {
      console.error("Failed to increment play count:", error);
    }
  },
}));
