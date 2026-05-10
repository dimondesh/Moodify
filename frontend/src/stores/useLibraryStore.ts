/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type { Album, Song, LibraryPlaylist, Artist } from "../types";
import { useOfflineStore } from "./useOfflineStore";
import {
  getAllUserAlbums,
  getAllUserPlaylists,
  getAllUserSongs,
} from "../lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import i18n from "@/lib/i18n";

interface LibraryStore {
  albums: Album[];
  likedSongs: Song[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];
  /** Mongo id of the user's LIKED_SONGS playlist when it exists */
  likedPlaylistId: string | null;

  isLoading: boolean;
  error: string | null;

  fetchLibrary: () => Promise<void>;
  fetchLikedSongs: () => Promise<void>;
  fetchFollowedArtists: () => Promise<void>;

  toggleAlbum: (albumId: string) => Promise<void>;
  toggleSongLike: (songId: string) => Promise<void>;
  togglePlaylist: (playlistId: string) => Promise<void>;
  toggleArtistFollow: (artistId: string) => Promise<void>;

  isAlbumInLibrary: (albumId: string) => boolean;
  isPlaylistInLibrary: (playlistId: string) => boolean;
  isSongLiked: (songId: string) => boolean;
  isArtistFollowed: (artistId: string) => boolean;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  albums: [],
  likedSongs: [],
  playlists: [],
  followedArtists: [],
  likedPlaylistId: null,
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
        const [albums, playlists, songs] = await Promise.all([
          getAllUserAlbums(userId),
          getAllUserPlaylists(userId),
          getAllUserSongs(userId),
        ]);

        set({
          albums,
          playlists: playlists as LibraryPlaylist[],
          likedSongs: songs,
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

  fetchLikedSongs: async () => {
    const { isOffline } = useOfflineStore.getState();
    const userId = useAuthStore.getState().user?.id;
    set({ isLoading: true, error: null });

    if (isOffline) {
      if (!userId) {
        set({
          error: i18n.t("errors.userNotAvailableOffline"),
        });
        return;
      }
      console.log(
        "[Offline] Fetching liked songs (all downloaded songs) from IndexedDB.",
      );
      try {
        const allDownloadedSongs = await getAllUserSongs(userId);
        set({ likedSongs: allDownloadedSongs, likedPlaylistId: null });
      } catch (err: any) {
        set({
          error: err.message || i18n.t("errors.fetchOfflineSongsError"),
        });
      }
      return;
    }

    try {
      const res = await axiosInstance.get("/library/liked-songs");
      set({
        likedSongs: res.data.songs,
        likedPlaylistId: res.data.playlistId ?? null,
      });
    } catch (err: any) {
      set({
        error: err.message || i18n.t("errors.fetchLikedSongsError"),
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

  toggleSongLike: async (songId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/songs/toggle-like", { songId });
      await Promise.all([get().fetchLibrary(), get().fetchLikedSongs()]);
    } catch (err) {
      console.error("Toggle song like error", err);
      set({ error: i18n.t("errors.toggleSongLikeError") });
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
  isSongLiked: (songId: string) =>
    get().likedSongs.some((song) => song._id === songId),
  isArtistFollowed: (artistId: string) =>
    get().followedArtists.some((artist) => artist._id === artistId),
}));
