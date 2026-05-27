import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProfilePageData, toggleFollow } from "@/api/profile";
import { queryKeys } from "@/lib/queryKeys";

export function useProfileData(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profile.data(userId ?? ""),
    queryFn: () => fetchProfilePageData(userId!),
    enabled: Boolean(userId),
  });
}

export function useToggleFollow(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleFollow(userId!),
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.profile.data(userId),
      });
    },
  });
}
