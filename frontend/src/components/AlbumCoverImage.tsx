/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/AlbumCoverImage.tsx

import React, { useState, useEffect, useRef } from "react";
import { cn } from "../lib/utils";

interface AlbumCoverImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  albumId?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  [key: string]: any;
}

// Global cache to prevent duplicate image loads
const imageCache = new Map<
  string,
  {
    loaded: boolean;
    loading: boolean;
    error: boolean;
  }
>();

const AlbumCoverImage: React.FC<AlbumCoverImageProps> = ({
  src,
  alt,
  className,
  fallbackSrc = "/default-song-cover.png",
  albumId,
  onError,
  onLoad,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Use albumId as cache key, fallback to src if no albumId
  const cacheKey = albumId || src;

  useEffect(() => {
    if (!src) {
      setImageSrc(fallbackSrc);
      return;
    }

    // Check if image is already cached
    const cached = imageCache.get(cacheKey);

    if (cached?.loaded) {
      setImageSrc(src);
      setHasError(cached.error);
      return;
    }

    if (cached?.loading) {
      setIsLoading(true);
      return;
    }

    // Start loading the image
    setIsLoading(true);
    imageCache.set(cacheKey, { loaded: false, loading: true, error: false });

    const img = new Image();

    img.onload = () => {
      imageCache.set(cacheKey, { loaded: true, loading: false, error: false });
      setImageSrc(src);
      setIsLoading(false);
      setHasError(false);
    };

    img.onerror = () => {
      imageCache.set(cacheKey, { loaded: true, loading: false, error: true });
      setImageSrc(fallbackSrc);
      setIsLoading(false);
      setHasError(true);
    };

    img.src = src;
  }, [src, cacheKey, fallbackSrc]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setImageSrc(fallbackSrc);
      setHasError(true);
    }
    onError?.(e);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    onLoad?.(e);
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={cn(
        className,
        isLoading && "opacity-50",
        hasError && "opacity-75"
      )}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};

export default AlbumCoverImage;
