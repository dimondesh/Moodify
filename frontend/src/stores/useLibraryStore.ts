/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type { Album, LibraryPlaylist, Artist } from "../types";
import { useOfflineStore } from "./useOfflineStore";
import { getAllUserAlbums, getAllUserPlaylists } from "../lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import i18n from "@/lib/i18n";

interface LibraryStore {
  albums: Album[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];

  isLoading: boolean;
  error: string | null;

  fetchLibrary: () => Promise<void>;
  fetchFollowedArtists: () => Promise<void>;

  toggleAlbum: (albumId: string) => Promise<void>;
  togglePlaylist: (playlistId: string) => Promise<void>;
  toggleArtistFollow: (artistId: string) => Promise<void>;

  isAlbumInLibrary: (albumId: string) => boolean;
  isPlaylistInLibrary: (playlistId: string) => boolean;
  isArtistFollowed: (artistId: string) => boolean;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  albums: [],
  playlists: [],
  followedArtists: [],
  isLoading: false,
  error: null,

  fetchLibrary: async () => {
    const { isOffline } = useOfflineStore.getState();
    const userId = useAuthStore.getState().user?.id;
    set({ isLoading: true, error: null });

    if (isOffline) {
      console.log("[Offline] Fetching library from IndexedDB.");
      if (!userId) {
        set({
          error: i18n.t("errors.userNotAvailableOffline"),
        });
        return;
      }
      try {
        const [albums, playlists] = await Promise.all([
          getAllUserAlbums(userId),
          getAllUserPlaylists(userId),
        ]);

        set({
          albums,
          playlists: playlists as LibraryPlaylist[],
          followedArtists: [],
        });
      } catch (err: any) {
        console.error("Failed to fetch offline library data:", err);
        set({
          error: err.message || i18n.t("errors.fetchLibraryOfflineError"),
        });
      }
      return;
    }

    try {
      const response = await axiosInstance.get("/library/summary");
      const data = response.data;

      set({
        albums: data.albums || [],
        playlists: data.playlists || [],
        followedArtists: data.followedArtists || [],
      });
    } catch (err: any) {
      set({
        error: err.message || i18n.t("errors.fetchLibraryError"),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchFollowedArtists: async () => {
    if (useOfflineStore.getState().isOffline) return;

    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get("/library/artists");
      set({ followedArtists: res.data.artists, isLoading: false });
    } catch (err: any) {
      set({
        error: err.message || i18n.t("errors.fetchFollowedArtistsError"),
        isLoading: false,
      });
    }
  },

  toggleAlbum: async (albumId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/albums/toggle", { albumId });
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle album error", err);
      set({ error: i18n.t("errors.toggleAlbumError") });
    }
  },

  togglePlaylist: async (playlistId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/playlists/toggle", { playlistId });
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle playlist error", err);
      set({ error: i18n.t("errors.togglePlaylistError") });
    }
  },

  toggleArtistFollow: async (artistId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/artists/toggle", { artistId });
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle artist follow error", err);
      set({ error: i18n.t("errors.toggleArtistFollowError") });
    }
  },

  isAlbumInLibrary: (albumId: string) =>
    get().albums.some((album) => album._id === albumId),
  isPlaylistInLibrary: (playlistId: string) =>
    get().playlists.some((playlist) => playlist._id === playlistId),
  isArtistFollowed: (artistId: string) =>
    get().followedArtists.some((artist) => artist._id === artistId),
}));
