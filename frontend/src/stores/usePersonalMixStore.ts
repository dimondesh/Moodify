// src/stores/usePersonalMixStore.ts

import { create } from "zustand";
import { PersonalMix } from "@/types";

interface PersonalMixStore {
  personalMixes: PersonalMix[];
  isLoading: boolean;
  error: string | null;
  fetchPersonalMixes: () => Promise<void>;
  setPersonalMixes: (mixes: PersonalMix[]) => void;
  clearPersonalMixes: () => void;
}

export const usePersonalMixStore = create<PersonalMixStore>((set, get) => ({
  personalMixes: [],
  isLoading: false,
  error: null,

  fetchPersonalMixes: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const response = await fetch("/api/personal-mixes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch personal mixes: ${response.status}`);
      }

      const data = await response.json();
      set({ personalMixes: data, isLoading: false });
    } catch (error) {
      console.error("Error fetching personal mixes:", error);
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  setPersonalMixes: (mixes: PersonalMix[]) => {
    set({ personalMixes: mixes });
  },

  clearPersonalMixes: () => {
    set({ personalMixes: [], error: null });
  },
}));
