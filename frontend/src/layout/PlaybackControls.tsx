// frontend/src/layout/PlaybackControls.tsx

import { useEffect, useState, useRef } from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { Button } from "../components/ui/button";
import { useDominantColor } from "@/hooks/useDominantColor";
import { useAudioSettingsStore } from "../lib/webAudio";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next"; // <-- ИМПОРТ

import {
  Heart,
  Laptop2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  ChevronDown,
  Sliders,
  Mic2,
  Waves,
} from "lucide-react";
import { Slider } from "../components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useChatStore } from "../stores/useChatStore";

import { getArtistNames } from "@/lib/utils";

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface LyricLine {
  time: number;
  text: string;
}

const parseLrc = (lrcContent: string): LyricLine[] => {
  const lines = lrcContent.split("\n");
  const parsedLyrics: LyricLine[] = [];

  lines.forEach((line) => {
    const timeMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      const milliseconds = parseInt(timeMatch[3].padEnd(3, "0"), 10);
      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;
      const text = line.replace(/\[.*?\]/g, "").trim();
      parsedLyrics.push({ time: timeInSeconds, text });
    }
  });

  parsedLyrics.sort((a, b) => a.time - b.time);
  return parsedLyrics;
};

const PlaybackControls = () => {
  const { t } = useTranslation(); // <-- ИСПОЛЬЗОВАНИЕ ХУКА
  const navigate = useNavigate();

  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    repeatMode,
    setRepeatMode,
    isShuffle,
    toggleShuffle,
    isFullScreenPlayerOpen,
    setIsFullScreenPlayerOpen,
    isDesktopLyricsOpen,
    setIsDesktopLyricsOpen,
    setIsMobileLyricsFullScreen,
    vocalsVolume,
    setVocalsVolume,
    masterVolume,
    setMasterVolume,
    currentTime,
    duration,
    setCurrentTime: setPlayerCurrentTime,
  } = usePlayerStore();

  const { reverbEnabled, reverbMix, setReverbEnabled, setReverbMix } =
    useAudioSettingsStore();

  const { isSongLiked, toggleSongLike, fetchLikedSongs } = useLibraryStore();

  const [previousMasterVolume, setPreviousMasterVolume] =
    useState(masterVolume);

  const [isCompactView, setIsCompactView] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  const topSwipeAreaRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const { extractColor } = useDominantColor();
  const dominantColor = usePlayerStore((state) => state.dominantColor);
  const currentSongImage = currentSong?.imageUrl;
  const lastImageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentSongImage &&
      currentSong?.imageUrl &&
      currentSong.imageUrl !== lastImageUrlRef.current
    ) {
      lastImageUrlRef.current = currentSong.imageUrl;
      extractColor(currentSong.imageUrl);
    }
  }, [currentSong?.imageUrl, extractColor, currentSongImage]);

  useEffect(() => {
    fetchLikedSongs();
  }, [fetchLikedSongs]);

  useEffect(() => {
    const checkScreenSize = () => {
      const isCompact = window.innerWidth < 1024;
      setIsCompactView(isCompact);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (currentSong?.lyrics) {
      setLyrics(parseLrc(currentSong.lyrics));
    } else {
      setLyrics([]);
    }
  }, [currentSong]);

  const toggleRepeatMode = () => {
    if (repeatMode === "off") {
      setRepeatMode("all");
    } else if (repeatMode === "all") {
      setRepeatMode("one");
    } else {
      setRepeatMode("off");
    }
  };

  useEffect(() => {
    const socket = useChatStore.getState().socket;
    if (socket) {
      const songIdToSend = currentSong && isPlaying ? currentSong._id : null;
      socket.emit("update_activity", { songId: songIdToSend });
    }
  }, [isPlaying, currentSong]);

  const toggleMute = () => {
    if (masterVolume > 0) {
      setPreviousMasterVolume(masterVolume);
      setMasterVolume(0);
    } else {
      setMasterVolume(previousMasterVolume);
    }
  };

  const renderVolumeIcon = () => {
    if (masterVolume === 0) return <VolumeX className="h-4 w-4" />;
    if (masterVolume <= 33) return <Volume className="h-4 w-4" />;
    if (masterVolume <= 66) return <Volume1 className="h-4 w-4" />;
    return <Volume2 className="h-4 w-4" />;
  };

  const handleSeek = (value: number[]) => {
    setPlayerCurrentTime(value[0]);
  };

  const handleToggleLike = () => {
    if (currentSong) {
      toggleSongLike(currentSong._id);
    }
  };

  const handleArtistClick = (artistId: string) => {
    navigate(`/artists/${artistId}`);
    if (isCompactView && isFullScreenPlayerOpen) {
      setIsFullScreenPlayerOpen(false);
    }
  };

  const handleAlbumClick = (albumId: string) => {
    navigate(`/albums/${albumId}`);
    if (isCompactView && isFullScreenPlayerOpen) {
      setIsFullScreenPlayerOpen(false);
    }
  };

  const handleTopAreaTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTopAreaTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const currentY = e.touches[0].clientY;
    const diffY = currentY - touchStartY.current;

    const mainContentScrollTop = mobilePlayerContentRef.current?.scrollTop || 0;

    if (diffY > 50 && mainContentScrollTop <= 5) {
      setIsFullScreenPlayerOpen(false);
    }
  };

  const mobilePlayerContentRef = useRef<HTMLDivElement>(null);

  if (!currentSong) {
    return (
      <footer
        className={`h-20 sm:h-24 bg-zinc-900 border-t border-zinc-800 px-4 z-40
          ${isCompactView && isFullScreenPlayerOpen ? "hidden" : ""}`}
      >
        <div className="flex items-center justify-center h-full text-zinc-500">
          {t("player.noSong")}
        </div>
      </footer>
    );
  }

  if (isCompactView) {
    return (
      <>
        {!isFullScreenPlayerOpen && (
          <footer className="fixed bottom-16 left-0 right-0 h-16 sm:h-20 bg-zinc-800 border-t border-zinc-700 px-3 sm:px-4 flex items-center justify-between z-[61]">
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
              onClick={() => setIsFullScreenPlayerOpen(true)}
            >
              <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                <img
                  src={currentSong.imageUrl || "/default-song-cover.png"}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute top-0 left-0 h-[2px] bg-white transition-all duration-100"
                  style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                />
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="font-medium truncate text-white text-sm sm:text-base">
                  {currentSong.title}
                </div>
                <div className="text-xs text-zinc-400 truncate">
                  {currentSong.artist.map((artist, index) => (
                    <span key={artist._id}>
                      {artist.name}
                      {index < currentSong.artist.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className={`hover:text-white ${
                  isSongLiked(currentSong._id)
                    ? "text-violet-500"
                    : "text-zinc-400"
                } w-8 h-8`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleLike();
                }}
                title={
                  isSongLiked(currentSong._id)
                    ? t("player.unlike")
                    : t("player.like")
                }
              >
                <Heart className="h-5 w-5 fill-current" />
              </Button>
              <Button
                size="icon"
                className="bg-white hover:bg-white/90 text-black rounded-full h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current" />
                )}
              </Button>
            </div>
          </footer>
        )}

        <Dialog
          open={isFullScreenPlayerOpen}
          onOpenChange={setIsFullScreenPlayerOpen}
        >
          <DialogPortal>
            <DialogContent
              aria-describedby={undefined}
              className={`fixed w-auto h-screen max-w-none rounded-none bg-zinc-950 text-white flex flex-col p-4 sm:p-6 min-w-screen overflow-hidden z-[70] border-0`}
              style={{
                background: `linear-gradient(to bottom, ${dominantColor} 0%, rgba(20, 20, 20, 1) 50%, #18181b 100%)`,
                transition: "background 1s ease-in-out",
              }}
            >
              <style>{`
                  button[data-slot="dialog-close"] {
                    display: none !important;
                  }
                `}</style>
              <DialogTitle className="sr-only">
                {currentSong?.title || t("player.nowPlaying")} -{" "}
                {getArtistNames(currentSong.artist, [])}
              </DialogTitle>

              <div
                className="flex justify-between items-center min-w-screen mb-4 flex-shrink-0"
                ref={topSwipeAreaRef}
                onTouchStart={handleTopAreaTouchStart}
                onTouchMove={handleTopAreaTouchMove}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullScreenPlayerOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <ChevronDown className="h-6 w-6" />
                </Button>
                <button
                  onClick={() => {
                    if (currentSong?.albumId) {
                      handleAlbumClick(currentSong.albumId);
                    }
                  }}
                  className="text-sm font-semibold text-zinc-400 uppercase hover:underline focus:outline-none focus:underline"
                >
                  {currentSong?.albumTitle || t("player.nowPlaying")}
                </button>
                <div className="w-10 h-10"></div>
              </div>

              <div
                ref={mobilePlayerContentRef}
                className="flex-1 flex flex-col items-center overflow-y-auto w-full hide-scrollbar"
              >
                <div className="flex flex-col items-center justify-center px-4 py-8 flex-shrink-0 w-full">
                  {currentSong ? (
                    <img
                      src={currentSong.imageUrl || "/default-song-cover.png"}
                      alt={currentSong.title}
                      className="w-full max-w-md aspect-square object-cover rounded-lg shadow-2xl mb-8"
                    />
                  ) : (
                    <div className="w-full max-w-md aspect-square bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 mb-8">
                      {t("player.noSong")}
                    </div>
                  )}

                  <div className="flex justify-between items-center w-full mb-4 px-2">
                    <div className="flex flex-col text-left">
                      <button
                        onClick={() => {
                          if (currentSong?.albumId) {
                            handleAlbumClick(currentSong.albumId);
                          }
                        }}
                        className="text-2xl font-bold text-white mb-1 text-left hover:underline focus:outline-none focus:underline"
                      >
                        {currentSong?.title || t("player.noSong")}
                      </button>
                      <p className="text-zinc-400 text-base">
                        {currentSong.artist.map((artist, index) => (
                          <span key={artist._id}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArtistClick(artist._id);
                              }}
                              className="hover:underline focus:outline-none focus:underline"
                            >
                              {artist.name}
                            </button>
                            {index < currentSong.artist.length - 1 && ", "}
                          </span>
                        ))}
                      </p>
                    </div>
                    {currentSong && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`hover:text-white ${
                          isSongLiked(currentSong._id)
                            ? "text-violet-500"
                            : "text-zinc-400"
                        }`}
                        onClick={handleToggleLike}
                        title={
                          isSongLiked(currentSong._id)
                            ? t("player.unlike")
                            : t("player.like")
                        }
                      >
                        <Heart className="h-7 w-7 fill-current" />
                      </Button>
                    )}
                  </div>

                  <div className="w-full flex items-center gap-2 mb-8 px-2">
                    <div className="text-xs text-zinc-400">
                      {formatTime(currentTime)}
                    </div>
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={1}
                      className="flex-1 hover:cursor-grab active:cursor-grabbing"
                      onValueChange={handleSeek}
                    />
                    <div className="text-xs text-zinc-400">
                      {formatTime(duration)}
                    </div>
                  </div>

                  <div className="flex items-center justify-around w-full mb-8 px-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`hover:text-white ${
                        isShuffle ? "text-violet-500" : "text-zinc-400"
                      }`}
                      onClick={toggleShuffle}
                      title={t("player.toggleShuffle")}
                    >
                      <Shuffle className="h-6 w-6" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hover:text-white text-zinc-400"
                      onClick={() => {
                        if (currentTime > 3) {
                          setPlayerCurrentTime(0);
                        } else {
                          playPrevious();
                        }
                      }}
                    >
                      <SkipBack className="h-6 w-6 fill-current" />
                    </Button>
                    <Button
                      size="icon"
                      className="bg-violet-500 hover:bg-violet-400 text-black rounded-full h-16 w-16"
                      onClick={togglePlay}
                    >
                      {isPlaying ? (
                        <Pause className="h-9 w-9 fill-current" />
                      ) : (
                        <Play className="h-9 w-9 fill-current" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hover:text-white text-zinc-400"
                      onClick={playNext}
                    >
                      <SkipForward className="h-6 w-6 fill-current" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`hover:text-white ${
                        repeatMode !== "off"
                          ? "text-violet-500"
                          : "text-zinc-400"
                      }`}
                      onClick={toggleRepeatMode}
                      title={t("player.toggleRepeat")}
                    >
                      {repeatMode === "one" ? (
                        <Repeat1 className="h-6 w-6" />
                      ) : (
                        <Repeat className="h-6 w-6" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between w-full pb-4 px-2">
                    <div className="flex items-center justify-start gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="hover:text-white text-zinc-400"
                            title={t("player.vocals")}
                            disabled={!currentSong || !currentSong.vocalsUrl}
                          >
                            <Sliders className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="center"
                          className="w-48 bg-zinc-800 border-zinc-700 p-3 rounded-md shadow-lg z-70"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem className="focus:bg-transparent">
                            <div className="flex items-center w-full gap-2">
                              <span className="text-sm text-zinc-400 w-8 mr-2">
                                {t("player.vocals")}
                              </span>
                              <Slider
                                value={[vocalsVolume]}
                                max={100}
                                step={1}
                                className="flex-1 hover:cursor-grab active:cursor-grabbing"
                                onValueChange={(value) =>
                                  setVocalsVolume(value[0])
                                }
                                disabled={
                                  !currentSong || !currentSong.vocalsUrl
                                }
                              />
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`hover:text-white ${
                              reverbEnabled
                                ? "text-violet-500"
                                : "text-zinc-400"
                            }`}
                            title={t("player.reverb")}
                            disabled={!currentSong || !reverbEnabled}
                            onClick={() => {
                              if (!reverbEnabled) setReverbEnabled(true);
                            }}
                          >
                            <Waves className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="center"
                          className="w-48 bg-zinc-800 border-zinc-700 p-3 rounded-md shadow-lg z-70"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem className="focus:bg-transparent">
                            <div className="flex items-center w-full gap-2">
                              <span className="text-sm text-zinc-400 w-8 mr-4">
                                {t("player.reverb")}
                              </span>
                              <Slider
                                value={[reverbMix * 100]}
                                max={100}
                                step={1}
                                className="flex-1 hover:cursor-grab active:cursor-grabbing"
                                onValueChange={(value) =>
                                  setReverbMix(value[0] / 100)
                                }
                              />
                            </div>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-white text-zinc-400"
                        onClick={toggleMute}
                      >
                        {renderVolumeIcon()}
                      </Button>
                      <Slider
                        value={[masterVolume]}
                        max={100}
                        step={1}
                        className="w-24 hover:cursor-grab active:cursor-grabbing"
                        onValueChange={(value) => {
                          const newVolume = value[0];
                          setMasterVolume(newVolume);
                          if (newVolume > 0) setPreviousMasterVolume(newVolume);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:text-white text-zinc-400"
                      >
                        <Laptop2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
                {currentSong.lyrics && (
                  <div className="w-full  mx-auto mt-8 flex flex-col items-center flex-shrink-0">
                    <h3 className="text-xl font-bold mb-4 text-white">
                      {t("player.lyricsPreview")}
                    </h3>
                    <div className="w-full text-center relative cursor-pointer">
                      {lyrics.slice(0, 5).map((line, index) => (
                        <p
                          key={index}
                          className={`py-0.5 text-base font-bold transition-colors duration-100
                              ${
                                currentTime >= line.time &&
                                (index === lyrics.length - 1 ||
                                  currentTime < lyrics[index + 1].time)
                                  ? "text-violet-400"
                                  : "text-zinc-400"
                              }`}
                        >
                          {line.text}
                        </p>
                      ))}
                      {lyrics.length > 5 && (
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent flex items-end justify-center pb-2">
                          <Button
                            variant="ghost"
                            className="text-violet-400 hover:text-violet-300 text-sm font-bold"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMobileLyricsFullScreen(true);
                              setIsFullScreenPlayerOpen(false);
                            }}
                          >
                            {t("player.showFullLyrics")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="h-20 w-full flex-shrink-0"></div>
              </div>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </>
    );
  }

  return (
    <footer className="h-20 sm:h-24 bg-zinc-900 border-t border-zinc-800 px-4 z-40">
      <div className="flex justify-between items-center h-full max-w-[1800px] mx-auto">
        <div className="flex items-center gap-4 min-w-[180px] w-[30%]">
          {currentSong && (
            <>
              <button
                onClick={() => {
                  if (currentSong.albumId) {
                    handleAlbumClick(currentSong.albumId);
                  }
                }}
                className="flex-shrink-0 rounded-md overflow-hidden"
              >
                <img
                  src={currentSong.imageUrl || "/default-song-cover.png"}
                  alt={currentSong.title}
                  className="w-14 h-14 object-cover"
                />
              </button>
              <div className="flex flex-col">
                <button
                  onClick={() => {
                    if (currentSong.albumId) {
                      handleAlbumClick(currentSong.albumId);
                    }
                  }}
                  className="font-medium truncate text-left hover:underline cursor-pointer focus:outline-none focus:underline"
                >
                  {currentSong.title}
                </button>
                <div className="text-sm text-zinc-400 truncate">
                  {currentSong.artist.map((artist, index) => (
                    <span key={artist._id}>
                      <button
                        onClick={() => handleArtistClick(artist._id)}
                        className="hover:underline focus:outline-none focus:underline"
                      >
                        {artist.name}
                      </button>
                      {index < currentSong.artist.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={`hover:text-white ${
                  isSongLiked(currentSong._id)
                    ? "text-violet-500"
                    : "text-zinc-400"
                }`}
                onClick={handleToggleLike}
                title={
                  isSongLiked(currentSong._id)
                    ? t("player.unlike")
                    : t("player.like")
                }
              >
                <Heart className="h-4 w-4 fill-current" />
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 flex-1 max-w-full sm:max-w-[45%]">
          <div className="flex items-center gap-4 sm:gap-6">
            <Button
              size="icon"
              variant="ghost"
              className={`hover:text-white ${
                isShuffle ? "text-violet-500" : "text-zinc-400"
              }`}
              onClick={toggleShuffle}
              title={t("player.toggleShuffle")}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={() => {
                if (currentTime > 3) {
                  setPlayerCurrentTime(0);
                } else {
                  playPrevious();
                }
              }}
              disabled={!currentSong}
            >
              <SkipBack className="h-4 w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              className="bg-white hover:bg-white/90 text-black rounded-full h-8 w-8"
              onClick={togglePlay}
              disabled={!currentSong}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={playNext}
              disabled={!currentSong}
            >
              <SkipForward className="h-4 w-4 fill-current" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className={`hover:text-white ${
                repeatMode !== "off" ? "text-violet-500" : "text-zinc-400"
              }`}
              onClick={toggleRepeatMode}
              title={t("player.toggleRepeat")}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4" />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full">
            <div className="text-xs text-zinc-400">
              {formatTime(currentTime)}
            </div>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="w-full hover:cursor-grab active:cursor-grabbing"
              onValueChange={handleSeek}
            />
            <div className="text-xs text-zinc-400">{formatTime(duration)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 min-w-[180px] w-[30%] justify-end">
          {currentSong.lyrics && (
            <Button
              size="icon"
              variant="ghost"
              className={`hover:text-white ${
                isDesktopLyricsOpen ? "text-violet-500" : "text-zinc-400"
              }`}
              onClick={() => setIsDesktopLyricsOpen(!isDesktopLyricsOpen)}
              title={t("player.lyrics")}
            >
              <Mic2 className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="hover:text-white text-zinc-400"
                title={t("player.vocals")}
                disabled={!currentSong || !currentSong.vocalsUrl}
              >
                <Sliders className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="w-48 bg-zinc-800 border-zinc-700 p-3 rounded-md shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem className="focus:bg-transparent">
                <div className="flex items-center w-full gap-2">
                  <span className="text-sm text-zinc-400 w-8 mr-2">
                    {t("player.vocals")}
                  </span>
                  <Slider
                    value={[vocalsVolume]}
                    max={100}
                    step={1}
                    className="flex-1 hover:cursor-grab active:cursor-grabbing"
                    onValueChange={(value) => setVocalsVolume(value[0])}
                    disabled={!currentSong || !currentSong.vocalsUrl}
                  />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={`hover:text-white ${
                  reverbEnabled ? "text-violet-500" : "text-zinc-400"
                }`}
                title={t("player.reverb")}
                disabled={!currentSong || !reverbEnabled}
                onClick={() => {
                  if (!reverbEnabled) setReverbEnabled(true);
                }}
              >
                <Waves className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="w-48 bg-zinc-800 border-zinc-700 p-3 rounded-md shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem className="focus:bg-transparent">
                <div className="flex items-center w-full gap-2">
                  <span className="text-sm text-zinc-400 w-8 mr-2">
                    {t("player.reverb")}
                  </span>
                  <Slider
                    value={[reverbMix * 100]}
                    max={100}
                    step={1}
                    className="flex-1 hover:cursor-grab active:cursor-grabbing"
                    onValueChange={(value) => setReverbMix(value[0] / 100)}
                  />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            className="hover:text-white text-zinc-400"
          >
            <Laptop2 className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-white text-zinc-400"
              onClick={toggleMute}
            >
              {renderVolumeIcon()}
            </Button>
            <Slider
              value={[masterVolume]}
              max={100}
              step={1}
              className="w-24 hover:cursor-grab active:cursor-grabbing"
              onValueChange={(value) => {
                const newVolume = value[0];
                setMasterVolume(newVolume);
                if (newVolume > 0) setPreviousMasterVolume(newVolume);
              }}
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PlaybackControls;
