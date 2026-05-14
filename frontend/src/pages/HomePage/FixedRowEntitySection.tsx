import React, { useMemo, useRef, useState, useLayoutEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Song } from "@/types";
import EntitySectionCard from "./EntitySectionCard";
import type { DisplayItem } from "@/types";
import { isValidDisplayItem } from "@/lib/entitySection";

export interface ListPagePrefetchItem {
  _id: string;
  name?: string;
  title?: string;
  imageUrl: string;
  type?: string;
  itemType?: string;
}

/** Tailwind w-36 / w-44 + gap-1 / gap-2 (must match EntitySectionCard + row gap) */
function countCardsThatFit(containerWidth: number, isSmUp: boolean): number {
  if (containerWidth <= 0) return 1;
  const cardW = isSmUp ? 176 : 144;
  const gap = isSmUp ? 8 : 4;
  return Math.max(1, Math.floor((containerWidth + gap) / (cardW + gap)));
}

export interface FixedRowEntitySectionProps {
  title: string;
  items: DisplayItem[];
  /** Used with Show all when `listPageItems` is not set */
  apiEndpoint?: string;
  /**
   * When set, Show all navigates to /list with `items` in state (for APIs whose JSON is not a bare array).
   */
  listPageItems?: ListPagePrefetchItem[];
  /** Upper bound on how many cards to show even if the row fits more (optional) */
  maxVisible?: number;
  isLoading?: boolean;
  /** e.g. privacy hint below title */
  noticeSlot?: React.ReactNode;
  className?: string;
}

const FixedRowEntitySection: React.FC<FixedRowEntitySectionProps> = ({
  title,
  items,
  apiEndpoint,
  listPageItems,
  maxVisible,
  isLoading = false,
  noticeSlot,
  className = "",
}) => {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const [fitCount, setFitCount] = useState(6);

  const measureRow = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    const isSmUp = window.matchMedia("(min-width: 640px)").matches;
    let n = countCardsThatFit(width, isSmUp);
    if (maxVisible != null) {
      n = Math.min(n, maxVisible);
    }
    setFitCount(n);
  }, [maxVisible]);

  useLayoutEffect(() => {
    measureRow();
    const mq = window.matchMedia("(min-width: 640px)");
    const onMq = () => measureRow();
    mq.addEventListener("change", onMq);

    const el = rowRef.current;
    if (!el) {
      return () => {
        mq.removeEventListener("change", onMq);
      };
    }
    const ro = new ResizeObserver(() => measureRow());
    ro.observe(el);

    return () => {
      ro.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, [measureRow, isLoading, items.length]);

  const validItems = useMemo(
    () => (items || []).filter(isValidDisplayItem),
    [items],
  );

  const visibleCount = Math.min(fitCount, validItems.length);

  const itemsToShow = useMemo(
    () => validItems.slice(0, visibleCount),
    [validItems, visibleCount],
  );

  const songsOnly = useMemo(
    () =>
      validItems.filter(
        (item): item is Song & { itemType: "song" } =>
          item.itemType === "song",
      ),
    [validItems],
  );

  if (isLoading) {
    const skeletonSlots = Math.max(1, Math.min(fitCount, 12));
    return (
      <div className={`mb-12 mt-12 ${className}`.trim()}>
        <div className="flex justify-between items-center mb-4">
          <div className="h-8 w-56 max-w-[70%] bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-4 w-16 bg-zinc-800/50 rounded animate-pulse" />
        </div>
        <div
          ref={rowRef}
          className="flex flex-nowrap gap-1 sm:gap-2 overflow-x-hidden"
        >
          {Array.from({ length: skeletonSlots }).map((_, i) => (
            <div
              key={i}
              className="w-36 sm:w-44 flex-shrink-0 p-2 space-y-3 animate-pulse"
            >
              <div className="aspect-square bg-zinc-800/50 rounded-md" />
              <div className="h-4 bg-zinc-800/50 rounded w-3/4" />
              <div className="h-3 bg-zinc-800/50 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return null;
  }

  if (validItems.length === 0) {
    return null;
  }

  const hasOverflow = validItems.length > visibleCount;

  let showAllState: { title: string; apiEndpoint?: string; items?: ListPagePrefetchItem[] } | null = null;
  if (hasOverflow) {
    if (listPageItems && listPageItems.length > 0) {
      showAllState = { title, items: listPageItems };
    } else if (apiEndpoint) {
      showAllState = { title, apiEndpoint };
    }
  }

  return (
    <div className={`mb-12 mt-12 ${className}`.trim()}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
        {showAllState && (
          <Link
            to="/list"
            state={showAllState}
            className="text-sm font-bold text-zinc-400 hover:underline"
          >
            {t("pages.profile.showAll")}
          </Link>
        )}
      </div>
      {noticeSlot}
      <div
        ref={rowRef}
        className="flex flex-nowrap gap-1 sm:gap-2 overflow-x-hidden"
      >
        {itemsToShow.map((item) => (
          <EntitySectionCard
            key={`${item.itemType}-${item._id}`}
            item={item}
            songsOnly={songsOnly}
          />
        ))}
      </div>
    </div>
  );
};

export default FixedRowEntitySection;
