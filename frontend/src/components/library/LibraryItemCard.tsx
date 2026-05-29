import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";
import UniversalPlayButton from "@/components/ui/UniversalPlayButton";
import { CDN_DEFAULT_ARTIST_IMAGE } from "@/lib/cdn";
import { cn } from "@/lib/utils";
import type { LibraryItemDisplay } from "@/lib/libraryDisplay";
import type { LibraryItem } from "@/types";

interface LibraryItemCardProps {
  item: LibraryItem;
  display: LibraryItemDisplay;
  isDownloaded: boolean;
  variant: "sidebar" | "page";
  showPlayButton?: boolean;
}

export function LibraryItemCard({
  item,
  display,
  isDownloaded: downloaded,
  variant,
  showPlayButton = false,
}: LibraryItemCardProps) {
  const isSidebar = variant === "sidebar";

  return (
    <Link
      to={display.linkPath}
      className={cn(
        "hover:bg-zinc-800/50 rounded-md flex flex-col items-center text-center cursor-pointer relative",
        isSidebar
          ? "p-1 flex-shrink-0"
          : "bg-transparent p-2 transition-all group",
      )}
    >
      <div
        className={cn(
          "relative flex-shrink-0",
          showPlayButton && "group",
          isSidebar ? "mb-0.5" : "mb-2 w-full",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden",
            isSidebar ? "" : "aspect-square w-full shadow-lg",
            item.type === "artist" ? "rounded-full" : "rounded-md",
          )}
        >
          <CoverImage
            entity={item}
            size={isSidebar ? "thumb" : "card"}
            defaultUrl={
              item.type === "artist"
                ? CDN_DEFAULT_ARTIST_IMAGE
                : display.coverDefault
            }
            alt={item.title}
            className={cn(
              "object-cover transition-opacity",
              display.imageClass,
              isSidebar
                ? "h-20 w-20 group-hover:opacity-50"
                : "absolute inset-0 w-full h-full duration-300",
              item.type === "artist" && !isSidebar && "rounded-full",
              showPlayButton && "group-hover:opacity-50",
            )}
          />
        </div>
        {showPlayButton && (
          <>
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const playButton =
                  e.currentTarget.parentElement?.querySelector("button");
                playButton?.click();
              }}
            />
            <UniversalPlayButton
              entity={item}
              entityType={item.type as "album" | "playlist" | "artist"}
              variant="overlay"
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              size="sm"
            />
          </>
        )}
      </div>
      <div className={cn(isSidebar ? "w-full" : "px-1 w-full")}>
        <p
          className={cn(
            "font-semibold truncate text-white",
            isSidebar ? "text-xs font-medium mb-0" : "text-sm",
          )}
        >
          {item.title}
        </p>
        <div
          className={cn(
            "flex items-center justify-center",
            isSidebar ? "gap-0.5" : "gap-1.5",
          )}
        >
          {downloaded && (
            <Download
              className={cn(
                "text-[#8b5cf6] flex-shrink-0",
                isSidebar ? "size-2" : "size-3",
              )}
            />
          )}
          <p className="text-xs text-gray-400 truncate">{display.subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
