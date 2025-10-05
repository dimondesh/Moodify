// frontend/src/pages/LibraryPage/LibraryPage.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ScrollArea } from "../../components/ui/scroll-area";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { usePlaylistStore } from "../../stores/usePlaylistStore";
import { useMusicStore } from "../../stores/useMusicStore";
import LibraryGridSkeleton from "../../components/ui/skeletons/PlaylistSkeleton";
import {
  LibraryItem,
  AlbumItem,
  PlaylistItem,
  Artist,
  LikedSongsItem,
  FollowedArtistItem,
  MixItem,
  PersonalMixItem,
  GeneratedPlaylistItem,
  Album,
  Playlist,
  Mix,
  PersonalMix,
} from "../../types";
import { Button } from "@/components/ui/button";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../lib/firebase";
import { CreatePlaylistDialog } from "../PlaylistPage/CreatePlaylistDialog";
import { Plus, Grid3X3, List, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Download } from "lucide-react";
import { useOfflineStore } from "../../stores/useOfflineStore";
import { cn } from "@/lib/utils";
import { useUIStore } from "../../stores/useUIStore";
import EntityTypeFilter from "../../components/ui/EntityTypeFilter";

const LibraryPage = () => {
  const { t } = useTranslation();
  const {
    likedSongs,
    albums,
    playlists,
    followedArtists,
    savedMixes,
    savedPersonalMixes,
    isLoading: isLoadingLibrary,
    error: libraryError,
    generatedPlaylists,
  } = useLibraryStore();
  const {
    myPlaylists,
    isLoading: isLoadingPlaylists,
    error: playlistsError,
  } = usePlaylistStore();
  const {
    isCreatePlaylistDialogOpen,
    openCreatePlaylistDialog,
    closeAllDialogs,
    entityTypeFilter,
    setEntityTypeFilter,
    librarySearchQuery,
    setLibrarySearchQuery,
    libraryPageViewMode,
    setLibraryPageViewMode,
    isLibraryPageSearchOpen,
    setIsLibraryPageSearchOpen,
  } = useUIStore();

  const { artists } = useMusicStore();
  const [user] = useAuthState(auth);
  const { isDownloaded, fetchAllDownloaded } = useOfflineStore(
    (s) => s.actions
  );
  const isOffline = useOfflineStore((s) => s.isOffline);

  const [downloadedItems, setDownloadedItems] = useState<LibraryItem[]>([]);
  const librarySearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOffline) {
      setEntityTypeFilter("downloaded");
    }
  }, [isOffline, setEntityTypeFilter]);

  useEffect(() => {
    if (entityTypeFilter === "downloaded") {
      const loadDownloaded = async () => {
        const items = await fetchAllDownloaded();
        const downloadedLibraryItemsMap = new Map<string, LibraryItem>();

        items.forEach((item) => {
          // Определяем тип элемента по его свойствам
          if ((item as any).isGenerated) {
            // Генерированный плейлист
            downloadedLibraryItemsMap.set(item._id, {
              _id: item._id,
              type: "generated-playlist",
              title: t((item as any).nameKey, (item as any).title),
              imageUrl: item.imageUrl,
              createdAt: new Date(
                (item as any).addedAt || (item as any).generatedOn
              ),
              sourceName: "Moodify",
            } as GeneratedPlaylistItem);
          } else if ((item as any).owner) {
            // Обычный плейлист
            downloadedLibraryItemsMap.set(item._id, {
              _id: item._id,
              type: "playlist",
              title: (item as Playlist).title,
              imageUrl: (item as Playlist).imageUrl,
              createdAt: new Date((item as Playlist).updatedAt),
              owner: (item as Playlist).owner,
            } as PlaylistItem);
          } else if ((item as any).artist) {
            // Альбом
            downloadedLibraryItemsMap.set(item._id, {
              _id: item._id,
              type: "album",
              title: (item as Album).title,
              imageUrl: (item as Album).imageUrl,
              createdAt: new Date((item as Album).updatedAt),
              artist: (item as Album).artist,
              albumType: (item as Album).type,
            } as AlbumItem);
          } else if ((item as any).user) {
            // Персональный микс
            downloadedLibraryItemsMap.set(item._id, {
              _id: item._id,
              type: "personal-mix",
              title: (item as PersonalMix).name,
              imageUrl: (item as PersonalMix).imageUrl,
              createdAt: new Date((item as PersonalMix).generatedOn),
            } as PersonalMixItem);
          } else if ((item as any).sourceName) {
            // Обычный микс
            downloadedLibraryItemsMap.set(item._id, {
              _id: item._id,
              type: "mix",
              title: t((item as Mix).name),
              imageUrl: (item as Mix).imageUrl,
              createdAt: new Date((item as Mix).generatedOn),
              sourceName: (item as Mix).sourceName,
            } as MixItem);
          }
        });
        const sortedItems = Array.from(downloadedLibraryItemsMap.values()).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        setDownloadedItems(sortedItems);
      };
      loadDownloaded();
    }
  }, [entityTypeFilter, fetchAllDownloaded, t]);

  // Автофокус на строку поиска когда она открывается
  useEffect(() => {
    if (isLibraryPageSearchOpen && librarySearchInputRef.current) {
      // Небольшая задержка для корректного отображения элемента
      const timer = setTimeout(() => {
        librarySearchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLibraryPageSearchOpen]);

  const getArtistNames = useCallback(
    (artistsInput: (string | Artist)[] | undefined) => {
      if (!artistsInput || artistsInput.length === 0)
        return t("common.unknownArtist");
      const names = artistsInput
        .map((artistOrId) => {
          if (typeof artistOrId === "string") {
            const foundArtist = artists.find(
              (a: Artist) => a._id === artistOrId
            );
            return foundArtist ? foundArtist.name : null;
          } else {
            return artistOrId.name;
          }
        })
        .filter(Boolean);
      return names.join(", ") || t("common.unknownArtist");
    },
    [artists, t]
  );

  const isLoading = (isLoadingLibrary || isLoadingPlaylists) && !isOffline;
  const combinedError: string | null =
    (libraryError as string | null) || (playlistsError as string | null);
  const errorMessage = combinedError;

  const libraryItems = useMemo(() => {
    const libraryItemsMap = new Map<string, LibraryItem>();

    (albums || []).forEach((album) =>
      libraryItemsMap.set(album._id, {
        _id: album._id,
        type: "album",
        title: album.title,
        imageUrl: album.imageUrl,
        createdAt: new Date(album.addedAt ?? new Date()),
        artist: album.artist,
        albumType: album.type,
      } as AlbumItem)
    );

    [...(myPlaylists || []), ...(playlists || [])].forEach((playlist) => {
      if (!libraryItemsMap.has(playlist._id)) {
        const isGenerated = (playlist as any).isGenerated;
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
    });

    (generatedPlaylists || []).forEach((playlist) => {
      if (!libraryItemsMap.has(playlist._id)) {
        libraryItemsMap.set(playlist._id, {
          _id: playlist._id,
          type: "generated-playlist",
          title: t(playlist.nameKey),
          imageUrl: playlist.imageUrl,
          createdAt: new Date(playlist.addedAt || playlist.generatedOn),
          sourceName: "Moodify",
        } as GeneratedPlaylistItem);
      }
    });

    (savedMixes || []).forEach((mix) =>
      libraryItemsMap.set(mix._id, {
        _id: mix._id,
        type: "mix",
        title: t(mix.name),
        imageUrl: mix.imageUrl,
        createdAt: new Date(mix.addedAt ?? new Date()),
        sourceName: mix.sourceName,
      } as MixItem)
    );

    (savedPersonalMixes || []).forEach((personalMix) =>
      libraryItemsMap.set(personalMix._id, {
        _id: personalMix._id,
        type: "personal-mix",
        title: personalMix.name,
        imageUrl: personalMix.imageUrl,
        createdAt: new Date((personalMix as any).addedAt ?? new Date()),
      } as PersonalMixItem)
    );

    (followedArtists || []).forEach((artist) =>
      libraryItemsMap.set(artist._id, {
        _id: artist._id,
        type: "artist",
        title: artist.name,
        imageUrl: artist.imageUrl,
        createdAt: new Date(artist.addedAt || artist.createdAt),
        artistId: artist._id,
      } as FollowedArtistItem)
    );

    if (likedSongs.length > 0) {
      libraryItemsMap.set("liked-songs", {
        _id: "liked-songs",
        type: "liked-songs",
        title: t("sidebar.likedSongs"),
        imageUrl: "/liked.png",
        createdAt: new Date(
          likedSongs[0]?.addedAt || likedSongs[0]?.likedAt || Date.now()
        ),
        songsCount: likedSongs.length,
      });
    }

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
    likedSongs,
    t,
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
          filtered = downloadedItems;
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
    downloadedItems,
    entityTypeFilter,
    librarySearchQuery,
    getArtistNames,
  ]);

  if (isLoading && !entityTypeFilter) return <LibraryGridSkeleton />;

  if (errorMessage && !isOffline) {
    return (
      <div className="p-4 sm:p-6 bg-zinc-900 min-h-screen text-white">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
          {t("sidebar.library")}
        </h1>
        <p className="text-red-500 mt-4 text-center">
          Error loading library: {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Your Library</title>
        <meta
          name="description"
          content="Access your saved albums, playlists, followed artists, and liked songs all in one place on Moodify."
        />
      </Helmet>
      <div className="h-full">
        <ScrollArea className="h-full rounded-md">
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
                    className="hover:bg-[#2a2a2a] hidden md:flex"
                    onClick={openCreatePlaylistDialog}
                    title={t("sidebar.createPlaylist")}
                  >
                    <Plus className="size-6" />
                  </Button>
                )}
              </div>

              <div className="mb-6">
                <EntityTypeFilter
                  currentFilter={entityTypeFilter}
                  onFilterChange={(filter) =>
                    setEntityTypeFilter(filter as any)
                  }
                  hasDownloaded={!!user}
                  className="w-full"
                />
              </div>

              <div className="mb-6 space-y-4">
                {/* Search and toggle controls */}
                <div className="flex items-center gap-4">
                  {/* Search button and input container */}
                  <div className="flex-1">
                    <div
                      className="relative"
                      onClick={() =>
                        setIsLibraryPageSearchOpen(!isLibraryPageSearchOpen)
                      }
                    >
                      {/* Search button - always visible and clickable */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setIsLibraryPageSearchOpen(!isLibraryPageSearchOpen)
                        }
                        className={cn(
                          "text-gray-400 hover:text-white hover:bg-[#2a2a2a] h-12 w-12 p-0 transition-all duration-300 ease-in-out z-20",
                          isLibraryPageSearchOpen
                            ? "opacity-0 pointer-events-none"
                            : "opacity-100"
                        )}
                      >
                        <Search className="size-5" />
                      </Button>

                      {/* Search input - appears in place of button */}
                      <div
                        className={cn(
                          "absolute top-0 left-0 transition-all duration-300 ease-in-out overflow-hidden z-10",
                          isLibraryPageSearchOpen
                            ? "w-full opacity-100"
                            : "w-12 opacity-0"
                        )}
                      >
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                        <input
                          ref={librarySearchInputRef}
                          type="text"
                          placeholder={t("sidebar.searchLibrary")}
                          value={librarySearchQuery}
                          onChange={(e) =>
                            setLibrarySearchQuery(e.target.value)
                          }
                          onBlur={() => setIsLibraryPageSearchOpen(false)}
                          className="w-full bg-[#2a2a2a] rounded-md py-3 pl-12 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none transition duration-150 ease-in-out"
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
                      setLibraryPageViewMode(
                        libraryPageViewMode === "grid" ? "list" : "grid"
                      )
                    }
                    className="text-gray-400 hover:text-white hover:bg-[#2a2a2a] h-12 w-12 p-0 flex-shrink-0"
                  >
                    {libraryPageViewMode === "grid" ? (
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
                      : entityTypeFilter === "downloaded"
                      ? "You have no downloaded content yet."
                      : t("sidebar.emptyLibrary")}
                  </p>
                ) : libraryPageViewMode === "grid" ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {filteredLibraryItems.map((item) => {
                      let linkPath: string = "#";
                      let subtitle: string = "";
                      let coverImageUrl: string | null | undefined =
                        item.imageUrl;

                      switch (item.type) {
                        case "album": {
                          const albumItem = item as AlbumItem;
                          linkPath = `/albums/${albumItem._id}`;
                          subtitle = `${
                            t(`sidebar.subtitle.${albumItem.albumType}`) ||
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
                          coverImageUrl = item.imageUrl;
                          break;
                        }
                        case "artist": {
                          const artistItem = item as FollowedArtistItem;
                          linkPath = `/artists/${artistItem._id}`;
                          subtitle = t("sidebar.subtitle.artist");
                          break;
                        }
                        case "mix": {
                          const mixItem = item as MixItem;
                          linkPath = `/mixes/${mixItem._id}`;
                          subtitle = t("sidebar.subtitle.dailyMix");
                          coverImageUrl =
                            item.imageUrl ||
                            "https://moodify.b-cdn.net/default-album-cover.png";
                          break;
                        }
                        case "personal-mix": {
                          const personalMixItem = item as PersonalMixItem;
                          linkPath = `/personal-mixes/${personalMixItem._id}`;
                          subtitle = "Personal Mix";
                          coverImageUrl =
                            item.imageUrl ||
                            "https://moodify.b-cdn.net/default-album-cover.png";
                          break;
                        }
                      }

                      return (
                        <Link
                          key={`${item.type}-${item._id}`}
                          to={linkPath}
                          className="bg-transparent p-0 rounded-md hover:bg-[#2a2a2a]/50 transition-all group cursor-pointer flex flex-col items-center text-center hover-scale"
                        >
                          <div className="relative mb-2 w-full">
                            <div
                              className={cn(
                                "relative aspect-square w-full overflow-hidden shadow-lg",
                                item.type === "artist"
                                  ? "rounded-full"
                                  : "rounded-md"
                              )}
                            >
                              <img
                                src={
                                  coverImageUrl ||
                                  "https://moodify.b-cdn.net/default-album-cover.png"
                                }
                                alt={item.title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://moodify.b-cdn.net/default-album-cover.png";
                                }}
                              />
                            </div>
                          </div>
                          <div className="px-1 w-full">
                            <h3 className="font-semibold text-sm truncate text-white">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-1.5 justify-center">
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
                        case "personal-mix": {
                          const personalMixItem = item as PersonalMixItem;
                          linkPath = `/personal-mixes/${personalMixItem._id}`;
                          subtitle = "Personal Mix";
                          break;
                        }
                      }

                      return (
                        <Link
                          key={`${item.type}-${item._id}`}
                          to={linkPath}
                          className="bg-transparent p-3 rounded-md hover:bg-[#2a2a2a]/50 transition-all group cursor-pointer flex items-center gap-4 hover-scale"
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={item.imageUrl || fallbackImage}
                              alt={item.title}
                              className={`size-16 object-cover ${imageClass} transition-opacity group-hover:opacity-50`}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  fallbackImage;
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate text-white mb-1">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              {isDownloaded(item._id) && (
                                <Download className="size-4 text-[#8b5cf6] flex-shrink-0" />
                              )}
                              <p className="text-sm text-gray-400 truncate">
                                {subtitle}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
        <CreatePlaylistDialog
          isOpen={isCreatePlaylistDialogOpen}
          onClose={closeAllDialogs}
        />
      </div>
    </>
  );
};

export default LibraryPage;
