import { useQuery } from "@tanstack/react-query";
import { fetchHomeBootstrap } from "@/lib/api/home";
import { fetchMyPlaylists } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/stores/useAuthStore";
import { isHomeFeedGenerating } from "@/lib/homeFeedGeneration";
import { useLibraryStore } from "@/stores/useLibraryStore";

async function syncLibraryForBootstrap() {
  const isLoggedIn = Boolean(useAuthStore.getState().accessToken);
  if (isLoggedIn) {
    await useLibraryStore.getState().fetchLibrary({ silent: true });
  } else {
    useLibraryStore.setState({
      albums: [],
      playlists: [],
      followedArtists: [],
    });
  }
}

export function useHomeBootstrapAuthKey() {
  const userId = useAuthStore((s) => s.user?.id);
  return userId ?? "__guest__";
}

export function useHomeBootstrap() {
  const authKey = useHomeBootstrapAuthKey();
  const requiresOnboarding = useAuthStore((s) => s.user?.requiresOnboarding);

  return useQuery({
    queryKey: queryKeys.home.bootstrap(authKey),
    enabled: !requiresOnboarding && !isHomeFeedGenerating(),
    queryFn: async () => {
      const userId = useAuthStore.getState().user?.id;
      const tasks: Promise<unknown>[] = [
        fetchHomeBootstrap(),
        syncLibraryForBootstrap(),
      ];
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
