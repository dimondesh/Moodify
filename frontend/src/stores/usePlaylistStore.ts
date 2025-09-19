// frontend/src/stores/usePlaylistStore.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import type { Playlist, Song } from "@/types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import { getUserItem, getAllUserPlaylists } from "@/lib/offline-db";
import { useAuthStore } from "./useAuthStore";

interface CachedPlaylist {
  data: Playlist;
  timestamp: number;
}

interface PlaylistStore {
  myPlaylists: Playlist[];
  ownedPlaylists: Playlist[];
  publicPlaylists: Playlist[];
  recommendations: Song[];
  isRecommendationsLoading: boolean;
  currentPlaylist: Playlist | null;
  cachedPlaylists: Map<string, CachedPlaylist>;
  isLoading: boolean;
  error: string | null;
  dominantColor: string | null;
  recommendedPlaylists: Playlist[];
  fetchRecommendedPlaylists: () => Promise<void>;
  setDominantColor: (color: string) => void;
  createPlaylistFromSong: (song: Song) => Promise<void>;
  updateCurrentPlaylistFromSocket: (playlist: Playlist) => void;
  generateAiPlaylist: (prompt: string) => Promise<Playlist | undefined>;
  fetchMyPlaylists: () => Promise<void>;
  fetchOwnedPlaylists: () => Promise<void>;
  fetchRecommendations: (playlistId: string) => Promise<void>;
  fetchPublicPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<void>;
  createPlaylist: (
    title: string,
    description: string,
    isPublic: boolean,
    imageFile?: File | null
  ) => Promise<Playlist | undefined>;
  updatePlaylist: (
    id: string,
    title: string,
    description: string,
    isPublic: boolean,
    imageFile?: File | null
  ) => Promise<Playlist | undefined>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  togglePlaylistInUserLibrary: (playlistId: string) => Promise<void>;
  addPlaylistLike: (playlistId: string) => Promise<void>;
  removePlaylistLike: (playlistId: string) => Promise<void>;
  resetCurrentPlaylist: () => void;
  fetchPlaylistDetails: (playlistId: string) => Promise<void>;
}

const CACHE_DURATION = 60 * 60 * 1000;

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  myPlaylists: [],
  ownedPlaylists: [],
  recommendations: [],
  isRecommendationsLoading: false,
  recommendedPlaylists: [],
  publicPlaylists: [],
  currentPlaylist: null,
  cachedPlaylists: new Map(),
  isLoading: false,
  error: null,
  dominantColor: null,
  setDominantColor: (color: string) => set({ dominantColor: color }),

  updateCurrentPlaylistFromSocket: (playlist) => {
    set((state) => {
      if (state.currentPlaylist?._id === playlist._id) {
        const newCachedPlaylists = new Map(state.cachedPlaylists);
        newCachedPlaylists.set(playlist._id, {
          data: playlist,
          timestamp: Date.now(),
        });
        return {
          currentPlaylist: playlist,
          cachedPlaylists: newCachedPlaylists,
        };
      }
      return state;
    });
  },

  fetchPlaylistDetails: async (playlistId: string) => {
    const { cachedPlaylists } = get();
    const cachedEntry = cachedPlaylists.get(playlistId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION) {
      console.log(`[Cache] Loading playlist ${playlistId} from cache.`);
      set({ currentPlaylist: cachedEntry.data, isLoading: false, error: null });
      return;
    }

    set({ currentPlaylist: null, error: null, isLoading: true });
    const { isOffline } = useOfflineStore.getState();
    const { isDownloaded } = useOfflineStore.getState().actions;
    const userId = useAuthStore.getState().user?.id;

    if (isDownloaded(playlistId) && userId) {
      console.log(`[Offline] Загрузка плейлиста ${playlistId} из IndexedDB.`);
      const localPlaylist = await getUserItem("playlists", playlistId, userId);
      if (localPlaylist) {
        set({ currentPlaylist: localPlaylist, isLoading: false });
        return;
      }
    }

    if (isOffline) {
      console.log(`[Offline] Нет сети и плейлист ${playlistId} не скачан.`);
      const errorMsg = "Этот плейлист не скачан и недоступен в офлайн-режиме.";
      set({ currentPlaylist: null, error: errorMsg, isLoading: false });
      toast.error(errorMsg);
      return;
    }
    try {
      const res = await axiosInstance.get(`/playlists/${playlistId}`);
      set((state) => ({
        currentPlaylist: res.data,
        isLoading: false,
        cachedPlaylists: new Map(state.cachedPlaylists).set(playlistId, {
          data: res.data,
          timestamp: Date.now(),
        }),
      }));
    } catch (e: any) {
      console.error(`Failed to fetch playlist with ID ${playlistId}:`, e);
      set({
        currentPlaylist: null,
        error: e.response?.data?.message || "Failed to fetch playlist details",
        isLoading: false,
      });
      toast.error(`Failed to load playlist details.`);
    }
  },
  generateAiPlaylist: async (prompt: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.post("/playlists/generate-ai", {
        prompt,
      });
      const newPlaylist: Playlist = response.data;

      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      toast.success(`AI плейлист "${newPlaylist.title}" успешно создан!`);

      return newPlaylist;
    } catch (err: any) {
      console.error("Failed to generate AI playlist:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Не удалось сгенерировать плейлист. Попробуйте другой запрос.";
      toast.error(errorMessage);
      set({ error: errorMessage });
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecommendedPlaylists: async () => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      const response = await axiosInstance.get(
        "/users/me/recommendations/playlists"
      );
      set({ recommendedPlaylists: response.data });
    } catch (err: any) {
      console.error("Failed to fetch recommended playlists:", err);
    }
  },
  createPlaylistFromSong: async (song: Song) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.post("/playlists/from-song", {
        title: song.title,
        imageUrl: song.imageUrl,
        initialSongId: song._id,
      });

      toast.success(`Плейлист "${song.title}" создан!`);

      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      return response.data;
    } catch (err: any) {
      console.error("Failed to create playlist from song:", err);
      toast.error(err.response?.data?.message || "Не удалось создать плейлист");
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  },
  fetchMyPlaylists: async () => {
    const { isOffline } = useOfflineStore.getState();
    set({ isLoading: true, error: null });
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ myPlaylists: [], isLoading: false });
      return;
    }

    if (isOffline) {
      console.log("[Offline] Fetching 'My Playlists' from IndexedDB.");
      try {
        const allPlaylists = await getAllUserPlaylists(currentUser.id);
        const myOfflinePlaylists = allPlaylists.filter(
          (pl: Playlist) => pl.owner?._id === currentUser.id
        );
        set({ myPlaylists: myOfflinePlaylists, isLoading: false });
      } catch (err: any) {
        console.error("Failed to fetch my offline playlists:", err);
        set({
          error:
            err.response?.data?.message ||
            "Failed to fetch my offline playlists",
          isLoading: false,
        });
        toast.error("Failed to load your offline playlists.");
      }
      return;
    }

    try {
      const response = await axiosInstance.get("/playlists/my");
      set({ myPlaylists: response.data, isLoading: false });
    } catch (err: any) {
      console.error("Failed to fetch my playlists:", err);
      set({
        error: err.response?.data?.message || "Failed to fetch my playlists",
        isLoading: false,
      });
      toast.error("Failed to load your playlists.");
    }
  },

  fetchOwnedPlaylists: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      set({ ownedPlaylists: [], isLoading: false });
      return;
    }
    if (useOfflineStore.getState().isOffline) {
      try {
        const allPlaylists = await getAllUserPlaylists(currentUser.id);
        const ownedOffline = allPlaylists.filter(
          (p) => p.owner?._id === currentUser.id
        );
        set({ ownedPlaylists: ownedOffline, isLoading: false });
      } catch (err: any) {
        console.error("Failed to fetch owned playlists:", err);
        toast.error("Could not refresh your playlists.");
      }
      return;
    }

    try {
      const response = await axiosInstance.get("/library/playlists/owned");
      set({ ownedPlaylists: response.data, isLoading: false });
    } catch (err: any) {
      console.error("Failed to fetch owned playlists:", err);
      set({
        error: err.response?.data?.message || "Failed to fetch owned playlists",
        isLoading: false,
      });
      toast.error("Could not load your playlists.");
    }
  },

  fetchPublicPlaylists: async () => {
    if (useOfflineStore.getState().isOffline) return;

    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/playlists/public");
      set({ publicPlaylists: response.data, isLoading: false });
    } catch (err: any) {
      console.error("Failed to fetch public playlists:", err);
      set({
        error:
          err.response?.data?.message || "Failed to fetch public playlists",
        isLoading: false,
      });
      toast.error("Failed to load public playlists.");
    }
  },

  fetchPlaylistById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get(`/playlists/${id}`);
      set({ currentPlaylist: response.data, isLoading: false });
    } catch (err: any) {
      console.error(`Failed to fetch playlist by ID ${id}:`, err);
      set({
        error:
          err.response?.data?.message ||
          `Failed to fetch playlist with ID ${id}`,
        isLoading: false,
      });
      toast.error(`Failed to load playlist.`);
    }
  },

  fetchRecommendations: async (playlistId: string) => {
    if (useOfflineStore.getState().isOffline) return;

    set({ isRecommendationsLoading: true, error: null });
    try {
      const response = await axiosInstance.get(
        `/playlists/${playlistId}/recommendations`
      );
      set({ recommendations: response.data, isRecommendationsLoading: false });
    } catch (err: any) {
      console.error("Failed to fetch recommendations:", err);
      set({
        error: err.response?.data?.message || "Failed to fetch recommendations",
        isRecommendationsLoading: false,
      });
      toast.error("Could not load recommendations.");
    }
  },

  createPlaylist: async (title, description, isPublic, imageFile) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("isPublic", String(isPublic));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await axiosInstance.post("/playlists", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      set({ isLoading: false });
      return response.data;
    } catch (err: any) {
      console.error("Failed to create playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to create playlist",
        isLoading: false,
      });
      return undefined;
    }
  },

  updatePlaylist: async (id, title, description, isPublic, imageFile) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("isPublic", String(isPublic));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await axiosInstance.put(`/playlists/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      set({ isLoading: false });
      return response.data;
    } catch (err: any) {
      console.error("Failed to update playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to update playlist",
        isLoading: false,
      });
      return undefined;
    }
  },

  deletePlaylist: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.delete(`/playlists/${id}`);
      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      set({ isLoading: false });
    } catch (err: any) {
      console.error("Failed to delete playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to delete playlist",
        isLoading: false,
      });
    }
  },

  addSongToPlaylist: async (playlistId: string, songId: string) => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.post(`/playlists/${playlistId}/songs`, { songId });

      const { isDownloaded, downloadItem } = useOfflineStore.getState().actions;
      if (isDownloaded(playlistId)) {
        console.log(
          `Playlist ${playlistId} is downloaded. Re-downloading to sync new song...`
        );
        toast.loading("Updating your downloaded playlist...", {
          id: "playlist-sync",
        });
        await downloadItem(playlistId, "playlists");
        toast.success("Downloaded playlist updated!", { id: "playlist-sync" });
      }
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Failed to add song to playlist:", err);
      toast.dismiss("playlist-sync");
      set({
        error: err.response?.data?.message || "Failed to add song to playlist",
        isLoading: false,
      });
    }
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    console.log(
      `[STORE] ACTION: removeSongFromPlaylist called for playlist ${playlistId}, song ${songId}`
    );
    try {
      await axiosInstance.delete(`/playlists/${playlistId}/songs/${songId}`);

      set((state) => {
        if (state.currentPlaylist && state.currentPlaylist._id === playlistId) {
          const updatedSongs = state.currentPlaylist.songs.filter(
            (song) => song._id !== songId
          );
          console.log(
            `[STORE] Locally updating UI. New song count: ${updatedSongs.length}`
          );
          return {
            currentPlaylist: {
              ...state.currentPlaylist,
              songs: updatedSongs,
            },
          };
        }
        return state;
      });

      await get().fetchOwnedPlaylists();
      await get().fetchMyPlaylists();
    } catch (err: any) {
      console.error("Failed to remove song from playlist:", err);
      toast.error(err.response?.data?.message || "Failed to remove song.");
      throw err;
    }
  },
  togglePlaylistInUserLibrary: async (playlistId: string) => {
    try {
      const response = await axiosInstance.post(
        `/api/library/playlists/toggle`,
        { playlistId }
      );
      const { isAdded, message } = response.data;

      toast.success(
        message ||
          (isAdded
            ? "Playlist added to library!"
            : "Playlist removed from library!")
      );

      get().fetchMyPlaylists();
    } catch (err: any) {
      console.error("Failed to toggle playlist in library:", err);
      set({
        error:
          err.response?.data?.message || "Failed to toggle playlist in library",
      });
      toast.error("Failed to toggle playlist in library.");
    }
  },

  addPlaylistLike: async (playlistId: string) => {
    try {
      await axiosInstance.post(`/playlists/${playlistId}/like`);
      toast.success("Playlist liked!");

      get().fetchPlaylistDetails(playlistId);
      get().fetchPublicPlaylists();
    } catch (err: any) {
      console.error("Failed to like playlist:", err);
      set({ error: err.response?.data?.message || "Failed to like playlist" });
      toast.error("Failed to like playlist.");
    }
  },

  removePlaylistLike: async (playlistId: string) => {
    try {
      await axiosInstance.delete(`/playlists/${playlistId}/unlike`);
      toast.success("Playlist unliked!");
      get().fetchPlaylistDetails(playlistId);
      get().fetchPublicPlaylists();
    } catch (err: any) {
      console.error("Failed to unlike playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to unlike playlist",
      });
      toast.error("Failed to unlike playlist.");
    }
  },

  resetCurrentPlaylist: () => set({ currentPlaylist: null }),
}));
