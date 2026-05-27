import { useQuery } from "@tanstack/react-query";
import { fetchPlaylistRecommendations } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import { useOfflineStore } from "@/stores/useOfflineStore";

export function usePlaylistRecommendations(playlistId: string | undefined) {
  const isOffline = useOfflineStore((s) => s.isOffline);

  return useQuery({
    queryKey: queryKeys.playlists.recommendations(playlistId ?? ""),
    queryFn: () => fetchPlaylistRecommendations(playlistId!),
    enabled: Boolean(playlistId) && !isOffline,
  });
}
