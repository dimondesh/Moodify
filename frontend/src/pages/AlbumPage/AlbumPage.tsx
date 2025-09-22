// frontend/src/pages/AlbumPage/AlbumPage.tsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMusicStore } from "../../stores/useMusicStore";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import {
  CheckCircle2,
  Clock,
  Pause,
  Play,
  PlusCircle,
  Heart,
  MoreHorizontal,
} from "lucide-react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import Equalizer from "../../components/ui/equalizer";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { format } from "date-fns";
import { useDominantColor } from "@/hooks/useDominantColor";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { DownloadButton } from "@/components/ui/DownloadButton";
import PlaylistDetailsSkeleton from "../../components/ui/skeletons/PlaylistDetailsSkeleton";
import { Share } from "lucide-react";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { useUIStore } from "@/stores/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import SongOptionsDrawer from "./SongOptionsDrawer";
import { Song } from "@/types";
import EqualizerTitle from "@/components/ui/equalizer-title";
import { getOptimizedImageUrl } from "@/lib/utils";

const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const AlbumPage = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { t } = useTranslation();
  const { albumId } = useParams();
  const navigate = useNavigate();
  const { openShareDialog, closeAllDialogs, shareEntity } = useUIStore();

  const {
    fetchAlbumbyId,
    currentAlbum,
    isLoading: isAlbumDataLoading,
  } = useMusicStore();
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const { albums, toggleAlbum, likedSongs, toggleSongLike } = useLibraryStore();
  const [inLibrary, setInLibrary] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<Song | null>(
    null
  );

  const { extractColor } = useDominantColor();
  const [isColorLoading, setIsColorLoading] = useState(true);
  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState([
    { key: 0, color: "#18181b" },
  ]);

  useEffect(() => {
    if (albumId) {
      fetchAlbumbyId(albumId);
    }
  }, [albumId, fetchAlbumbyId]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds((prev) => [{ key: newKey, color }, ...prev.slice(0, 1)]);
    };

    if (currentAlbum?.imageUrl) {
      setIsColorLoading(true);
      extractColor(currentAlbum.imageUrl)
        .then((color) => updateBackgroundColor(color || "#18181b"))
        .finally(() => setIsColorLoading(false));
    } else if (currentAlbum) {
      updateBackgroundColor("#18181b");
      setIsColorLoading(false);
    }
  }, [currentAlbum, extractColor]);

  useEffect(() => {
    if (!currentAlbum) return;
    const exists = albums.some(
      (a) => a._id.toString() === currentAlbum._id.toString()
    );
    setInLibrary(exists);
  }, [albums, currentAlbum]);

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
      (song) => song._id === currentSong?._id
    );
    if (isCurrentAlbumPlaying) togglePlay();
    else playAlbum(currentAlbum.songs, 0);
  };

  const handlePlaySong = (index: number) => {
    playAlbum(currentAlbum.songs, index);
  };

  const handleArtistClick = (artistId: string) => {
    navigate(`/artists/${artistId}`);
  };

  const handleAlbumTitleClick = (albumId: string | null | undefined) => {
    if (albumId) {
      navigate(`/albums/${albumId}`);
    }
  };

  const renderDesktopSongList = () =>
    currentAlbum.songs.map((song, index) => {
      const isCurrentSong = currentSong?._id === song._id;
      const songIsLiked = likedSongs.some(
        (likedSong) => likedSong._id === song._id
      );

      return (
        <div
          key={song._id}
          onClick={() => handlePlaySong(index)}
          className={`grid grid-cols-[16px_4fr_2fr_auto] items-center gap-4 px-4 py-2 text-sm text-gray-400 hover:bg-[#2a2a2a] rounded-md group cursor-pointer ${
            isCurrentSong ? "bg-[#2a2a2a]" : ""
          }`}
        >
          <div className="flex items-center justify-center">
            {isCurrentSong && isPlaying ? (
              <div className="z-10">
                <Equalizer />
              </div>
            ) : (
              <span className="group-hover:hidden">{index + 1}</span>
            )}
            {!isCurrentSong && (
              <Play className="h-4 w-4 hidden group-hover:block" />
            )}
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={getOptimizedImageUrl(
                song.imageUrl || "/default-song-cover.png",
                80
              )}
              alt={song.title}
              className="size-10 object-cover rounded-md flex-shrink-0"
            />
            <div className="min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAlbumTitleClick(song.albumId);
                }}
                className={`font-medium text-left hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6] truncate w-70 lg:w-60 xl:w-80 2xl:w-100 ${
                  isCurrentSong ? "text-[#8b5cf6]" : "text-white"
                }`}
              >
                {song.title}
              </button>
              <div className="text-gray-400 truncate">
                {song.artist.map((artist, artistIndex) => (
                  <span key={artist._id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArtistClick(artist._id);
                      }}
                      className="hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6]"
                    >
                      {artist.name}
                    </button>
                    {artistIndex < song.artist.length - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="items-center hidden md:flex justify-baseline text-xs">
            {song.createdAt
              ? format(new Date(song.createdAt), "MMM dd, yyyy")
              : "N/A"}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-full ${
                songIsLiked
                  ? "text-[#8b5cf6] hover:text-[#7c3aed]"
                  : "text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSongLike(song._id);
              }}
              title={songIsLiked ? t("player.unlike") : t("player.like")}
            >
              <Heart
                className={`h-5 w-5 ${songIsLiked ? "fill-[#8b5cf6]" : ""}`}
              />
            </Button>
            <span className="w-10 text-right">
              {formatDuration(song.duration)}
            </span>
          </div>
        </div>
      );
    });

  const renderMobileSongList = () =>
    currentAlbum.songs.map((song) => {
      const isCurrentSong = currentSong?._id === song._id;
      return (
        <div
          key={song._id}
          onClick={() =>
            handlePlaySong(
              currentAlbum.songs.findIndex((s) => s._id === song._id)
            )
          }
          className={`flex items-center justify-between gap-4 p-2 rounded-md group cursor-pointer ${
            isCurrentSong ? "bg-white/10" : "hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isCurrentSong && isPlaying && (
                  <div className="block sm:hidden flex-shrink-0">
                    <EqualizerTitle />
                  </div>
                )}
                <p
                  className={`font-medium truncate w-50 sm:w-120 ${
                    isCurrentSong ? "text-violet-400" : "text-white"
                  }`}
                >
                  {song.title}
                </p>
              </div>
              <p className="text-sm text-zinc-400 truncate">{artistNames}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSongForMenu(song);
            }}
          >
            <MoreHorizontal className="h-5 w-5 text-zinc-400 group-hover:text-white" />
          </Button>
        </div>
      );
    });
  const type = currentAlbum.type;
  return (
    <>
      <Helmet>
        <title>{`${currentAlbum.title} - ${artistNames}`}</title>
      </Helmet>
      <div className="h-full">
        <ScrollArea className="h-full pb-30 rounded-md lg:pb-0">
          <div className="relative min-h-screen">
            {backgrounds
              .slice(0, 2)
              .reverse()
              .map((bg, index) => (
                <div
                  key={bg.key}
                  className={`absolute inset-0 pointer-events-none ${
                    index === 1 ? "animate-fade-in" : ""
                  }`}
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(to bottom, ${bg.color} 0%, rgba(20, 20, 20, 0.8) 50%, #18181b 100%)`,
                  }}
                />
              ))}
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 sm:pb-8 items-center sm:items-end">
                <img
                  src={getOptimizedImageUrl(currentAlbum.imageUrl, 500)}
                  alt={currentAlbum.title}
                  className="w-48 h-48 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded object-cover"
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

              <div className="px-4 sm:px-6 pb-4 flex items-center gap-2 ">
                <Button
                  onClick={handlePlayAlbum}
                  size="icon"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-white/90 hover:scale-105 transition-all"
                >
                  {isPlaying &&
                  currentAlbum.songs.some(
                    (song) => song._id === currentSong?._id
                  ) ? (
                    <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  )}
                </Button>
                {currentAlbum && (
                  <Button
                    onClick={handleToggleAlbum}
                    disabled={isToggling}
                    variant="ghost"
                    size="icon"
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full p-2 transition-colors ${
                      inLibrary ? "hover:bg-white/20" : "hover:bg-white/10"
                    }`}
                    title={
                      inLibrary
                        ? t("pages.album.actions.removeFromLibrary")
                        : t("pages.album.actions.addToLibrary")
                    }
                  >
                    {inLibrary ? (
                      <CheckCircle2 className="size-6  text-[#8b5cf6]" />
                    ) : (
                      <PlusCircle className="size-6   text-white" />
                    )}
                  </Button>
                )}
                <DownloadButton
                  itemId={currentAlbum._id}
                  itemType="albums"
                  itemTitle={currentAlbum.title}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-md p-2 transition-colors"
                  title="Share"
                  onClick={() =>
                    openShareDialog({ type: "album", id: currentAlbum._id })
                  }
                >
                  <Share className="size-6 text-white" />
                </Button>
              </div>

              <div className="bg-black/20 backdrop-blur-sm">
                {!isMobile && (
                  <div className="grid grid-cols-[16px_4fr_2.5fr_auto] gap-4 px-4 sm:px-6 md:px-10 py-2 text-sm text-gray-400 border-b border-[#2a2a2a]">
                    <div>#</div>
                    <div>{t("pages.album.headers.title")}</div>
                    <div className="hidden md:block">
                      {t("pages.album.headers.releaseDate")}
                    </div>
                    <div className="text-right">
                      <Clock className="h-4 w-4 inline-block" />
                    </div>
                  </div>
                )}
                <div className="px-2 sm:px-6">
                  <div className="space-y-1 sm:space-y-2 py-4">
                    {isMobile
                      ? renderMobileSongList()
                      : renderDesktopSongList()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {currentAlbum && (
            <ShareDialog
              isOpen={
                shareEntity?.type === "album" &&
                shareEntity?.id === currentAlbum._id
              }
              onClose={closeAllDialogs}
              entityType="album"
              entityId={currentAlbum._id}
            />
          )}
          {shareEntity?.type === "song" && (
            <ShareDialog
              isOpen={true}
              onClose={closeAllDialogs}
              entityType="song"
              entityId={shareEntity.id}
            />
          )}
        </ScrollArea>
      </div>
      <SongOptionsDrawer
        song={selectedSongForMenu}
        isOpen={!!selectedSongForMenu}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSongForMenu(null);
          }
        }}
      />
    </>
  );
};

export default AlbumPage;
