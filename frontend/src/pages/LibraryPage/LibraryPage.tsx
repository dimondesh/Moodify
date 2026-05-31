// frontend/src/pages/LibraryPage/LibraryPage.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Plus, Grid3X3, List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "../../stores/useAuthStore";
import { useUIStore } from "../../stores/useUIStore";
import { useQuickCreatePlaylist } from "@/hooks/useQuickCreatePlaylist";
import { useLibraryData } from "@/hooks/useLibraryData";
import { getLibraryItemDisplay } from "@/lib/libraryDisplay";
import EntityTypeFilter from "@/layout/EntityTypeFilter";
import LibraryPageSkeleton from "./LibraryPageSkeleton";
import { LibrarySearchBar } from "@/components/library/LibrarySearchBar";
import { LibraryItemRow } from "@/components/library/LibraryItemRow";
import { LibraryItemCard } from "@/components/library/LibraryItemCard";

const LibraryPage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const quickCreatePlaylist = useQuickCreatePlaylist();
  const {
    librarySearchQuery,
    setLibrarySearchQuery,
    libraryViewMode,
    setLibraryViewMode,
    isLibrarySearchOpen,
    setIsLibrarySearchOpen,
    entityTypeFilter,
    setEntityTypeFilter,
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

  if (isLoading && !entityTypeFilter) return <LibraryPageSkeleton />;

  if (errorMessage && !isOffline) {
    return (
      <div className="p-4 sm:p-6 bg-zinc-900 min-h-screen text-white">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
          {t("sidebar.library")}
        </h1>
        <p className="text-red-500 mt-4 text-center">{errorMessage}</p>
      </div>
    );
  }

  const displayContext = { t, artists, myPlaylists };

  return (
    <>
      <Helmet>
        <title>Your Library</title>
        <meta
          name="description"
          content="Access your saved albums, playlists, followed artists, and liked songs all in one place on Moodify Music."
        />
      </Helmet>
      <div className="h-full">
        <div className="relative min-h-screen p-4 sm:p-6 pb-40 sm:pb-50 lg:pb-10 ">
          <div
            className="absolute inset-0 bg-[#0f0f0f] pointer-events-none"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="flex justify-between items-baseline">
              <h1 className="hidden md:block text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-6 text-white">
                {t("sidebar.library")}
              </h1>
              {user && !isOffline && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-zinc-800/50 hidden md:flex"
                  onClick={() => void quickCreatePlaylist()}
                  title={t("sidebar.createPlaylist")}
                >
                  <Plus className="size-6" />
                </Button>
              )}
            </div>

            <div className="mb-6">
              <EntityTypeFilter
                currentFilter={entityTypeFilter}
                onFilterChange={(filter) => setEntityTypeFilter(filter as any)}
                hasDownloaded={hasDownloadedItems}
                className="w-full"
              />
            </div>

            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-4 max-w-screen">
                <LibrarySearchBar
                  variant="page"
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
                      libraryViewMode === "grid" ? "list" : "grid",
                    )
                  }
                  className="text-gray-400 hover:text-white hover:bg-zinc-800/50 h-12 w-12 p-0 flex-shrink-0"
                >
                  {libraryViewMode === "grid" ? (
                    <List className="w-5 h-5" />
                  ) : (
                    <Grid3X3 className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {filteredLibraryItems.length === 0 ? (
                <p className="text-gray-400 px-2">
                  {librarySearchQuery.trim()
                    ? t("sidebar.noSearchResults")
                    : t("sidebar.emptyLibrary")}
                </p>
              ) : libraryViewMode === "grid" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredLibraryItems.map((item) => (
                    <LibraryItemCard
                      key={`${item.type}-${item._id}`}
                      item={item}
                      display={getLibraryItemDisplay(item, displayContext)}
                      isDownloaded={isDownloaded(item._id)}
                      variant="page"
                    />
                  ))}
                </div>
              ) : (
                <div>
                  {filteredLibraryItems.map((item) => (
                    <LibraryItemRow
                      key={`${item.type}-${item._id}`}
                      item={item}
                      display={getLibraryItemDisplay(item, displayContext)}
                      isDownloaded={isDownloaded(item._id)}
                      variant="page"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LibraryPage;
