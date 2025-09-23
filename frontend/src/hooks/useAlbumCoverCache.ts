// src/hooks/useAlbumCoverCache.ts

import { useState, useEffect, useRef } from "react";

interface AlbumCoverCache {
  [albumId: string]: {
    imageUrl: string;
    loaded: boolean;
    loading: boolean;
  };
}

const albumCoverCache: AlbumCoverCache = {};

export const useAlbumCoverCache = (songs: any[]) => {
  const [cache, setCache] = useState<AlbumCoverCache>(albumCoverCache);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!songs || songs.length === 0) return;

    // Group songs by albumId and get unique album covers
    const albumCovers = new Map<string, string>();

    songs.forEach((song) => {
      if (song.albumId && song.imageUrl) {
        albumCovers.set(song.albumId, song.imageUrl);
      }
    });

    // Process each unique album cover
    albumCovers.forEach((imageUrl, albumId) => {
      // Skip if already cached or currently loading
      if (cache[albumId]?.loaded || loadingRef.current.has(albumId)) {
        return;
      }

      // Mark as loading
      loadingRef.current.add(albumId);

      // Create a new image element to preload the image
      const img = new Image();

      img.onload = () => {
        // Image loaded successfully
        setCache((prev) => ({
          ...prev,
          [albumId]: {
            imageUrl,
            loaded: true,
            loading: false,
          },
        }));
        loadingRef.current.delete(albumId);
      };

      img.onerror = () => {
        // Image failed to load
        setCache((prev) => ({
          ...prev,
          [albumId]: {
            imageUrl: "/default-song-cover.png",
            loaded: true,
            loading: false,
          },
        }));
        loadingRef.current.delete(albumId);
      };

      // Start loading the image
      img.src = imageUrl;

      // Set initial cache entry
      setCache((prev) => ({
        ...prev,
        [albumId]: {
          imageUrl,
          loaded: false,
          loading: true,
        },
      }));
    });
  }, [songs]);

  const getAlbumCover = (albumId: string, fallbackImageUrl?: string) => {
    const cached = cache[albumId];
    if (cached?.loaded) {
      return cached.imageUrl;
    }
    return fallbackImageUrl || "/default-song-cover.png";
  };

  const isAlbumCoverLoading = (albumId: string) => {
    return cache[albumId]?.loading || false;
  };

  const isAlbumCoverLoaded = (albumId: string) => {
    return cache[albumId]?.loaded || false;
  };

  return {
    getAlbumCover,
    isAlbumCoverLoading,
    isAlbumCoverLoaded,
    cache,
  };
};
