/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type { Album, LibraryPlaylist, Artist, Playlist, Song } from "../types";
import { useOfflineStore } from "./useOfflineStore";
import { getAllUserAlbums, getAllUserPlaylists } from "../lib/offline-db";
import { useAuthStore } from "./useAuthStore";
import { usePlaylistStore } from "./usePlaylistStore";
import i18n from "@/lib/i18n";

function getLikedPlaylist(): Playlist | undefined {
  return usePlaylistStore
    .getState()
    .myPlaylists.find((p) => p.type === "LIKED_SONGS");
}

function playlistContainsSong(playlist: Playlist, songId: string): boolean {
  return (playlist.songs ?? []).some((s) => {
    const id = typeof s === "string" ? s : (s as Song)._id;
    return id === songId;
  });
}

interface LibraryStore {
  albums: Album[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];

  isLoading: boolean;
  error: string | null;

  fetchLibrary: () => Promise<void>;
  fetchFollowedArtists: () => Promise<void>;

  toggleAlbum: (albumId: string) => Promise<void>;
  toggleSongLike: (songId: string) => Promise<void>;
  togglePlaylist: (playlistId: string) => Promise<void>;
  toggleArtistFollow: (artistId: string) => Promise<void>;

  isAlbumInLibrary: (albumId: string) => boolean;
  isPlaylistInLibrary: (playlistId: string) => boolean;
  isSongLiked: (songId: string) => boolean;
  isArtistFollowed: (artistId: string) => boolean;
  getLikedPlaylist: () => Playlist | undefined;
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

  toggleSongLike: async (songId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      const res = await axiosInstance.post("/library/songs/toggle-like", {
        songId,
      });
      const playlistId = res.data.playlistId as string | undefined;
      await usePlaylistStore.getState().fetchMyPlaylists();

      const { currentPlaylist, fetchPlaylistDetails, cachedPlaylists } =
        usePlaylistStore.getState();
      if (
        playlistId &&
        currentPlaylist?._id === playlistId &&
        currentPlaylist.type === "LIKED_SONGS"
      ) {
        const nextCache = new Map(cachedPlaylists);
        nextCache.delete(playlistId);
        usePlaylistStore.setState({ cachedPlaylists: nextCache });
        await fetchPlaylistDetails(playlistId);
      }
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
  isSongLiked: (songId: string) => {
    const liked = getLikedPlaylist();
    if (!liked) return false;
    return playlistContainsSong(liked, songId);
  },
  isArtistFollowed: (artistId: string) =>
    get().followedArtists.some((artist) => artist._id === artistId),
  getLikedPlaylist,
}));
