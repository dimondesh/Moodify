import { useQuery } from "@tanstack/react-query";
import { fetchSecondaryHomeWithToast } from "@/lib/api/music";
import { queryKeys } from "@/lib/queryKeys";

export function useSecondaryHome() {
  return useQuery({
    queryKey: queryKeys.home.secondary,
    queryFn: fetchSecondaryHomeWithToast,
  });
}
