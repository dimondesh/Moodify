import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRecentSearch,
  clearRecentSearches,
  fetchRecentSearches,
  fetchSearch,
  removeRecentSearch,
} from "@/api/search";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/useAuthStore";

const SEARCH_STALE_TIME = 5 * 60 * 1000;

export function useSearchQuery(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.search.results(trimmed),
    queryFn: () => fetchSearch(trimmed),
    enabled: trimmed.length > 0,
    staleTime: SEARCH_STALE_TIME,
  });
}

export function useRecentSearches(enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: queryKeys.search.recent,
    queryFn: fetchRecentSearches,
    enabled: Boolean(userId) && enabled,
  });
}

export function useAddRecentSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      itemType,
    }: {
      itemId: string;
      itemType: string;
    }) => addRecentSearch(itemId, itemType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.recent });
    },
  });
}

export function useRemoveRecentSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (searchId: string) => removeRecentSearch(searchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.recent });
    },
  });
}

export function useClearRecentSearches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearRecentSearches,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.recent });
    },
  });
}
