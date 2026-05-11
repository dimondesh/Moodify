// src/stores/useUIStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Playlist } from "../types";
import { useMusicStore } from "./useMusicStore";
import { useLibraryStore } from "./useLibraryStore";
import { usePlaylistStore } from "./usePlaylistStore";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

interface ShareEntity {
  type: "song" | "album" | "playlist";
  id: string;
}

interface SongRemovalInfo {
  songId: string;
  playlistId: string;
}

type LibraryFilter = "all" | "downloaded";
type EntityTypeFilter = "playlists" | "albums" | "artists" | "downloaded";
type LibraryViewMode = "list" | "grid";

interface UIStore {
  editingPlaylist: Playlist | null;
  /** Optional callback after playlist edit save (e.g. refresh details page). */
  playlistFormOnSuccess: (() => void) | null;
  isSearchAndAddDialogOpen: boolean;
  shareEntity: ShareEntity | null;
  isEditProfileDialogOpen: boolean;
  playlistToDelete: Playlist | null;
  songToRemoveFromPlaylist: SongRemovalInfo | null;
  isUserSheetOpen: boolean;
  isHomePageLoading: boolean;
  isSecondaryHomePageLoading: boolean;
  libraryFilter: LibraryFilter;
  entityTypeFilter: EntityTypeFilter | null;
  isIosDevice: boolean; // <-- НОВЫЙ ФЛАГ
  isFriendsActivityOpen: boolean;
  librarySearchQuery: string;
  leftSidebarViewMode: LibraryViewMode;
  libraryPageViewMode: LibraryViewMode;
  isLeftSidebarSearchOpen: boolean;
  isLibraryPageSearchOpen: boolean;

  setIsIosDevice: (isIos: boolean) => void; // <-- НОВАЯ ФУНКЦИЯ
  setIsHomePageLoading: (isLoading: boolean) => void;
  setIsSecondaryHomePageLoading: (isLoading: boolean) => void;
  setLibraryFilter: (filter: LibraryFilter) => void;
  setEntityTypeFilter: (filter: EntityTypeFilter | null) => void;
  setIsFriendsActivityOpen: (isOpen: boolean) => void;
  setLibrarySearchQuery: (query: string) => void;
  setLeftSidebarViewMode: (mode: LibraryViewMode) => void;
  setLibraryPageViewMode: (mode: LibraryViewMode) => void;
  setIsLeftSidebarSearchOpen: (isOpen: boolean) => void;
  setIsLibraryPageSearchOpen: (isOpen: boolean) => void;

  openEditPlaylistDialog: (playlist: Playlist, onSuccess?: () => void) => void;
  openSearchAndAddDialog: () => void;
  openShareDialog: (entity: ShareEntity) => void;
  openEditProfileDialog: () => void;
  openDeletePlaylistDialog: (playlist: Playlist) => void;
  openRemoveSongFromPlaylistDialog: (info: SongRemovalInfo) => void;
  setUserSheetOpen: (isOpen: boolean) => void;

  closeAllDialogs: () => void;
  fetchInitialData: () => Promise<void>;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      editingPlaylist: null,
      playlistFormOnSuccess: null,
      isSearchAndAddDialogOpen: false,
      shareEntity: null,
      isEditProfileDialogOpen: false,
      playlistToDelete: null,
      songToRemoveFromPlaylist: null,
      isUserSheetOpen: false,
      isHomePageLoading: true,
      isSecondaryHomePageLoading: true,
      libraryFilter: "all",
      entityTypeFilter: null,
      isIosDevice: false, // <-- ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ
      isFriendsActivityOpen: true,
      librarySearchQuery: "",
      leftSidebarViewMode: "list",
      libraryPageViewMode: "grid",
      isLeftSidebarSearchOpen: false,
      isLibraryPageSearchOpen: false,

      setIsIosDevice: (isIos: boolean) => set({ isIosDevice: isIos }), // <-- РЕАЛИЗАЦИЯ
      setIsHomePageLoading: (isLoading) =>
        set({ isHomePageLoading: isLoading }),
      setIsSecondaryHomePageLoading: (isLoading) =>
        set({ isSecondaryHomePageLoading: isLoading }),

      setLibraryFilter: (filter) => set({ libraryFilter: filter }),
      setEntityTypeFilter: (filter) => set({ entityTypeFilter: filter }),
      setIsFriendsActivityOpen: (isOpen) =>
        set({ isFriendsActivityOpen: isOpen }),
      setLibrarySearchQuery: (query) => set({ librarySearchQuery: query }),
      setLeftSidebarViewMode: (mode) => set({ leftSidebarViewMode: mode }),
      setLibraryPageViewMode: (mode) => set({ libraryPageViewMode: mode }),
      setIsLeftSidebarSearchOpen: (isOpen) =>
        set({ isLeftSidebarSearchOpen: isOpen }),
      setIsLibraryPageSearchOpen: (isOpen) =>
        set({ isLibraryPageSearchOpen: isOpen }),

      openEditPlaylistDialog: (playlist, onSuccess) =>
        set({
          editingPlaylist: playlist,
          playlistFormOnSuccess: onSuccess ?? null,
        }),
      openSearchAndAddDialog: () => set({ isSearchAndAddDialogOpen: true }),
      openShareDialog: (entity) => set({ shareEntity: entity }),
      openEditProfileDialog: () => set({ isEditProfileDialogOpen: true }),
      openDeletePlaylistDialog: (playlist) =>
        set({ playlistToDelete: playlist }),
      openRemoveSongFromPlaylistDialog: (info) =>
        set({ songToRemoveFromPlaylist: info }),
      setUserSheetOpen: (isOpen) => set({ isUserSheetOpen: isOpen }),

      closeAllDialogs: () =>
        set({
          editingPlaylist: null,
          playlistFormOnSuccess: null,
          isSearchAndAddDialogOpen: false,
          shareEntity: null,
          isEditProfileDialogOpen: false,
          playlistToDelete: null,
          songToRemoveFromPlaylist: null,
        }),

      fetchInitialData: async () => {
        set({ isHomePageLoading: true, isSecondaryHomePageLoading: true });
        try {
          const [bootstrapResponse] = await Promise.all([
            axiosInstance.get("/home/bootstrap"),
            usePlaylistStore.getState().fetchMyPlaylists(),
          ]);

          const { data } = bootstrapResponse;

          useMusicStore.setState({
            featuredSongs: data.featuredSongs || [],
            trendingSongs: data.trendingSongs || [],
            trendingAlbums: data.trendingAlbums || [],
            madeForYouSongs: data.madeForYouSongs || [],
            recentlyListenedSongs: data.recentlyListenedSongs || [],
            favoriteArtists: data.favoriteArtists || [],
            newReleases: data.newReleases || [],
            homePersonalPlaylists: data.personalMixes || [],
            homeSmartPlaylists: data.allGeneratedPlaylists || [],
            genreMixes: data.genreMixes || [],
            moodMixes: data.moodMixes || [],
            homePageDataLastFetched: Date.now(),
          });

          useLibraryStore.setState({
            albums: data.library.albums || [],
            playlists: data.library.playlists || [],
            followedArtists: data.library.followedArtists || [],
          });

          if (useAuthStore.getState().user) {
            void useLibraryStore.getState().fetchLikedSongs();
          }

          usePlaylistStore.setState({
            publicPlaylists: data.publicPlaylists || [],
            recommendedPlaylists: data.recommendedPlaylists || [],
          });

        } catch (error) {
          console.error("Failed to fetch initial app data", error);
          toast.error("Could not load essential app data.");
        } finally {
          set({ isHomePageLoading: false, isSecondaryHomePageLoading: false });
        }
      },
    }),
    {
      name: "ui-store",
      partialize: (state) => ({
        isFriendsActivityOpen: state.isFriendsActivityOpen,
        libraryFilter: state.libraryFilter,
        entityTypeFilter: state.entityTypeFilter,
        isIosDevice: state.isIosDevice,
        leftSidebarViewMode: state.leftSidebarViewMode,
        libraryPageViewMode: state.libraryPageViewMode,
      }),
    }
  )
);
