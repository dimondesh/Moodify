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
import { usePlaylistStore } from "../../stores/usePlaylistStore";
import { useMixesStore } from "../../stores/useMixesStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useDominantColor } from "@/hooks/useDominantColor";
import { Song } from "@/types";
import { useGeneratedPlaylistStore } from "../../stores/useGeneratedPlaylistStore";
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
    recentlyListenedSongs,
    recentlyListenedEntities,
    madeForYouSongs,
    trendingAlbums,
    featuredSongs,
    favoriteArtists,
    newReleases,
    fetchRecentlyListenedSongs,
    isRecentlyListenedLoading,
  } = useMusicStore();

  const { genreMixes, moodMixes } = useMixesStore();
  const { user } = useAuthStore();
  const { publicPlaylists, recommendedPlaylists } = usePlaylistStore();
  const { allGeneratedPlaylists } = useGeneratedPlaylistStore();

  const { isHomePageLoading, isSecondaryHomePageLoading } = useUIStore();
  const { initializeQueue, currentSong } = usePlayerStore();
  const { extractColor } = useDominantColor();

  const [currentBgColor, setCurrentBgColor] = useState("#18181b");
  const defaultColorRef = useRef("#18181b");

  const changeBackgroundColor = useCallback(
    (color: string) => {
      if (isMobile) return;

      // Проверяем, не тот ли же цвет уже активен
      if (currentBgColor === color) {
        return;
      }

      setCurrentBgColor(color);
    },
    [isMobile, currentBgColor]
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

  // Загружаем историю прослушивания при загрузке страницы
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
  }, [user]); // fetchRecentlyListenedSongs стабильна из store

  useEffect(() => {
    if (
      currentSong === null &&
      !isHomePageLoading &&
      (madeForYouSongs.length > 0 ||
        featuredSongs.length > 0 ||
        trendingAlbums.length > 0)
    ) {
      const allSongs = [...featuredSongs, ...madeForYouSongs];
      // Добавляем песни из трендовых альбомов
      const trendingSongsFromAlbums = trendingAlbums.flatMap(
        (album) => album.songs || []
      );
      allSongs.push(...trendingSongsFromAlbums);

      if (allSongs.length > 0) {
        initializeQueue(allSongs);
      }
    }
  }, [
    initializeQueue,
    madeForYouSongs,
    featuredSongs,
    trendingAlbums,
    currentSong,
    isHomePageLoading,
  ]);

  // Кэш для цветов, чтобы избежать повторных вычислений
  const colorCacheRef = useRef<Map<string, string>>(new Map());
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSongHover = useCallback(
    (song: Song) => {
      if (isMobile) return;

      // Очищаем предыдущий таймаут
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Небольшая задержка для предотвращения лишних запросов
      hoverTimeoutRef.current = setTimeout(() => {
        const imageUrl = song.imageUrl;
        if (!imageUrl) {
          changeBackgroundColor("#18181b");
          return;
        }

        // Проверяем кэш
        const cachedColor = colorCacheRef.current.get(imageUrl);
        if (cachedColor) {
          changeBackgroundColor(cachedColor);
          return;
        }

        // Извлекаем цвет только если его нет в кэше
        extractColor(imageUrl).then((color) => {
          const finalColor = color || "#18181b";
          // Сохраняем в кэш
          colorCacheRef.current.set(imageUrl, finalColor);
          // Ограничиваем размер кэша
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
    [extractColor, changeBackgroundColor, isMobile]
  );

  const handleSongLeave = useCallback(() => {
    if (isMobile) return;
    // Очищаем таймаут при уходе мыши
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Плавный возврат к дефолтному цвету с задержкой
    hoverTimeoutRef.current = setTimeout(() => {
      changeBackgroundColor(defaultColorRef.current);
    }, 250);
  }, [changeBackgroundColor, isMobile]);

  // Очистка таймаута при размонтировании
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

  const recommendedPlaylistsItems = useMemo(
    () =>
      recommendedPlaylists.map((pl) => ({
        ...pl,
        itemType: "playlist" as const,
      })),
    [recommendedPlaylists]
  );
  const newReleasesItems = useMemo(
    () =>
      newReleases.map((album) => ({ ...album, itemType: "album" as const })),
    [newReleases]
  );
  const favoriteArtistsItems = useMemo(
    () =>
      favoriteArtists.map((artist) => ({
        ...artist,
        itemType: "artist" as const,
      })),
    [favoriteArtists]
  );
  const madeForYouSongsItems = useMemo(
    () =>
      madeForYouSongs.map((song) => ({ ...song, itemType: "song" as const })),
    [madeForYouSongs]
  );
  const trendingAlbumsItems = useMemo(
    () =>
      trendingAlbums.map((album) => ({ ...album, itemType: "album" as const })),
    [trendingAlbums]
  );
  const recentlyListenedItems = useMemo(
    () =>
      recentlyListenedEntities.map((entity) => ({
        ...entity,
        itemType: entity.itemType,
      })),
    [recentlyListenedEntities]
  );
  const genreMixesItems = useMemo(
    () => genreMixes.map((mix) => ({ ...mix, itemType: "mix" as const })),
    [genreMixes]
  );
  const moodMixesItems = useMemo(
    () => moodMixes.map((mix) => ({ ...mix, itemType: "mix" as const })),
    [moodMixes]
  );
  const publicPlaylistsItems = useMemo(
    () =>
      publicPlaylists.map((pl) => ({ ...pl, itemType: "playlist" as const })),
    [publicPlaylists]
  );
  const generatedPlaylistsItems = useMemo(
    () =>
      allGeneratedPlaylists.map((pl) => ({
        ...pl,
        itemType: "generated-playlist" as const,
      })),
    [allGeneratedPlaylists]
  );

  const handleShowAllMadeForYou = useCallback(
    () =>
      navigate("/all-songs/made-for-you", {
        state: { songs: madeForYouSongs, title: t("homepage.madeForYou") },
      }),
    [navigate, madeForYouSongs, t]
  );
  const handleShowAllRecentlyListened = useCallback(
    () =>
      navigate("/all-songs/recently-listened", {
        state: {
          songs: recentlyListenedSongs,
          title: t("homepage.recentlyListened"),
        },
      }),
    [navigate, recentlyListenedSongs, t]
  );
  const handleShowAllGenreMixes = useCallback(
    () =>
      navigate(`/all-mixes/genres`, {
        state: { mixes: genreMixes, title: t("homepage.genreMixes") },
      }),
    [navigate, genreMixes, t]
  );
  const handleShowAllMoodMixes = useCallback(
    () =>
      navigate(`/all-mixes/moods`, {
        state: { mixes: moodMixes, title: t("homepage.moodMixes") },
      }),
    [navigate, moodMixes, t]
  );
  const handleShowAllTrending = useCallback(
    () =>
      navigate("/all-albums/trending", {
        state: { albums: trendingAlbums, title: t("homepage.trending") },
      }),
    [navigate, trendingAlbums, t]
  );

  return (
    <>
      <Helmet>
        <title>Home</title>
        <meta
          name="description"
          content="Listen to trending music, discover personal mixes, and explore public playlists. Moodify - your ultimate guide in the world of music."
        />
      </Helmet>
      <main className="overflow-y-auto h-full bg-[#0f0f0f] hide-scrollbar pb-30 lg:pb-0">
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
                  <HorizontalSection
                    title={t("homepage.genreMixes")}
                    items={genreMixesItems}
                    isLoading={isSecondaryHomePageLoading}
                    t={t}
                    limit={12}
                    onShowAll={handleShowAllGenreMixes}
                  />

                  <HorizontalSection
                    title={t("homepage.moodMixes")}
                    items={moodMixesItems}
                    isLoading={isSecondaryHomePageLoading}
                    t={t}
                    limit={12}
                    onShowAll={handleShowAllMoodMixes}
                  />

                  {user && (
                    <HorizontalSection
                      title={t("homepage.madeForYou")}
                      items={madeForYouSongsItems}
                      isLoading={isSecondaryHomePageLoading}
                      limit={12}
                      t={t}
                      onShowAll={handleShowAllMadeForYou}
                    />
                  )}

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

                  {user && (
                    <HorizontalSection
                      title={t("homepage.favoriteArtists")}
                      items={favoriteArtistsItems}
                      t={t}
                      limit={12}
                      isLoading={isSecondaryHomePageLoading}
                    />
                  )}

                  {user && (
                    <HorizontalSection
                      title={t("homepage.newReleases")}
                      t={t}
                      items={newReleasesItems}
                      isLoading={isSecondaryHomePageLoading}
                      limit={12}
                    />
                  )}

                  {user && (
                    <HorizontalSection
                      title={t("homepage.playlistsForYou")}
                      items={recommendedPlaylistsItems}
                      t={t}
                      isLoading={isSecondaryHomePageLoading}
                      limit={12}
                    />
                  )}

                  <HorizontalSection
                    title={t("homepage.generatedForYou")}
                    items={generatedPlaylistsItems}
                    t={t}
                    isLoading={isSecondaryHomePageLoading}
                    limit={12}
                  />

                  <HorizontalSection
                    title={t("homepage.publicPlaylists")}
                    items={publicPlaylistsItems}
                    t={t}
                    isLoading={isSecondaryHomePageLoading}
                    limit={12}
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
