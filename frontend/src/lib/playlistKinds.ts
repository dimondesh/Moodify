import type { Playlist, PlaylistKind } from "@/types";

const GENERATED_PLAYLIST_TYPES: PlaylistKind[] = [
  "GENRE_MIX",
  "MOOD_MIX",
  "PERSONAL_MIX",
  "ON_REPEAT",
  "DISCOVER_WEEKLY",
  "ON_REPEAT_REWIND",
  "NEW_RELEASES",
];

export function isGeneratedPlaylistType(
  type?: PlaylistKind | string | null,
): boolean {
  if (!type) return false;
  return GENERATED_PLAYLIST_TYPES.includes(type as PlaylistKind);
}

export function getPlaylistMadeForUserId(
  madeFor: Playlist["madeFor"],
): string | null {
  if (!madeFor) return null;
  if (typeof madeFor === "string") return madeFor;
  return madeFor._id ?? null;
}

export function isPlaylistMadeForUser(
  playlist: Pick<Playlist, "madeFor">,
  userId?: string | null,
): boolean {
  if (!userId) return false;
  const madeForId = getPlaylistMadeForUserId(playlist.madeFor);
  return Boolean(madeForId && madeForId === userId);
}

/** Playlists that belong in sidebar/library via "my playlists" (not curated feed). */
export function isLibraryMyPlaylist(playlist: Pick<Playlist, "type">): boolean {
  return playlist.type === "USER_CREATED" || playlist.type === "LIKED_SONGS";
}

/** Show add/remove library control (not for own USER_CREATED). */
export function canShowPlaylistLibraryToggle(
  playlist: Pick<Playlist, "type" | "owner"> | null | undefined,
  viewerUserId?: string | null,
): boolean {
  if (!playlist || playlist.type === "LIKED_SONGS") return false;
  const ownerId = playlist.owner?._id ?? playlist.owner;
  if (
    viewerUserId &&
    ownerId &&
    String(ownerId) === String(viewerUserId) &&
    playlist.type === "USER_CREATED"
  ) {
    return false;
  }
  return true;
}
