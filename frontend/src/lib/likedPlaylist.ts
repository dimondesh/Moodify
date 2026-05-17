import type { Playlist, Song } from "@/types";

export const LIKED_PLAYLIST_TYPE = "LIKED_SONGS" as const;

export function findLikedPlaylist(
  playlists: Playlist[],
): Playlist | undefined {
  return playlists.find((p) => p.type === LIKED_PLAYLIST_TYPE);
}

export function getSongIdFromPlaylistEntry(
  entry: string | Song,
): string | undefined {
  if (typeof entry === "string") return entry;
  return entry._id;
}

export function isSongInPlaylist(playlist: Playlist, songId: string): boolean {
  return (playlist.songs ?? []).some((s) => {
    const id = getSongIdFromPlaylistEntry(s);
    return id === songId;
  });
}

export function getLikedSongIds(playlists: Playlist[]): Set<string> {
  const liked = findLikedPlaylist(playlists);
  if (!liked?.songs?.length) return new Set();
  const ids = liked.songs
    .map((s) => getSongIdFromPlaylistEntry(s))
    .filter((id): id is string => Boolean(id));
  return new Set(ids);
}
