import { useQuery } from "@tanstack/react-query";
import { fetchHubs, fetchHubById } from "@/lib/api/hubs";
import { queryKeys } from "@/lib/queryKeys";

const STALE_TIME = 6 * 60 * 60 * 1000;

export function useHubs() {
  return useQuery({
    queryKey: queryKeys.hubs.list,
    queryFn: fetchHubs,
    staleTime: STALE_TIME,
  });
}

export function useHub(hubId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hubs.detail(hubId ?? ""),
    queryFn: () => fetchHubById(hubId!),
    enabled: Boolean(hubId),
    staleTime: STALE_TIME,
  });
}
