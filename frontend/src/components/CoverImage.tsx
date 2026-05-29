import { cn } from "@/lib/utils";
import {
  buildImageSrcSet,
  getImageUrlByKey,
  type ImageEntity,
  type ImageSizeKey,
  IMAGE_SIZES,
} from "@/lib/imageUrl";

const SIZES_ATTR: Record<ImageSizeKey, string> = {
  thumb: "64px",
  card: "(max-width: 640px) 50vw, 200px",
  large: "(max-width: 1024px) 50vw, 320px",
};

export interface CoverImageProps
  extends Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "src" | "srcSet" | "sizes"
  > {
  entity: ImageEntity | null | undefined;
  size: ImageSizeKey;
  defaultUrl: string;
  alt: string;
}

export function CoverImage({
  entity,
  size,
  defaultUrl,
  alt,
  className,
  loading = "lazy",
  decoding = "async",
  ...props
}: CoverImageProps) {
  const src = getImageUrlByKey(entity, size, defaultUrl);
  const srcSet = buildImageSrcSet(entity);

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? SIZES_ATTR[size] : undefined}
      alt={alt}
      width={IMAGE_SIZES[size]}
      height={IMAGE_SIZES[size]}
      loading={loading}
      decoding={decoding}
      className={cn(className)}
      {...props}
    />
  );
}
