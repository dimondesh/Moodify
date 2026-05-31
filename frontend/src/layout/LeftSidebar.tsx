//frontend/src/layout/LeftSidebar.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Library,
  Plus,
  LibraryIcon,
  Grid3X3,
  List,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import PlaylistSkeleton from "../components/ui/skeletons/PlaylistSkeleton";
import React from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { useUIStore } from "../stores/useUIStore";
import { useTranslation } from "react-i18next";
import { useQuickCreatePlaylist } from "@/hooks/useQuickCreatePlaylist";
import { useLibraryData } from "@/hooks/useLibraryData";
import { getLibraryItemDisplay } from "@/lib/libraryDisplay";
import EntityTypeFilter from "@/layout/EntityTypeFilter";
import { LibrarySearchBar } from "@/components/library/LibrarySearchBar";
import { LibraryItemRow } from "@/components/library/LibraryItemRow";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";

const LeftSidebar = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const quickCreatePlaylist = useQuickCreatePlaylist();
  const {
    entityTypeFilter,
    setEntityTypeFilter,
    librarySearchQuery,
    setLibrarySearchQuery,
    libraryViewMode,
    setLibraryViewMode,
    isLibrarySearchOpen,
    setIsLibrarySearchOpen,
  } = useUIStore();

  const {
    filteredLibraryItems,
    myPlaylists,
    artists,
    isDownloaded,
    isLoading,
    errorMessage,
    hasDownloadedItems,
    isOffline,
  } = useLibraryData();

  const GridSkeleton = React.memo(() => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-1">
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          className="px-0 py-1 flex flex-col items-center space-y-2"
        >
          <div className="w-full h-20 bg-zinc-800 rounded-md animate-pulse" />
          <div className="w-full flex flex-col items-center space-y-1.5">
            <div className="h-3 w-3/4 bg-zinc-800 rounded-full animate-pulse" />
            <div className="h-2 w-1/2 bg-zinc-800/80 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  ));
  GridSkeleton.displayName = "GridSkeleton";

  const displayContext = { t, artists, myPlaylists };
  const showLoading = !user
    ? authLoading && !isOffline
    : isLoading;

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#0f0f0f]">
      {user && (
        <div className="p-4 flex justify-between items-center border-b border-[#2a2a2a]">
          <div className="flex items-center text-gray-300">
            <Library className="size-4 mr-3" />
            <span className="text-sm font-semibold">{t("sidebar.library")}</span>
          </div>
          {!isOffline && (
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-transparent! text-gray-300 hover:text-white! h-6 w-6"
              onClick={() => void quickCreatePlaylist()}
              title={t("sidebar.createPlaylist")}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>
      )}
      <div className={cn("flex-1 min-h-0 flex flex-col px-1", user && "mt-4")}>
        {user && (
          <div className="mb-3 shrink-0">
            <EntityTypeFilter
              currentFilter={entityTypeFilter}
              onFilterChange={(filter) => setEntityTypeFilter(filter as any)}
              hasDownloaded={hasDownloadedItems}
              className="w-full"
            />
          </div>
        )}

        {user && (
          <div className="mb-3 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <LibrarySearchBar
                variant="sidebar"
                isOpen={isLibrarySearchOpen}
                onOpenChange={setIsLibrarySearchOpen}
                query={librarySearchQuery}
                onQueryChange={setLibrarySearchQuery}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLibraryViewMode(
                    libraryViewMode === "list" ? "grid" : "list",
                  )
                }
                className="text-gray-400 hover:text-white mt-0.5 hover:bg-transparent! h-8 w-8 p-0 flex-shrink-0"
              >
                {libraryViewMode === "list" ? (
                  <Grid3X3 className="w-4 h-4" />
                ) : (
                  <List className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {showLoading ? (
          libraryViewMode === "grid" ? (
            <GridSkeleton />
          ) : (
            <PlaylistSkeleton />
          )
        ) : !user ? (
          <LoginPrompt />
        ) : errorMessage && !isOffline ? (
          <p className="text-red-500 px-2 text-sm text-center">{errorMessage}</p>
        ) : filteredLibraryItems.length === 0 ? (
          <p className="text-zinc-400 px-2">
            {librarySearchQuery.trim()
              ? t("sidebar.noSearchResults")
              : t("sidebar.emptyLibrary")}
          </p>
        ) : (
          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto hide-scrollbar",
              libraryViewMode === "list" ? "pb-7" : "pb-26",
            )}
          >
            {libraryViewMode === "list" ? (
              <div>
                {filteredLibraryItems.map((item) => (
                  <LibraryItemRow
                    key={`${item.type}-${item._id}`}
                    item={item}
                    display={getLibraryItemDisplay(item, displayContext)}
                    isDownloaded={isDownloaded(item._id)}
                    variant="sidebar"
                    showPlayButton
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(80px,1fr))]">
                {filteredLibraryItems.map((item) => (
                  <LibraryItemCard
                    key={`${item.type}-${item._id}`}
                    item={item}
                    display={getLibraryItemDisplay(item, displayContext)}
                    isDownloaded={isDownloaded(item._id)}
                    variant="sidebar"
                    showPlayButton
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftSidebar;

const LoginPrompt = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
      <div className="relative">
        <div className="relative bg-zinc-900 rounded-full p-4">
          <LibraryIcon className="size-8 text-[#8b5cf6]" />
        </div>
      </div>

      <div className="space-y-2 max-w-[250px]">
        <h3 className="text-lg font-semibold text-white">
          {t("sidebar.loginPromptTitle")}
        </h3>
        <p className="text-sm text-zinc-400">
          {t("sidebar.loginPromptDescription")}
        </p>
      </div>
    </div>
  );
};
