//frontend/src/layout/LeftSidebar.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Heart,
  HomeIcon,
  Library,
  MessageCircle,
  Search,
  Plus,
  LibraryIcon,
  Grid3X3,
  List,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { Button, buttonVariants } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import PlaylistSkeleton from "../components/ui/skeletons/PlaylistSkeleton";
import { useMemo, useEffect, useRef, useCallback } from "react";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../lib/firebase";
import { CreatePlaylistDialog } from "../pages/PlaylistPage/CreatePlaylistDialog";
import {
  LibraryItem,
  AlbumItem,
  PlaylistItem,
  Artist,
  LikedSongsItem,
  FollowedArtistItem,
  MixItem,
  GeneratedPlaylistItem,
} from "../types";
import { useMusicStore } from "../stores/useMusicStore";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { useOfflineStore } from "../stores/useOfflineStore";
import { useChatStore } from "../stores/useChatStore";
import { useUIStore } from "../stores/useUIStore";
import { getOptimizedImageUrl } from "@/lib/utils";
import UniversalPlayButton from "../components/ui/UniversalPlayButton";
import EntityTypeFilter from "../components/ui/EntityTypeFilter";

const LeftSidebar = () => {
  const { t } = useTranslation();
  const {
    albums,
    playlists,
    savedMixes,
    followedArtists,
    isLoading: isLoadingLibrary,
    generatedPlaylists,
  } = useLibraryStore();

  const {
    myPlaylists,
    isLoading: isLoadingPlaylists,
    fetchMyPlaylists,
  } = usePlaylistStore();
  const { unreadMessages } = useChatStore();
  const totalUnread = Array.from(unreadMessages.values()).reduce(
    (acc, count) => acc + count,
    0
  );

  const [user, loadingUser] = useAuthState(auth);
  const { isOffline } = useOfflineStore();
  const { isDownloaded } = useOfflineStore((s) => s.actions);
  const {
    isCreatePlaylistDialogOpen,
    openCreatePlaylistDialog,
    closeAllDialogs,
    entityTypeFilter,
    setEntityTypeFilter,
    librarySearchQuery,
    setLibrarySearchQuery,
    leftSidebarViewMode,
    setLeftSidebarViewMode,
    isLeftSidebarSearchOpen,
    setIsLeftSidebarSearchOpen,
  } = useUIStore();

  const { artists } = useMusicStore();
  const playlistsFetchedRef = useRef(false);
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);

  // Fetch playlists when library data is loaded and user is authenticated
  useEffect(() => {
    if (
      user &&
      !isLoadingLibrary &&
      !isOffline &&
      !playlistsFetchedRef.current
    ) {
      playlistsFetchedRef.current = true;
      fetchMyPlaylists();
    }
  }, [user, isLoadingLibrary, isOffline, fetchMyPlaylists]);

  // Reset the ref when user changes
  useEffect(() => {
    playlistsFetchedRef.current = false;
  }, [user]);

  // Автофокус на строку поиска когда она открывается
  useEffect(() => {
    if (isLeftSidebarSearchOpen && sidebarSearchInputRef.current) {
      // Небольшая задержка для корректного отображения элемента
      const timer = setTimeout(() => {
        sidebarSearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLeftSidebarSearchOpen]);

  const getArtistNames = useCallback(
    (artistsData: string[] | Artist[] | undefined) => {
      if (!artistsData || artistsData.length === 0)
        return t("common.unknownArtist");

      const names = artistsData
        .map((item) => {
          if (typeof item === "string") {
            const artist = artists.find((a) => a._id === item);
            return artist ? artist.name : null;
          } else if (item && typeof item === "object" && "name" in item) {
            return (item as Artist).name;
          }
          return null;
        })
        .filter(Boolean);

      return names.join(", ") || t("common.unknownArtist");
    },
    [artists, t]
  );

  const isLoading =
    (isLoadingLibrary || isLoadingPlaylists || loadingUser) && !isOffline;

  const libraryItems = useMemo(() => {
    const libraryItemsMap = new Map<string, LibraryItem>();

    // Helper function to check if item should be included based on offline state
    const shouldIncludeItem = (
      itemId: string,
      itemType: "album" | "playlist" | "generated-playlist" | "mix" | "artist"
    ) => {
      if (!isOffline) return true; // Include all items when online

      // When offline, only include downloaded items
      if (itemType === "generated-playlist") {
        return isDownloaded(itemId); // Generated playlists are stored as "playlist" type in offline store
      }
      return isDownloaded(itemId);
    };

    (albums || []).forEach((album) => {
      if (shouldIncludeItem(album._id, "album")) {
        libraryItemsMap.set(album._id, {
          _id: album._id,
          type: "album",
          title: album.title,
          imageUrl: album.imageUrl,
          createdAt: new Date(album.addedAt ?? new Date()),
          artist: album.artist,
          albumType: album.type,
        } as AlbumItem);
      }
    });

    [...(myPlaylists || []), ...(playlists || [])].forEach((playlist) => {
      if (!libraryItemsMap.has(playlist._id)) {
        const isGenerated = (playlist as any).isGenerated;
        const itemType = isGenerated ? "generated-playlist" : "playlist";

        if (shouldIncludeItem(playlist._id, itemType)) {
          libraryItemsMap.set(playlist._id, {
            _id: playlist._id,
            type: isGenerated ? "generated-playlist" : "playlist",
            title: isGenerated ? t((playlist as any).nameKey) : playlist.title,
            imageUrl: playlist.imageUrl,
            createdAt: new Date(
              (playlist as any).addedAt || playlist.updatedAt || new Date()
            ),
            owner: playlist.owner,
            isGenerated: isGenerated,
          } as PlaylistItem);
        }
      }
    });

    (generatedPlaylists || []).forEach((playlist) => {
      if (!libraryItemsMap.has(playlist._id)) {
        if (shouldIncludeItem(playlist._id, "generated-playlist")) {
          libraryItemsMap.set(playlist._id, {
            _id: playlist._id,
            type: "generated-playlist",
            title: t(playlist.nameKey),
            imageUrl: playlist.imageUrl,
            createdAt: new Date(playlist.addedAt || playlist.generatedOn),
            sourceName: "Moodify",
          } as GeneratedPlaylistItem);
        }
      }
    });

    (savedMixes || []).forEach((mix) => {
      if (shouldIncludeItem(mix._id, "mix")) {
        libraryItemsMap.set(mix._id, {
          _id: mix._id,
          type: "mix",
          title: t(mix.name),
          imageUrl: mix.imageUrl,
          createdAt: new Date(mix.addedAt ?? new Date()),
          sourceName: mix.sourceName,
        } as MixItem);
      }
    });

    (followedArtists || []).forEach((artist) => {
      if (shouldIncludeItem(artist._id, "artist")) {
        libraryItemsMap.set(artist._id, {
          _id: artist._id,
          type: "artist",
          title: artist.name,
          imageUrl: artist.imageUrl,
          createdAt: new Date(artist.addedAt || artist.createdAt),
          artistId: artist._id,
        } as FollowedArtistItem);
      }
    });

    return Array.from(libraryItemsMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }, [
    albums,
    myPlaylists,
    playlists,
    generatedPlaylists,
    savedMixes,
    followedArtists,
    t,
    isOffline,
    isDownloaded,
  ]);

  const filteredLibraryItems = useMemo(() => {
    let filtered = libraryItems;

    // Apply entity type filter first
    if (entityTypeFilter) {
      switch (entityTypeFilter) {
        case "playlists":
          filtered = filtered.filter(
            (item) =>
              item.type === "playlist" || item.type === "generated-playlist"
          );
          break;
        case "albums":
          filtered = filtered.filter((item) => item.type === "album");
          break;
        case "artists":
          filtered = filtered.filter((item) => item.type === "artist");
          break;
        case "downloaded":
          filtered = filtered.filter((item) => isDownloaded(item._id));
          break;
        default:
          break;
      }
    }

    // Apply search query filter to already filtered items
    if (librarySearchQuery.trim()) {
      const query = librarySearchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const title = item.title.toLowerCase();
        const subtitle = getArtistNames(
          item.type === "album" ? (item as AlbumItem).artist : undefined
        ).toLowerCase();

        return title.includes(query) || subtitle.includes(query);
      });
    }

    return filtered;
  }, [
    libraryItems,
    entityTypeFilter,
    librarySearchQuery,
    isDownloaded,
    getArtistNames,
  ]);

  return (
    <div className="h-full flex flex-col bg-[#0f0f0f]">
      <div className="p-4">
        <div className="space-y-1">
          <Link
            to="/"
            className={cn(
              buttonVariants({
                variant: "ghost",
                className:
                  "w-full justify-start text-gray-300 hover:text-white hover:bg-[#2a2a2a] h-8 px-0",
              })
            )}
          >
            <div className="flex items-center px-2 w-full">
              <HomeIcon className="mr-3 size-4" />
              <span className="text-sm font-medium">{t("sidebar.home")}</span>
            </div>
          </Link>

          <Link
            to="/search"
            className={cn(
              buttonVariants({
                variant: "ghost",
                className:
                  "w-full justify-start text-gray-300 hover:text-white hover:bg-[#2a2a2a] h-8 px-0",
              })
            )}
          >
            <div className="flex items-center px-2 w-full">
              <Search className="mr-3 size-4" />
              <span className="text-sm font-medium">{t("sidebar.search")}</span>
            </div>
          </Link>

          {user && (
            <Link
              to="/chat"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className:
                    "w-full justify-start text-gray-300 hover:text-white hover:bg-[#2a2a2a] h-8 px-0 relative",
                })
              )}
            >
              <div className="flex items-center px-2 w-full">
                <MessageCircle className="mr-3 size-4" />
                <span className="text-sm font-medium">
                  {t("sidebar.messages")}
                </span>
              </div>
              {totalUnread > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#8b5cf6] text-white text-xs rounded-full h-4 px-1.5 flex items-center justify-center font-semibold">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </Link>
          )}

          {user && (
            <Link
              to="/liked-songs"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className:
                    "w-full justify-start text-gray-300 hover:text-white hover:bg-[#2a2a2a] h-8 px-0",
                })
              )}
            >
              <div className="flex items-center px-2 w-full">
                <Heart className="mr-3 size-4" />
                <span className="text-sm font-medium">
                  {t("sidebar.likedSongs")}
                </span>
              </div>
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-gray-300 px-2">
            <Library className="size-4 mr-3" />
            <span className="text-sm font-semibold">
              {t("sidebar.library")}
            </span>
          </div>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-[#2a2a2a] h-6 w-6"
              onClick={openCreatePlaylistDialog}
              title={t("sidebar.createPlaylist")}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>

        {user && (
          <div className="mb-3">
            <EntityTypeFilter
              currentFilter={entityTypeFilter}
              onFilterChange={(filter) => setEntityTypeFilter(filter as any)}
              hasDownloaded={libraryItems.some((item) =>
                isDownloaded(item._id)
              )}
              className="w-full"
            />
          </div>
        )}

        {user && (
          <div className="mb-3 space-y-2">
            {/* Search and toggle controls */}
            <div className="flex items-center gap-2">
              {/* Search button and input container */}
              <div className="flex-1">
                <div
                  className="relative"
                  onClick={() =>
                    setIsLeftSidebarSearchOpen(!isLeftSidebarSearchOpen)
                  }
                >
                  {/* Search button - always visible and clickable */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setIsLeftSidebarSearchOpen(!isLeftSidebarSearchOpen)
                    }
                    className={cn(
                      "text-gray-400 hover:text-white hover:bg-[#2a2a2a] mt-0.5 h-8 w-8 p-0 transition-all duration-300 ease-in-out z-20",
                      isLeftSidebarSearchOpen
                        ? "opacity-0 pointer-events-none"
                        : "opacity-100"
                    )}
                  >
                    <Search className="w-4 h-4" />
                  </Button>

                  {/* Search input - appears in place of button */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 transition-all duration-300 ease-in-out overflow-hidden z-10",
                      isLeftSidebarSearchOpen
                        ? "w-full opacity-100"
                        : "w-8 opacity-0"
                    )}
                  >
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    <input
                      ref={sidebarSearchInputRef}
                      type="text"
                      placeholder={t("sidebar.searchLibrary")}
                      value={librarySearchQuery}
                      onChange={(e) => setLibrarySearchQuery(e.target.value)}
                      onBlur={() => setIsLeftSidebarSearchOpen(false)}
                      className="w-full bg-[#2a2a2a] rounded-md py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-400 focus:outline-none transition duration-150 ease-in-out cursor-pointer"
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              {/* Single toggle button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLeftSidebarViewMode(
                    leftSidebarViewMode === "list" ? "grid" : "list"
                  )
                }
                className="text-gray-400 hover:text-white mt-0.5 hover:bg-[#2a2a2a] h-8 w-8 p-0 flex-shrink-0"
              >
                {leftSidebarViewMode === "list" ? (
                  <Grid3X3 className="w-4 h-4" />
                ) : (
                  <List className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <PlaylistSkeleton />
        ) : !user ? (
          <LoginPrompt className="flex-1" />
        ) : filteredLibraryItems.length === 0 ? (
          <p className="text-zinc-400 px-2">
            {librarySearchQuery.trim()
              ? t("sidebar.noSearchResults")
              : t("sidebar.emptyLibrary")}
          </p>
        ) : (
          <ScrollArea className="flex-1 h-full pb-7">
            {leftSidebarViewMode === "list" ? (
              <div className="space-y-2">
                {filteredLibraryItems.map((item) => {
                  let linkPath: string = "#";
                  let subtitle: string = "";
                  let fallbackImage: string =
                    "https://moodify.b-cdn.net/default-album-cover.png";
                  let imageClass = "rounded-md";

                  switch (item.type) {
                    case "album": {
                      const albumItem = item as AlbumItem;
                      linkPath = `/albums/${albumItem._id}`;
                      subtitle = `${
                        t(`pages.album.${albumItem.albumType}`) ||
                        t("sidebar.subtitle.album")
                      } • ${getArtistNames(albumItem.artist)}`;
                      break;
                    }
                    case "playlist": {
                      const playlistItem = item as PlaylistItem;
                      linkPath = `/playlists/${playlistItem._id}`;
                      subtitle = `${t("sidebar.subtitle.playlist")} • ${
                        playlistItem.owner?.fullName ||
                        t("common.unknownArtist")
                      }`;
                      break;
                    }
                    case "generated-playlist": {
                      linkPath = `/generated-playlists/${item._id}`;
                      subtitle = t("sidebar.subtitle.playlist");
                      break;
                    }
                    case "liked-songs": {
                      const likedItem = item as LikedSongsItem;
                      linkPath = "/liked-songs";
                      subtitle = `${t("sidebar.subtitle.playlist")} • ${
                        likedItem.songsCount
                      } ${
                        likedItem.songsCount !== 1
                          ? t("sidebar.subtitle.songs")
                          : t("sidebar.subtitle.song")
                      }`;
                      fallbackImage = "/liked.png";
                      break;
                    }
                    case "artist": {
                      const artistItem = item as FollowedArtistItem;
                      linkPath = `/artists/${artistItem._id}`;
                      subtitle = t("sidebar.subtitle.artist");
                      imageClass = "rounded-full";
                      break;
                    }
                    case "mix": {
                      const mixItem = item as MixItem;
                      linkPath = `/mixes/${mixItem._id}`;
                      subtitle = t("sidebar.subtitle.dailyMix");
                      break;
                    }
                    default:
                      break;
                  }

                  return (
                    <Link
                      to={linkPath}
                      key={`${item.type}-${item._id}`}
                      className="p-2 hover:bg-[#2a2a2a] rounded-md flex items-center gap-3 cursor-pointer hover-scale relative"
                    >
                      <div className="relative flex-shrink-0 group">
                        <img
                          src={getOptimizedImageUrl(
                            item.imageUrl || fallbackImage,
                            100
                          )}
                          alt={item.title}
                          className={`size-10 object-cover ${imageClass} transition-opacity group-hover:opacity-50`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackImage;
                          }}
                        />
                        <UniversalPlayButton
                          entity={item}
                          entityType={
                            item.type as
                              | "album"
                              | "playlist"
                              | "generated-playlist"
                              | "mix"
                              | "artist"
                          }
                          variant="overlay"
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                          size="sm"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white text-sm">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {isDownloaded(item._id) && (
                            <Download className="size-3 text-[#8b5cf6] flex-shrink-0" />
                          )}
                          <p className="text-xs text-gray-400 truncate">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-1">
                {filteredLibraryItems.map((item) => {
                  let linkPath: string = "#";
                  let subtitle: string = "";
                  let fallbackImage: string =
                    "https://moodify.b-cdn.net/default-album-cover.png";
                  let imageClass = "rounded-md";

                  switch (item.type) {
                    case "album": {
                      const albumItem = item as AlbumItem;
                      linkPath = `/albums/${albumItem._id}`;
                      subtitle = `${
                        t(`pages.album.${albumItem.albumType}`) ||
                        t("sidebar.subtitle.album")
                      } • ${getArtistNames(albumItem.artist)}`;
                      break;
                    }
                    case "playlist": {
                      const playlistItem = item as PlaylistItem;
                      linkPath = `/playlists/${playlistItem._id}`;
                      subtitle = `${t("sidebar.subtitle.playlist")} • ${
                        playlistItem.owner?.fullName ||
                        t("common.unknownArtist")
                      }`;
                      break;
                    }
                    case "generated-playlist": {
                      linkPath = `/generated-playlists/${item._id}`;
                      subtitle = t("sidebar.subtitle.playlist");
                      break;
                    }
                    case "liked-songs": {
                      const likedItem = item as LikedSongsItem;
                      linkPath = "/liked-songs";
                      subtitle = `${t("sidebar.subtitle.playlist")} • ${
                        likedItem.songsCount
                      } ${
                        likedItem.songsCount !== 1
                          ? t("sidebar.subtitle.songs")
                          : t("sidebar.subtitle.song")
                      }`;
                      fallbackImage = "/liked.png";
                      break;
                    }
                    case "artist": {
                      const artistItem = item as FollowedArtistItem;
                      linkPath = `/artists/${artistItem._id}`;
                      subtitle = t("sidebar.subtitle.artist");
                      imageClass = "rounded-full";
                      break;
                    }
                    case "mix": {
                      const mixItem = item as MixItem;
                      linkPath = `/mixes/${mixItem._id}`;
                      subtitle = t("sidebar.subtitle.dailyMix");
                      break;
                    }
                    default:
                      break;
                  }

                  return (
                    <Link
                      to={linkPath}
                      key={`${item.type}-${item._id}`}
                      className="p-1 hover:bg-[#2a2a2a] rounded-md flex flex-col items-center text-center cursor-pointer hover-scale relative"
                    >
                      <div className="relative flex-shrink-0 group mb-0.5">
                        <img
                          src={getOptimizedImageUrl(
                            item.imageUrl || fallbackImage,
                            100
                          )}
                          alt={item.title}
                          className={`size-16 object-cover ${imageClass} transition-opacity group-hover:opacity-50`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = fallbackImage;
                          }}
                        />
                        <UniversalPlayButton
                          entity={item}
                          entityType={
                            item.type as
                              | "album"
                              | "playlist"
                              | "generated-playlist"
                              | "mix"
                              | "artist"
                          }
                          variant="overlay"
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                          size="sm"
                        />
                      </div>
                      <div className="w-full">
                        <p className="font-medium truncate text-white text-xs mb-0">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-0.5 justify-center">
                          {isDownloaded(item._id) && (
                            <Download className="size-2 text-[#8b5cf6] flex-shrink-0" />
                          )}
                          <p className="text-xs text-gray-400 truncate">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </div>

      <CreatePlaylistDialog
        isOpen={isCreatePlaylistDialogOpen}
        onClose={closeAllDialogs}
        onSuccess={fetchMyPlaylists}
      />
    </div>
  );
};

export default LeftSidebar;

const LoginPrompt = ({ className }: { className?: string }) => {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center space-y-4",
        className
      )}
    >
      <div className="relative">
        <div
          className="absolute -inset-1 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] rounded-full blur-lg
         opacity-75 animate-pulse"
          aria-hidden="true"
        />
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
