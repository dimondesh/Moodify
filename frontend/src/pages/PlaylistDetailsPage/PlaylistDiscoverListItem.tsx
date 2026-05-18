import { Button } from "@/components/ui/button";
import {
  CDN_DEFAULT_ALBUM_COVER,
  CDN_DEFAULT_ARTIST_IMAGE,
} from "@/lib/cdn";
import { getOptimizedImageUrl } from "@/lib/utils";
import type { Artist } from "@/types";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export type DiscoverListVariant = "song" | "album" | "artist";

type PlaylistDiscoverListItemProps = {
  variant: DiscoverListVariant;
  title: string;
  imageUrl?: string;
  artists?: Artist[];
  albumTitle?: string;
  trackIndex?: number;
  showAlbumColumn?: boolean;
  isAdded?: boolean;
  onAdd?: () => void;
  onDrillDown?: () => void;
  onAlbumClick?: () => void;
  onArtistClick?: (artistId: string) => void;
};

export function PlaylistDiscoverListItem({
  variant,
  title,
  imageUrl,
  artists = [],
  albumTitle,
  trackIndex,
  showAlbumColumn = true,
  isAdded = false,
  onAdd,
  onDrillDown,
  onAlbumClick,
  onArtistClick,
}: PlaylistDiscoverListItemProps) {
  const { t } = useTranslation();

  const coverSrc = getOptimizedImageUrl(
    imageUrl ||
      (variant === "artist"
        ? CDN_DEFAULT_ARTIST_IMAGE
        : CDN_DEFAULT_ALBUM_COVER),
    80,
  );

  const handleRowClick = () => {
    if (variant !== "song") {
      onDrillDown?.();
    }
  };

  const showMiddleAlbum =
    variant === "song" && showAlbumColumn && Boolean(albumTitle?.trim());

  return (
    <div
      role={variant !== "song" ? "button" : undefined}
      tabIndex={variant !== "song" ? 0 : undefined}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (variant !== "song" && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onDrillDown?.();
        }
      }}
      className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_auto] gap-3 sm:gap-4 items-center px-2 py-2 rounded-md hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        {trackIndex != null && (
          <span className="w-5 text-xs text-zinc-500 tabular-nums flex-shrink-0 text-center">
            {trackIndex}
          </span>
        )}
        <img
          src={coverSrc}
          alt=""
          className={`size-10 flex-shrink-0 object-cover ${
            variant === "artist" ? "rounded-full" : "rounded-md"
          }`}
        />
        <div className="min-w-0 flex flex-col flex-1">
          <span className="font-medium text-white truncate">{title}</span>
          {variant === "artist" && (
            <span className="text-sm text-zinc-400 truncate">
              {t("pages.playlist.discover.artist")}
            </span>
          )}
          {variant === "album" && (
            <span className="text-sm text-zinc-400 truncate">
              {t("pages.playlist.discover.album")}
            </span>
          )}
          {variant === "song" && artists.length > 0 && (
            <span className="text-sm text-zinc-400 truncate">
              {artists.map((artist, index) => (
                <span key={artist._id}>
                  <button
                    type="button"
                    className="hover:text-violet-400 hover:underline focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArtistClick?.(artist._id);
                    }}
                  >
                    {artist.name}
                  </button>
                  {index < artists.length - 1 && ", "}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0 hidden sm:block">
        {showMiddleAlbum ? (
          <button
            type="button"
            className="text-sm text-zinc-400 truncate w-full text-left hover:text-violet-400 hover:underline focus:outline-none"
            onClick={(e) => {
              e.stopPropagation();
              onAlbumClick?.();
            }}
          >
            {albumTitle}
          </button>
        ) : null}
      </div>

      <div className="flex items-center justify-end flex-shrink-0">
        {variant === "song" ? (
          <Button
            size="sm"
            type="button"
            disabled={isAdded}
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            className="bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-60"
          >
            {isAdded
              ? t("pages.playlist.discover.added")
              : t("pages.playlist.discover.add")}
          </Button>
        ) : (
          <ChevronRight className="size-5 text-zinc-400" aria-hidden />
        )}
      </div>
    </div>
  );
}