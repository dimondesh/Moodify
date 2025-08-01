// /home/dmytro/VS_Projects/Moodify/frontend/src/layout/LeftSidebar.tsx

import {
  Heart,
  HomeIcon,
  Library,
  MessageCircle,
  Search,
  Plus,
  LibraryIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { Button, buttonVariants } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import PlaylistSkeleton from "../components/ui/skeletons/PlaylistSkeleton";
import { useEffect, useState } from "react";
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
} from "../types";
import { useMusicStore } from "../stores/useMusicStore";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { useOfflineStore } from "../stores/useOfflineStore";

const LeftSidebar = () => {
  const { t } = useTranslation();
  const {
    albums,
    playlists,
    savedMixes,
    followedArtists,
    fetchLibrary,
    isLoading: isLoadingLibrary,
  } = useLibraryStore();

  const {
    myPlaylists,
    fetchMyPlaylists,
    isLoading: isLoadingPlaylists,
  } = usePlaylistStore();

  const [user, loadingUser] = useAuthState(auth);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { isDownloaded } = useOfflineStore((s) => s.actions);

  const { artists, fetchArtists } = useMusicStore();

  useEffect(() => {
    if (user && !loadingUser) {
      fetchLibrary();
      fetchMyPlaylists();
    }
    fetchArtists();
  }, [fetchLibrary, fetchMyPlaylists, user, loadingUser, fetchArtists]);

  const getArtistNames = (artistsData: string[] | Artist[] | undefined) => {
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
  };

  const isLoading = isLoadingLibrary || isLoadingPlaylists || loadingUser;

  const allPlaylistsMap = new Map<string, PlaylistItem>();

  (myPlaylists || []).forEach((playlist) => {
    allPlaylistsMap.set(playlist._id, {
      _id: playlist._id,
      type: "playlist" as const,
      title: playlist.title,
      imageUrl: playlist.imageUrl,
      createdAt: new Date(playlist.updatedAt ?? new Date()),
      owner: playlist.owner,
    });
  });

  (playlists || []).forEach((playlist) => {
    if (!allPlaylistsMap.has(playlist._id)) {
      allPlaylistsMap.set(playlist._id, {
        _id: playlist._id,
        type: "playlist" as const,
        title: playlist.title,
        imageUrl: playlist.imageUrl,
        createdAt: new Date(playlist.addedAt ?? new Date()),
        owner: playlist.owner,
      });
    }
  });

  const uniquePlaylists = Array.from(allPlaylistsMap.values());

  const libraryItems: LibraryItem[] = [
    ...(albums || []).map((album) => ({
      _id: album._id,
      type: "album" as const,
      title: album.title,
      imageUrl: album.imageUrl,
      createdAt: new Date(album.addedAt ?? new Date()),
      artist: album.artist,
      albumType: album.type,
    })),
    ...uniquePlaylists,
    ...(followedArtists || []).map((artist) => ({
      _id: artist._id,
      type: "artist" as const,
      title: artist.name,
      imageUrl: artist.imageUrl,
      createdAt: new Date(artist.addedAt || artist.createdAt),
      artistId: artist._id,
    })),
    ...(savedMixes || []).map((mix) => ({
      _id: mix._id,
      type: "mix" as const,
      title: mix.name,
      imageUrl: mix.imageUrl,
      createdAt: new Date(mix.addedAt ?? new Date()),
      sourceName: mix.sourceName,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="rounded-lg bg-zinc-900 p-4">
        <div className="space-y-2">
          <Link
            to="/"
            className={cn(
              buttonVariants({
                variant: "ghost",
                className: "w-full justify-start text-white hover:bg-zinc-800",
              })
            )}
          >
            <HomeIcon className="mr-2 size-5" />
            <span>{t("sidebar.home")}</span>
          </Link>

          <Link
            to="/search"
            className={cn(
              buttonVariants({
                variant: "ghost",
                className: "w-full justify-start text-white hover:bg-zinc-800",
              })
            )}
          >
            <Search className="mr-2 size-5" />
            <span>{t("sidebar.search")}</span>
          </Link>

          {user && (
            <Link
              to="/chat"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className:
                    "w-full justify-start text-white hover:bg-zinc-800",
                })
              )}
            >
              <MessageCircle className="mr-2 size-5" />
              <span>{t("sidebar.messages")}</span>
            </Link>
          )}

          {user && (
            <Link
              to="/liked-songs"
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className:
                    "w-full justify-start text-white hover:bg-zinc-800",
                })
              )}
            >
              <Heart className="mr-2 size-5" />
              <span>{t("sidebar.likedSongs")}</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-lg bg-zinc-900 p-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-white px-2">
            <Library className="size-5 mr-2" />
            <span>{t("sidebar.library")}</span>
          </div>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-zinc-800"
              onClick={() => setIsCreateDialogOpen(true)}
              title={t("sidebar.createPlaylist")}
            >
              <Plus className="size-5" />
            </Button>
          )}
        </div>

        {isLoading ? (
          <PlaylistSkeleton />
        ) : !user ? (
          <LoginPrompt className="flex-1" />
        ) : libraryItems.length === 0 ? (
          <p className="text-zinc-400 px-2">{t("sidebar.emptyLibrary")}</p>
        ) : (
          <ScrollArea className="flex-1 h-full pb-7">
            <div className="space-y-2">
              {libraryItems.map((item) => {
                let linkPath: string;
                let subtitle: string;
                let fallbackImage: string;
                let imageClass = "rounded-md";

                if (item.type === "album") {
                  const albumItem = item as AlbumItem;
                  linkPath = `/albums/${albumItem._id}`;
                  subtitle = `${
                    t(`sidebar.subtitle.${albumItem.albumType}`) ||
                    t("sidebar.subtitle.album")
                  } • ${getArtistNames(albumItem.artist)}`;
                  fallbackImage = "/default-album-cover.png";
                } else if (item.type === "playlist") {
                  const playlistItem = item as PlaylistItem;
                  linkPath = `/playlists/${playlistItem._id}`;
                  subtitle = `${t("sidebar.subtitle.playlist")} • ${
                    playlistItem.owner?.fullName || t("common.unknownArtist")
                  }`;
                  fallbackImage = "/default-album-cover.png";
                } else if (item.type === "liked-songs") {
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
                } else if (item.type === "artist") {
                  const artistItem = item as FollowedArtistItem;
                  linkPath = `/artists/${artistItem._id}`;
                  subtitle = t("sidebar.subtitle.artist");
                  fallbackImage = "/default-album-cover.png";
                  imageClass = "rounded-full";
                } else if (item.type === "mix") {
                  const mixItem = item as MixItem;
                  linkPath = `/mixes/${mixItem._id}`;
                  subtitle = t("sidebar.subtitle.dailyMix");
                  fallbackImage = "/default-album-cover.png";
                  imageClass = "rounded-md";
                } else {
                  linkPath = "#";
                  subtitle = "";
                  fallbackImage = "/default-album-cover.png";
                }

                return (
                  <Link
                    to={linkPath}
                    key={item._id}
                    className="p-2 hover:bg-zinc-800 rounded-md flex items-center gap-3 group cursor-pointer"
                  >
                    <img
                      src={item.imageUrl || fallbackImage}
                      alt={item.title}
                      className={`size-12 object-cover ${imageClass} flex-shrink-0`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackImage;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-md truncate text-white">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {isDownloaded(item._id) && (
                          <Download className="size-3 text-violet-400 flex-shrink-0" />
                        )}
                        <p className="text-sm text-zinc-400 truncate">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <CreatePlaylistDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
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
          className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full blur-lg
         opacity-75 animate-pulse"
          aria-hidden="true"
        />
        <div className="relative bg-zinc-900 rounded-full p-4">
          <LibraryIcon className="size-8 text-emerald-400" />
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
