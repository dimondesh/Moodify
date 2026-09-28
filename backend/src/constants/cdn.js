const hostname = (process.env.BUNNY_PULL_ZONE_HOSTNAME || "").replace(
  /^https?:\/\//,
  "",
);
if (!hostname) {
  throw new Error("BUNNY_PULL_ZONE_HOSTNAME is required");
}

export const CDN_BASE = `https://${hostname}`;

export const cdnAsset = (path) =>
  `${CDN_BASE}/${path.replace(/^\//, "")}`;

/** Matches imageVariants IMAGE_SIZES — keep in sync. */
export const SYSTEM_COVER_SIZES = [64, 300, 640];

/** Real webp variants on CDN: `{stem}_64.webp`, `{stem}_300.webp`, `{stem}_640.webp`. */
export const buildSystemCoverImages = (stem) =>
  SYSTEM_COVER_SIZES.map((size) => ({
    size,
    url: cdnAsset(`${stem}_${size}.webp`),
  }));

export const CDN_DEFAULT_ALBUM_COVER = cdnAsset("default-album-cover.png");
export const CDN_DEFAULT_ARTIST_IMAGE = cdnAsset("artist.png");
export const CDN_DEFAULT_USER_IMAGE = cdnAsset("user.png");

export const CDN_LIKED_PLAYLIST_IMAGES = buildSystemCoverImages("liked");
export const CDN_ON_REPEAT_IMAGES = buildSystemCoverImages("on-repeat");
export const CDN_DISCOVER_WEEKLY_IMAGES =
  buildSystemCoverImages("discover-weekly");
export const CDN_ON_REPEAT_REWIND_IMAGES =
  buildSystemCoverImages("on-repeat-rewind");

/** Largest variant URL (OG, accent extraction, single-url callers). */
export const CDN_LIKED_PLAYLIST_COVER = CDN_LIKED_PLAYLIST_IMAGES.at(-1).url;
export const CDN_ON_REPEAT_IMAGE = CDN_ON_REPEAT_IMAGES.at(-1).url;
export const CDN_DISCOVER_WEEKLY_IMAGE = CDN_DISCOVER_WEEKLY_IMAGES.at(-1).url;
export const CDN_ON_REPEAT_REWIND_IMAGE =
  CDN_ON_REPEAT_REWIND_IMAGES.at(-1).url;

/** Source PNGs used to (re)generate sized webp variants. */
export const SYSTEM_COVER_SOURCES = [
  { stem: "liked", sourcePath: "liked.png" },
  { stem: "on-repeat", sourcePath: "on-repeat.png" },
  { stem: "discover-weekly", sourcePath: "discover-weekly.png" },
  { stem: "on-repeat-rewind", sourcePath: "on-repeat-rewind.png" },
];

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

export const CDN_SYSTEM_PLAYLIST_IMAGES_BY_TYPE = {
  LIKED_SONGS: CDN_LIKED_PLAYLIST_IMAGES,
  ON_REPEAT: CDN_ON_REPEAT_IMAGES,
  DISCOVER_WEEKLY: CDN_DISCOVER_WEEKLY_IMAGES,
  ON_REPEAT_REWIND: CDN_ON_REPEAT_REWIND_IMAGES,
};

/** Fixed CDN art → constant accent; otherwise leave stored coverAccentHex. */
export function applySystemPlaylistCoverAccent(playlist) {
  if (!playlist?.type) return playlist;
  const hex = CDN_SYSTEM_PLAYLIST_ACCENT_BY_TYPE[playlist.type];
  if (hex) playlist.coverAccentHex = hex;
  return playlist;
}
