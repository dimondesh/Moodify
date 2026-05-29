import { useEffect, useRef } from "react";
import { getImageUrl, IMAGE_SIZES } from "@/lib/imageUrl";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";

const preloaded = new Set<string>();

export const useAlbumCoverCache = (songs: { albumId?: string; images?: { size: number; url: string }[] }[]) => {
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!songs?.length) return;

    const albumCovers = new Map<string, { albumId: string; entity: { images?: { size: number; url: string }[] } }>();

    songs.forEach((song) => {
      if (song.albumId && song.images?.length) {
        albumCovers.set(song.albumId, {
          albumId: song.albumId,
          entity: { images: song.images },
        });
      }
    });

    albumCovers.forEach(({ albumId, entity }) => {
      const url = getImageUrl(entity, IMAGE_SIZES.thumb, CDN_DEFAULT_ALBUM_COVER);
      const cacheKey = `${albumId}:${url}`;
      if (preloaded.has(cacheKey) || loadingRef.current.has(cacheKey)) {
        return;
      }
      loadingRef.current.add(cacheKey);
      const img = new Image();
      img.onload = () => {
        preloaded.add(cacheKey);
        loadingRef.current.delete(cacheKey);
      };
      img.onerror = () => {
        loadingRef.current.delete(cacheKey);
      };
      img.src = url;
    });
  }, [songs]);
};
