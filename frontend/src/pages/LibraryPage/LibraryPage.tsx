// frontend/src/pages/LibraryPage/LibraryPage.tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from "react";
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
  GeneratedPlaylistItem,
  Album,
  Playlist,
  Mix,
} from "../../types";
import { Button } from "@/components/ui/button";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../lib/firebase";
import { CreatePlaylistDialog } from "../PlaylistPage/CreatePlaylistDialog";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { Download } from "lucide-react";
import { useOfflineStore } from "../../stores/useOfflineStore";
import { cn } from "@/lib/utils";
import { useUIStore } from "../../stores/useUIStore";

const LibraryPage = () => {
  const { t } = useTranslation();
  const {
    likedSongs,
    albums,
    playlists,
    followedArtists,
    savedMixes,
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
    libraryFilter,
    setLibraryFilter,
  } = useUIStore();

  const { artists } = useMusicStore();
  const [user] = useAuthState(auth);
  const { isDownloaded, fetchAllDownloaded } = useOfflineStore(
    (s) => s.actions
  );
  const isOffline = useOfflineStore((s) => s.isOffline);

  const [downloadedItems, setDownloadedItems] = useState<LibraryItem[]>([]);

  useEffect(() => {
    if (isOffline) {
      setLibraryFilter("downloaded");
    }
  }, [isOffline, setLibraryFilter]);

  useEffect(() => {
    if (libraryFilter === "downloaded") {
      const loadDownloaded = async () => {
        const items = await fetchAllDownloaded();
        const downloadedLibraryItemsMap = new Map<string, LibraryItem>();

        items.forEach((item) => {
          if ("songsData" in item && "title" in item) {
            const isGenerated = (item as any).isGenerated;
            if (isGenerated) {
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
              downloadedLibraryItemsMap.set(item._id, {
                _id: item._id,
                type: "playlist",
                title: (item as Playlist).title,
                imageUrl: (item as Playlist).imageUrl,
                createdAt: new Date((item as Playlist).updatedAt),
                owner: (item as Playlist).owner,
              } as PlaylistItem);
            } else if ((item as any).artist) {
              downloadedLibraryItemsMap.set(item._id, {
                _id: item._id,
                type: "album",
                title: (item as Album).title,
                imageUrl: (item as Album).imageUrl,
                createdAt: new Date((item as Album).updatedAt),
                artist: (item as Album).artist,
                albumType: (item as Album).type,
              } as AlbumItem);
            }
          } else if ("sourceName" in item) {
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
  }, [libraryFilter, fetchAllDownloaded, t]);

  const getArtistNames = (artistsInput: (string | Artist)[] | undefined) => {
    if (!artistsInput || artistsInput.length === 0)
      return t("common.unknownArtist");
    const names = artistsInput
      .map((artistOrId) => {
        if (typeof artistOrId === "string") {
          const foundArtist = artists.find((a: Artist) => a._id === artistOrId);
          return foundArtist ? foundArtist.name : null;
        } else {
          return artistOrId.name;
        }
      })
      .filter(Boolean);
    return names.join(", ") || t("common.unknownArtist");
  };

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
        createdAt: new Date(likedSongs[0]?.likedAt || Date.now()),
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
    if (libraryFilter === "downloaded") {
      return downloadedItems;
    }
    return libraryItems;
  }, [libraryItems, libraryFilter, downloadedItems]);

  if (isLoading && libraryFilter !== "downloaded")
    return <LibraryGridSkeleton />;

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
              className="absolute inset-0 bg-gradient-to-b from-[#8b5cf6]/10 via-[#0f0f0f]/80 to-[#0f0f0f] pointer-events-none"
              aria-hidden="true"
            />
            <div className="relative z-10">
              <div className="flex justify-between items-baseline">
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-6 text-white">
                  {t("sidebar.library")}
                </h1>
                {user && !isOffline && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-[#2a2a2a] "
                    onClick={openCreatePlaylistDialog}
                    title={t("sidebar.createPlaylist")}
                  >
                    <Plus className="size-6" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-6">
                {!isOffline && (
                  <Button
                    onClick={() => setLibraryFilter("all")}
                    className={cn(
                      "rounded-full h-8 px-4 text-xs font-semibold",
                      libraryFilter === "all"
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]"
                    )}
                  >
                    All
                  </Button>
                )}
                <Button
                  onClick={() => setLibraryFilter("downloaded")}
                  className={cn(
                    "rounded-full h-8 px-4 text-xs font-semibold",
                    libraryFilter === "downloaded"
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]"
                  )}
                >
                  Downloaded
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                {filteredLibraryItems.length === 0 ? (
                  <p className="text-gray-400 px-2">
                    {libraryFilter === "downloaded"
                      ? "You have no downloaded content yet."
                      : t("sidebar.emptyLibrary")}
                  </p>
                ) : (
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
