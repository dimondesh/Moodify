import { useQuery } from "@tanstack/react-query";
import { fetchListenHistory } from "@/lib/api/music";
import { queryKeys } from "@/lib/queryKeys";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { useAuthStore } from "@/stores/useAuthStore";

export function useListenHistory() {
  const isOffline = useOfflineStore((s) => s.isOffline);
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: queryKeys.listenHistory,
    queryFn: fetchListenHistory,
    enabled:
      Boolean(user) && !user?.isAnonymous && !isOffline,
  });
}
