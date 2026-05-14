// frontend/src/pages/LyricsPage/LyricsPage.tsx

import { useEffect, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { getArtistNames } from "@/lib/utils";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Drawer } from "vaul";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDominantColor } from "@/hooks/useDominantColor";
import { CoverDominantBackdrop } from "@/components/CoverDominantBackdrop";

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

function getScrollAreaViewport(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return (
    (root.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null) ??
    (root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null)
  );
}

/** Scroll only inside `scrollEl` — avoids scrolling drawer / outer ancestors (scrollIntoView). */
function scrollLineCenterInViewport(
  lineEl: HTMLElement | null,
  scrollEl: HTMLElement | null,
) {
  if (!lineEl || !scrollEl) return;
  const s = scrollEl.getBoundingClientRect();
  const l = lineEl.getBoundingClientRect();
  const nextTop =
    scrollEl.scrollTop + (l.top - s.top) - s.height / 2 + l.height / 2;
  scrollEl.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
}

/** Same paint stack as `CoverDominantBackdrop` so header matches lyrics area. */
function MobileDominantDrawerHeader({
  backdropColor,
  children,
}: {
  backdropColor: string;
  children: ReactNode;
}) {
  return (
    <div className="relative z-10 shrink-0 overflow-hidden border-b border-white/10">
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-zinc-950"
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundColor: backdropColor }}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/60" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

interface LyricsPageProps {
  variant?: "desktop" | "mobile-drawer";
}

const LyricsPage: React.FC<LyricsPageProps> = ({ variant = "desktop" }) => {
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
  const mobileLyricsScrollRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const getLyricsScrollEl = useCallback((): HTMLElement | null => {
    if (variant === "mobile-drawer") return mobileLyricsScrollRef.current;
    return getScrollAreaViewport(lyricsScrollAreaRef.current);
  }, [variant]);

  // Создаем локальное состояние для хранения отображаемой песни и текста
  const [displayState, setDisplayState] = useState<{
    song: typeof currentSong;
    lyrics: LyricLine[];
  }>({
    song: currentSong,
    lyrics: currentSong?.lyrics ? parseLrc(currentSong.lyrics) : [],
  });

  // Синхронизируем глобальное состояние с локальным, защищаясь от undefined (загрузки)
  useEffect(() => {
    setDisplayState((prev) => {
      if (!currentSong) {
        return { song: null, lyrics: [] };
      }

      // Если lyrics !== undefined, значит загрузка завершена (либо текст есть, либо пустая строка)
      if (currentSong.lyrics !== undefined) {
        return { song: currentSong, lyrics: parseLrc(currentSong.lyrics) };
      }

      // Если это самая первая песня и предыдущей нет — показываем её без текста
      if (!prev.song) {
        return { song: currentSong, lyrics: [] };
      }

      // Если идет загрузка (undefined) и есть предыдущая песня — оставляем предыдущую (предотвращаем мерцание)
      return prev;
    });
  }, [currentSong]);

  const { song: displaySong, lyrics } = displayState;
  const realCurrentTime = currentTime;

  const coverImageUrl = currentSong?.imageUrl ?? displaySong?.imageUrl;

  const { extractColor } = useDominantColor();
  const [backdropColor, setBackdropColor] = useState("#27272a");

  useEffect(() => {
    let alive = true;
    const url = coverImageUrl;
    if (!url) {
      setBackdropColor("#27272a");
      return;
    }
    void extractColor(url).then((color) => {
      if (alive) setBackdropColor(color);
    });
    return () => {
      alive = false;
    };
  }, [coverImageUrl, extractColor]);

  useEffect(() => {
    setIsUserScrolling(false);
    const viewport = getLyricsScrollEl();
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [displaySong?._id, getLyricsScrollEl]);

  useEffect(() => {
    const viewport = getLyricsScrollEl();
    if (!viewport || lyrics.length === 0 || isUserScrolling) return;

    if (realCurrentTime < lyrics[0].time) {
      if (viewport.scrollTop > 10) {
        viewport.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const activeLineIndex = lyrics.findIndex(
      (line, index) =>
        realCurrentTime >= line.time &&
        (index === lyrics.length - 1 ||
          realCurrentTime < lyrics[index + 1].time),
    );

    if (activeLineIndex === -1) return;

    const root =
      variant === "mobile-drawer"
        ? mobileLyricsScrollRef.current
        : lyricsScrollAreaRef.current;
    if (!root) return;

    const activeLineElement = root.querySelector(
      `.lyric-line-${activeLineIndex}`,
    ) as HTMLElement | null;

    scrollLineCenterInViewport(activeLineElement, viewport);
  }, [realCurrentTime, lyrics, isUserScrolling, variant, getLyricsScrollEl]);

  const handleScroll = useCallback(() => {
    if (!isUserScrolling) setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
      scrollTimeoutRef.current = null;
    }, 3000);
  }, [isUserScrolling]);

  useEffect(() => {
    const scrollAreaElement = getLyricsScrollEl();
    if (!scrollAreaElement) return;

    const onTouchStart = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      setIsUserScrolling(true);
    };

    scrollAreaElement.addEventListener("scroll", handleScroll);
    scrollAreaElement.addEventListener("touchstart", onTouchStart, {
      passive: true,
    });
    scrollAreaElement.addEventListener("touchend", handleScroll);
    scrollAreaElement.addEventListener("touchcancel", handleScroll);

    return () => {
      scrollAreaElement.removeEventListener("scroll", handleScroll);
      scrollAreaElement.removeEventListener("touchstart", onTouchStart);
      scrollAreaElement.removeEventListener("touchend", handleScroll);
      scrollAreaElement.removeEventListener("touchcancel", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll, getLyricsScrollEl]);

  const handleClose = () => {
    if (variant === "mobile-drawer") {
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

  const isLoading = displaySong?.lyrics === undefined;

  // Показываем заглушку только если загрузка завершена, а текста так и нет
  if (!displaySong || (!isLoading && !lyrics.length)) {
    if (variant === "mobile-drawer") {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-none bg-zinc-950 text-zinc-400">
          {displaySong ? (
            <MobileDominantDrawerHeader backdropColor={backdropColor}>
              <div className="flex w-full items-start gap-1 px-2 pb-3 pt-2">
                <Drawer.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-vaul-no-drag
                    className="-mt-0.5 shrink-0 text-zinc-300 hover:text-white"
                    aria-label={t("player.close")}
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </Drawer.Close>
                <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
                  <Drawer.Title className="m-0 text-balance text-xl font-bold leading-snug text-white">
                    {displaySong.title}
                  </Drawer.Title>
                  <Drawer.Description className="mt-1.5 block text-balance text-sm font-normal leading-snug text-zinc-300">
                    {getArtistNames(displaySong.artist, [])}
                  </Drawer.Description>
                </div>
                <div className="w-10 shrink-0" aria-hidden />
              </div>
            </MobileDominantDrawerHeader>
          ) : (
            <MobileDominantDrawerHeader backdropColor={backdropColor}>
              <div className="flex w-full items-center px-2 pb-2 pt-1">
                <Drawer.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-vaul-no-drag
                    className="shrink-0 text-zinc-300 hover:text-white"
                    aria-label={t("player.close")}
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </Drawer.Close>
                <Drawer.Title className="sr-only">
                  {t("player.lyrics")}
                </Drawer.Title>
                <div className="w-10 shrink-0" aria-hidden />
              </div>
            </MobileDominantDrawerHeader>
          )}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
            <p>{t("player.noLyrics")}</p>
            <Drawer.Close asChild>
              <Button variant="ghost" className="mt-4" data-vaul-no-drag>
                {t("player.close")}
              </Button>
            </Drawer.Close>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-black text-zinc-400">
        <p>{t("player.noLyrics")}</p>
        <Button variant="ghost" className="mt-4" onClick={handleClose}>
          {t("player.close")}
        </Button>
      </div>
    );
  }

  const showLyricsEdgeMask = variant === "desktop" && isMobile;
  const lyricLineClass =
    variant === "desktop"
      ? "py-1.5 text-4xl sm:text-5xl md:text-6xl px-2 font-semibold transition-all duration-200"
      : "py-1 text-3xl px-2 font-semibold transition-all duration-200";

  const lyricsBlocks = (
    <>
      <div className="pointer-events-none h-[8vh] w-full"></div>
      {lyrics.map((line, index) => (
        <p
          key={index}
          className={`${lyricLineClass} lyric-line-${index} cursor-pointer drop-shadow-md transition-all duration-200 hover:text-white ${
            realCurrentTime >= line.time &&
            (index === lyrics.length - 1 ||
              realCurrentTime < lyrics[index + 1].time)
              ? "text-white"
              : "text-white/20 hover:text-zinc-200"
          }`}
          onClick={() => handleLyricLineClick(line.time)}
        >
          {line.text}
        </p>
      ))}
      <div className="pointer-events-none h-[50vh] w-full"></div>
    </>
  );

  if (variant === "mobile-drawer") {
    return (
      <div className="isolate relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden overscroll-none bg-zinc-950">
        <CoverDominantBackdrop accentColor={backdropColor} />
        <MobileDominantDrawerHeader backdropColor={backdropColor}>
          <div className="flex w-full items-start gap-1 px-2 pb-3 pt-2">
            <Drawer.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-vaul-no-drag
                className="-mt-0.5 shrink-0 text-zinc-300 hover:text-white"
                aria-label={t("player.close")}
              >
                <ChevronDown className="h-6 w-6" />
              </Button>
            </Drawer.Close>
            <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
              <Drawer.Title className="m-0 text-balance text-lg font-bold leading-snug text-white">
                {displaySong.title}
              </Drawer.Title>
              <Drawer.Description className="mt-1 block text-balance text-sm font-normal leading-snug text-zinc-300">
                {getArtistNames(displaySong.artist, [])}
              </Drawer.Description>
            </div>
            <div className="w-10 shrink-0" aria-hidden />
          </div>
        </MobileDominantDrawerHeader>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-4 pb-3 pt-1 text-white">
          <div
            ref={mobileLyricsScrollRef}
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain no-scrollbar [-webkit-overflow-scrolling:touch]"
          >
            {lyricsBlocks}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="isolate relative flex h-full min-h-0 w-full flex-col overflow-hidden overscroll-none bg-zinc-950">
      <CoverDominantBackdrop accentColor={backdropColor} />

      <div className="relative z-10 flex h-full min-h-0 w-full flex-1 flex-col items-center justify-start p-4 pt-6 text-white sm:p-8">
        <ScrollArea
          className="relative z-10 h-full min-h-0 w-full max-w-4xl flex-1 overflow-hidden text-left"
          ref={lyricsScrollAreaRef}
          style={{
            maskImage: showLyricsEdgeMask
              ? "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)"
              : "none",
            WebkitMaskImage: showLyricsEdgeMask
              ? "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)"
              : "none",
          }}
        >
          {lyricsBlocks}
        </ScrollArea>
      </div>
    </div>
  );
};

export default LyricsPage;
