// frontend/src/pages/HomePage/HorizontalSection.tsx

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";
import { getArtistNames, getOptimizedImageUrl } from "../../lib/utils";
import { useMusicStore } from "../../stores/useMusicStore";
import type {
  Song,
  Album,
  Playlist,
  Mix,
  Artist,
  GeneratedPlaylist,
  PersonalMix,
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
  | (GeneratedPlaylist & { itemType: "generated-playlist" })
  | (PersonalMix & { itemType: "personal-mix" });

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

  // Функция для проверки валидности элемента
  const isValidItem = useCallback((item: DisplayItem): boolean => {
    if (!item || !item._id || !item.itemType) return false;

    switch (item.itemType) {
      case "song":
      case "album":
      case "playlist":
        return !!(item as Song | Album | Playlist).title;
      case "artist":
        return (
          !!(item as Artist).name ||
          !!(item as Artist & { title?: string }).title
        );
      case "mix":
        return (
          !!(item as Mix).name || !!(item as Mix & { title?: string }).title
        );
      case "generated-playlist":
        return (
          !!(item as GeneratedPlaylist).nameKey ||
          !!(item as GeneratedPlaylist & { title?: string }).title
        );
      case "personal-mix":
        return (
          !!(item as PersonalMix).name ||
          !!(item as PersonalMix & { title?: string }).title
        );
      default:
        return false;
    }
  }, []);

  // Мемоизируем фильтрацию и обработку элементов
  const validItems = useMemo(
    () => items.filter(isValidItem),
    [items, isValidItem]
  );

  const itemsToShow = useMemo(
    () => validItems.slice(0, limit),
    [validItems, limit]
  );
  const canShowAll = useMemo(
    () => onShowAll && items.length > limit,
    [onShowAll, items.length, limit]
  );

  const songsOnly = useMemo(
    () =>
      validItems.filter(
        (item): item is Song & { itemType: "song" } => item.itemType === "song"
      ),
    [validItems]
  );

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
      viewportElement.addEventListener("scroll", checkScrollability, {
        passive: true,
      });
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

  if (validItems.length === 0) {
    return null;
  }

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
      case "personal-mix":
        navigate(`/personal-mixes/${item._id}`);
        break;
      case "artist":
        navigate(`/artists/${item._id}`);
        break;
    }
  };

  const getDisplayTitle = (item: DisplayItem): string => {
    if (item.itemType === "artist") {
      return (
        (item as Artist).name ||
        (item as Artist & { title?: string }).title ||
        "Unknown Artist"
      );
    }
    if (item.itemType === "mix") {
      // Для миксов используем name если есть, иначе title (из истории)
      const mixName =
        (item as Mix).name || (item as Mix & { title?: string }).title;
      return mixName ? t(mixName) : "Unknown Mix";
    }
    if (item.itemType === "generated-playlist") {
      const nameKey =
        (item as GeneratedPlaylist).nameKey ||
        (item as GeneratedPlaylist & { title?: string }).title;
      return nameKey ? t(nameKey) : "Unknown Playlist";
    }
    if (item.itemType === "personal-mix") {
      const personalMixName =
        (item as PersonalMix).name ||
        (item as PersonalMix & { title?: string }).title;
      return personalMixName || "Unknown Mix";
    }
    return item.title || "Unknown Title";
  };

  const getSubtitle = (item: DisplayItem): string => {
    switch (item.itemType) {
      case "song":
        return getArtistNames((item as Song).artist, allArtists);
      case "album": {
        const album = item as Album;
        const albumType = album.type || "album";
        const albumArtists = album.artist
          ? getArtistNames(album.artist, allArtists)
          : t("sidebar.subtitle.unknownArtist");
        return `${t(`sidebar.subtitle.${albumType}`)} • ${albumArtists}`;
      }
      case "playlist": {
        const playlist = item as Playlist;
        return t("sidebar.subtitle.byUser", {
          name: playlist.owner?.fullName || t("sidebar.subtitle.user"),
        });
      }
      case "generated-playlist":
        return `${t("sidebar.subtitle.playlist")} • Moodify`;
      case "mix": {
        const mix = item as Mix;
        if (!mix.songs || mix.songs.length === 0) {
          return t("sidebar.subtitle.dailyMix");
        }

        const allArtists = mix.songs.flatMap((song) => song.artist);
        const uniqueArtists = allArtists.filter(
          (artist, index, self) =>
            index === self.findIndex((a) => a._id === artist._id)
        );
        const firstTwoUniqueArtists = uniqueArtists.slice(0, 2);
        const artistNames = getArtistNames(firstTwoUniqueArtists, allArtists);

        if (uniqueArtists.length > 2) {
          return `${artistNames} ${t("common.andMore")}`;
        }
        return artistNames;
      }
      case "personal-mix": {
        const personalMix = item as PersonalMix;
        if (!personalMix.songs || personalMix.songs.length === 0) {
          return t("sidebar.subtitle.dailyMix");
        }

        const allArtists = personalMix.songs.flatMap((song) => song.artist);
        const uniqueArtists = allArtists.filter(
          (artist, index, self) =>
            index === self.findIndex((a) => a._id === artist._id)
        );
        const firstTwoUniqueArtists = uniqueArtists.slice(0, 2);
        const artistNames = getArtistNames(firstTwoUniqueArtists, allArtists);

        if (uniqueArtists.length > 2) {
          return `${artistNames} ${t("common.andMore")}`;
        }
        return artistNames;
      }
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
                          {getDisplayTitle(item)?.[0] || "?"}
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
                    {/* Для миксов добавляем затемнение с названием */}
                    {(item.itemType === "mix" ||
                      item.itemType === "personal-mix") && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-6 z-10">
                        <h3 className="text-white text-sm font-bold drop-shadow-lg break-words">
                          {getDisplayTitle(item)}
                        </h3>
                      </div>
                    )}
                  </div>
                  <UniversalPlayButton
                    entity={item}
                    entityType={item.itemType}
                    songs={item.itemType === "song" ? songsOnly : undefined}
                    className={`absolute bottom-3 right-2 ${
                      item.itemType === "mix" ||
                      item.itemType === "personal-mix"
                        ? "z-50"
                        : ""
                    }`}
                    size="sm"
                  />
                </div>
                <div className="px-1">
                  {/* Для миксов не показываем название под обложкой, только subtitle */}
                  {item.itemType !== "mix" &&
                    item.itemType !== "personal-mix" && (
                      <h3 className="font-semibold text-sm truncate">
                        {getDisplayTitle(item)}
                      </h3>
                    )}
                  <p
                    className="text-xs text-zinc-400 leading-tight"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      wordWrap: "break-word",
                      wordBreak: "break-word",
                    }}
                  >
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
