import { useQuery } from "@tanstack/react-query";
import { fetchOwnedPlaylists } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/useAuthStore";

export function useOwnedPlaylists() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.playlists.owned,
    queryFn: fetchOwnedPlaylists,
    enabled: Boolean(userId),
  });
}
