import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMyPlaylists, useArtists } from "@/hooks/queries";
import {
  buildLibraryItems,
  filterLibraryItems,
  transformDownloadedItems,
} from "@/lib/libraryItems";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { useUIStore } from "@/stores/useUIStore";
import type { LibraryItem } from "@/types";

export function useLibraryData() {
  const { t } = useTranslation();
  const {
    albums,
    playlists,
    followedArtists,
    isLoading: isLoadingLibrary,
    error: libraryError,
  } = useLibraryStore();
  const {
    data: myPlaylists = [],
    isPending: isLoadingPlaylists,
    error: playlistsError,
  } = useMyPlaylists();
  const { data: artists = [] } = useArtists();
  const {
    entityTypeFilter,
    setEntityTypeFilter,
    librarySearchQuery,
  } = useUIStore();
  const { isDownloaded, fetchAllDownloaded } = useOfflineStore(
    (s) => s.actions,
  );
  const isOffline = useOfflineStore((s) => s.isOffline);
  const hasDownloadedItems = useOfflineStore(
    (s) => s.downloadedItemIds.size > 0,
  );

  const [downloadedItems, setDownloadedItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    if (isOffline) {
      setEntityTypeFilter("downloaded");
    }
  }, [isOffline, setEntityTypeFilter]);

  useEffect(() => {
    if (entityTypeFilter === "downloaded") {
      const loadDownloaded = async () => {
        const items = await fetchAllDownloaded();
        setDownloadedItems(transformDownloadedItems(items, t));
      };
      void loadDownloaded();
    }
  }, [entityTypeFilter, fetchAllDownloaded, t]);

  const libraryItems = useMemo(
    () =>
      buildLibraryItems({
        albums,
        myPlaylists,
        playlists,
        followedArtists,
        t,
      }),
    [albums, myPlaylists, playlists, followedArtists, t],
  );

  const unknownArtistLabel = t("common.unknownArtist");

  const filteredLibraryItems = useMemo(
    () =>
      filterLibraryItems({
        libraryItems,
        downloadedItems,
        entityTypeFilter,
        librarySearchQuery,
        artists,
        unknownArtistLabel,
      }),
    [
      libraryItems,
      downloadedItems,
      entityTypeFilter,
      librarySearchQuery,
      artists,
      unknownArtistLabel,
    ],
  );

  const isLoading = (isLoadingLibrary || isLoadingPlaylists) && !isOffline;
  const errorMessage =
    (libraryError as string | null) || (playlistsError as string | null);

  return {
    libraryItems,
    filteredLibraryItems,
    downloadedItems,
    myPlaylists,
    artists,
    isDownloaded,
    isLoading,
    errorMessage,
    hasDownloadedItems,
    isOffline,
  };
}
