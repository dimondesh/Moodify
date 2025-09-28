// frontend/src/components/ui/EntityTypeFilter.tsx

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ScrollArea } from "./scroll-area";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";

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

  const filters = [
    { key: "playlists", label: t("common.playlists") },
    { key: "albums", label: t("common.albums") },
    { key: "artists", label: t("common.artists") },
    ...(hasDownloaded
      ? [{ key: "downloaded", label: t("common.downloaded") }]
      : []),
  ];

  return (
    <ScrollArea className={cn("w-full", className)}>
      <div className="flex gap-1.5 min-w-max">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onFilterChange(currentFilter === key ? null : key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap rounded-full border",
              currentFilter === key
                ? "bg-white text-black border-white hover:bg-gray-100"
                : "bg-transparent text-white border-gray-600 hover:border-white hover:bg-white/10"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};

export default EntityTypeFilter;
