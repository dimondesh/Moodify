/* eslint-disable @typescript-eslint/no-explicit-any */
// frontend/src/stores/useOfflineStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  saveUserItem,
  deleteUserItem,
  getDb,
  getAllUserAlbums,
  getAllUserPlaylists,
  getAllUserMixes,
  getAllUserSongs,
  getUserItem,
} from "@/lib/offline-db";
import type { Song, Album, Playlist, Mix } from "@/types";
import { axiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useMusicStore } from "./useMusicStore";
import i18n from "@/lib/i18n";

type ItemType = "albums" | "playlists" | "mixes" | "generated-playlists";

interface OfflineState {
  downloadedItemIds: Set<string>;
  downloadedSongIds: Set<string>;
  downloadingItemIds: Set<string>;
  isOffline: boolean;
  _hasHydrated: boolean;
  actions: {
    init: () => Promise<void>;
    checkOnlineStatus: () => void;
    isDownloaded: (itemId: string) => boolean;
    isSongDownloaded: (songId: string) => boolean;
    isDownloading: (itemId: string) => boolean;
    downloadItem: (itemId: string, itemType: ItemType) => Promise<void>;
    deleteItem: (
      itemId: string,
      itemType: ItemType,
      itemTitle: string
    ) => Promise<void>;
    syncLibrary: () => Promise<void>;
    getStorageUsage: () => Promise<{ usage: number; quota: number }>;
    clearAllDownloads: () => Promise<void>;
    fetchAllDownloaded: () => Promise<(Album | Playlist | Mix)[]>;
  };
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      downloadedItemIds: new Set(),
      downloadedSongIds: new Set(),
      downloadingItemIds: new Set(),
      isOffline: !navigator.onLine,
      _hasHydrated: false,

      actions: {
        init: async () => {
          const userId = useAuthStore.getState().user?.id;
          const isCurrentlyOffline = !navigator.onLine;
          set({ isOffline: isCurrentlyOffline });

          if (!userId) {
            set({ downloadedItemIds: new Set(), downloadedSongIds: new Set() });
            return;
          }

          const [albums, playlists, mixes, songs] = await Promise.all([
            getAllUserAlbums(userId),
            getAllUserPlaylists(userId),
            getAllUserMixes(userId),
            getAllUserSongs(userId),
          ]);

          const allItemKeys = [
            ...albums.map((i) => i._id),
            ...playlists.map((i) => i._id),
            ...mixes.map((i) => i._id),
          ];
          const allSongKeys = songs.map((s) => s._id);

          set({
            downloadedItemIds: new Set(allItemKeys),
            downloadedSongIds: new Set(allSongKeys),
          });

          if (isCurrentlyOffline) {
            console.log("[Offline Startup] Forcing data fetch from IndexedDB.");
            useMusicStore.getState().fetchArtists();
          }

          window.addEventListener("online", get().actions.checkOnlineStatus);
          window.addEventListener("offline", get().actions.checkOnlineStatus);
        },

        checkOnlineStatus: () => {
          set({ isOffline: !navigator.onLine });
        },

        isDownloaded: (itemId) => get().downloadedItemIds.has(itemId),
        isSongDownloaded: (songId) => get().downloadedSongIds.has(songId),
        isDownloading: (itemId) => get().downloadingItemIds.has(itemId),

        syncLibrary: async () => {
          const { isOffline } = get();
          const userId = useAuthStore.getState().user?.id;
          if (isOffline || !userId) return;

          toast.loading(i18n.t("toasts.syncingLibrary"), { id: "sync-toast" });

          try {
            const [localPlaylists, localMixes] = await Promise.all([
              getAllUserPlaylists(userId),
              getAllUserMixes(userId),
            ]);

            for (const localPlaylist of localPlaylists) {
              try {
                const endpoint = localPlaylist.isGenerated
                  ? `/generated-playlists/${localPlaylist._id}`
                  : `/playlists/${localPlaylist._id}`;
                const serverResponse = await axiosInstance.get(endpoint);
                const serverPlaylist = serverResponse.data;
                const serverDate = localPlaylist.isGenerated
                  ? serverPlaylist.generatedOn
                  : serverPlaylist.updatedAt;
                const localDate = localPlaylist.isGenerated
                  ? (localPlaylist as any).generatedOn
                  : localPlaylist.updatedAt;

                if (new Date(serverDate) > new Date(localDate)) {
                  toast.loading(
                    i18n.t("toasts.updatingItem", {
                      itemTitle: localPlaylist.title,
                    }),
                    {
                      id: `sync-${localPlaylist._id}`,
                    }
                  );
                  await get().actions.downloadItem(
                    localPlaylist._id,
                    localPlaylist.isGenerated
                      ? "generated-playlists"
                      : "playlists"
                  );
                  toast.dismiss(`sync-${localPlaylist._id}`);
                }
              } catch (e) {
                console.error(
                  `Failed to sync playlist ${localPlaylist._id}`,
                  e
                );
              }
            }

            for (const localMix of localMixes) {
              try {
                const serverResponse = await axiosInstance.get(
                  `/mixes/${localMix._id}`
                );
                const serverMix = serverResponse.data;
                if (
                  new Date(serverMix.generatedOn) >
                  new Date(localMix.generatedOn)
                ) {
                  toast.loading(
                    i18n.t("toasts.updatingItem", { itemTitle: localMix.name }),
                    {
                      id: `sync-${localMix._id}`,
                    }
                  );
                  await get().actions.downloadItem(localMix._id, "mixes");
                  toast.dismiss(`sync-${localMix._id}`);
                }
              } catch (e) {
                console.error(`Failed to sync mix ${localMix._id}`, e);
              }
            }

            toast.success(i18n.t("toasts.syncSuccess"), { id: "sync-toast" });
          } catch (error) {
            console.error("Library sync failed:", error);
            toast.error(i18n.t("toasts.syncError"), { id: "sync-toast" });
          }
        },
        fetchAllDownloaded: async () => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) return [];
          const [albums, playlists, mixes] = await Promise.all([
            getAllUserAlbums(userId),
            getAllUserPlaylists(userId),
            getAllUserMixes(userId),
          ]);
          return [...albums, ...playlists, ...mixes];
        },

        downloadItem: async (itemId, itemType) => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) {
            toast.error(i18n.t("toasts.loginRequiredForDownload"));
            return;
          }

          if (get().downloadingItemIds.has(itemId)) return;

          set((state) => ({
            downloadingItemIds: new Set(state.downloadingItemIds).add(itemId),
          }));

          let allOtherSongIds = new Set<string>();

          try {
            let endpoint = "";
            let storeName: "albums" | "playlists" | "mixes";
            let isGenerated = false;

            if (itemType === "generated-playlists") {
              endpoint = `/generated-playlists/${itemId}`;
              storeName = "playlists";
              isGenerated = true;
            } else {
              endpoint =
                itemType === "albums"
                  ? `/albums/${itemId}`
                  : `/${itemType}/${itemId}`;
              storeName = itemType;
            }

            const response = await axiosInstance.get(endpoint);
            const serverItemData =
              itemType === "albums" ? response.data.album : response.data;

            if (!serverItemData || !serverItemData.songs) {
              throw new Error(i18n.t("errors.invalidServerData"));
            }

            const oldItemData = await getUserItem(storeName, itemId, userId);
            const newSongIds = new Set(
              serverItemData.songs.map((s: Song) => s._id)
            );
            const removedSongs: Song[] = [];

            if (oldItemData && (oldItemData as any).songsData) {
              (oldItemData as any).songsData.forEach((oldSong: Song) => {
                if (!newSongIds.has(oldSong._id)) {
                  removedSongs.push(oldSong);
                }
              });
            }

            if (removedSongs.length > 0) {
              console.log(
                `Found ${removedSongs.length} songs to remove from offline storage.`
              );
              const [allAlbums, allPlaylists, allMixes] = await Promise.all([
                getAllUserAlbums(userId),
                getAllUserPlaylists(userId),
                getAllUserMixes(userId),
              ]);

              allOtherSongIds = new Set<string>();
              [...allAlbums, ...allPlaylists, ...allMixes].forEach((item) => {
                if (item._id !== itemId) {
                  (item.songsData || (item as any).songs || []).forEach(
                    (song: Song) => allOtherSongIds.add(song._id)
                  );
                }
              });

              const urlsToDelete = new Set<string>();
              for (const removedSong of removedSongs) {
                if (!allOtherSongIds.has(removedSong._id)) {
                  if (removedSong.imageUrl)
                    urlsToDelete.add(removedSong.imageUrl);
                  if (removedSong.instrumentalUrl)
                    urlsToDelete.add(removedSong.instrumentalUrl);
                  if (removedSong.vocalsUrl)
                    urlsToDelete.add(removedSong.vocalsUrl);
                  await deleteUserItem("songs", removedSong._id);
                }
              }
              const assetsCache = await caches.open("bunny-assets-cache");
              for (const url of urlsToDelete) {
                await assetsCache.delete(url).catch((e) => console.warn(e));
              }
            }

            const songsData = serverItemData.songs as Song[];
            const urlsToCache = new Set<string>();
            if (serverItemData.imageUrl)
              urlsToCache.add(serverItemData.imageUrl);
            songsData.forEach((song) => {
              if (song.imageUrl) urlsToCache.add(song.imageUrl);
              if (song.instrumentalUrl) urlsToCache.add(song.instrumentalUrl);
              if (song.vocalsUrl) urlsToCache.add(song.vocalsUrl);
            });

            const allUrls = Array.from(urlsToCache).filter(Boolean);
            const assetsCache = await caches.open("bunny-assets-cache");

            for (const url of allUrls) {
              try {
                await assetsCache.add(url);
              } catch (err) {
                console.warn(`Could not cache URL: ${url}`, err);
              }
            }

            let itemToSave;
            if (isGenerated) {
              const user = useAuthStore.getState().user;
              itemToSave = {
                ...serverItemData,
                title: i18n.t(serverItemData.nameKey),
                description: i18n.t(serverItemData.descriptionKey),
                owner: user,
                type: "playlist",
                isGenerated: true,
                songsData,
                userId,
              };
            } else {
              itemToSave = { ...serverItemData, songsData, userId };
            }
            await saveUserItem(storeName, itemToSave as any);

            for (const song of songsData) {
              await saveUserItem("songs", { ...song, userId });
            }

            set((state) => {
              const newDownloaded = new Set(state.downloadedItemIds).add(
                itemId
              );
              const newDownloading = new Set(state.downloadingItemIds);
              newDownloading.delete(itemId);
              const newDownloadedSongs = new Set(state.downloadedSongIds);
              songsData.forEach((song) => newDownloadedSongs.add(song._id));

              removedSongs.forEach((song) => {
                if (
                  !allOtherSongIds.has(song._id) &&
                  !newSongIds.has(song._id)
                ) {
                  newDownloadedSongs.delete(song._id);
                }
              });
              return {
                downloadedItemIds: newDownloaded,
                downloadingItemIds: newDownloading,
                downloadedSongIds: newDownloadedSongs,
              };
            });
          } catch (error) {
            console.error(`Failed to download ${itemType} ${itemId}:`, error);
            set((state) => {
              const newDownloading = new Set(state.downloadingItemIds);
              newDownloading.delete(itemId);
              return { downloadingItemIds: newDownloading };
            });
            throw error;
          }
        },

        deleteItem: async (itemId, itemType, itemTitle) => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) return;
          try {
            const storeName: "albums" | "playlists" | "mixes" =
              itemType === "generated-playlists" ? "playlists" : itemType;

            const itemToDelete = await getUserItem(storeName, itemId, userId);
            if (!itemToDelete) return;

            const songs = ((itemToDelete as any).songsData ||
              (itemToDelete as any).songs) as Song[];

            const [allAlbums, allPlaylists, allMixes] = await Promise.all([
              getAllUserAlbums(userId),
              getAllUserPlaylists(userId),
              getAllUserMixes(userId),
            ]);

            const allOtherSongIds = new Set<string>();
            [...allAlbums, ...allPlaylists, ...allMixes].forEach((item) => {
              if (item._id !== itemId) {
                (item.songsData || (item as any).songs || []).forEach(
                  (song: Song) => allOtherSongIds.add(song._id)
                );
              }
            });

            const urlsToDelete = new Set<string>();
            if (
              itemToDelete.imageUrl &&
              !allOtherSongIds.has(itemToDelete.imageUrl)
            ) {
              urlsToDelete.add(itemToDelete.imageUrl);
            }

            for (const song of songs) {
              if (!allOtherSongIds.has(song._id)) {
                if (song.imageUrl) urlsToDelete.add(song.imageUrl);
                if (song.instrumentalUrl)
                  urlsToDelete.add(song.instrumentalUrl);
                if (song.vocalsUrl) urlsToDelete.add(song.vocalsUrl);
                await deleteUserItem("songs", song._id);
              }
            }

            const assetsCache = await caches.open("bunny-assets-cache");
            for (const url of urlsToDelete) {
              await assetsCache.delete(url).catch((e) => console.warn(e));
            }

            await deleteUserItem(storeName, itemId);

            set((state) => {
              const newDownloaded = new Set(state.downloadedItemIds);
              newDownloaded.delete(itemId);
              const newDownloadedSongs = new Set(state.downloadedSongIds);
              songs.forEach((song) => {
                if (!allOtherSongIds.has(song._id))
                  newDownloadedSongs.delete(song._id);
              });
              return {
                downloadedItemIds: newDownloaded,
                downloadedSongIds: newDownloadedSongs,
              };
            });
            toast.success(
              i18n.t("toasts.itemRemovedFromDownloads", { itemTitle })
            );
          } catch (error) {
            console.error(`Failed to delete ${itemType} ${itemId}:`, error);
            toast.error(i18n.t("toasts.removeItemError", { itemTitle }));
          }
        },
        getStorageUsage: async () => {
          if (navigator.storage && navigator.storage.estimate) {
            const estimation = await navigator.storage.estimate();
            return {
              usage: estimation.usage || 0,
              quota: estimation.quota || 0,
            };
          }
          return { usage: 0, quota: 0 };
        },
        clearAllDownloads: async () => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) {
            toast.error(i18n.t("toasts.loginToClearDownloads"));
            return;
          }

          if (get().downloadedItemIds.size === 0) {
            toast.success(i18n.t("toasts.noDownloadsToClear"));
            return;
          }

          toast.loading(i18n.t("toasts.clearingDownloads"));
          try {
            const db = await getDb();
            await Promise.all([
              db.clear("albums"),
              db.clear("playlists"),
              db.clear("mixes"),
              db.clear("songs"),
            ]);
            await caches.delete("moodify-audio-cache");
            await caches.delete("cloudinary-images-cache");
            await caches.delete("bunny-assets-cache");

            set({
              downloadedItemIds: new Set(),
              downloadingItemIds: new Set(),
              downloadedSongIds: new Set(),
            });

            toast.dismiss();
            toast.success(i18n.t("toasts.downloadsCleared"));
          } catch (error) {
            console.error("Failed to clear all downloads:", error);
            toast.dismiss();
            toast.error(i18n.t("toasts.clearDownloadsError"));
          }
        },
      },
    }),
    {
      name: "moodify-offline-storage",
      storage: createJSONStorage(() => localStorage, {
        replacer: (_, value: any) => {
          if (value instanceof Set) {
            return { __type: "Set", value: Array.from(value) };
          }
          return value;
        },
        reviver: (_, value: any) => {
          if (value && value.__type === "Set") {
            return new Set(value.value);
          }
          return value;
        },
      }),
      partialize: (state) => ({
        downloadedItemIds: state.downloadedItemIds,
        downloadedSongIds: state.downloadedSongIds,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
        }
      },
    }
  )
);
