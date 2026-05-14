// frontend/src/pages/HomePage/HorizontalSection.tsx

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Button } from "../../components/ui/button";
import { ScrollArea, ScrollBar } from "../../components/ui/scroll-area";
import type { Song } from "../../types";
import HorizontalSectionSkeleton from "./HorizontalSectionSkeleton";
import { TFunction } from "i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { DisplayItem } from "@/types";
import { isValidDisplayItem } from "@/lib/entitySection";
import EntitySectionCard from "./EntitySectionCard";

interface HorizontalSectionProps {
  title: string;
  items: DisplayItem[];
  isLoading: boolean;
  onShowAll?: () => void;
  limit?: number;
  t: TFunction;
}

const HorizontalSectionComponent: React.FC<HorizontalSectionProps> = ({
  title,
  items,
  isLoading,
  onShowAll,
  limit = 6,
  t,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const validItems = useMemo(
    () => items.filter(isValidDisplayItem),
    [items],
  );

  const itemsToShow = useMemo(
    () => validItems.slice(0, limit),
    [validItems, limit],
  );
  const canShowAll = useMemo(
    () => onShowAll && items.length > limit,
    [onShowAll, items.length, limit],
  );

  const songsOnly = useMemo(
    () =>
      validItems.filter(
        (item): item is Song & { itemType: "song" } =>
          item.itemType === "song",
      ),
    [validItems],
  );

  const checkScrollability = useCallback(() => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
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
      "[data-radix-scroll-area-viewport]",
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
  }, [items, isLoading, checkScrollability]);

  const scroll = (direction: "left" | "right") => {
    const element = scrollContainerRef.current?.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    if (element) {
      const scrollAmount = element.clientWidth * 0.8;
      element.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (isLoading) {
    return <HorizontalSectionSkeleton />;
  }

  if (!items || items.length === 0) {
    return null;
  }

  if (validItems.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 sm:mb-8 relative group/section">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {canShowAll && (
          <Button
            variant="link"
            className="text-sm text-zinc-400 hover:text-white"
            onClick={onShowAll}
          >
            {t("searchpage.showAll")}
          </Button>
        )}
      </div>

      {isDesktop && canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-black/50 hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      {isDesktop && canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-black/50 hover:bg-black/80 rounded-full size-10 opacity-0 group-hover/section:opacity-100 transition-opacity"
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      <ScrollArea
        className="w-full whitespace-nowrap rounded-md"
        ref={scrollContainerRef}
      >
        <div className="flex pb-4">
          {itemsToShow.map((item) => (
            <EntitySectionCard
              key={`${item.itemType}-${item._id}`}
              item={item}
              songsOnly={songsOnly}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
    </div>
  );
};

const HorizontalSection = React.memo(HorizontalSectionComponent);
export default HorizontalSection;
