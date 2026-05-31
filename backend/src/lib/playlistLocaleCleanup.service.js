import { Playlist } from "../models/playlist.model.js";

/** Legacy duplicate of localizedNames — remove from all playlists. */
export const removePlaylistSearchableNames = async () => {
  const result = await Playlist.updateMany(
    { searchableNames: { $exists: true } },
    { $unset: { searchableNames: "" } },
  );

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  };
};
