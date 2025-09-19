// frontend/src/pages/LyricsPage/LyricsPage.tsx

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { getArtistNames } from "@/lib/utils";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { ChevronDown } from "lucide-react";
import { useDominantColor } from "@/hooks/useDominantColor";
import { useTranslation } from "react-i18next";
import { useAudioSettingsStore } from "@/lib/webAudio";

interface LyricLine {
  time: number;
  text: string;
}

const parseLrc = (lrcContent: string): LyricLine[] => {
  if (!lrcContent) return [];
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
      if (text) {
        parsedLyrics.push({ time: timeInSeconds, text });
      }
    }
  });
  parsedLyrics.sort((a, b) => a.time - b.time);
  return parsedLyrics;
};

interface LyricsPageProps {
  isMobileFullScreen?: boolean;
}

const LyricsPage: React.FC<LyricsPageProps> = ({
  isMobileFullScreen = false,
}) => {
  const { t } = useTranslation();
  const {
    currentSong,
    currentTime,
    setIsDesktopLyricsOpen,
    setIsMobileLyricsFullScreen,
    setIsFullScreenPlayerOpen,
    seekToTime,
  } = usePlayerStore();

  const { playbackRateEnabled, playbackRate } = useAudioSettingsStore();

  const lyricsScrollAreaRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { extractColor } = useDominantColor();
  const lastImageUrlRef = useRef<string | null>(null);

  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState([
    { key: 0, color: "#18181b" },
  ]);

  const lyrics = useMemo(() => {
    return currentSong?.lyrics ? parseLrc(currentSong.lyrics) : [];
  }, [currentSong?.lyrics]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds((prev) => [{ key: newKey, color }, ...prev.slice(0, 1)]);
    };

    if (
      currentSong?.imageUrl &&
      currentSong.imageUrl !== lastImageUrlRef.current
    ) {
      lastImageUrlRef.current = currentSong.imageUrl;
      extractColor(currentSong.imageUrl).then((color) => {
        updateBackgroundColor(color || "#18181b");
      });
    } else if (!currentSong) {
      updateBackgroundColor("#18181b");
    }
  }, [currentSong, extractColor]);

  useEffect(() => {
    setIsUserScrolling(false);
    if (lyricsScrollAreaRef.current) {
      const viewport = lyricsScrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) viewport.scrollTop = 0;
    }
  }, [lyrics]);

  useEffect(() => {
    if (lyricsScrollAreaRef.current && lyrics.length > 0 && !isUserScrolling) {
      const currentRate = playbackRateEnabled ? playbackRate : 1.0;
      const realCurrentTime = currentTime * currentRate;

      const activeLineIndex = lyrics.findIndex(
        (line, index) =>
          realCurrentTime >= line.time &&
          (index === lyrics.length - 1 ||
            realCurrentTime < lyrics[index + 1].time)
      );
      if (activeLineIndex !== -1) {
        const activeLineElement = lyricsScrollAreaRef.current.querySelector(
          `.lyric-line-${activeLineIndex}`
        ) as HTMLElement;
        if (activeLineElement) {
          activeLineElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }
  }, [currentTime, lyrics, isUserScrolling, playbackRate, playbackRateEnabled]);

  const handleScroll = useCallback(() => {
    if (!isUserScrolling) setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollTimeoutRef.current = null;
    }, 3000);
  }, [isUserScrolling]);

  useEffect(() => {
    const scrollAreaElement = lyricsScrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement;
    if (scrollAreaElement) {
      scrollAreaElement.addEventListener("scroll", handleScroll);
      scrollAreaElement.addEventListener("touchstart", () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = null;
        }
        setIsUserScrolling(true);
      });
      scrollAreaElement.addEventListener("touchend", handleScroll);
      scrollAreaElement.addEventListener("touchcancel", handleScroll);
    }
    return () => {
      if (scrollAreaElement) {
        scrollAreaElement.removeEventListener("scroll", handleScroll);
        scrollAreaElement.removeEventListener("touchstart", () => {});
        scrollAreaElement.removeEventListener("touchend", handleScroll);
        scrollAreaElement.removeEventListener("touchcancel", handleScroll);
      }
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll]);

  const handleClose = () => {
    if (isMobileFullScreen) {
      setIsMobileLyricsFullScreen(false);
      setIsFullScreenPlayerOpen(true);
    } else {
      setIsDesktopLyricsOpen(false);
    }
  };

  const handleLyricLineClick = (time: number) => {
    setIsUserScrolling(false);
    const currentRate = playbackRateEnabled ? playbackRate : 1.0;
    const uiSeekTime = time / currentRate;
    seekToTime(uiSeekTime);
  };

  if (!currentSong || !lyrics.length) {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-screen text-zinc-400 ${
          isMobileFullScreen
            ? "fixed inset-0 z-[80] bg-zinc-950"
            : "w-full bg-black"
        }`}
      >
        <p>{t("player.noLyrics")}</p>
        <Button variant="ghost" className="mt-4" onClick={handleClose}>
          {t("player.close")}
        </Button>
      </div>
    );
  }

  const currentRate = playbackRateEnabled ? playbackRate : 1.0;
  const realCurrentTime = currentTime * currentRate;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className={`flex flex-col items-center justify-start h-[calc(100vh - 1px)] p-4 sm:p-8 text-white ${
          isMobileFullScreen ? "fixed inset-0 z-[80]" : "w-full"
        }`}
      >
        {backgrounds
          .slice(0, 2)
          .reverse()
          .map((bg, index) => (
            <div
              key={bg.key}
              className={`absolute inset-y-0 w-full ${
                index === 1 ? "animate-fade-in" : ""
              }`}
              style={{
                background: `linear-gradient(to bottom, ${bg.color} 0%, rgba(20, 20, 20, 0.8) 100%, #18181b 100%)`,
              }}
            />
          ))}

        <div className="flex justify-between items-center w-full max-w-4xl mb-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white"
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
          <div className="text-sm font-semibold text-zinc-400 uppercase z-10">
            {t("player.lyrics")}
          </div>
          <div className="w-10 h-10 z-10" />
        </div>
        <div className="text-center mb-8 z-10">
          <h2 className="text-3xl font-bold mb-1">{currentSong.title}</h2>
          <p className="text-zinc-400 text-lg">
            {getArtistNames(currentSong.artist, [])}
          </p>
        </div>
        <ScrollArea
          className="flex-1 w-full max-w-4xl text-center h-full"
          ref={lyricsScrollAreaRef}
        >
          {lyrics.map((line, index) => (
            <p
              key={index}
              className={`py-1 text-2xl px-2 sm:text-3xl font-semibold transition-all duration-200 lyric-line-${index} cursor-pointer hover:text-white ${
                realCurrentTime >= line.time &&
                (index === lyrics.length - 1 ||
                  realCurrentTime < lyrics[index + 1].time)
                  ? "text-violet-400 scale-105"
                  : "text-zinc-400"
              }`}
              onClick={() => handleLyricLineClick(line.time)}
            >
              {line.text}
            </p>
          ))}
          <div className="h-[50vh] w-full"></div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default LyricsPage;
