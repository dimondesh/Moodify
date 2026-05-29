import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
  CDN_DEFAULT_USER_IMAGE,
} from "@/lib/cdn";

export const IMAGE_SIZES = {
  thumb: 64,
  card: 300,
  large: 640,
} as const;

export type ImageSizeKey = keyof typeof IMAGE_SIZES;

export interface ImageVariant {
  size: number;
  url: string;
}

export interface ImageEntity {
  images?: ImageVariant[];
}

export const DEFAULT_IMAGES = {
  album: CDN_DEFAULT_ALBUM_COVER,
  artist: CDN_DEFAULT_ARTIST_IMAGE,
  user: CDN_DEFAULT_USER_IMAGE,
} as const;

export function getImageUrl(
  entity: ImageEntity | null | undefined,
  targetSize: number,
  defaultUrl: string = CDN_DEFAULT_ALBUM_COVER,
): string {
  const images = entity?.images;
  if (!images?.length) {
    return defaultUrl;
  }

  const sorted = [...images].sort((a, b) => a.size - b.size);
  const exact = sorted.find((img) => img.size === targetSize);
  if (exact) return exact.url;

  const larger = sorted.find((img) => img.size >= targetSize);
  if (larger) return larger.url;

  return sorted[sorted.length - 1]?.url ?? defaultUrl;
}

export function buildImageSrcSet(
  entity: ImageEntity | null | undefined,
): string | undefined {
  const images = entity?.images;
  if (!images?.length) return undefined;
  return images.map((img) => `${img.url} ${img.size}w`).join(", ");
}

export function getImageUrlByKey(
  entity: ImageEntity | null | undefined,
  key: ImageSizeKey,
  defaultUrl?: string,
): string {
  return getImageUrl(entity, IMAGE_SIZES[key], defaultUrl);
}

export function buildStaticCdnImages(cdnUrl: string): ImageVariant[] {
  return Object.values(IMAGE_SIZES).map((size) => ({ size, url: cdnUrl }));
}

export function getUserAvatarUrl(
  entity: ImageEntity | null | undefined,
): string {
  return getImageUrlByKey(entity, "thumb", DEFAULT_IMAGES.user);
}

/** Largest variant URL for OG tags, color extraction, offline cache keys */
export function getLargeCoverUrl(
  entity: ImageEntity | null | undefined,
  defaultUrl: string = CDN_DEFAULT_ALBUM_COVER,
): string {
  return getImageUrl(entity, IMAGE_SIZES.large, defaultUrl);
}

export function buildMediaSessionArtwork(
  entity: ImageEntity | null | undefined,
  fallback = CDN_DEFAULT_ALBUM_COVER,
): { src: string; sizes: string; type: string }[] {
  if (entity?.images?.length) {
    return entity.images.map((img) => ({
      src: img.url,
      sizes: `${img.size}x${img.size}`,
      type: "image/webp",
    }));
  }
  return buildStaticCdnImages(fallback).map((img) => ({
    src: img.url,
    sizes: `${img.size}x${img.size}`,
    type: "image/png",
  }));
}
