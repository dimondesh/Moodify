// backend/src/lib/playlistCover.service.js
import { deleteFromBunny, getPathFromUrl } from "../media/bunny.service.js";

const PLAYLIST_COVER_PREFIX = "playlist_covers/";

/** @param {string | null | undefined} remotePath */
export function isUserUploadedPlaylistCoverPath(remotePath) {
  if (!remotePath || typeof remotePath !== "string") return false;
  return remotePath.replace(/\\/g, "/").startsWith(PLAYLIST_COVER_PREFIX);
}

/**
 * @param {{ images?: { url?: string }[], imagePublicId?: string | null }} playlist
 * @param {string | null} [excludePath] — newly uploaded path to keep
 * @returns {string[]}
 */
export function collectDeletablePlaylistCoverPaths(playlist, excludePath = null) {
  const paths = new Set();
  const normalizedExclude = excludePath?.replace(/\\/g, "/") ?? null;

  if (Array.isArray(playlist.images)) {
    for (const img of playlist.images) {
      const p = getPathFromUrl(img?.url);
      if (p && isUserUploadedPlaylistCoverPath(p)) {
        paths.add(p);
      }
    }
  }

  if (isUserUploadedPlaylistCoverPath(playlist.imagePublicId)) {
    paths.add(playlist.imagePublicId.replace(/\\/g, "/"));
  }

  if (normalizedExclude) {
    paths.delete(normalizedExclude);
  }

  return [...paths];
}

/**
 * @param {{ images?: { url?: string }[], imagePublicId?: string | null }} playlist
 * @param {string | null} [excludePath]
 */
export async function deletePlaylistCoverFromCdn(playlist, excludePath = null) {
  const paths = collectDeletablePlaylistCoverPaths(playlist, excludePath);
  await Promise.all(paths.map((p) => deleteFromBunny(p)));
}
