import { useQuery } from "@tanstack/react-query";
import { fetchHomeBootstrap } from "@/lib/api/home";
import { fetchMyPlaylists } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/useAuthStore";

export function useHomeBootstrapAuthKey() {
  const userId = useAuthStore((s) => s.user?.id);
  return userId ?? "__guest__";
}

export function useHomeBootstrap() {
  const authKey = useHomeBootstrapAuthKey();

  return useQuery({
    queryKey: queryKeys.home.bootstrap(authKey),
    queryFn: async () => {
      const userId = useAuthStore.getState().user?.id;
      const tasks: Promise<unknown>[] = [fetchHomeBootstrap()];
      if (userId) {
        tasks.push(
          queryClient.fetchQuery({
            queryKey: queryKeys.playlists.my,
            queryFn: fetchMyPlaylists,
          }),
        );
      }
      const [bootstrap] = await Promise.all(tasks);
      return bootstrap as Awaited<ReturnType<typeof fetchHomeBootstrap>>;
    },
  });
}
