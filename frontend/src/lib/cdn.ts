const hostname = (
  import.meta.env.VITE_BUNNY_PULL_ZONE_HOSTNAME || ""
).replace(/^https?:\/\//, "");

if (!hostname) {
  throw new Error("VITE_BUNNY_PULL_ZONE_HOSTNAME is required");
}

export const CDN_BASE = `https://${hostname}`;

export const cdnAsset = (path: string) =>
  `${CDN_BASE}/${path.replace(/^\//, "")}`;

export const CDN_DEFAULT_ALBUM_COVER = cdnAsset("default-album-cover.png");
export const CDN_DEFAULT_ARTIST_IMAGE = cdnAsset("artist.jpeg");
export const CDN_DEFAULT_USER_IMAGE = cdnAsset("user.png");
export const CDN_LIKED_PLAYLIST_COVER = cdnAsset("liked.png");

export { getUserAvatarUrl } from "@/lib/imageUrl";
