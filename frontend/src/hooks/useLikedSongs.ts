import { usePlaylistStore } from "@/stores/usePlaylistStore";
import {
  findLikedPlaylist,
  isSongInPlaylist,
} from "@/lib/likedPlaylist";

export function useLikedPlaylist() {
  return usePlaylistStore((s) => findLikedPlaylist(s.myPlaylists));
}

export function useIsSongLiked(songId: string | undefined): boolean {
  return usePlaylistStore((s) => {
    if (!songId) return false;
    const liked = findLikedPlaylist(s.myPlaylists);
    return liked ? isSongInPlaylist(liked, songId) : false;
  });
}
