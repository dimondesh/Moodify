// frontend/src/components/ui/EntityTypeFilter.tsx

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "./scroll-area";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface EntityTypeFilterProps {
  currentFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  className?: string;
  hasDownloaded?: boolean;
}

const EntityTypeFilter = ({
  currentFilter,
  onFilterChange,
  className,
  hasDownloaded = false,
}: EntityTypeFilterProps) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const filters = [
    { key: "playlists", label: t("common.playlists") },
    { key: "albums", label: t("common.albums") },
    { key: "artists", label: t("common.artists") },
    ...(hasDownloaded
      ? [{ key: "downloaded", label: t("common.downloaded") }]
      : []),
  ];

  const checkScrollability = useCallback(() => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  useEffect(() => {
    const scrollAreaElement = scrollContainerRef.current;
    const viewportElement = scrollAreaElement?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );

    if (viewportElement) {
      checkScrollability();
      viewportElement.addEventListener("scroll", checkScrollability, {
        passive: true,
      });
      window.addEventListener("resize", checkScrollability);

      const resizeObserver = new ResizeObserver(checkScrollability);
      resizeObserver.observe(viewportElement);

      if (viewportElement.firstChild) {
        resizeObserver.observe(viewportElement.firstChild as Element);
      }

      return () => {
        viewportElement.removeEventListener("scroll", checkScrollability);
        window.removeEventListener("resize", checkScrollability);
        resizeObserver.disconnect();
      };
    }
  }, [filters.length, checkScrollability]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (element) {
      const scrollAmount = element.clientWidth * 0.8;
      element.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className={cn("relative w-full group/section", className)}>
      {/* Left scroll button */}
      {isDesktop && canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-black/50 backdrop-blur-md hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {/* Right scroll button */}
      {isDesktop && canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-black/50 backdrop-blur-md hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity flex items-center justify-center"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <ScrollArea
        ref={scrollContainerRef}
        className="w-full whitespace-nowrap rounded-md"
      >
        <div className="flex gap-1.5 min-w-max pb-2">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFilterChange(currentFilter === key ? null : key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap rounded-full border flex-shrink-0",
                currentFilter === key
                  ? "bg-white text-black border-white hover:bg-gray-100"
                  : "bg-transparent text-white border-gray-600 hover:border-white hover:bg-white/10"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );
};

export default EntityTypeFilter;
