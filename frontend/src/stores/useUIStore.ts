// src/stores/useUIStore.ts

import { create } from "zustand";
import type { Playlist } from "../types";
import { useMusicStore } from "./useMusicStore";
import { useLibraryStore } from "./useLibraryStore";
import { usePlaylistStore } from "./usePlaylistStore";
import { useMixesStore } from "./useMixesStore";
import { useGeneratedPlaylistStore } from "./useGeneratedPlaylistStore";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

interface ShareEntity {
  type: "song" | "album" | "playlist" | "mix";
  id: string;
}

interface SongRemovalInfo {
  songId: string;
  playlistId: string;
}

type LibraryFilter = "all" | "downloaded";

interface UIStore {
  isCreatePlaylistDialogOpen: boolean;
  editingPlaylist: Playlist | null;
  isSearchAndAddDialogOpen: boolean;
  shareEntity: ShareEntity | null;
  isEditProfileDialogOpen: boolean;
  playlistToDelete: Playlist | null;
  songToRemoveFromPlaylist: SongRemovalInfo | null;
  isUserSheetOpen: boolean;
  isHomePageLoading: boolean;
  isSecondaryHomePageLoading: boolean;
  libraryFilter: LibraryFilter;
  isIosDevice: boolean; // <-- НОВЫЙ ФЛАГ
  isFriendsActivityOpen: boolean;

  setIsIosDevice: (isIos: boolean) => void; // <-- НОВАЯ ФУНКЦИЯ
  setIsHomePageLoading: (isLoading: boolean) => void;
  setIsSecondaryHomePageLoading: (isLoading: boolean) => void;
  setLibraryFilter: (filter: LibraryFilter) => void;
  setIsFriendsActivityOpen: (isOpen: boolean) => void;

  openCreatePlaylistDialog: () => void;
  openEditPlaylistDialog: (playlist: Playlist) => void;
  openSearchAndAddDialog: () => void;
  openShareDialog: (entity: ShareEntity) => void;
  openEditProfileDialog: () => void;
  openDeletePlaylistDialog: (playlist: Playlist) => void;
  openRemoveSongFromPlaylistDialog: (info: SongRemovalInfo) => void;
  setUserSheetOpen: (isOpen: boolean) => void;

  closeAllDialogs: () => void;
  fetchInitialData: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set) => ({
  isCreatePlaylistDialogOpen: false,
  editingPlaylist: null,
  isSearchAndAddDialogOpen: false,
  shareEntity: null,
  isEditProfileDialogOpen: false,
  playlistToDelete: null,
  songToRemoveFromPlaylist: null,
  isUserSheetOpen: false,
  isHomePageLoading: true,
  isSecondaryHomePageLoading: true,
  libraryFilter: "all",
  isIosDevice: false, // <-- ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ
  isFriendsActivityOpen: true,

  setIsIosDevice: (isIos: boolean) => set({ isIosDevice: isIos }), // <-- РЕАЛИЗАЦИЯ
  setIsHomePageLoading: (isLoading) => set({ isHomePageLoading: isLoading }),
  setIsSecondaryHomePageLoading: (isLoading) =>
    set({ isSecondaryHomePageLoading: isLoading }),

  setLibraryFilter: (filter) => set({ libraryFilter: filter }),
  setIsFriendsActivityOpen: (isOpen) => set({ isFriendsActivityOpen: isOpen }),

  openCreatePlaylistDialog: () => set({ isCreatePlaylistDialogOpen: true }),
  openEditPlaylistDialog: (playlist) => set({ editingPlaylist: playlist }),
  openSearchAndAddDialog: () => set({ isSearchAndAddDialogOpen: true }),
  openShareDialog: (entity) => set({ shareEntity: entity }),
  openEditProfileDialog: () => set({ isEditProfileDialogOpen: true }),
  openDeletePlaylistDialog: (playlist) => set({ playlistToDelete: playlist }),
  openRemoveSongFromPlaylistDialog: (info) =>
    set({ songToRemoveFromPlaylist: info }),
  setUserSheetOpen: (isOpen) => set({ isUserSheetOpen: isOpen }),

  closeAllDialogs: () =>
    set({
      isCreatePlaylistDialogOpen: false,
      editingPlaylist: null,
      isSearchAndAddDialogOpen: false,
      shareEntity: null,
      isEditProfileDialogOpen: false,
      playlistToDelete: null,
      songToRemoveFromPlaylist: null,
    }),

  fetchInitialData: async () => {
    set({ isHomePageLoading: true, isSecondaryHomePageLoading: true });
    try {
      const { data } = await axiosInstance.get("/home/bootstrap");

      useMusicStore.setState({
        featuredSongs: data.featuredSongs || [],
        trendingSongs: data.trendingSongs || [],
        trendingAlbums: data.trendingAlbums || [],
        madeForYouSongs: data.madeForYouSongs || [],
        recentlyListenedSongs: data.recentlyListenedSongs || [],
        favoriteArtists: data.favoriteArtists || [],
        newReleases: data.newReleases || [],
        homePageDataLastFetched: Date.now(),
      });

      useLibraryStore.setState({
        albums: data.library.albums || [],
        likedSongs: data.library.likedSongs || [],
        playlists: data.library.playlists || [],
        followedArtists: data.library.followedArtists || [],
        savedMixes: data.library.savedMixes || [],
        generatedPlaylists: data.library.generatedPlaylists || [],
        isLoading: false,
      });

      usePlaylistStore.setState({
        publicPlaylists: data.publicPlaylists || [],
        recommendedPlaylists: data.recommendedPlaylists || [],
      });

      useMixesStore.setState({
        genreMixes: data.genreMixes || [],
        moodMixes: data.moodMixes || [],
      });

      useGeneratedPlaylistStore.setState({
        allGeneratedPlaylists: data.allGeneratedPlaylists || [],
      });
    } catch (error) {
      console.error("Failed to fetch initial app data", error);
      toast.error("Could not load essential app data.");
    } finally {
      set({ isHomePageLoading: false, isSecondaryHomePageLoading: false });
    }
  },
}));
