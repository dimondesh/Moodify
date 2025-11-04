/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type {
  Album,
  Song,
  LibraryPlaylist,
  Artist,
  Mix,
  GeneratedPlaylist,
  PersonalMix,
} from "../types";
import { useOfflineStore } from "./useOfflineStore";
import {
  getAllUserAlbums,
  getAllUserPlaylists,
  getAllUserMixes,
  getAllUserSongs,
} from "../lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";
import i18n from "@/lib/i18n";

interface LibraryStore {
  albums: Album[];
  likedSongs: Song[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];
  savedMixes: Mix[];
  savedPersonalMixes: PersonalMix[];
  generatedPlaylists: GeneratedPlaylist[];

  isLoading: boolean;
  error: string | null;

  fetchLibrary: () => Promise<void>;
  fetchLikedSongs: () => Promise<void>;
  fetchFollowedArtists: () => Promise<void>;
  isGeneratedPlaylistSaved: (playlistId: string) => boolean;
  toggleGeneratedPlaylistInLibrary: (playlistId: string) => Promise<void>;

  toggleAlbum: (albumId: string) => Promise<void>;
  toggleSongLike: (songId: string) => Promise<void>;
  togglePlaylist: (playlistId: string) => Promise<void>;
  toggleArtistFollow: (artistId: string) => Promise<void>;
  toggleMixInLibrary: (mixId: string) => Promise<void>;
  togglePersonalMixInLibrary: (personalMixId: string) => Promise<void>;
  isAlbumInLibrary: (albumId: string) => boolean;
  isPlaylistInLibrary: (playlistId: string) => boolean;

  isSongLiked: (songId: string) => boolean;
  isArtistFollowed: (artistId: string) => boolean;
  isMixSaved: (mixId: string) => boolean;
  isPersonalMixSaved: (personalMixId: string) => boolean;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  albums: [],
  likedSongs: [],
  playlists: [],
  followedArtists: [],
  savedMixes: [],
  savedPersonalMixes: [],
  generatedPlaylists: [],
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
        const [albums, playlists, savedMixes, songs] = await Promise.all([
          getAllUserAlbums(userId),
          getAllUserPlaylists(userId),
          getAllUserMixes(userId),
          getAllUserSongs(userId),
        ]);

        set({
          albums,
          playlists: playlists as LibraryPlaylist[],
          savedMixes,
          likedSongs: songs,
          followedArtists: [],
          generatedPlaylists: playlists.filter(
            (p: any) => p.isGenerated
          ) as unknown as GeneratedPlaylist[],
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
        likedSongs: data.likedSongs || [],
        playlists: data.playlists || [],
        followedArtists: data.followedArtists || [],
        savedMixes: data.savedMixes || [],
        savedPersonalMixes: data.savedPersonalMixes || [],
        generatedPlaylists: data.generatedPlaylists || [],
      });
    } catch (err: any) {
      set({
        error: err.message || i18n.t("errors.fetchLibraryError"),
      });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleGeneratedPlaylistInLibrary: async (playlistId: string) => {
    if (useOfflineStore.getState().isOffline) return;

    const previousPlaylists = get().generatedPlaylists;
    const isCurrentlySaved = get().isGeneratedPlaylistSaved(playlistId);

    set((state) => ({
      generatedPlaylists: isCurrentlySaved
        ? state.generatedPlaylists.filter((p) => p._id !== playlistId)
        : [
            ...state.generatedPlaylists,
            { _id: playlistId, nameKey: "placeholder" } as GeneratedPlaylist,
          ],
    }));

    try {
      const response = await axiosInstance.post(
        "/library/generated-playlists/toggle",
        { playlistId }
      );
      toast.success(
        response.data.isSaved
          ? i18n.t("toasts.savedToLibrary")
          : i18n.t("toasts.removedFromLibrary")
      );
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle generated playlist error", err);
      toast.error(i18n.t("toasts.libraryUpdateError"));
      set({ generatedPlaylists: previousPlaylists });
    }
  },

  isGeneratedPlaylistSaved: (playlistId: string) => {
    return get().generatedPlaylists.some((p) => p._id === playlistId);
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
        "[Offline] Fetching liked songs (all downloaded songs) from IndexedDB."
      );
      try {
        const allDownloadedSongs = await getAllUserSongs(userId);
        set({ likedSongs: allDownloadedSongs });
      } catch (err: any) {
        set({
          error: err.message || i18n.t("errors.fetchOfflineSongsError"),
        });
      }
      return;
    }

    try {
      const res = await axiosInstance.get("/library/liked-songs");
      set({ likedSongs: res.data.songs });
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
      await get().fetchLibrary();
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

  toggleMixInLibrary: async (mixId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/mixes/toggle", { mixId });
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle mix in library error", err);
      set({ error: i18n.t("errors.toggleMixError") });
    }
  },

  togglePersonalMixInLibrary: async (personalMixId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      await axiosInstance.post("/library/personal-mixes/toggle", {
        personalMixId,
      });
      await get().fetchLibrary();
    } catch (err) {
      console.error("Toggle personal mix in library error", err);
      set({ error: i18n.t("errors.toggleMixError") });
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
  isMixSaved: (mixId: string) =>
    get().savedMixes.some((mix) => mix._id === mixId),
  isPersonalMixSaved: (personalMixId: string) =>
    get().savedPersonalMixes.some((mix) => mix._id === personalMixId),
}));
