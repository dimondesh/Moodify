import { useQuery } from "@tanstack/react-query";
import { fetchArtists } from "@/lib/api/music";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 24 * 60 * 60 * 1000;

export function useArtists() {
  return useQuery({
    queryKey: queryKeys.artists,
    queryFn: fetchArtists,
    staleTime: STALE_TIME,
  });
}
