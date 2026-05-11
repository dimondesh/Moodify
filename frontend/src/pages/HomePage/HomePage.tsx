// src/pages/HomePage/HomePage.tsx

import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import { useMusicStore } from "../../stores/useMusicStore";
import FeaturedSection from "./FeaturedSection";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useDominantColor } from "@/hooks/useDominantColor";
import { Song } from "@/types";
import HorizontalSection from "./HorizontalSection";
import { useNavigate } from "react-router-dom";
import { useUIStore } from "../../stores/useUIStore";
import HomePageSkeleton from "./HomePageSkeleton";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const HomePageComponent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    trendingAlbums,
    featuredSongs,
    recentlyListenedSongs,
    recentlyListenedEntities,
    fetchRecentlyListenedSongs,
    isRecentlyListenedLoading,
  } = useMusicStore();
  const { user } = useAuthStore();

  const { isHomePageLoading, isSecondaryHomePageLoading } = useUIStore();
  const { initializeQueue, currentSong } = usePlayerStore();
  const { extractColor } = useDominantColor();

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
      extractColor(featuredSongs[0].imageUrl).then((color) => {
        const newDefaultColor = color || "#18181b";
        defaultColorRef.current = newDefaultColor;
        if (currentBgColor === "#18181b") {
          changeBackgroundColor(newDefaultColor);
        }
      });
    }
  }, [
    featuredSongs,
    extractColor,
    currentBgColor,
    isHomePageLoading,
    changeBackgroundColor,
    isMobile,
  ]);

  useEffect(() => {
    if (
      user &&
      !user.isAnonymous &&
      recentlyListenedEntities.length === 0 &&
      !isRecentlyListenedLoading
    ) {
      fetchRecentlyListenedSongs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (
      currentSong === null &&
      !isHomePageLoading &&
      (featuredSongs.length > 0 || trendingAlbums.length > 0)
    ) {
      const allSongs = [...featuredSongs];
      const trendingSongsFromAlbums = trendingAlbums.flatMap(
        (album) => album.songs || [],
      );
      allSongs.push(...trendingSongsFromAlbums);

      if (allSongs.length > 0) {
        initializeQueue(allSongs);
      }
    }
  }, [
    initializeQueue,
    featuredSongs,
    trendingAlbums,
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
        const imageUrl = song.imageUrl;
        if (!imageUrl) {
          changeBackgroundColor("#18181b");
          return;
        }

        const cachedColor = colorCacheRef.current.get(imageUrl);
        if (cachedColor) {
          changeBackgroundColor(cachedColor);
          return;
        }

        extractColor(imageUrl).then((color) => {
          const finalColor = color || "#18181b";
          colorCacheRef.current.set(imageUrl, finalColor);
          if (colorCacheRef.current.size > 50) {
            const firstKey = colorCacheRef.current.keys().next().value;
            if (firstKey) {
              colorCacheRef.current.delete(firstKey);
            }
          }
          changeBackgroundColor(finalColor);
        });
      }, 50);
    },
    [extractColor, changeBackgroundColor, isMobile],
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

  const trendingAlbumsItems = useMemo(
    () =>
      trendingAlbums.map((album) => ({ ...album, itemType: "album" as const })),
    [trendingAlbums],
  );

  const recentlyListenedItems = useMemo(
    () =>
      recentlyListenedEntities.map((entity) => ({
        ...entity,
        itemType: entity.itemType,
      })),
    [recentlyListenedEntities],
  );

  const handleShowAllRecentlyListened = useCallback(
    () =>
      navigate("/all-songs/recently-listened", {
        state: {
          songs: recentlyListenedSongs,
          title: t("homepage.recentlyListened"),
        },
      }),
    [navigate, recentlyListenedSongs, t],
  );

  const handleShowAllTrending = useCallback(
    () =>
      navigate("/all-albums/trending", {
        state: { albums: trendingAlbums, title: t("homepage.trending") },
      }),
    [navigate, trendingAlbums, t],
  );

  return (
    <>
      <Helmet>
        <title>Home</title>
        <meta
          name="description"
          content="Listen to trending music and quick picks on Moodify."
        />
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

                <FeaturedSection
                  onSongHover={handleSongHover}
                  onSongLeave={handleSongLeave}
                />

                <div className="space-y-6">
                  {user && recentlyListenedItems.length > 0 && (
                    <HorizontalSection
                      title={t("homepage.recentlyListened")}
                      items={recentlyListenedItems}
                      isLoading={isRecentlyListenedLoading}
                      t={t}
                      limit={12}
                      onShowAll={handleShowAllRecentlyListened}
                    />
                  )}

                  <HorizontalSection
                    title={t("homepage.trending")}
                    items={trendingAlbumsItems}
                    isLoading={isSecondaryHomePageLoading}
                    t={t}
                    limit={12}
                    onShowAll={handleShowAllTrending}
                  />
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
