/** @param {import("mongoose").Types.ObjectId | { _id?: unknown } | string | null | undefined} madeFor */
export function getPlaylistMadeForId(madeFor) {
  if (!madeFor) return null;
  if (typeof madeFor === "object" && madeFor._id != null) {
    return String(madeFor._id);
  }
  return String(madeFor);
}

export function canUserViewPlaylist(playlist, viewerId) {
  if (playlist.isPublic) return true;
  if (!viewerId) return false;

  const viewer = String(viewerId);
  const ownerRef = playlist.owner;
  const ownerId =
    ownerRef?._id != null
      ? String(ownerRef._id)
      : ownerRef != null
        ? String(ownerRef)
        : null;

  if (ownerId && ownerId === viewer) return true;

  const madeForId = getPlaylistMadeForId(playlist.madeFor);
  if (madeForId && madeForId === viewer) return true;

  return false;
}
