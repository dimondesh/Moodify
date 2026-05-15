// src/layout/PlaybackControls.tsx

import { useEffect, useState, startTransition, memo, useCallback } from "react";
import { Drawer } from "vaul";
import { useDominantColor } from "@/hooks/useDominantColor";
import { usePlayerStore } from "../stores/usePlayerStore";
import { useLibraryStore } from "../stores/useLibraryStore";
import { Button } from "../components/ui/button";
import { useAudioSettingsStore } from "../lib/webAudio";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Maximize, Share, Shuffle } from "lucide-react";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { AddToPlaylistControl } from "./AddToPlaylistControl";
import Repeat from "@/components/ui/repeat-icon";
import { CoverDominantBackdrop } from "@/components/CoverDominantBackdrop";

import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  ChevronDown,
  Mic2,
  Waves,
  List,
} from "lucide-react";
import { Slider } from "../components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useChatStore } from "../stores/useChatStore";

import { getArtistNames } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { useAuthStore } from "../stores/useAuthStore";
import { QueueDropdown } from "../components/QueueDropdown";
import { QueueDrawer } from "../components/QueueDrawer";
import Repeat1 from "@/components/ui/repeat-one-icon";

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

const MiniPlayerSeekIndicator = memo(function MiniPlayerSeekIndicator() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="absolute left-0 right-0 bottom-0 z-10 h-[2px] bg-white/15">
      <div
        className="h-full bg-white transition-all duration-100"
        style={{ width: `${pct || 0}%` }}
      />
    </div>
  );
});

const DrawerSeekBlock = memo(function DrawerSeekBlock() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seekToTime = usePlayerStore((s) => s.seekToTime);
  return (
    <div className="w-full flex flex-col gap-2 mb-2 px-2">
      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={1}
        className="w-full hover:cursor-grab active:cursor-grabbing"
        onValueChange={(value) => seekToTime(value[0])}
      />
      <div className="w-full flex items-center justify-between">
        <div className="text-xs text-zinc-400 font-mono">
          {formatTime(currentTime)}
        </div>
        <div className="text-xs text-zinc-400 font-mono">
          {formatTime(duration)}
        </div>
      </div>
    </div>
  );
});

const DesktopSeekRow = memo(function DesktopSeekRow() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const seekToTime = usePlayerStore((s) => s.seekToTime);
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="text-xs text-gray-400 font-mono">
        {formatTime(currentTime)}
      </div>
      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={1}
        className="w-full hover:cursor-pointer"
        onValueChange={(value) => seekToTime(value[0])}
      />
      <div className="text-xs text-gray-400 font-mono">
        {formatTime(duration)}
      </div>
    </div>
  );
});

const DrawerLyricsPreviewBlock = memo(function DrawerLyricsPreviewBlock({
  lyrics,
  lyricsBgColor,
  onOpenFullscreenLyrics,
}: {
  lyrics: LyricLine[];
  lyricsBgColor: string;
  onOpenFullscreenLyrics: () => void;
}) {
  const { t } = useTranslation();
  const currentTime = usePlayerStore((s) => s.currentTime);
  return (
    <div
      className="w-full px-4 mx-auto mt-0 mb-4 flex-shrink-0 cursor-pointer animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out"
      onClick={(e) => {
        e.stopPropagation();
        onOpenFullscreenLyrics();
      }}
    >
      <div
        className="w-full rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: lyricsBgColor,
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25))",
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-white">
            {t("player.lyricsPreview", "Lyrics")}
          </h3>
          <div className="text-[10px] font-bold px-1.5 py-1.5 bg-black/20 rounded-full text-white uppercase tracking-wider border border-white/10">
            <Maximize className="size-5" />
          </div>
        </div>

        <div className="w-full text-left relative">
          {(() => {
            const { playbackRateEnabled, playbackRate } =
              useAudioSettingsStore.getState();
            const currentRate = playbackRateEnabled ? playbackRate : 1.0;
            const realCurrentTime = currentTime / currentRate;
            const preview = lyrics.slice(0, 5);

            return preview.map((line, index) => {
              const isActive =
                realCurrentTime >= line.time &&
                (index === preview.length - 1 ||
                  (lyrics[index + 1] !== undefined &&
                    realCurrentTime < lyrics[index + 1].time));

              return (
                <p
                  key={index}
                  className={`py-1 text-lg sm:text-xl font-bold transition-all duration-300
                    ${isActive ? "text-white" : "text-white mix-blend-overlay"}`}
                >
                  {line.text}
                </p>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
});

/** Isolated: updates lock screen / control center position without re-rendering the whole bar. */
function MediaSessionPositionSync() {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentSong = usePlayerStore((s) => s.currentSong);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator) ||
      !("setPositionState" in navigator.mediaSession)
    ) {
      return;
    }
    if (currentSong && duration > 0) {
      const safePosition = Math.min(currentTime, duration);
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: safePosition,
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [currentTime, duration, isPlaying, currentSong]);

  return null;
}

const PlaybackControls = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isIosDevice } = useUIStore();
  const user = useAuthStore((s) => s.user);

  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const playNext = usePlayerStore((s) => s.playNext);
  const playPrevious = usePlayerStore((s) => s.playPrevious);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const setRepeatMode = usePlayerStore((s) => s.setRepeatMode);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const isFullScreenPlayerOpen = usePlayerStore((s) => s.isFullScreenPlayerOpen);
  const setIsFullScreenPlayerOpen = usePlayerStore(
    (s) => s.setIsFullScreenPlayerOpen,
  );
  const isDesktopLyricsOpen = usePlayerStore((s) => s.isDesktopLyricsOpen);
  const setIsDesktopLyricsOpen = usePlayerStore(
    (s) => s.setIsDesktopLyricsOpen,
  );
  const setIsMobileLyricsFullScreen = usePlayerStore(
    (s) => s.setIsMobileLyricsFullScreen,
  );
  const masterVolume = usePlayerStore((s) => s.masterVolume);
  const setMasterVolume = usePlayerStore((s) => s.setMasterVolume);

  const { shareEntity, openShareDialog, closeAllDialogs } = useUIStore();

  const { reverbEnabled, reverbMix, setReverbEnabled, setReverbMix } =
    useAudioSettingsStore();

  const { fetchLikedSongs } = useLibraryStore();

  const [previousMasterVolume, setPreviousMasterVolume] =
    useState(masterVolume);

  const [isCompactView, setIsCompactView] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

  const { extractColor } = useDominantColor();
  const [lyricsBgColor, setLyricsBgColor] = useState<string>("#27272a");

  // Подтягиваем доминантный цвет при смене трека
  useEffect(() => {
    let isMounted = true;
    const fetchColor = async () => {
      if (currentSong?.imageUrl) {
        const color = await extractColor(
          currentSong.imageUrl,
          currentSong.coverAccentHex,
        );
        if (isMounted) setLyricsBgColor(color);
      }
    };
    fetchColor();
    return () => {
      isMounted = false;
    };
  }, [currentSong?.imageUrl, currentSong?.coverAccentHex, extractColor]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      if (!currentSong) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        return;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: getArtistNames(
          Array.isArray(currentSong.artist) ? currentSong.artist : [],
          [],
        ),
        album: currentSong.albumTitle || "",
        artwork: [
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: currentSong.imageUrl || "/Moodify.svg",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlay());
      navigator.mediaSession.setActionHandler("pause", () => togglePlay());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        const { currentTime, seekToTime, playPrevious } =
          usePlayerStore.getState();
        if (currentTime > 3) {
          seekToTime(0);
        } else {
          void playPrevious();
        }
      });

      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) {
          usePlayerStore.getState().seekToTime(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const { currentTime, seekToTime } = usePlayerStore.getState();
        const newTime = currentTime + (details.seekOffset || 10);
        seekToTime(newTime);
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const { currentTime, seekToTime } = usePlayerStore.getState();
        const newTime = currentTime - (details.seekOffset || 10);
        seekToTime(newTime);
      });
    }
  }, [
    currentSong,
    isPlaying,
    playNext,
    playPrevious,
    togglePlay,
  ]);

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
    if (!currentSong) {
      setLyrics([]);
      return;
    }
    const raw = currentSong.lyrics;
    if (typeof raw !== "string" || !raw) {
      setLyrics([]);
      return;
    }

    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      startTransition(() => {
        if (!cancelled) setLyrics(parseLrc(raw));
      });
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(apply, { timeout: 500 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(apply, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [currentSong?._id, currentSong?.lyrics]);

  const toggleRepeatMode = () => {
    if (repeatMode === "off") {
      setRepeatMode("all");
    } else if (repeatMode === "all") {
      setRepeatMode("one");
    } else {
      setRepeatMode("off");
    }
  };

  const openDrawerLyricsFullscreen = useCallback(() => {
    setIsMobileLyricsFullScreen(true);
    setIsFullScreenPlayerOpen(false);
  }, [setIsMobileLyricsFullScreen, setIsFullScreenPlayerOpen]);

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
    if (masterVolume === 0) return <VolumeX className="size-5 md:size-4.5" />;
    if (masterVolume <= 33) return <Volume className="size-5 md:size-4.5" />;
    if (masterVolume <= 66) return <Volume1 className="size-5 md:size-4.5" />;
    return <Volume2 className="size-5 md:size-4.5" />;
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

  if (!currentSong) {
    return (
      <footer
        className={`h-18 sm:h-20 bg-[#0f0f0f] border-t border-[#2a2a2a] px-4 z-40
          ${isCompactView && isFullScreenPlayerOpen ? "hidden" : ""}`}
      >
        <div className="flex items-center justify-center h-full text-gray-400">
          {t("player.noSong")}
        </div>
      </footer>
    );
  }

  return (
    <>
      <MediaSessionPositionSync />
      {isCompactView ? (
        <>
          {!isFullScreenPlayerOpen && (
            <footer className="fixed bottom-21 left-0 right-0 h-14 sm:h-16 mx-1 mb-[4px] rounded-md px-3 sm:px-4 z-[60] relative overflow-hidden isolate flex items-center">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md"
                style={{ backgroundColor: lyricsBgColor }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md bg-black/60"
              />
              <div className="relative z-10 flex w-full min-w-0 flex-1 items-center justify-between gap-3">
                <div
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                  onClick={() => setIsFullScreenPlayerOpen(true)}
                >
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
                    <img
                      src={currentSong.imageUrl || "/default-song-cover.png"}
                      alt={currentSong.title}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="truncate text-sm font-medium text-white">
                      {currentSong.title}
                    </div>
                    <div className="truncate text-xs text-zinc-400">
                      {Array.isArray(currentSong.artist)
                        ? currentSong.artist.map((artist, index) => (
                            <span key={artist._id}>
                              {artist.name}
                              {index < currentSong.artist.length - 1 && ", "}
                            </span>
                          ))
                        : "Unknown Artist"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <AddToPlaylistControl
                    song={currentSong}
                    className="size-5.5"
                    iconClassName="size-5.5"
                    disabled={!user}
                  />
                  <Button
                    size="icon"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-white/90 sm:h-10 sm:w-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
                    ) : (
                      <Play className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
                    )}
                  </Button>
                </div>
              </div>

              <MiniPlayerSeekIndicator />
            </footer>
          )}

          <Drawer.Root
            open={isFullScreenPlayerOpen}
            onOpenChange={setIsFullScreenPlayerOpen}
          >
            <Drawer.Portal>
              <Drawer.Overlay className="fixed bg-black/40 z-[70] max-w-none " />
              <Drawer.Content
                aria-describedby={undefined}
                className="isolate bg-zinc-950 flex flex-col w-auto max-w-none h-full max-h-[100%] mt-24 min-w-screen overflow-hidden fixed bottom-0 left-0 right-0 z-[70]"
              >
                <CoverDominantBackdrop accentColor={lyricsBgColor} />

                <div className="relative z-10 flex flex-1 min-h-0 w-full mx-auto flex-col overflow-auto hide-scrollbar">
                  <Drawer.Title className="sr-only">
                    {currentSong?.title || t("player.nowPlaying")} -{" "}
                    {getArtistNames(
                      Array.isArray(currentSong.artist)
                        ? currentSong.artist
                        : [],
                      [],
                    )}
                  </Drawer.Title>
                  <div className="flex justify-between items-center mb-4 flex-shrink-0 mt-2 px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFullScreenPlayerOpen(false)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <ChevronDown className="size-6" />
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

                  <div className="flex-1 flex flex-col items-center overflow-y-auto w-full hide-scrollbar">
                    <div className="flex flex-col items-center justify-center px-4 py-8 pb-0 flex-shrink-0 w-full">
                      {currentSong ? (
                        <img
                          src={
                            currentSong.imageUrl || "/default-song-cover.png"
                          }
                          alt={currentSong.title}
                          className="w-full max-w-md aspect-square object-cover rounded-lg shadow-2xl mb-10"
                        />
                      ) : (
                        <div className="w-full max-w-md aspect-square bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 mb-8">
                          {t("player.noSong")}
                        </div>
                      )}

                      <div className="flex justify-between items-center w-full mb-4 px-2">
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <button
                            onClick={() => {
                              if (currentSong?.albumId) {
                                handleAlbumClick(currentSong.albumId);
                              }
                            }}
                            className="text-2xl font-bold text-white mb-0 text-left hover:underline focus:outline-none focus:underline truncate"
                          >
                            {currentSong?.title || t("player.noSong")}
                          </button>
                          <p className="text-zinc-400 text-base truncate mb-1">
                            {Array.isArray(currentSong.artist)
                              ? currentSong.artist.map((artist, index) => (
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
                                    {index < currentSong.artist.length - 1 &&
                                      ", "}
                                  </span>
                                ))
                              : "Unknown Artist"}
                          </p>
                        </div>
                        {currentSong && (
                          <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                            <AddToPlaylistControl
                              song={currentSong}
                              iconClassName="size-7"
                              disabled={!user}
                            />
                          </div>
                        )}
                      </div>

                      <DrawerSeekBlock />

                      <div className="flex items-center justify-between w-full mb-6 px-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={`hover:text-white ${
                            shuffleMode !== "off"
                              ? "text-violet-500"
                              : "text-zinc-400"
                          }`}
                          onClick={toggleShuffle}
                          title={t("player.toggleShuffle")}
                        >
                          <div className="relative flex flex-col items-center justify-center">
                            <Shuffle className="size-5.5" />
                            {shuffleMode === "smart" && (
                              <div className="absolute right-3 -bottom-1 w-1 h-1 rounded-full bg-violet-500" />
                            )}
                          </div>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="hover:text-white text-zinc-400"
                          onClick={() => {
                            const { currentTime, seekToTime, playPrevious } =
                              usePlayerStore.getState();
                            if (currentTime > 3) {
                              seekToTime(0);
                            } else {
                              void playPrevious();
                            }
                          }}
                        >
                          <SkipBack className="size-6 fill-current" />
                        </Button>
                        <Button
                          size="icon"
                          className="bg-white hover:bg-white/90 text-black rounded-full h-16 w-16"
                          onClick={togglePlay}
                        >
                          {isPlaying ? (
                            <Pause className="size-6 fill-current" />
                          ) : (
                            <Play className="size-6 fill-current" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="hover:text-white text-zinc-400"
                          onClick={playNext}
                        >
                          <SkipForward className="size-6 fill-current" />
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
                            <Repeat1 className="size-6" />
                          ) : (
                            <Repeat className="size-6" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between w-full pb-4 px-2">
                        <div className="flex items-center justify-start gap-2">
                          {!isIosDevice && (
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
                          )}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`hover:text-white text-zinc-400 ${
                              !user ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            onClick={() =>
                              openShareDialog({
                                type: "song",
                                id: currentSong._id,
                              })
                            }
                            disabled={!user}
                            title={
                              !user
                                ? t("auth.loginRequired")
                                : t("player.share")
                            }
                          >
                            <Share className="size-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-zinc-400 hover:text-white h-8 w-8"
                            onClick={() => setIsQueueDrawerOpen(true)}
                            title={t("player.queue.title")}
                          >
                            <List className="size-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {currentSong?.lyrics !== "" && lyrics.length > 0 && (
                      <DrawerLyricsPreviewBlock
                        lyrics={lyrics}
                        lyricsBgColor={lyricsBgColor}
                        onOpenFullscreenLyrics={openDrawerLyricsFullscreen}
                      />
                    )}
                    <div className="h-20 w-full flex-shrink-0"></div>
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </>
      ) : (
        <footer
          className={`h-18 sm:h-20 bg-[#0f0f0f] border-t border-[#2a2a2a] px-4 z-40`}
        >
          <div className="flex justify-between items-center h-full max-w-screen mx-auto">
            <div className="flex items-center gap-4 min-w-[180px] w-[30%]">
              {currentSong && (
                <>
                  <button
                    onClick={() => {
                      if (currentSong.albumId) {
                        handleAlbumClick(currentSong.albumId);
                      }
                    }}
                    className="flex-shrink-0 rounded-md overflow-hidden hover-scale"
                  >
                    <img
                      src={currentSong.imageUrl || "/default-song-cover.png"}
                      alt={currentSong.title}
                      className="w-12 h-12 object-cover"
                    />
                  </button>
                  <div className="flex flex-col min-w-0">
                    <button
                      onClick={() => {
                        if (currentSong.albumId) {
                          handleAlbumClick(currentSong.albumId);
                        }
                      }}
                      className="font-medium truncate text-left hover:text-[#8b5cf6] cursor-pointer focus:outline-none focus:text-[#8b5cf6] text-sm"
                    >
                      {currentSong.title}
                    </button>
                    <div className="text-xs text-gray-400 truncate">
                      {currentSong.artist && currentSong.artist.length > 0
                        ? currentSong.artist.map((artist, index) => (
                            <span key={artist._id}>
                              <button
                                onClick={() => handleArtistClick(artist._id)}
                                className="hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6]"
                              >
                                {artist.name}
                              </button>
                              {index < currentSong.artist.length - 1 && ", "}
                            </span>
                          ))
                        : "Unknown Artist"}
                    </div>
                  </div>
                  <AddToPlaylistControl song={currentSong} disabled={!user} />
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-1 max-w-full sm:max-w-[45%]">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className={`hover:text-white hover:bg-transparent! h-8 w-8 ${
                    shuffleMode !== "off" ? "text-[#8b5cf6]" : "text-gray-400"
                  }`}
                  onClick={toggleShuffle}
                  title={t("player.toggleShuffle")}
                >
                  <div className="relative flex flex-col items-center justify-center">
                    <Shuffle className="size-4.5" />
                    {shuffleMode === "smart" && (
                      <div className="absolute -bottom-1 right-2 w-1 h-1 rounded-full bg-[#8b5cf6] " />
                    )}
                  </div>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:text-white hover:bg-transparent! text-gray-400 h-8 w-8"
                  onClick={() => {
                    const { currentTime, seekToTime, playPrevious } =
                      usePlayerStore.getState();
                    if (currentTime > 3) {
                      seekToTime(0);
                    } else {
                      void playPrevious();
                    }
                  }}
                  disabled={!currentSong}
                >
                  <SkipBack className="size-5 fill-current" />
                </Button>
                <Button
                  size="icon"
                  className="bg-white hover:bg-white/90 text-black rounded-full h-10 w-10"
                  onClick={togglePlay}
                  disabled={!currentSong}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current ml-0.5" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:text-white hover:bg-transparent! text-gray-400 h-8 w-8"
                  onClick={playNext}
                  disabled={!currentSong}
                >
                  <SkipForward className="size-5 fill-current" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className={`hover:text-white hover:bg-transparent! h-8 w-8 ${
                    repeatMode !== "off" ? "text-[#8b5cf6]" : "text-gray-400"
                  }`}
                  onClick={toggleRepeatMode}
                  title={t("player.toggleRepeat")}
                >
                  {repeatMode === "one" ? (
                    <Repeat1 className="size-5" />
                  ) : (
                    <Repeat className="size-5" />
                  )}
                </Button>
              </div>
              <DesktopSeekRow />
            </div>
            <div className="flex items-center gap-4 min-w-[180px] w-[30%] justify-end">
              {!isIosDevice && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={currentSong?.lyrics === ""}
                  className={`hover:text-white hover:bg-transparent! h-5 w-5 text-gray-400 ${
                    isDesktopLyricsOpen ? "text-[#8b5cf6]" : "text-gray-400"
                  }`}
                  onClick={() => setIsDesktopLyricsOpen(!isDesktopLyricsOpen)}
                  title={t("player.lyrics")}
                >
                  <Mic2 className="size-4.5" />
                </Button>
              )}

              {!isIosDevice && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`hover:text-white hover:bg-transparent! h-5 w-5 text-gray-400`}
                      title={t("player.reverb")}
                      disabled={!currentSong || !reverbEnabled}
                      onClick={() => {
                        if (!reverbEnabled) setReverbEnabled(true);
                      }}
                    >
                      <Waves className="size-4.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="end"
                    className="w-48 bg-[#1a1a1a] border-[#2a2a2a] p-3 rounded-md shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem className="focus:bg-transparent">
                      <div className="flex items-center w-full gap-2">
                        <span className="text-sm text-gray-400 w-8 mr-4">
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
              )}

              <Button
                size="icon"
                variant="ghost"
                className={`hover:text-white hover:bg-transparent! text-gray-400 h-5 w-5 ${
                  !user ? "opacity-50 cursor-not-allowed" : ""
                }`}
                onClick={() =>
                  openShareDialog({ type: "song", id: currentSong._id })
                }
                disabled={!user}
                title={!user ? t("auth.loginRequired") : t("player.share")}
              >
                <Share className="size-4.5" />
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:text-white hover:bg-transparent! text-gray-400 h-4 w-4"
                  onClick={toggleMute}
                >
                  {renderVolumeIcon()}
                </Button>
                <Slider
                  value={[masterVolume]}
                  max={100}
                  step={1}
                  className="w-28 hover:cursor-grab active:cursor-grabbing"
                  onValueChange={(value) => {
                    const newVolume = value[0];
                    setMasterVolume(newVolume);
                    if (newVolume > 0) setPreviousMasterVolume(newVolume);
                  }}
                />
                <QueueDropdown>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:text-white hover:bg-transparent! text-gray-400 h-5 w-5"
                    title={t("player.queue.title")}
                  >
                    <List className="size-4.5" />
                  </Button>
                </QueueDropdown>
              </div>
            </div>
          </div>
        </footer>
      )}

      {currentSong && (
        <ShareDialog
          isOpen={
            shareEntity?.type === "song" && shareEntity?.id === currentSong._id
          }
          onClose={closeAllDialogs}
          entityType="song"
          entityId={currentSong._id}
        />
      )}
      <QueueDrawer
        isOpen={isQueueDrawerOpen}
        onOpenChange={setIsQueueDrawerOpen}
      />
    </>
  );
};

export default PlaybackControls;
