import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAlbum } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Pause, Play, PlusCircle } from "lucide-react";
import CheckedIcon from "@/components/ui/checkedIcon";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useAuthStore } from "@/stores/useAuthStore";
import { DownloadButton } from "@/components/ui/DownloadButton";
import PlaylistDetailsSkeleton from "@/components/ui/skeletons/PlaylistDetailsSkeleton";
import { Share } from "lucide-react";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { useUIStore } from "@/stores/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CollectionGradientLayout } from "@/components/CollectionGradientLayout";
import { CollectionSongList } from "@/components/CollectionSongList/CollectionSongList";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import { getLargeCoverUrl } from "@/lib/imageUrl";
import { useDominantCoverGradient } from "@/hooks/useDominantCoverGradient";
import { AlbumCoverDialog } from "./AlbumCoverDialog";
const AlbumPage = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { albumId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const playSongId = searchParams.get("play");
  const navigate = useNavigate();
  const { closeAllDialogs, shareEntity } = useUIStore();

  const {
    data: currentAlbum,
    isPending: isAlbumDataLoading,
  } = useAlbum(albumId);
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const { albums, toggleAlbum } = useLibraryStore();
  const [inLibrary, setInLibrary] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);

  const { backgrounds, isColorLoading } = useDominantCoverGradient(
    albumId,
    currentAlbum?.coverAccentHex,
  );

  useEffect(() => {
    if (!currentAlbum) return;
    const exists = albums.some(
      (a) => a._id.toString() === currentAlbum._id.toString(),
    );
    setInLibrary(exists);
  }, [albums, currentAlbum]);

  useEffect(() => {
    if (
      currentAlbum &&
      playSongId &&
      !isAlbumDataLoading &&
      currentAlbum.songs.length > 0
    ) {
      const songIndex = currentAlbum.songs.findIndex(
        (s) => s._id === playSongId,
      );

      // Если трек найден и он сейчас не играет
      if (songIndex !== -1 && currentSong?._id !== playSongId) {
        playAlbum(currentAlbum.songs, songIndex, {
          type: "album",
          entityId: currentAlbum._id,
          entityTitle: currentAlbum.title,
        });

        // Очищаем URL, чтобы трек не запускался заново при ререндерах
        searchParams.delete("play");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [
    currentAlbum,
    playSongId,
    isAlbumDataLoading,
    playAlbum,
    currentSong,
    searchParams,
    setSearchParams,
  ]);

  const handleToggleAlbum = async () => {
    if (!currentAlbum || isToggling) return;
    setIsToggling(true);
    await toggleAlbum(currentAlbum._id);
    setIsToggling(false);
  };

  if (isAlbumDataLoading || isColorLoading) {
    return (
      <>
        <Helmet>
          <title>Loading Album...</title>
        </Helmet>
        <PlaylistDetailsSkeleton />
      </>
    );
  }

  if (!currentAlbum) {
    return (
      <>
        <Helmet>
          <title>Album Not Found</title>
        </Helmet>
        <div className="p-4 sm:p-6 bg-[#0f0f0f] min-h-screen text-white">
          <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
            {t("pages.album.notFoundTitle")}
          </h1>
          <p className="text-gray-400">{t("pages.album.notFoundDesc")}</p>
        </div>
      </>
    );
  }

  const artistNames = currentAlbum.artist.map((a) => a.name).join(", ");

  const handlePlayAlbum = () => {
    const isCurrentAlbumPlaying = currentAlbum.songs.some(
      (song) => song._id === currentSong?._id,
    );
    if (isCurrentAlbumPlaying) togglePlay();
    else
      playAlbum(currentAlbum.songs, 0, {
        type: "album",
        entityId: currentAlbum._id,
        entityTitle: currentAlbum.title,
      });
  };

  const handlePlaySong = (index: number) => {
    playAlbum(currentAlbum.songs, index, {
      type: "album",
      entityId: currentAlbum._id,
      entityTitle: currentAlbum.title,
    });
  };

  const handleArtistClick = (artistId: string) => {
    navigate(`/artists/${artistId}`);
  };

  const handleAlbumTitleClick = (albumId: string | null | undefined) => {
    if (albumId) {
      navigate(`/albums/${albumId}`);
    }
  };

  const type = currentAlbum.type;
  const getAlbumSongDateLabel = (song: (typeof currentAlbum.songs)[number]) =>
    song.createdAt ? format(new Date(song.createdAt), "MMM dd, yyyy") : "N/A";
  return (
    <>
      <Helmet>
        <title>{`${currentAlbum.title} - ${artistNames}`}</title>
        <meta
          property="og:title"
          content={`${currentAlbum.title} - ${artistNames} | Moodify Music`}
        />
        <meta
          property="og:description"
          content={`Listen to ${currentAlbum.title} by ${artistNames} on Moodify Music.`}
        />
        <meta property="og:image" content={getLargeCoverUrl(currentAlbum)} />
        <meta property="og:site_name" content="Moodify Music" />
        <meta property="og:type" content="music.album" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <CollectionGradientLayout
        backgrounds={backgrounds}
        footerTint="#18181b"
        midTint="rgba(20, 20, 20, 0.8)"
        innerClassName="relative min-h-screen pb-36 lg:pb-0"
      >
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 sm:pb-8 items-center sm:items-end">
            <CoverImage
              entity={currentAlbum}
              size="large"
              defaultUrl={CDN_DEFAULT_ALBUM_COVER}
              alt={currentAlbum.title}
              loading="eager"
              onClick={() => {
                if (!isMobile) setIsCoverModalOpen(true);
              }}
              className={`w-64 h-64 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded object-cover ${
                !isMobile
                  ? "cursor-pointer hover:opacity-80 transition-opacity"
                  : ""
              }`}
            />
            <div className="flex flex-col justify-end text-center sm:text-left min-w-0">
              <p className="text-xs sm:text-sm font-medium ">
                {t(`pages.album.${type}`) || currentAlbum.type}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-2 sm:my-4 break-words">
                {currentAlbum.title}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 text-xs sm:text-sm text-gray-100">
                <span className="font-medium text-white">
                  {currentAlbum.artist.map((artist, index) => (
                    <span key={artist._id}>
                      <button
                        onClick={() => handleArtistClick(artist._id)}
                        className="hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6] cursor-pointer"
                      >
                        {artist.name}
                      </button>
                      {index < currentAlbum.artist.length - 1 && ", "}
                    </span>
                  ))}
                </span>
                <span>
                  • {currentAlbum.songs.length}{" "}
                  {currentAlbum.songs.length !== 1
                    ? t("pages.album.songs")
                    : t("pages.album.song")}
                </span>
                <span>• {currentAlbum.releaseYear}</span>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-4 flex items-center gap-1">
            <Button
              onClick={handlePlayAlbum}
              size="icon"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-white/90 hover:scale-105 transition-all duration-100"
            >
              {isPlaying &&
              currentAlbum.songs.some(
                (song) => song._id === currentSong?._id,
              ) ? (
                <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
              )}
            </Button>
            {currentAlbum && (
              <Button
                onClick={handleToggleAlbum}
                disabled={isToggling || !user}
                variant="ghost2"
                size="icon"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-2 transition-colors group ${
                  !user ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={
                  !user
                    ? t("auth.loginRequired")
                    : inLibrary
                      ? t("pages.album.actions.removeFromLibrary")
                      : t("pages.album.actions.addToLibrary")
                }
              >
                {inLibrary ? (
                  <CheckedIcon className="size-8 text-[#8b5cf6]" />
                ) : (
                  <PlusCircle className="size-8 text-white/80 group-hover:text-white transition-colors" />
                )}
              </Button>
            )}
            <DownloadButton
              itemId={currentAlbum._id}
              itemType="albums"
              itemTitle={currentAlbum.title}
              disabled={!user}
            />
            <ShareDialog
              entityType="album"
              entityId={currentAlbum._id}
            >
              <Button
                variant="ghost2"
                size="icon"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-md p-2 transition-colors group ${
                  !user ? "opacity-50 cursor-not-allowed" : ""
                }`}
                title={!user ? t("auth.loginRequired") : t("common.share")}
                disabled={!user}
              >
                <Share className="size-8 text-white/80 group-hover:text-white transition-colors" />
              </Button>
            </ShareDialog>
          </div>

          <CollectionSongList
            songs={currentAlbum.songs}
            context="album"
            isMobile={isMobile}
            currentSongId={currentSong?._id}
            isPlaying={isPlaying}
            onPlay={handlePlaySong}
            onArtistClick={handleArtistClick}
            onAlbumClick={handleAlbumTitleClick}
            dateHeaderKey="pages.album.headers.releaseDate"
            getDateLabel={getAlbumSongDateLabel}
            mobileVariant="album"
            mobileArtistNames={artistNames}
            isLoggedIn={Boolean(user)}
          />
        </div>
      </CollectionGradientLayout>
      {shareEntity?.type === "song" && (
        <ShareDialog
          isOpen={true}
          onClose={closeAllDialogs}
          entityType="song"
          entityId={shareEntity.id}
        />
      )}
      {!isMobile && currentAlbum && (
        <AlbumCoverDialog
          open={isCoverModalOpen}
          onOpenChange={setIsCoverModalOpen}
          coverUrl={getLargeCoverUrl(currentAlbum)}
          albumTitle={currentAlbum.title}
        />
      )}
    </>
  );
};

export default AlbumPage;
