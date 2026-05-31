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

export async function prefetchHomeData(authKey: string) {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.home.bootstrap(authKey),
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
