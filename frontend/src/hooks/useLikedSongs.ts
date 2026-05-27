import { useMyPlaylists } from "@/hooks/queries";
import {
  findLikedPlaylist,
  isSongInPlaylist,
} from "@/lib/likedPlaylist";

export function useLikedPlaylist() {
  const { data: myPlaylists = [] } = useMyPlaylists();
  return findLikedPlaylist(myPlaylists);
}

export function useIsSongLiked(songId: string | undefined): boolean {
  const { data: myPlaylists = [] } = useMyPlaylists();
  if (!songId) return false;
  const liked = findLikedPlaylist(myPlaylists);
  return liked ? isSongInPlaylist(liked, songId) : false;
}
