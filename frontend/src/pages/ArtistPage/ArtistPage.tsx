// frontend/src/pages/ArtistPage/ArtistPage.tsx

import { useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Play, UserPlus, UserCheck, Pause } from "lucide-react";
import StandardLoader from "../../components/ui/StandardLoader";
import { usePlayerStore } from "../../stores/usePlayerStore";
import toast from "react-hot-toast";
import { useLibraryStore } from "../../stores/useLibraryStore";
import type { Song, Album } from "../../types";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useArtist } from "@/hooks/queries";
import { getImageUrlByKey } from "@/lib/imageUrl";
import { CDN_DEFAULT_ARTIST_IMAGE } from "@/lib/cdn";
import HorizontalSection from "../HomePage/HorizontalSection";
import { useAuthStore } from "@/stores/useAuthStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CollectionSongList } from "@/components/CollectionSongList/CollectionSongList";

const ArtistPage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentSong, isPlaying, playAlbum, setCurrentSong, togglePlay } =
    usePlayerStore();
  const { isArtistFollowed, toggleArtistFollow } =
    useLibraryStore();

  const {
    data: artistData,
    isPending: loading,
    error,
    refetch,
  } = useArtist(id);
  const artist = artistData?.artist;
  const artistAppearsOn = artistData?.appearsOn ?? [];
  const isAppearsOnLoading = loading;

  const { popularSongs, albums, singlesAndEps } = useMemo(() => {
    const allArtistSongs: Song[] = artist?.songs || [];
    const allArtistAlbums: Album[] = artist?.albums || [];
    return {
      popularSongs: allArtistSongs.slice(0, 5),
      albums: allArtistAlbums.filter((album) => album.type === "Album"),
      singlesAndEps: allArtistAlbums.filter(
        (album) => album.type === "Single" || album.type === "EP",
      ),
    };
  }, [artist]);

  const albumsItems = useMemo(
    () =>
      albums.map((album) => ({
        ...album,
        songs: [],
        itemType: "album" as const,
      })),
    [albums],
  );

  const singlesAndEpsItems = useMemo(
    () =>
      singlesAndEps.map((album) => ({
        ...album,
        songs: [],
        itemType: "album" as const,
      })),
    [singlesAndEps],
  );

  const appearsOnItems = useMemo(
    () =>
      artistAppearsOn.map((album) => ({
        ...album,
        songs: [],
        itemType: "album" as const,
      })),
    [artistAppearsOn],
  );

  const handleShowAllAlbums = useCallback(() => {
    navigate("/list", {
      state: {
        title: t("pages.artist.albums"),
        items: albumsItems,
      },
    });
  }, [navigate, t, albumsItems]);

  const handleShowAllSinglesAndEps = useCallback(() => {
    navigate("/list", {
      state: {
        title: t("pages.artist.singlesAndEps"),
        items: singlesAndEpsItems,
      },
    });
  }, [navigate, t, singlesAndEpsItems]);

  const handleShowAllAppearsOn = useCallback(() => {
    navigate("/list", {
      state: {
        title: t("pages.artist.appearsOn"),
        items: appearsOnItems,
      },
    });
  }, [navigate, t, appearsOnItems]);

  const isAnyPopularSongPlaying = useMemo(
    () =>
      isPlaying && popularSongs.some((song) => song._id === currentSong?._id),
    [isPlaying, popularSongs, currentSong],
  );

  const handlePlayArtistSongs = useCallback(() => {
    if (popularSongs.length === 0) {
      toast.error("No popular songs available to play.");
      return;
    }
    if (isAnyPopularSongPlaying) togglePlay();
    else
      playAlbum(popularSongs, 0, {
        type: "artist",
        entityId: artist?._id,
        entityTitle: artist?.name,
      });
  }, [popularSongs, isAnyPopularSongPlaying, togglePlay, playAlbum, artist]);

  const handlePlaySong = useCallback(
    (index: number) => {
      const song = popularSongs[index];
      if (!song) return;
      if (currentSong?._id === song._id) togglePlay();
      else {
        setCurrentSong(song);
        playAlbum(popularSongs, index, {
          type: "artist",
          entityId: artist?._id,
          entityTitle: artist?.name,
        });
      }
    },
    [currentSong, togglePlay, setCurrentSong, playAlbum, popularSongs, artist],
  );

  const handleArtistClick = useCallback(
    (artistId: string) => navigate(`/artists/${artistId}`),
    [navigate],
  );

  const handleAlbumClick = useCallback(
    (albumId: string | null | undefined) => {
      if (albumId) navigate(`/albums/${albumId}`);
    },
    [navigate],
  );

  const getPopularSongPlaysLabel = useCallback(
    (song: Song) =>
      `${song.playCount?.toLocaleString() ?? 0} ${t("pages.artist.plays")}`,
    [t],
  );

  const getPopularSongMobileSubtitle = useCallback(
    (song: Song) => song.albumTitle ?? "",
    [],
  );

  const handleToggleFollow = useCallback(async () => {
    if (!artist || !id) return;
    try {
      await toggleArtistFollow(artist._id);
      void refetch();
    } catch (e) {
      toast.error(t("common.failedToChangeFollowStatus"));
      console.error("Error toggling artist follow:", e);
    }
  }, [artist, id, toggleArtistFollow, refetch, t]);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-full">
        <StandardLoader size="lg" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex items-center justify-center h-full text-red-500">
        <p>{error.message}</p>
      </main>
    );
  }

  if (!artist) {
    return (
      <main className="flex items-center justify-center h-full text-gray-400">
        <p>{t("pages.artist.notFound")}</p>
      </main>
    );
  }
  const metaDescription = `Listen to ${
    artist.name
  } on Moodify Music. Discover popular tracks, albums, and the full discography. ${
    artist.bio ? artist.bio.substring(0, 120) + "..." : ""
  }`;

  return (
    <>
      <Helmet>
        <title>{`${artist.name} | Слушать на Moodify Music`}</title>
        <meta name="description" content={metaDescription} />

        {/* Open Graph / Facebook / Telegram - чтобы ссылка была красивой */}
        <meta property="og:type" content="music.musician" />
        <meta property="og:title" content={artist.name} />
        <meta
          property="og:description"
          content={`Слушай треки ${artist.name} бесплатно на Moodify Music.`}
        />
        <meta
          property="og:image"
          content={getImageUrlByKey(artist, "large", CDN_DEFAULT_ARTIST_IMAGE)}
        />
        <meta property="og:url" content={window.location.href} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={artist.name} />
        <meta
          name="twitter:image"
          content={getImageUrlByKey(artist, "large", CDN_DEFAULT_ARTIST_IMAGE)}
        />
      </Helmet>
      <div className="bg-[#0f0f0f] overflow-y-auto h-full hide-scrollbar pb-30 lg:pb-0">
        <div className="relative w-full h-[340px] sm:h-[300px] md:h-[300px] lg:h-[450px]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${getImageUrlByKey(artist, "large", CDN_DEFAULT_ARTIST_IMAGE)})`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-[#0f0f0f] z-0" />
          <div className="relative z-10 h-full flex flex-col justify-end px-6 sm:px-10 pb-6 sm:pb-10">
            <p className="text-white text-sm font-semibold uppercase mb-2">
              {t("pages.artist.type")}
            </p>
            <h1 className="text-white text-4xl sm:text-6xl md:text-7xl font-bold leading-tight">
              {artist.name}
            </h1>
            <div className="mt-4 flex items-center gap-4">
              <Button
                className="bg-white hover:bg-white/90 text-black rounded-full h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center transition-transform hover:scale-105"
                onClick={handlePlayArtistSongs}
                title={
                  isAnyPopularSongPlaying
                    ? t("pages.artist.actions.pause")
                    : `${t("pages.artist.actions.play")} ${artist.name}`
                }
              >
                {isAnyPopularSongPlaying ? (
                  <Pause className="h-7 w-7 fill-current" />
                ) : (
                  <Play className="h-7 w-7 fill-current!" />
                )}
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-4 py-2 text-white border-[#2a2a2a] hover:border-[#8b5cf6] hover:text-[#8b5cf6] flex items-center gap-2"
                onClick={handleToggleFollow}
              >
                {isArtistFollowed(artist._id) ? (
                  <>
                    <UserCheck className="h-5 w-5" />
                    {t("pages.artist.actions.following")}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    {t("pages.artist.actions.follow")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          {popularSongs.length > 0 && (
            <div>
              <h2 className="mb-4 px-4 text-2xl font-bold text-white sm:px-6">
                {t("pages.artist.popular")}
              </h2>
              <CollectionSongList
                songs={popularSongs}
                context="album"
                isMobile={isMobile}
                currentSongId={currentSong?._id}
                isPlaying={isPlaying}
                onPlay={handlePlaySong}
                onArtistClick={handleArtistClick}
                onAlbumClick={handleAlbumClick}
                dateHeaderKey="pages.artist.headers.plays"
                getDateLabel={getPopularSongPlaysLabel}
                getMobileSubtitle={getPopularSongMobileSubtitle}
                mobileVariant="artist"
                isLoggedIn={Boolean(user)}
                showDesktopHeader={false}
                dimBackground={false}
              />
            </div>
          )}
          <HorizontalSection
            title={t("pages.artist.albums")}
            items={albumsItems}
            isLoading={loading}
            t={t}
            limit={6}
            onShowAll={handleShowAllAlbums}
          />
          <HorizontalSection
            title={t("pages.artist.singlesAndEps")}
            items={singlesAndEpsItems}
            isLoading={loading}
            t={t}
            limit={6}
            onShowAll={handleShowAllSinglesAndEps}
          />
          <HorizontalSection
            title={t("pages.artist.appearsOn")}
            items={appearsOnItems}
            isLoading={isAppearsOnLoading}
            t={t}
            limit={6}
            onShowAll={handleShowAllAppearsOn}
          />
          {artist.bio && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">
                {t("pages.artist.about")} {artist.name}
              </h2>
              <p className="text-zinc-300 whitespace-pre-wrap">{artist.bio}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ArtistPage;
