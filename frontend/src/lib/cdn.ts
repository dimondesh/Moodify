const hostname = (
  import.meta.env.VITE_BUNNY_PULL_ZONE_HOSTNAME || ""
).replace(/^https?:\/\//, "");

if (!hostname) {
  throw new Error("VITE_BUNNY_PULL_ZONE_HOSTNAME is required");
}

export const CDN_BASE = `https://${hostname}`;

export const cdnAsset = (path: string) =>
  `${CDN_BASE}/${path.replace(/^\//, "")}`;

/** Keep in sync with backend SYSTEM_COVER_SIZES / IMAGE_SIZES. */
const SYSTEM_COVER_SIZES = [64, 300, 640] as const;

export type SystemCoverImage = { size: number; url: string };

export const buildSystemCoverImages = (stem: string): SystemCoverImage[] =>
  SYSTEM_COVER_SIZES.map((size) => ({
    size,
    url: cdnAsset(`${stem}_${size}.webp`),
  }));

export const CDN_DEFAULT_ALBUM_COVER = cdnAsset("default-album-cover.png");
export const CDN_DEFAULT_ARTIST_IMAGE = cdnAsset("artist.jpeg");
export const CDN_DEFAULT_USER_IMAGE = cdnAsset("user.png");

export const CDN_LIKED_PLAYLIST_IMAGES = buildSystemCoverImages("liked");
export const CDN_LIKED_PLAYLIST_COVER =
  CDN_LIKED_PLAYLIST_IMAGES[CDN_LIKED_PLAYLIST_IMAGES.length - 1].url;

export { getUserAvatarUrl } from "@/lib/imageUrl";
