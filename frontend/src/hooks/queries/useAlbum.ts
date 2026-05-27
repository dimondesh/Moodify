import { useQuery } from "@tanstack/react-query";
import { fetchAlbumById } from "@/lib/api/music";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 24 * 60 * 60 * 1000;

export function useAlbum(albumId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.album(albumId ?? ""),
    queryFn: () => fetchAlbumById(albumId!),
    enabled: Boolean(albumId),
    staleTime: STALE_TIME,
  });
}
