/** Types produced by cron/generators — not shown as "my playlists" until user saves them. */
export const GENERATED_PLAYLIST_TYPES = [
  "GENRE_MIX",
  "MOOD_MIX",
  "PERSONAL_MIX",
  "ON_REPEAT",
  "DISCOVER_WEEKLY",
  "ON_REPEAT_REWIND",
  "NEW_RELEASES",
];

export const USER_CREATED_PLAYLIST_TYPE = "USER_CREATED";

/** Virtual playlist id for Liked Songs (not a MongoDB ObjectId). */
export const LIKED_PLAYLIST_ID = "liked";

export function isGeneratedPlaylistType(type) {
  return GENERATED_PLAYLIST_TYPES.includes(type);
}
