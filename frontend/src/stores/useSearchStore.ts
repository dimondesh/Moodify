// src/stores/useSearchStore.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import {
  Playlist,
  Song,
  Album,
  Artist,
  User,
  Mix,
  RecentSearchItem,
} from "../types";

interface SearchState {
  query: string;
  songs: Song[];
  albums: Album[];
  playlists: Playlist[];
  users: User[];
  mixes: Mix[];
  artists: Artist[];
  loading: boolean;
  error: string | null;
  recentSearches: RecentSearchItem[];
  isRecentLoading: boolean;

  setQuery: (q: string) => void;
  search: (q: string) => Promise<void>;

  fetchRecentSearches: () => Promise<void>;
  addRecentSearch: (itemId: string, itemType: string) => Promise<void>;
  removeRecentSearch: (searchId: string) => Promise<void>;
  clearRecentSearches: () => Promise<void>;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  songs: [],
  albums: [],
  playlists: [],
  artists: [],
  users: [],
  mixes: [],
  recentSearches: [],
  isRecentLoading: false,

  loading: false,
  error: null,

  setQuery: (q) => set({ query: q }),

  search: async (q) => {
    if (!q.trim()) {
      set({
        songs: [],
        albums: [],
        playlists: [],
        artists: [],
        users: [],
        mixes: [],
        loading: false,
        error: null,
        query: "",
      });
      return;
    }

    set({ loading: true, error: null, query: q });

    try {
      const res = await axiosInstance.get("/search", { params: { q } });
      set({
        songs: res.data.songs || [],
        albums: res.data.albums || [],
        playlists: res.data.playlists || [],
        artists: res.data.artists || [],
        users: res.data.users || [],
        mixes: res.data.mixes || [],
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message || "Failed to search", loading: false });
    }
  },
  fetchRecentSearches: async () => {
    set({ isRecentLoading: true });
    try {
      const res = await axiosInstance.get("/users/me/recent-searches");
      set({ recentSearches: res.data, isRecentLoading: false });
    } catch (e) {
      console.error("Failed to fetch recent searches", e);
      set({ isRecentLoading: false });
    }
  },

  addRecentSearch: async (itemId, itemType) => {
    try {
      await axiosInstance.post("/users/me/recent-searches", {
        itemId,
        itemType,
      });
    } catch (e) {
      console.error("Failed to add recent search", e);
    }
  },

  removeRecentSearch: async (searchId: string) => {
    set((state) => ({
      recentSearches: state.recentSearches.filter(
        (s) => s.searchId !== searchId
      ),
    }));
    try {
      await axiosInstance.delete(`/users/me/recent-searches/${searchId}`);
    } catch (e) {
      console.error("Failed to remove recent search", e);
      get().fetchRecentSearches();
    }
  },

  clearRecentSearches: async () => {
    set({ recentSearches: [] });
    try {
      await axiosInstance.delete(`/users/me/recent-searches/all`);
    } catch (e) {
      console.error("Failed to clear recent searches", e);
      get().fetchRecentSearches();
    }
  },
}));
