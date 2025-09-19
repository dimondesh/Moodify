// frontend/src/pages/HomePage/HorizontalSection.tsx

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import PlayButton from "./PlayButton";
import { getArtistNames, getOptimizedImageUrl } from "../../lib/utils";
import { useMusicStore } from "../../stores/useMusicStore";
import type {
  Song,
  Album,
  Playlist,
  Mix,
  Artist,
  GeneratedPlaylist,
} from "../../types";
import HorizontalSectionSkeleton from "./HorizontalSectionSkeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TFunction } from "i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type DisplayItem =
  | (Song & { itemType: "song" })
  | (Album & { itemType: "album" })
  | (Playlist & { itemType: "playlist" })
  | (Mix & { itemType: "mix" })
  | (Artist & { itemType: "artist" })
  | (GeneratedPlaylist & { itemType: "generated-playlist" });

interface HorizontalSectionProps {
  title: string;
  items: DisplayItem[];
  isLoading: boolean;
  onShowAll?: () => void;
  limit?: number;
  t: TFunction;
}

const HorizontalSectionComponent: React.FC<HorizontalSectionProps> = ({
  title,
  items,
  isLoading,
  onShowAll,
  limit = 6,
  t,
}) => {
  const navigate = useNavigate();
  const { artists: allArtists } = useMusicStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const checkScrollability = useCallback(() => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  useEffect(() => {
    const scrollAreaElement = scrollContainerRef.current;
    const viewportElement = scrollAreaElement?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );

    if (viewportElement) {
      checkScrollability();
      viewportElement.addEventListener("scroll", checkScrollability, { passive: true });
      window.addEventListener("resize", checkScrollability);

      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(viewportElement);
      
      // Также наблюдаем за контейнером контента внутри viewport
      if (viewportElement.firstChild) {
        resizeObserver.observe(viewportElement.firstChild as Element);
      }

      return () => {
        viewportElement.removeEventListener("scroll", checkScrollability);
        window.removeEventListener("resize", checkScrollability);
        resizeObserver.disconnect();
      };
    }
  }, [items, isLoading, checkScrollability]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (element) {
      const scrollAmount = element.clientWidth * 0.8;
      element.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (isLoading) {
    return <HorizontalSectionSkeleton />;
  }

  if (!items || items.length === 0) {
    return null;
  }

  const itemsToShow = items.slice(0, limit);
  const canShowAll = onShowAll && items.length > limit;

  const songsOnly = items.filter(
    (item): item is Song & { itemType: "song" } => item.itemType === "song"
  );

  const handleItemClick = (item: DisplayItem) => {
    switch (item.itemType) {
      case "song":
        navigate(`/albums/${(item as Song).albumId}`);
        break;
      case "album":
        navigate(`/albums/${item._id}`);
        break;
      case "playlist":
        navigate(`/playlists/${item._id}`);
        break;
      case "generated-playlist":
        navigate(`/generated-playlists/${item._id}`);
        break;
      case "mix":
        navigate(`/mixes/${item._id}`);
        break;
      case "artist":
        navigate(`/artists/${item._id}`);
        break;
    }
  };

  const getDisplayTitle = (item: DisplayItem): string => {
    if (item.itemType === "artist") return item.name;
    if (item.itemType === "mix") return t(item.name);
    if (item.itemType === "generated-playlist") return t(item.nameKey);
    return item.title;
  };

  const getSubtitle = (item: DisplayItem): string => {
    switch (item.itemType) {
      case "song":
        return getArtistNames((item as Song).artist, allArtists);
      case "album":
        return `${t(
          `sidebar.subtitle.${(item as Album).type}`
        )} • ${getArtistNames((item as Album).artist, allArtists)}`;
      case "playlist":
        return t("sidebar.subtitle.byUser", {
          name:
            (item as Playlist).owner?.fullName || t("sidebar.subtitle.user"),
        });
      case "generated-playlist":
        return `${t("sidebar.subtitle.playlist")} • Moodify Studio`;
      case "mix":
        return t("sidebar.subtitle.dailyMix");
      case "artist":
        return t("sidebar.subtitle.artist");
      default:
        return "";
    }
  };

  return (
    <div className="mb-4 sm:mb-8 relative group/section">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {canShowAll && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={onShowAll}
          >
            {t("searchpage.showAll")}
          </Button>
        )}
      </div>

      {isDesktop && canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-
          0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-md hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      {isDesktop && canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 backdrop-blur-md translate-x-1/2 z-20 bg-black/50 hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      <ScrollArea
        className="w-full whitespace-nowrap rounded-md"
        ref={scrollContainerRef}
      >
        <div className="flex gap-4 pb-4">
          {itemsToShow.map((item) => {
            if (item.itemType === "mix") {
              return (
                <div
                  key={`${item.itemType}-${item._id}`}
                  onClick={() => handleItemClick(item)}
                  className="group relative cursor-pointer overflow-hidden rounded-md bg-zinc-800/60 hover:bg-zinc-700/80 transition-all w-36 sm:w-44 flex-shrink-0"
                >
                  <img
                    src={getOptimizedImageUrl(item.imageUrl, 200)}
                    alt={getDisplayTitle(item)}
                    className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-end justify-start p-2 sm:p-3 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                    <h3 className="text-white text-base sm:text-lg font-bold drop-shadow-lg break-words whitespace-normal leading-tight">
                      {getDisplayTitle(item)}
                    </h3>
                  </div>
                </div>
              );
            }
            const songIndex =
              item.itemType === "song"
                ? songsOnly.findIndex((s) => s._id === item._id)
                : -1;
            return (
              <div
                key={`${item.itemType}-${item._id}`}
                className="bg-transparent p-0 rounded-md transition-all group cursor-pointer w-36 sm:w-44 flex-shrink-0"
                onClick={() => handleItemClick(item)}
              >
                <div className="relative mb-2">
                  <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                    {item.itemType === "artist" ? (
                      <Avatar className="absolute inset-0 h-full w-full object-cover rounded-full">
                        <AvatarImage
                          src={getOptimizedImageUrl(item.imageUrl, 200)}
                          alt={getDisplayTitle(item)}
                          className="object-cover h-auto w-auto rounded-full transition-transform duration-300 group-hover:scale-105"
                        />
                        <AvatarFallback>
                          {getDisplayTitle(item)[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <img
                        src={getOptimizedImageUrl(
                          item.imageUrl ||
                            "https://moodify.b-cdn.net/default-album-cover.png",
                          200
                        )}
                        alt={getDisplayTitle(item)}
                        className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                  </div>
                  {item.itemType === "song" && (
                    <PlayButton
                      song={item as Song}
                      songs={songsOnly}
                      songIndex={songIndex}
                    />
                  )}
                </div>
                <div className="px-1">
                  <h3 className="font-semibold text-sm truncate">
                    {getDisplayTitle(item)}
                  </h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {getSubtitle(item)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );
};

const HorizontalSection = React.memo(HorizontalSectionComponent);
export default HorizontalSection;