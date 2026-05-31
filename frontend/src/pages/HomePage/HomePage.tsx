// src/pages/HomePage/HomePage.tsx

import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import FeaturedSection from "./FeaturedSection";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { SITE_SLOGAN } from "@/lib/site-meta";
import { useDominantColor } from "@/hooks/useDominantColor";
import { Album, Song, type DisplayItem } from "@/types";
import HorizontalSection from "./HorizontalSection";
import { useNavigate } from "react-router-dom";
import HomePageSkeleton from "./HomePageSkeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHomeBootstrap } from "@/hooks/queries";
import type { HomeSection, HomeSectionId } from "@/lib/api/home";

const FEATURED_SECTION_IDS = new Set<HomeSectionId>([
  "quickPicks",
  "trendingSongs",
]);

const ALBUM_SECTION_IDS = new Set<HomeSectionId>([
  "trendingAlbums",
  "albumsYouMightLike",
]);

const HomePageComponent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const { data: homeData, isPending: isHomePageLoading } = useHomeBootstrap();
  const sections = homeData?.sections ?? [];

  const featuredSection = useMemo(
    () => sections.find((section) => FEATURED_SECTION_IDS.has(section.id)),
    [sections],
  );
  const featuredSongs = useMemo(
    () =>
      (featuredSection?.items ?? []).filter(
        (item): item is Song & { itemType: "song" } => item.itemType === "song",
      ),
    [featuredSection],
  );
  const albumSections = useMemo(
    () => sections.filter((section) => ALBUM_SECTION_IDS.has(section.id)),
    [sections],
  );

  const { initializeQueue, currentSong } = usePlayerStore();
  const { resolveAccentColor } = useDominantColor();

  const [currentBgColor, setCurrentBgColor] = useState("#18181b");
  const defaultColorRef = useRef("#18181b");

  const changeBackgroundColor = useCallback(
    (color: string) => {
      if (isMobile) return;

      if (currentBgColor === color) {
        return;
      }

      setCurrentBgColor(color);
    },
    [isMobile, currentBgColor],
  );

  useEffect(() => {
    if (featuredSongs.length > 0 && !isHomePageLoading && !isMobile) {
      const newDefaultColor = resolveAccentColor(
        featuredSongs[0].coverAccentHex,
      );
      defaultColorRef.current = newDefaultColor;
      if (currentBgColor === "#18181b") {
        changeBackgroundColor(newDefaultColor);
      }
    }
  }, [
    featuredSongs,
    resolveAccentColor,
    currentBgColor,
    isHomePageLoading,
    changeBackgroundColor,
    isMobile,
  ]);

  useEffect(() => {
    if (currentSong !== null || isHomePageLoading) return;

    const allSongs: Song[] = [...featuredSongs];
    for (const section of albumSections) {
      const albumSongs = (section.items as Album[]).flatMap(
        (album) => album.songs || [],
      );
      allSongs.push(...albumSongs);
    }

    if (allSongs.length > 0) {
      initializeQueue(allSongs);
    }
  }, [
    initializeQueue,
    featuredSongs,
    albumSections,
    currentSong,
    isHomePageLoading,
  ]);

  const colorCacheRef = useRef<Map<string, string>>(new Map());
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSongHover = useCallback(
    (song: Song) => {
      if (isMobile) return;

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      hoverTimeoutRef.current = setTimeout(() => {
        const cacheKey = `${song._id}:${song.coverAccentHex ?? ""}`;
        const cachedColor = colorCacheRef.current.get(cacheKey);
        if (cachedColor) {
          changeBackgroundColor(cachedColor);
          return;
        }

        const finalColor = resolveAccentColor(song.coverAccentHex);
        colorCacheRef.current.set(cacheKey, finalColor);
        if (colorCacheRef.current.size > 50) {
          const firstKey = colorCacheRef.current.keys().next().value;
          if (firstKey) {
            colorCacheRef.current.delete(firstKey);
          }
        }
        changeBackgroundColor(finalColor);
      }, 50);
    },
    [resolveAccentColor, changeBackgroundColor, isMobile],
  );

  const handleSongLeave = useCallback(() => {
    if (isMobile) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    hoverTimeoutRef.current = setTimeout(() => {
      changeBackgroundColor(defaultColorRef.current);
    }, 250);
  }, [changeBackgroundColor, isMobile]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 18) return t("greetings.afternoon");
    return t("greetings.evening");
  };

  const getShowAllHandler = useCallback(
    (section: HomeSection) => {
      switch (section.id) {
        case "recentlyListened": {
          const songs = section.items.flatMap((item) =>
            "songs" in item && item.songs ? item.songs : [],
          );
          return () =>
            navigate("/all-songs/recently-listened", {
              state: {
                songs,
                title: t("homepage.recentlyListened"),
              },
            });
        }
        case "trendingAlbums":
        case "albumsYouMightLike": {
          const albums = section.items.filter(
            (item): item is Album & { itemType: "album" } =>
              item.itemType === "album",
          );
          return () =>
            navigate("/all-albums/trending", {
              state: {
                albums,
                title: t(`homepage.${section.id}`),
              },
            });
        }
        default:
          return undefined;
      }
    },
    [navigate, t],
  );

  const renderSection = (section: HomeSection) => {
    if (section.items.length === 0) {
      return null;
    }

    if (FEATURED_SECTION_IDS.has(section.id)) {
      return (
        <FeaturedSection
          key={section.id}
          featuredSongs={featuredSongs}
          onSongHover={handleSongHover}
          onSongLeave={handleSongLeave}
        />
      );
    }

    return (
      <HorizontalSection
        key={section.id}
        title={t(`homepage.${section.id}`)}
        items={section.items as DisplayItem[]}
        isLoading={false}
        t={t}
        limit={12}
        onShowAll={getShowAllHandler(section)}
      />
    );
  };

  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <>
      <Helmet>
        <meta name="description" content={SITE_SLOGAN} />
      </Helmet>
      <main className="min-h-full bg-[#0f0f0f] pb-30 lg:pb-0">
        <div className="relative min-h-screen">
          <div className="absolute hidden lg:block inset-0 h-[50vh] w-full pointer-events-none z-0">
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                backgroundColor: currentBgColor,
                opacity: 0.35,
                maskImage:
                  "linear-gradient(to bottom, black 0%, transparent 70%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 0%, transparent 70%)",
                transition:
                  "background-color 800ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 800ms cubic-bezier(0.4, 0.0, 0.2, 1)",
                willChange: "background-color, opacity",
              }}
            />
          </div>

          <div className="relative z-10">
            {isHomePageLoading ? (
              <HomePageSkeleton />
            ) : (
              <div className="p-4 sm:p-6">
                <h1 className="hidden md:block text-2xl sm:text-3xl font-bold mb-6 text-white">
                  {getGreeting()}
                </h1>

                <div className="space-y-6">
                  {visibleSections.map(renderSection)}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};
const HomePage = React.memo(HomePageComponent);
export default HomePage;
