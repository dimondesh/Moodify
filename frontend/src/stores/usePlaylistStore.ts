// frontend/src/stores/usePlaylistStore.ts

/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import {
  createPlaylistFromSong as createPlaylistFromSongApi,
  createPlaylist as createPlaylistApi,
  updatePlaylistApi,
  deletePlaylistApi,
  addSongToPlaylistApi,
  removeSongFromPlaylistApi,
  togglePlaylistInUserLibraryApi,
  addPlaylistLikeApi,
  removePlaylistLikeApi,
  toggleSongLikeApi,
} from "@/lib/api/playlists";
import type { Playlist, Song } from "@/types";
import toast from "react-hot-toast";
import { useOfflineStore } from "./useOfflineStore";
import {
  findLikedPlaylist,
  isSongInPlaylist,
  LIKED_PLAYLIST_TYPE,
} from "@/lib/likedPlaylist";
import i18n from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import {
  invalidatePlaylistDetail,
  invalidatePlaylistLists,
} from "@/lib/invalidateQueries";

interface PlaylistStore {
  isLoading: boolean;
  error: string | null;
  dominantColor: string | null;
  setDominantColor: (color: string) => void;
  createPlaylistFromSong: (song: Song) => Promise<void>;
  createPlaylist: (
    title: string,
    description: string,
    isPublic: boolean,
    imageFile?: File | null,
  ) => Promise<Playlist | undefined>;
  updatePlaylist: (
    id: string,
    title: string,
    description: string,
    isPublic: boolean,
    imageFile?: File | null,
    removeImage?: boolean,
  ) => Promise<Playlist | undefined>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (
    playlistId: string,
    songId: string,
    options?: { allowDuplicate?: boolean },
  ) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  togglePlaylistInUserLibrary: (playlistId: string) => Promise<void>;
  addPlaylistLike: (playlistId: string) => Promise<void>;
  removePlaylistLike: (playlistId: string) => Promise<void>;
  getLikedPlaylist: () => Playlist | undefined;
  isSongLiked: (songId: string) => boolean;
  toggleSongLike: (songId: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  isLoading: false,
  error: null,
  dominantColor: null,
  setDominantColor: (color: string) => set({ dominantColor: color }),

  createPlaylistFromSong: async (song: Song) => {
    set({ isLoading: true, error: null });
    try {
      await createPlaylistFromSongApi(song._id, song.title);

      toast.success(`Плейлист "${song.title}" создан!`);

      await invalidatePlaylistLists();
    } catch (err: any) {
      console.error("Failed to create playlist from song:", err);
      toast.error(err.response?.data?.message || "Не удалось создать плейлист");
      return undefined;
    } finally {
      set({ isLoading: false });
    }
  },

  createPlaylist: async (title, description, isPublic, imageFile) => {
    set({ isLoading: true, error: null });
    try {
      const response = await createPlaylistApi(
        title,
        description,
        isPublic,
        imageFile,
      );
      await invalidatePlaylistLists();

      set({ isLoading: false });
      return response;
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
      const updated = await updatePlaylistApi(
        id,
        title,
        description,
        isPublic,
        imageFile,
        removeImage,
      );
      await invalidatePlaylistLists();

      queryClient.setQueryData(queryKeys.playlists.detail(id), updated);

      set({ isLoading: false });
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
      await deletePlaylistApi(id);
      await invalidatePlaylistLists();
      queryClient.removeQueries({ queryKey: queryKeys.playlists.detail(id) });
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Failed to delete playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to delete playlist",
        isLoading: false,
      });
    }
  },

  addSongToPlaylist: async (
    playlistId: string,
    songId: string,
    options?: { allowDuplicate?: boolean },
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await addSongToPlaylistApi(
        playlistId,
        songId,
        options?.allowDuplicate ?? false,
      );

      const { isDownloaded, downloadItem } = useOfflineStore.getState().actions;
      if (isDownloaded(playlistId)) {
        console.log(
          `Playlist ${playlistId} is downloaded. Re-downloading to sync new song...`,
        );
        toast.loading("Updating your downloaded playlist...", {
          id: "playlist-sync",
        });
        await downloadItem(playlistId, "playlists");
        toast.success("Downloaded playlist updated!", { id: "playlist-sync" });
      }

      const playlistFromApi = response?.playlist as Playlist | undefined;
      if (
        playlistFromApi?.songs &&
        Array.isArray(playlistFromApi.songs) &&
        playlistFromApi.songs.length > 0 &&
        typeof playlistFromApi.songs[0] === "object"
      ) {
        queryClient.setQueryData(
          queryKeys.playlists.detail(playlistId),
          playlistFromApi,
        );
      } else {
        await invalidatePlaylistDetail(playlistId);
      }
      await invalidatePlaylistLists();
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
    try {
      await removeSongFromPlaylistApi(playlistId, songId);

      const cached = queryClient.getQueryData<Playlist>(
        queryKeys.playlists.detail(playlistId),
      );
      if (cached) {
        const updatedPlaylist = {
          ...cached,
          songs: cached.songs.filter((song) => song._id !== songId),
        };
        queryClient.setQueryData(
          queryKeys.playlists.detail(playlistId),
          updatedPlaylist,
        );
      }

      await invalidatePlaylistLists();
    } catch (err: any) {
      console.error("Failed to remove song from playlist:", err);
      toast.error(err.response?.data?.message || "Failed to remove song.");
      throw err;
    }
  },

  togglePlaylistInUserLibrary: async (playlistId: string) => {
    try {
      const response = await togglePlaylistInUserLibraryApi(playlistId);
      const { isAdded, message } = response;

      toast.success(
        message ||
          (isAdded
            ? "Playlist added to library!"
            : "Playlist removed from library!"),
      );

      await invalidatePlaylistLists();
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
      await addPlaylistLikeApi(playlistId);
      toast.success("Playlist liked!");
      await invalidatePlaylistDetail(playlistId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.public,
      });
    } catch (err: any) {
      console.error("Failed to like playlist:", err);
      set({ error: err.response?.data?.message || "Failed to like playlist" });
      toast.error("Failed to like playlist.");
    }
  },

  removePlaylistLike: async (playlistId: string) => {
    try {
      await removePlaylistLikeApi(playlistId);
      toast.success("Playlist unliked!");
      await invalidatePlaylistDetail(playlistId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.public,
      });
    } catch (err: any) {
      console.error("Failed to unlike playlist:", err);
      set({
        error: err.response?.data?.message || "Failed to unlike playlist",
      });
      toast.error("Failed to unlike playlist.");
    }
  },

  getLikedPlaylist: () => {
    const myPlaylists = queryClient.getQueryData<Playlist[]>(
      queryKeys.playlists.my,
    );
    return findLikedPlaylist(myPlaylists ?? []);
  },

  isSongLiked: (songId: string) => {
    const liked = get().getLikedPlaylist();
    if (!liked) return false;
    return isSongInPlaylist(liked, songId);
  },

  toggleSongLike: async (songId: string) => {
    if (useOfflineStore.getState().isOffline) return;
    try {
      const res = await toggleSongLikeApi(songId);
      const playlistId = res.playlistId;
      await invalidatePlaylistLists();

      if (playlistId) {
        const cached = queryClient.getQueryData<Playlist>(
          queryKeys.playlists.detail(playlistId),
        );
        if (cached?.type === LIKED_PLAYLIST_TYPE) {
          await invalidatePlaylistDetail(playlistId);
        }
      }
    } catch (err) {
      console.error("Toggle song like error", err);
      set({ error: i18n.t("errors.toggleSongLikeError") });
    }
  },
}));
