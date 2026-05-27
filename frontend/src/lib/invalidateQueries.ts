import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";

export function invalidateArtists() {
  return queryClient.invalidateQueries({ queryKey: queryKeys.artists });
}

export function invalidatePlaylistLists() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.my }),
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists.owned }),
  ]);
}

export function invalidatePlaylistDetail(playlistId: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.playlists.detail(playlistId),
  });
}

export function invalidateHomeBootstrap(authKey: string) {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.home.bootstrap(authKey),
  });
}

export function invalidateListenHistory() {
  return queryClient.invalidateQueries({ queryKey: queryKeys.listenHistory });
}
