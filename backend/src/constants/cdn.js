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
