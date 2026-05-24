export const CDN_BASE = "https://moodify-one.b-cdn.net";

export const cdnAsset = (path: string) =>
  `${CDN_BASE}/${path.replace(/^\//, "")}`;

export const CDN_DEFAULT_ALBUM_COVER = cdnAsset("default-album-cover.png");
export const CDN_DEFAULT_ARTIST_IMAGE = cdnAsset("artist.jpeg");
export const CDN_DEFAULT_USER_IMAGE = cdnAsset("user.png");
export const CDN_LIKED_PLAYLIST_COVER = cdnAsset("liked.png");

export const resolveUserImageUrl = (imageUrl?: string | null): string =>
  imageUrl?.trim() ? imageUrl : CDN_DEFAULT_USER_IMAGE;
