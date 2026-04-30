/* eslint-disable @typescript-eslint/no-unused-vars */
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
  deleteOfflineDb,
} from "@/lib/offline-db";
import type { Song, Album, Playlist, Mix } from "@/types";
import { axiosInstance } from "@/lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useMusicStore } from "./useMusicStore";
import i18n from "@/lib/i18n";

type ItemType =
  | "albums"
  | "playlists"
  | "mixes"
  | "personal-mixes"
  | "generated-playlists";
const HLS_ASSETS_CACHE_NAME = "moodify-hls-assets-cache";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const parseM3u8KeyUris = (manifestText: string): string[] => {
  const out: string[] = [];
  // Example: #EXT-X-KEY:METHOD=AES-128,URI="key.key",IV=0x...
  const re = /#EXT-X-KEY:.*?URI="([^"]+)"/g;
  for (;;) {
    const m = re.exec(manifestText);
    if (!m) break;
    out.push(m[1]);
  }
  return out;
};

const parseM3u8Uris = (manifestText: string): string[] => {
  return manifestText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.startsWith("#"));
};

const collectHlsAssetUrls = async (
  hlsUrl: string,
  opts?: { maxDepth?: number; maxManifests?: number }
): Promise<string[]> => {
  const maxDepth = opts?.maxDepth ?? 3;
  const maxManifests = opts?.maxManifests ?? 25;

  const visitedManifests = new Set<string>();
  const assetUrls = new Set<string>();

  const queue: Array<{ url: string; depth: number }> = [{ url: hlsUrl, depth: 0 }];

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;
    if (visitedManifests.has(url)) continue;
    visitedManifests.add(url);
    assetUrls.add(url);

    if (visitedManifests.size > maxManifests) {
      throw new Error("Слишком много HLS манифестов (возможный цикл)");
    }

    if (depth > maxDepth) continue;

    const resp = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!resp.ok) {
      throw new Error(`Не удалось загрузить HLS манифест: ${url} (${resp.status})`);
    }
    const text = await resp.text();
    const baseUrl = new URL(url);

    // Keys
    for (const keyUri of parseM3u8KeyUris(text)) {
      const keyUrl = new URL(keyUri, baseUrl);
      assetUrls.add(keyUrl.href);
    }

    // All URIs (variants, segments, init maps, subtitles, etc.)
    for (const uri of parseM3u8Uris(text)) {
      const absolute = new URL(uri, baseUrl).href;
      assetUrls.add(absolute);
      if (absolute.endsWith(".m3u8")) {
        queue.push({ url: absolute, depth: depth + 1 });
      }
    }
  }

  return Array.from(assetUrls);
};

const fetchWithRetry = async (
  url: string,
  opts?: { retries?: number; backoffMs?: number }
): Promise<Response> => {
  const retries = opts?.retries ?? 3;
  const backoffMs = opts?.backoffMs ?? 250;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      await sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Failed to fetch");
};

const hasPopulatedArtists = (song: Song): boolean => {
  const a: any = (song as any).artist;
  return Array.isArray(a) && a.length > 0 && typeof a[0] === "object" && !!a[0]?.name;
};

interface OfflineState {
  downloadedItemIds: Set<string>;
  downloadedSongIds: Set<string>;
  downloadingItemIds: Set<string>;
  downloadProgress: Map<string, number>;
  downloadCancelled: Set<string>;
  isOffline: boolean;
  _hasHydrated: boolean;
  actions: {
    init: () => Promise<void>;
    checkOnlineStatus: () => void;
    isDownloaded: (itemId: string) => boolean;
    isSongDownloaded: (songId: string) => boolean;
    isDownloading: (itemId: string) => boolean;
    getDownloadProgress: (itemId: string) => number;
    downloadItem: (itemId: string, itemType: ItemType) => Promise<void>;
    cancelDownload: (itemId: string) => void;
    deleteItem: (
      itemId: string,
      itemType: ItemType,
      itemTitle: string
    ) => Promise<void>;
    syncLibrary: () => Promise<void>;
    getStorageUsage: () => Promise<{ usage: number; quota: number }>;
    getDownloadedContentSize: () => Promise<{ usage: number; quota: number }>;
    clearAllDownloads: () => Promise<void>;
    clearAppCache: () => Promise<void>;
    fetchAllDownloaded: () => Promise<(Album | Playlist | Mix)[]>;
    updateDownloadedPersonalMix: (personalMixId: string) => Promise<void>;
  };
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      downloadedItemIds: new Set(),
      downloadedSongIds: new Set(),
      downloadingItemIds: new Set(),
      downloadProgress: new Map(),
      downloadCancelled: new Set(),
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
            getAllUserMixes(userId), // Включает как обычные миксы, так и персональные
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
        getDownloadProgress: (itemId) =>
          get().downloadProgress.get(itemId) || 0,
        cancelDownload: (itemId) => {
          set((state) => ({
            downloadCancelled: new Set(state.downloadCancelled).add(itemId),
            downloadingItemIds: new Set(state.downloadingItemIds),
            downloadProgress: new Map(state.downloadProgress),
          }));
          // Remove from downloading set
          set((state) => {
            const newDownloading = new Set(state.downloadingItemIds);
            newDownloading.delete(itemId);
            const newProgress = new Map(state.downloadProgress);
            newProgress.delete(itemId);
            return {
              downloadingItemIds: newDownloading,
              downloadProgress: newProgress,
            };
          });
        },

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

        updateDownloadedPersonalMix: async (personalMixId: string) => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) return;

          const { isDownloaded } = get().actions;
          if (!isDownloaded(personalMixId)) return;

          try {
            console.log(
              `[Offline] Updating downloaded personal mix ${personalMixId}`
            );

            // Загружаем обновленные данные с сервера
            const response = await axiosInstance.get(
              `/personal-mixes/${personalMixId}`
            );
            const updatedData = response.data;

            if (!updatedData || !updatedData.songs) {
              throw new Error(i18n.t("errors.invalidServerData"));
            }

            // Обновляем данные в IndexedDB
            const itemToUpdate = {
              ...updatedData,
              songsData: updatedData.songs,
              userId,
            };

            await saveUserItem("mixes", itemToUpdate);

            console.log(
              `[Offline] Personal mix ${personalMixId} updated successfully`
            );
            toast.success(i18n.t("toasts.personalMixUpdated"));
          } catch (error) {
            console.error(
              `[Offline] Failed to update personal mix ${personalMixId}:`,
              error
            );
            toast.error(i18n.t("toasts.updateError"));
          }
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
            downloadProgress: new Map(state.downloadProgress).set(itemId, 0),
            downloadCancelled: new Set(state.downloadCancelled),
          }));

          try {
            // Check for cancellation before starting
            if (get().downloadCancelled.has(itemId)) {
              return;
            }

            // 1. Fetch item metadata
            let endpoint = "";
            let storeName: "albums" | "playlists" | "mixes";

            if (itemType === "generated-playlists") {
              endpoint = `/generated-playlists/${itemId}`;
              storeName = "playlists";
            } else if (itemType === "personal-mixes") {
              endpoint = `/personal-mixes/${itemId}`;
              storeName = "mixes";
            } else {
              endpoint = `/${itemType}/${itemId}`;
              storeName = itemType;
            }

            const response = await axiosInstance.get(endpoint);
            const serverItemData =
              itemType === "albums" ? response.data.album : response.data;

            if (!serverItemData || !serverItemData.songs) {
              throw new Error(i18n.t("errors.invalidServerData"));
            }

            // Update progress: 20% - metadata fetched
            set((state) => ({
              downloadProgress: new Map(state.downloadProgress).set(itemId, 20),
            }));

            // Check for cancellation
            if (get().downloadCancelled.has(itemId)) {
              return;
            }

            // 2. Collect all URLs to cache (images, manifests, variants, segments, keys)
            const urlsToCache = new Set<string>();
            if (serverItemData.imageUrl)
              urlsToCache.add(serverItemData.imageUrl);

            const resolvedSongs: Song[] = [];
            for (const song of serverItemData.songs as Song[]) {
              if (song.imageUrl) urlsToCache.add(song.imageUrl);

              // ВАЖНО: многие списки отдают "минимальный" Song без hlsUrl.
              // Для оффлайн загрузки догружаем полные данные по /songs/:id.
              let fullSong: Song = song;
              if (!fullSong.hlsUrl) {
                try {
                  const fullResp = await axiosInstance.get(`/songs/${song._id}`);
                  // Не перезатираем populated artist (с name) "сырой" версией с бэка
                  fullSong = {
                    ...song,
                    ...fullResp.data,
                    artist: hasPopulatedArtists(song)
                      ? (song as any).artist
                      : fullResp.data.artist,
                  };
                } catch (e) {
                  throw new Error(
                    i18n.t("toasts.downloadError", {
                      error: `Song ${song._id} has no hlsUrl and cannot be resolved`,
                    }),
                  );
                }
              }

              if (!fullSong.hlsUrl) {
                throw new Error(`Song ${song._id} has no hlsUrl`);
              }

              resolvedSongs.push(fullSong);

              const hlsAssets = await collectHlsAssetUrls(fullSong.hlsUrl);
              hlsAssets.forEach((u) => urlsToCache.add(u));
            }

            // Update progress: 40% - URLs collected
            set((state) => ({
              downloadProgress: new Map(state.downloadProgress).set(itemId, 40),
            }));

            // Check for cancellation
            if (get().downloadCancelled.has(itemId)) {
              return;
            }

            // 3. Cache all assets (реально нужно для оффлайна через service worker)
            const cache = await caches.open(HLS_ASSETS_CACHE_NAME);

            const urlList = Array.from(urlsToCache);
            let okCount = 0;
            const failUrls: string[] = [];

            for (let i = 0; i < urlList.length; i++) {
              const url = urlList[i];
              try {
                const resp = await fetchWithRetry(url, { retries: 3 });
                // cache.put требует "незапользованный" body, поэтому clone()
                await cache.put(url, resp.clone());
                okCount++;
              } catch (error) {
                failUrls.push(url);
                console.warn(`Failed to cache ${url}:`, error);
              } finally {
                // прогресс: 40..85 пропорционально реальной работе
                const pct = 40 + Math.round(((i + 1) / urlList.length) * 45);
                set((state) => ({
                  downloadProgress: new Map(state.downloadProgress).set(
                    itemId,
                    Math.min(85, pct),
                  ),
                }));
              }

              if (get().downloadCancelled.has(itemId)) return;
            }

            // Если упало слишком много — считаем загрузку неуспешной
            const failRatio = urlList.length === 0 ? 1 : failUrls.length / urlList.length;
            if (urlList.length === 0 || failRatio > 0.02) {
              throw new Error(
                `Не удалось закэшировать часть файлов (${failUrls.length}/${urlList.length}). Проверь CORS/доступ к CDN.`,
              );
            }

            // Update progress: 85% - assets cached
            set((state) => ({
              downloadProgress: new Map(state.downloadProgress).set(itemId, 85),
            }));

            // Check for cancellation
            if (get().downloadCancelled.has(itemId)) {
              return;
            }

            // 4. Save metadata to IndexedDB
            const itemToSave = {
              ...serverItemData,
              songsData: resolvedSongs,
              // чтобы все страницы/плеер в оффлайне работали с одинаковым полем
              songs: resolvedSongs,
              userId,
              isGenerated: itemType === "generated-playlists",
            };
            await saveUserItem(storeName, itemToSave as any);

            for (const song of resolvedSongs) {
              await saveUserItem("songs", { ...song, userId });
            }

            // Update progress: 90% - data saved
            set((state) => ({
              downloadProgress: new Map(state.downloadProgress).set(itemId, 90),
            }));

            // Check for cancellation
            if (get().downloadCancelled.has(itemId)) {
              return;
            }

            // 5. Update state - combine all updates in one call
            set((state) => {
              const newProgress = new Map(state.downloadProgress);
              const newCancelled = new Set(state.downloadCancelled);
              newProgress.delete(itemId);
              newCancelled.delete(itemId);

              return {
                downloadedItemIds: new Set(state.downloadedItemIds).add(itemId),
                downloadedSongIds: new Set([
                  ...state.downloadedSongIds,
                  ...resolvedSongs.map((s: Song) => s._id),
                ]),
                downloadingItemIds: new Set(
                  [...state.downloadingItemIds].filter((id) => id !== itemId)
                ),
                downloadProgress: newProgress,
                downloadCancelled: newCancelled,
              };
            });

            // Force a small delay to ensure state updates are processed
            setTimeout(() => {
              set((state) => ({ ...state }));
            }, 100);
          } catch (error) {
            console.error(`Failed to download ${itemType} ${itemId}:`, error);

            // Check if it's a network error and provide more specific error handling
            if (
              error instanceof TypeError &&
              error.message.includes("Failed to fetch")
            ) {
              console.warn(
                `Network error downloading ${itemType} ${itemId}. This might be due to CORS or network issues.`
              );
            }

            set((state) => {
              const newDownloading = new Set(
                [...state.downloadingItemIds].filter((id) => id !== itemId)
              );
              const newProgress = new Map(state.downloadProgress);
              const newCancelled = new Set(state.downloadCancelled);
              newProgress.delete(itemId);
              newCancelled.delete(itemId);
              return {
                downloadingItemIds: newDownloading,
                downloadProgress: newProgress,
                downloadCancelled: newCancelled,
              };
            });

            // Don't throw the error to prevent UI crashes, just log it
            // ВАЖНО: НЕ глотаем ошибку, иначе UI показывает "успех"
            throw error;
          }
        },

        deleteItem: async (itemId, itemType, itemTitle) => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) return;

          try {
            const storeName: "albums" | "playlists" | "mixes" =
              itemType === "generated-playlists"
                ? "playlists"
                : itemType === "personal-mixes"
                ? "mixes"
                : itemType;

            const itemToDelete = await getUserItem(storeName, itemId, userId);
            if (!itemToDelete) return;

            // 1. Collect all URLs to delete from cache
            const urlsToDelete = new Set<string>();
            if (itemToDelete.imageUrl) urlsToDelete.add(itemToDelete.imageUrl);

            const songs: Song[] = (itemToDelete as any).songsData || [];
            for (const song of songs) {
              if (song.imageUrl) urlsToDelete.add(song.imageUrl);
              if (song.hlsUrl) {
                urlsToDelete.add(song.hlsUrl);
                try {
                  const manifestResponse = await fetch(song.hlsUrl);
                  const manifestText = await manifestResponse.text();
                  const baseUrl = new URL(song.hlsUrl);
                  const segments = manifestText
                    .split("\n")
                    .filter((line) => line.endsWith(".ts"));
                  segments.forEach((segment) => {
                    const segmentUrl = new URL(segment, baseUrl);
                    urlsToDelete.add(segmentUrl.href);
                  });
                } catch (e) {
                  console.warn(
                    `Could not fetch manifest for deletion: ${song.hlsUrl}`,
                    e
                  );
                }
              }
            }

            // 2. Delete from Cache Storage
            const cache = await caches.open(HLS_ASSETS_CACHE_NAME);
            for (const url of urlsToDelete) {
              await cache.delete(url);
            }

            // 3. Delete from IndexedDB
            await deleteUserItem(storeName, itemId);
            for (const song of songs) {
              // Make sure not to delete a song if it's part of another downloaded item
              const [allAlbums, allPlaylists, allMixes] = await Promise.all([
                getAllUserAlbums(userId),
                getAllUserPlaylists(userId),
                getAllUserMixes(userId),
              ]);
              const isSongInOtherItems = [
                ...allAlbums,
                ...allPlaylists,
                ...allMixes,
              ].some(
                (item) =>
                  item._id !== itemId &&
                  item.songsData.some((s: Song) => s._id === song._id)
              );
              if (!isSongInOtherItems) {
                await deleteUserItem("songs", song._id);
              }
            }

            // 4. Update state
            set((state) => {
              const newDownloaded = new Set(state.downloadedItemIds);
              newDownloaded.delete(itemId);
              const newDownloadedSongs = new Set(state.downloadedSongIds);
              songs.forEach((song) => newDownloadedSongs.delete(song._id));

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
        getDownloadedContentSize: async () => {
          const userId = useAuthStore.getState().user?.id;
          if (!userId) return { usage: 0, quota: 0 };

          try {
            // Реальный размер берём из Cache Storage, чтобы не было двойного счёта
            let totalSize = 0;
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
              // считаем только то, что относится к оффлайн/медиа (и workbox runtime)
              if (
                !cacheName.startsWith("moodify-") &&
                !cacheName.startsWith("workbox-")
              )
                continue;
              const cache = await caches.open(cacheName);
              const keys = await cache.keys();
              for (const req of keys) {
                const resp = await cache.match(req);
                if (!resp) continue;
                try {
                  const blob = await resp.blob();
                  totalSize += blob.size;
                } catch {
                  // ignore
                }
              }
            }

            // Get total quota
            const quota = navigator.storage?.estimate
              ? (await navigator.storage.estimate()).quota || 0
              : 0;

            return { usage: totalSize, quota };
          } catch (error) {
            console.error(
              "Failed to calculate downloaded content size:",
              error
            );
            return { usage: 0, quota: 0 };
          }
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

            await caches.delete(HLS_ASSETS_CACHE_NAME);

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

        clearAppCache: async () => {
          try {
            // 1) stop service workers (so they don't re-populate caches mid-clear)
            if ("serviceWorker" in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.allSettled(regs.map((r) => r.unregister()));
            }

            // 2) delete all Cache Storage entries
            if ("caches" in window) {
              const names = await caches.keys();
              await Promise.allSettled(names.map((n) => caches.delete(n)));
            }

            // 3) delete offline IndexedDB
            await deleteOfflineDb().catch(() => {});

            // 4) clear persisted localStorage keys (new + legacy)
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) continue;
              if (
                k.startsWith("moodify-") ||
                k.startsWith("moodify-studio-") ||
                k === "moodify-offline-storage"
              ) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));

            // 5) reset in-memory offline state
            set({
              downloadedItemIds: new Set(),
              downloadedSongIds: new Set(),
              downloadingItemIds: new Set(),
              downloadProgress: new Map(),
              downloadCancelled: new Set(),
            });

            toast.success(i18n.t("toasts.cacheCleared", "Кэш приложения очищен"));

            // 6) reload so newest SW/assets apply without hard reload
            window.location.reload();
          } catch (e) {
            console.error("[Offline] Failed to clear app cache", e);
            toast.error(
              i18n.t("toasts.cacheClearFailed", "Не удалось очистить кэш"),
            );
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
