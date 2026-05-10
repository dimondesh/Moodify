import { Navigate, useParams } from "react-router-dom";

/** Old URLs pointed at separate entities; server model is always `Playlist`. */
export function LegacyPlaylistByMixId() {
  const { mixId } = useParams<{ mixId: string }>();
  if (!mixId) return <Navigate to="/" replace />;
  return <Navigate to={`/playlists/${mixId}`} replace />;
}

export function LegacyPlaylistById() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;
  return <Navigate to={`/playlists/${id}`} replace />;
}

export function LegacyPlaylistBrowse() {
  const { category } = useParams<{ category: string }>();
  if (!category) return <Navigate to="/" replace />;
  return <Navigate to={`/playlists/browse/${category}`} replace />;
}
