// frontend/src/pages/LikedSongs/LikedSongs.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { Heart, Pause, Play, MoreHorizontal } from "lucide-react";
import Equalizer from "../../components/ui/equalizer";
import LikedSongsSkeleton from "../../components/ui/skeletons/LikedSongsSkeleton";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { format } from "date-fns";
import EqualizerTitle from "@/components/ui/equalizer-title";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Song } from "@/types";
import { getArtistNames, getOptimizedImageUrl } from "@/lib/utils";
import SongOptionsDrawer from "../PlaylistPage/SongOptionsDrawer";

const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const LikedSongsPage = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { likedSongs, isLoading, error, fetchLikedSongs, toggleSongLike } =
    useLibraryStore();
  const { currentSong, isPlaying, playAlbum, togglePlay } = usePlayerStore();
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<Song | null>(
    null
  );

  useEffect(() => {
    fetchLikedSongs();
  }, [fetchLikedSongs]);

  const handlePlayLikedSongs = () => {
    if (likedSongs.length === 0) return;
    const isAnyLikedSongPlaying = likedSongs.some(
      (song) => song._id === currentSong?._id
    );
    if (isAnyLikedSongPlaying) {
      togglePlay();
    } else {
      playAlbum(likedSongs, 0);
    }
  };

  const handlePlaySpecificSong = (song: Song, index: number) => {
    if (currentSong?._id === song._id) {
      togglePlay();
    } else {
      playAlbum(likedSongs, index);
    }
  };

  const handleNavigateToAlbum = (albumId: string | null | undefined) => {
    if (albumId) navigate(`/albums/${albumId}`);
  };

  const handleNavigateToArtist = (artistId: string) => {
    navigate(`/artists/${artistId}`);
  };

  const renderDesktopSongList = () => {
    return likedSongs.map((song, index) => {
      const isCurrentlyPlaying = currentSong?._id === song._id;
      return (
        <div
          key={song._id}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            handlePlaySpecificSong(song, index);
          }}
          className={`grid grid-cols-[16px_4fr_2fr_1fr_min-content] md:grid-cols-[16px_4fr_2fr_1fr_min-content] gap-4 px-4 py-2 text-sm text-gray-400 hover:bg-[#2a2a2a] rounded-md group cursor-pointer ${
            isCurrentlyPlaying ? "bg-[#2a2a2a]" : ""
          }`}
        >
          <div className="flex items-center justify-center">
            {isCurrentlyPlaying && isPlaying ? (
              <div className="z-10">
                <Equalizer />
              </div>
            ) : (
              <span className="group-hover:hidden text-xs sm:text-sm">
                {index + 1}
              </span>
            )}
            {!isCurrentlyPlaying && (
              <Play className="h-3 w-3 sm:h-4 sm:w-4 hidden group-hover:block" />
            )}
          </div>
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigateToAlbum(song.albumId);
              }}
              className="flex-shrink-0"
            >
              <img
                src={getOptimizedImageUrl(
                  song.imageUrl || "/default-song-cover.png",
                  80
                )}
                alt={song.title}
                className="size-10 object-cover rounded-md"
              />
            </button>
            <div className="flex flex-col min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateToAlbum(song.albumId);
                }}
                className={`font-medium w-full text-left hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6] truncate ${
                  isCurrentlyPlaying ? "text-[#8b5cf6]" : "text-white"
                }`}
              >
                {song.title}
              </button>
              <div className="text-gray-400 text-xs sm:text-sm truncate">
                {song.artist.map((artist, artistIndex) => (
                  <span key={artist._id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToArtist(artist._id);
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
          <div className="items-center hidden md:flex text-xs">
            {song.likedAt
              ? format(new Date(song.likedAt), "MMM dd, yyyy")
              : "N/A"}
          </div>
          <div className="flex items-center text-xs sm:text-sm flex-shrink-0 justify-end md:mr-10">
            {formatDuration(song.duration)}
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full size-6 sm:size-7 text-[#8b5cf6] hover:text-[#7c3aed]"
              onClick={(e) => {
                e.stopPropagation();
                toggleSongLike(song._id);
              }}
              title={t("player.unlike")}
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            </Button>
          </div>
        </div>
      );
    });
  };

  const renderMobileSongList = () => {
    return likedSongs.map((song, index) => {
      const isCurrentSong = currentSong?._id === song._id;
      return (
        <div
          key={song._id}
          onClick={() => handlePlaySpecificSong(song, index)}
          className={`flex items-center justify-between gap-4 p-2 rounded-md group cursor-pointer ${
            isCurrentSong ? "bg-[#2a2a2a]" : "hover:bg-[#2a2a2a]"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={getOptimizedImageUrl(
                song.imageUrl || "/default-song-cover.png",
                100
              )}
              alt={song.title}
              className="size-12 object-cover rounded-md flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isCurrentSong && isPlaying && (
                  <div className="block sm:hidden flex-shrink-0">
                    <EqualizerTitle />
                  </div>
                )}
                <p
                  className={`font-medium truncate w-45 sm:w-120 ${
                    isCurrentSong ? "text-[#8b5cf6]" : "text-white"
                  }`}
                >
                  {song.title}
                </p>
              </div>
              <p className="text-sm text-gray-400 truncate w-45 sm:w-120">
                {getArtistNames(song.artist)}
              </p>
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
            <MoreHorizontal className="h-5 w-5 text-gray-400 group-hover:text-white" />
          </Button>
        </div>
      );
    });
  };

  if (isLoading) return <LikedSongsSkeleton />;

  if (!isLoading && !error && likedSongs.length === 0) {
    return (
      <div className="p-4 sm:p-6 bg-[#0f0f0f] min-h-screen text-white text-center">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
          {t("pages.likedSongs.title")}
        </h1>
        <p className="text-gray-400 mt-4">{t("pages.likedSongs.empty")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-[#0f0f0f] min-h-screen text-white text-center">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
          {t("pages.likedSongs.title")}
        </h1>
        <p className="text-red-500 mt-4">
          {t("pages.likedSongs.error")}: {error}
        </p>
      </div>
    );
  }

  const totalDurationSeconds = likedSongs.reduce(
    (sum, song) => sum + (song.duration || 0),
    0
  );
  const totalDurationMinutes = Math.floor(totalDurationSeconds / 60);
  const isAnyLikedSongPlaying = likedSongs.some(
    (song) => song._id === currentSong?._id
  );
  const songsCount = likedSongs.length;

  return (
    <>
      <Helmet>
        <title>Liked Songs</title>
        <meta
          name="description"
          content={`Your collection of ${songsCount} liked songs. Play all your favorite tracks saved on Moodify.`}
        />
      </Helmet>
      <div className="h-full relative">
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#8b5cf6]/20 via-[#0f0f0f]/80 to-[#0f0f0f] pointer-events-none animate-fade-in"
          aria-hidden="true"
        />
        <ScrollArea className="h-full rounded-md">
          <div className="relative min-h-screen pb-40 lg:pb-0">
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 items-center sm:items-end">
                <img
                  src="/liked.png"
                  alt={t("pages.likedSongs.title")}
                  className="w-64 h-64 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded object-cover"
                />
                <div className="flex flex-col justify-end text-center sm:text-left">
                  <p className="text-xs sm:text-sm font-medium ">
                    {t("pages.likedSongs.playlist")}
                  </p>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-2 sm:my-4">
                    {t("pages.likedSongs.title")}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 text-xs sm:text-sm text-gray-100">
                    <span className="font-medium text-white">
                      {t("pages.likedSongs.yourLibrary")}
                    </span>
                    <span>
                      • {likedSongs.length}{" "}
                      {likedSongs.length !== 1
                        ? t("pages.likedSongs.songs")
                        : t("pages.likedSongs.song")}
                    </span>
                    {totalDurationMinutes > 0 && (
                      <span>
                        • {totalDurationMinutes} {t("pages.likedSongs.minutes")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-6 pb-4 flex items-center gap-4 sm:gap-6 ">
                <Button
                  onClick={handlePlayLikedSongs}
                  size="icon"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-white/90 hover:scale-105 transition-all"
                >
                  {isPlaying && isAnyLikedSongPlaying ? (
                    <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  )}
                </Button>
              </div>

              <div className="bg-black/20 backdrop-blur-sm">
                <div className="px-2 sm:px-6">
                  <div className="space-y-1 py-4">
                    {isMobile
                      ? renderMobileSongList()
                      : renderDesktopSongList()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
      <SongOptionsDrawer
        song={selectedSongForMenu}
        playlistId={""}
        isOwner={false}
        isOpen={!!selectedSongForMenu}
        onOpenChange={(open) => !open && setSelectedSongForMenu(null)}
      />
    </>
  );
};

export default LikedSongsPage;
