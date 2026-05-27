import { useQuery } from "@tanstack/react-query";
import { fetchMyPlaylists } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/useAuthStore";

export function useMyPlaylists() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.playlists.my,
    queryFn: fetchMyPlaylists,
    enabled: Boolean(userId),
  });
}
