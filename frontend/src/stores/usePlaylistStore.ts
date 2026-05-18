// frontend/src/stores/usePlaylistStore.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import type { Playlist, Song } from "@/types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import { getUserItem, getAllUserPlaylists } from "@/lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import {
  findLikedPlaylist,
  isSongInPlaylist,
  LIKED_PLAYLIST_TYPE,
} from "@/lib/likedPlaylist";
import i18n from "@/lib/i18n";

interface CachedPlaylist {
  data: Playlist;
  timestamp: number;
}

interface PlaylistStore {
  myPlaylists: Playlist[];
  ownedPlaylists: Playlist[];
  publicPlaylists: Playlist[];
  recommendations: Song[] | null;
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
    imageFile?: File | null,
    removeImage?: boolean
  ) => Promise<Playlist | undefined>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  togglePlaylistInUserLibrary: (playlistId: string) => Promise<void>;
  addPlaylistLike: (playlistId: string) => Promise<void>;
  removePlaylistLike: (playlistId: string) => Promise<void>;
  resetCurrentPlaylist: () => void;
  fetchPlaylistDetails: (
    playlistId: string,
    forceRefetch?: boolean,
  ) => Promise<void>;
  invalidatePlaylistCache: (playlistId: string) => void;
  getLikedPlaylist: () => Playlist | undefined;
  isSongLiked: (songId: string) => boolean;
  toggleSongLike: (songId: string) => Promise<void>;
}

const CACHE_DURATION = 60 * 60 * 1000;

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  myPlaylists: [],
  ownedPlaylists: [],
  recommendations: null,
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

  invalidatePlaylistCache: (playlistId: string) => {
    set((state) => {
      const nextCache = new Map(state.cachedPlaylists);
      nextCache.delete(playlistId);
      return { cachedPlaylists: nextCache };
    });
  },

  fetchPlaylistDetails: async (playlistId: string, forceRefetch = false) => {
    const { cachedPlaylists } = get();
    const cachedEntry = cachedPlaylists.get(playlistId);
    if (
      !forceRefetch &&
      cachedEntry &&
      Date.now() - cachedEntry.timestamp < CACHE_DURATION
    ) {
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

    set({ isRecommendationsLoading: true });
    try {
      const response = await axiosInstance.get(
        `/playlists/${playlistId}/recommendations`
      );
      const data = response.data;
      set({
        recommendations: Array.isArray(data) ? data : null,
        isRecommendationsLoading: false,
      });
    } catch (err: unknown) {
      console.error("Failed to fetch recommendations:", err);
      set({ recommendations: null, isRecommendationsLoading: false });
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

  updatePlaylist: async (id, title, description, isPublic, imageFile, removeImage) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("isPublic", String(isPublic));
      if (imageFile) {
        formData.append("image", imageFile);
      } else if (removeImage) {
        formData.append("removeImage", "true");
      }

      const response = await axiosInstance.put(`/playlists/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      get().fetchMyPlaylists();
      get().fetchOwnedPlaylists();

      const updated = response.data as Playlist;
      get().invalidatePlaylistCache(id);
      set((state) => ({
        isLoading: false,
        currentPlaylist:
          state.currentPlaylist?._id === id ? updated : state.currentPlaylist,
        cachedPlaylists: new Map(state.cachedPlaylists).set(id, {
          data: updated,
          timestamp: Date.now(),
        }),
      }));
      return updated;
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
      const response = await axiosInstance.post(
        `/playlists/${playlistId}/songs`,
        { songId },
      );

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

      get().invalidatePlaylistCache(playlistId);
      const playlistFromApi = response.data?.playlist as Playlist | undefined;
      if (
        playlistFromApi?.songs &&
        Array.isArray(playlistFromApi.songs) &&
        playlistFromApi.songs.length > 0 &&
        typeof playlistFromApi.songs[0] === "object"
      ) {
        set((state) => ({
          isLoading: false,
          currentPlaylist:
            state.currentPlaylist?._id === playlistId
              ? playlistFromApi
              : state.currentPlaylist,
          cachedPlaylists: new Map(state.cachedPlaylists).set(playlistId, {
            data: playlistFromApi,
            timestamp: Date.now(),
          }),
        }));
      } else if (get().currentPlaylist?._id === playlistId) {
        await get().fetchPlaylistDetails(playlistId, true);
        set({ isLoading: false });
      } else {
        set({ isLoading: false });
      }
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
          const updatedPlaylist = {
            ...state.currentPlaylist,
            songs: updatedSongs,
          };
          console.log(
            `[STORE] Locally updating UI. New song count: ${updatedSongs.length}`
          );
          const nextCache = new Map(state.cachedPlaylists);
          nextCache.set(playlistId, {
            data: updatedPlaylist,
            timestamp: Date.now(),
          });
          return {
            currentPlaylist: updatedPlaylist,
            cachedPlaylists: nextCache,
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

  getLikedPlaylist: () => findLikedPlaylist(get().myPlaylists),

  isSongLiked: (songId: string) => {
    const liked = findLikedPlaylist(get().myPlaylists);
    if (!liked) return false;
    return isSongInPlaylist(liked, songId);
  },

  toggleSongLike: async (songId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      const res = await axiosInstance.post("/library/songs/toggle-like", {
        songId,
      });
      const playlistId = res.data.playlistId as string | undefined;
      await get().fetchMyPlaylists();

      const { currentPlaylist, fetchPlaylistDetails, cachedPlaylists } = get();
      if (
        playlistId &&
        currentPlaylist?._id === playlistId &&
        currentPlaylist.type === LIKED_PLAYLIST_TYPE
      ) {
        const nextCache = new Map(cachedPlaylists);
        nextCache.delete(playlistId);
        set({ cachedPlaylists: nextCache });
        await fetchPlaylistDetails(playlistId);
      }
    } catch (err) {
      console.error("Toggle song like error", err);
      set({ error: i18n.t("errors.toggleSongLikeError") });
    }
  },
}));
