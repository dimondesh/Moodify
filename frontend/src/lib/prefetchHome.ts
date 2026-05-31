import { fetchHomeBootstrap } from "@/lib/api/home";
import { fetchMyPlaylists } from "@/lib/api/playlists";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/useAuthStore";
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

export function clearHomeBootstrapCaches(userId?: string) {
  queryClient.removeQueries({
    queryKey: queryKeys.home.bootstrap("__guest__"),
  });
  if (userId) {
    queryClient.removeQueries({
      queryKey: queryKeys.home.bootstrap(userId),
    });
  }
}

export async function prefetchHomeData(
  authKey: string,
  { force = false }: { force?: boolean } = {},
) {
  const queryKey = queryKeys.home.bootstrap(authKey);

  if (force) {
    queryClient.removeQueries({ queryKey });
  }

  await queryClient.fetchQuery({
    queryKey,
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
