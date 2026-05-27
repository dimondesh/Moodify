import { useQuery } from "@tanstack/react-query";
import { fetchPlaylistById } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 60 * 60 * 1000;

export function usePlaylist(playlistId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.playlists.detail(playlistId ?? ""),
    queryFn: () => fetchPlaylistById(playlistId!),
    enabled: Boolean(playlistId),
    staleTime: STALE_TIME,
  });
}
