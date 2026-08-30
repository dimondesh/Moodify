export const CDN_BASE = "https://moodify-one.b-cdn.net";

export const cdnAsset = (path) =>
  `${CDN_BASE}/${path.replace(/^\//, "")}`;

export const CDN_DEFAULT_ALBUM_COVER = cdnAsset("default-album-cover.png");
export const CDN_DEFAULT_ARTIST_IMAGE = cdnAsset("artist.png");
export const CDN_DEFAULT_USER_IMAGE = cdnAsset("user.png");
export const CDN_LIKED_PLAYLIST_COVER = cdnAsset("liked.png");
export const CDN_ON_REPEAT_IMAGE = cdnAsset("on-repeat.png");
export const CDN_DISCOVER_WEEKLY_IMAGE = cdnAsset("discover-weekly.png");
export const CDN_ON_REPEAT_REWIND_IMAGE = cdnAsset("on-repeat-rewind.png");

/** Hero tints from fixed system covers (coverAccent on CDN art). */
export const CDN_LIKED_PLAYLIST_ACCENT_HEX = "#402376";
export const CDN_ON_REPEAT_ACCENT_HEX = "#412376";
export const CDN_DISCOVER_WEEKLY_ACCENT_HEX = "#572376";
export const CDN_ON_REPEAT_REWIND_ACCENT_HEX = "#412376";

export const CDN_SYSTEM_PLAYLIST_ACCENT_BY_TYPE = {
  LIKED_SONGS: CDN_LIKED_PLAYLIST_ACCENT_HEX,
  ON_REPEAT: CDN_ON_REPEAT_ACCENT_HEX,
  DISCOVER_WEEKLY: CDN_DISCOVER_WEEKLY_ACCENT_HEX,
  ON_REPEAT_REWIND: CDN_ON_REPEAT_REWIND_ACCENT_HEX,
};

/** Fixed CDN art → constant accent; otherwise leave stored coverAccentHex. */
export function applySystemPlaylistCoverAccent(playlist) {
  if (!playlist?.type) return playlist;
  const hex = CDN_SYSTEM_PLAYLIST_ACCENT_BY_TYPE[playlist.type];
  if (hex) playlist.coverAccentHex = hex;
  return playlist;
}
