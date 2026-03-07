// frontend/src/pages/LyricsPage/LyricsPage.tsx

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { getArtistNames } from "@/lib/utils";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

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

  const lyricsScrollAreaRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lyrics = useMemo(() => {
    return currentSong?.lyrics ? parseLrc(currentSong.lyrics) : [];
  }, [currentSong?.lyrics]);

  const realCurrentTime = currentTime;

  useEffect(() => {
    setIsUserScrolling(false);
    if (lyricsScrollAreaRef.current) {
      const viewport = lyricsScrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) viewport.scrollTop = 0;
    }
  }, [lyrics]);

  useEffect(() => {
    if (lyricsScrollAreaRef.current && lyrics.length > 0 && !isUserScrolling) {
      const activeLineIndex = lyrics.findIndex(
        (line, index) =>
          realCurrentTime >= line.time &&
          (index === lyrics.length - 1 ||
            realCurrentTime < lyrics[index + 1].time),
      );
      if (activeLineIndex !== -1) {
        const activeLineElement = lyricsScrollAreaRef.current.querySelector(
          `.lyric-line-${activeLineIndex}`,
        ) as HTMLElement;
        if (activeLineElement) {
          activeLineElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }
    }
  }, [realCurrentTime, lyrics, isUserScrolling]);

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
      "[data-radix-scroll-area-viewport]",
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
    seekToTime(time);
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      {/* 1. Блюр фона на основе обложки */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {currentSong?.imageUrl && (
          <>
            <img
              src={currentSong.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-60 scale-150 animate-fade-in"
              style={{ filter: "blur(80px)" }}
            />
            {/* Затемняющий оверлей поверх блюра, чтобы текст оставался читаемым */}
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}
      </div>

      <div
        className={`relative z-10 flex flex-col items-center justify-start h-[calc(100vh - 1px)] p-4 sm:p-8 text-white ${
          isMobileFullScreen ? "fixed inset-0 z-[80]" : "w-full"
        }`}
      >
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

        <div className="text-center mb-6 z-10">
          <h2 className="text-3xl font-bold mb-1">{currentSong.title}</h2>
          <p className="text-zinc-400 text-lg">
            {getArtistNames(currentSong.artist, [])}
          </p>
        </div>

        {/* 2. Градиент-маска на ScrollArea */}
        <ScrollArea
          className="flex-1 w-full max-w-4xl text-center h-full"
          ref={lyricsScrollAreaRef}
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          }}
        >
          {/* Добавляем пустой блок сверху, чтобы самая первая строка могла оказаться в центре при скролле */}
          <div className="h-[20vh] w-full" />

          {lyrics.map((line, index) => {
            const isActive =
              realCurrentTime >= line.time &&
              (index === lyrics.length - 1 ||
                realCurrentTime < lyrics[index + 1].time);

            // Вычисляем, начнется ли эта строка менее чем через 1 секунду
            const isUpcoming =
              line.time > realCurrentTime && line.time - realCurrentTime <= 1;

            // 3. Логика классов для блюра и цветов
            let stateClasses = "";

            if (isUserScrolling) {
              // Если пользователь скроллит - убираем блюр у всех строк
              stateClasses = isActive
                ? "text-violet-500 scale-105 opacity-100! blur-none"
                : "text-zinc-300 opacity-80 blur-none";
            } else {
              if (isActive) {
                stateClasses =
                  "text-violet-400 scale-105 opacity-100! blur-none drop-shadow-lg";
              } else if (isUpcoming) {
                // Если строка будет петься через <= 1 сек, плавно выводим из блюра
                stateClasses =
                  "text-zinc-200 opacity-90 blur-none duration-1000";
              } else {
                // Обычное состояние (прошедшие или будущие строки)
                stateClasses = "text-zinc-400 blur-[4px] opacity-40";
              }
            }

            return (
              <p
                key={index}
                className={`py-2 text-2xl px-2 sm:text-3xl font-bold transition-all duration-500 lyric-line-${index} cursor-pointer hover:text-white hover:blur-none hover:opacity-100 ${stateClasses}`}
                onClick={() => handleLyricLineClick(line.time)}
              >
                {line.text}
              </p>
            );
          })}

          <div className="h-[50vh] w-full" />
        </ScrollArea>
      </div>
    </div>
  );
};

export default LyricsPage;
