import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import type { ImageEntity } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";

interface AlbumCoverImageProps {
  entity: ImageEntity;
  alt: string;
  className?: string;
  size?: "thumb" | "card" | "large";
  fallbackSrc?: string;
  loading?: "eager" | "lazy";
}

const AlbumCoverImage = ({
  entity,
  alt,
  className,
  size = "card",
  fallbackSrc = CDN_DEFAULT_ALBUM_COVER,
  loading = "lazy",
}: AlbumCoverImageProps) => (
  <CoverImage
    entity={entity}
    size={size}
    defaultUrl={fallbackSrc}
    alt={alt}
    loading={loading}
    className={cn(className)}
  />
);

export default AlbumCoverImage;
