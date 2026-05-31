import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { CoverImage } from "@/components/CoverImage";
import UniversalPlayButton from "@/layout/UniversalPlayButton";
import { CDN_DEFAULT_ARTIST_IMAGE } from "@/lib/cdn";
import { cn } from "@/lib/utils";
import type { LibraryItemDisplay } from "@/lib/libraryDisplay";
import type { LibraryItem } from "@/types";

interface LibraryItemRowProps {
  item: LibraryItem;
  display: LibraryItemDisplay;
  isDownloaded: boolean;
  variant: "sidebar" | "page";
  showPlayButton?: boolean;
}

export function LibraryItemRow({
  item,
  display,
  isDownloaded: downloaded,
  variant,
  showPlayButton = false,
}: LibraryItemRowProps) {
  const isSidebar = variant === "sidebar";

  return (
    <Link
      to={display.linkPath}
      className={cn(
        "hover:bg-zinc-800/50 rounded-md flex items-center cursor-pointer relative",
        isSidebar
          ? "p-2 gap-2"
          : "bg-transparent p-3 gap-4 transition-all group",
      )}
    >
      <div className={cn("relative flex-shrink-0", showPlayButton && "group")}>
        <CoverImage
          entity={item}
          size="thumb"
          defaultUrl={
            item.type === "artist"
              ? CDN_DEFAULT_ARTIST_IMAGE
              : display.coverDefault
          }
          alt={item.title}
          className={cn(
            "object-cover transition-opacity",
            display.imageClass,
            isSidebar ? "size-10" : "size-16 group-hover:opacity-50",
            showPlayButton && "group-hover:opacity-50",
          )}
        />
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
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-semibold truncate text-white",
            isSidebar ? "text-sm font-medium" : "text-lg mb-1",
          )}
        >
          {item.title}
        </p>
        <div className={cn("flex items-center", isSidebar ? "gap-1.5" : "gap-2")}>
          {downloaded && (
            <Download
              className={cn(
                "text-[#8b5cf6] flex-shrink-0",
                isSidebar ? "size-3" : "size-4",
              )}
            />
          )}
          <p
            className={cn(
              "text-gray-400 truncate",
              isSidebar ? "text-xs" : "text-sm",
            )}
          >
            {display.subtitle}
          </p>
        </div>
      </div>
    </Link>
  );
}
