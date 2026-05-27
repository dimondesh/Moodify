// src/stores/useUIStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Playlist } from "../types";

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
  shareEntity: ShareEntity | null;
  isEditProfileDialogOpen: boolean;
  playlistToDelete: Playlist | null;
  songToRemoveFromPlaylist: SongRemovalInfo | null;
  isUserSheetOpen: boolean;
  libraryFilter: LibraryFilter;
  entityTypeFilter: EntityTypeFilter | null;
  isIosDevice: boolean;
  isFriendsActivityOpen: boolean;
  isChatConversationOpen: boolean;
  librarySearchQuery: string;
  leftSidebarViewMode: LibraryViewMode;
  libraryPageViewMode: LibraryViewMode;
  isLeftSidebarSearchOpen: boolean;
  isLibraryPageSearchOpen: boolean;

  setIsIosDevice: (isIos: boolean) => void;
  setLibraryFilter: (filter: LibraryFilter) => void;
  setEntityTypeFilter: (filter: EntityTypeFilter | null) => void;
  setIsFriendsActivityOpen: (isOpen: boolean) => void;
  setChatConversationOpen: (isOpen: boolean) => void;
  setLibrarySearchQuery: (query: string) => void;
  setLeftSidebarViewMode: (mode: LibraryViewMode) => void;
  setLibraryPageViewMode: (mode: LibraryViewMode) => void;
  setIsLeftSidebarSearchOpen: (isOpen: boolean) => void;
  setIsLibraryPageSearchOpen: (isOpen: boolean) => void;

  openEditPlaylistDialog: (playlist: Playlist, onSuccess?: () => void) => void;
  openShareDialog: (entity: ShareEntity) => void;
  openEditProfileDialog: () => void;
  openDeletePlaylistDialog: (playlist: Playlist) => void;
  openRemoveSongFromPlaylistDialog: (info: SongRemovalInfo) => void;
  setUserSheetOpen: (isOpen: boolean) => void;

  closeAllDialogs: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      editingPlaylist: null,
      playlistFormOnSuccess: null,
      shareEntity: null,
      isEditProfileDialogOpen: false,
      playlistToDelete: null,
      songToRemoveFromPlaylist: null,
      isUserSheetOpen: false,
      libraryFilter: "all",
      entityTypeFilter: null,
      isIosDevice: false,
      isFriendsActivityOpen: true,
      isChatConversationOpen: false,
      librarySearchQuery: "",
      leftSidebarViewMode: "list",
      libraryPageViewMode: "grid",
      isLeftSidebarSearchOpen: false,
      isLibraryPageSearchOpen: false,

      setIsIosDevice: (isIos: boolean) => set({ isIosDevice: isIos }),
      setLibraryFilter: (filter) => set({ libraryFilter: filter }),
      setEntityTypeFilter: (filter) => set({ entityTypeFilter: filter }),
      setIsFriendsActivityOpen: (isOpen) =>
        set({ isFriendsActivityOpen: isOpen }),
      setChatConversationOpen: (isOpen) =>
        set({ isChatConversationOpen: isOpen }),
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
          shareEntity: null,
          isEditProfileDialogOpen: false,
          playlistToDelete: null,
          songToRemoveFromPlaylist: null,
        }),
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
    },
  ),
);
