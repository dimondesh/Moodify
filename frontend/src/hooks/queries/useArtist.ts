import { useQuery } from "@tanstack/react-query";
import { fetchArtistById } from "@/lib/api/music";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 24 * 60 * 60 * 1000;

export function useArtist(artistId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.artist(artistId ?? ""),
    queryFn: () => fetchArtistById(artistId!),
    enabled: Boolean(artistId),
    staleTime: STALE_TIME,
  });
}
