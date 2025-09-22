// frontend/src/pages/PlaylistPage/PlaylistDetailsPage.tsx

/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ScrollArea } from "../../components/ui/scroll-area";
import { usePlaylistStore } from "../../stores/usePlaylistStore";
import PlaylistDetailsSkeleton from "../../components/ui/skeletons/PlaylistDetailsSkeleton";
import { format } from "date-fns";
import { Button } from "../../components/ui/button";
import { useChatStore } from "../../stores/useChatStore";
import { useOfflineStore } from "../../stores/useOfflineStore";
import EqualizerTitle from "@/components/ui/equalizer-title";
import SongOptionsDrawer from "./SongOptionsDrawer";
import { getArtistNames, getOptimizedImageUrl } from "@/lib/utils";

import {
  Play,
  Pause,
  PlusCircle,
  Edit,
  Trash2,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  X,
  Heart,
  Lock,
  Unlock,
  Loader2,
  RefreshCw,
  Share,
  Clock,
} from "lucide-react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { Song, Playlist } from "../../types";
import { useAuthStore } from "../../stores/useAuthStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader as DrawerHeaderComponent,
  DrawerTitle as DrawerTitleComponent,
} from "@/components/ui/drawer";
import { Input } from "../../components/ui/input";
import { useSearchStore } from "../../stores/useSearchStore";
import toast from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { useLibraryStore } from "../../stores/useLibraryStore";
import { EditPlaylistDialog } from "./EditPlaylistDialog";
import Equalizer from "../../components/ui/equalizer";
import { useDominantColor } from "@/hooks/useDominantColor";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { ShareDialog } from "@/components/ui/ShareDialog";
import { useUIStore } from "@/stores/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const PlaylistDetailsPage = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { socket } = useChatStore();
  const { t } = useTranslation();
  const { playlistId } = useParams<{ playlistId: string }>();
  const {
    currentPlaylist,
    error,
    fetchPlaylistDetails,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    updateCurrentPlaylistFromSocket,
    recommendations,
    isRecommendationsLoading,
    fetchRecommendations,
  } = usePlaylistStore();
  const {
    editingPlaylist,
    openEditPlaylistDialog,
    isSearchAndAddDialogOpen,
    openSearchAndAddDialog,
    playlistToDelete,
    openDeletePlaylistDialog,
    songToRemoveFromPlaylist,
    openRemoveSongFromPlaylistDialog,
    shareEntity,
    openShareDialog,
    closeAllDialogs,
  } = useUIStore();
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const {
    playlists: libraryPlaylists,
    togglePlaylist,
    likedSongs,
    toggleSongLike,
  } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isTogglingLibrary, setIsTogglingLibrary] = useState(false);
  const { extractColor } = useDominantColor();
  const [isColorLoading, setIsColorLoading] = useState(true);
  const [localIsLoading, setLocalIsLoading] = useState(true);
  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState([
    { key: 0, color: "#18181b" },
  ]);
  const [selectedSongForMenu, setSelectedSongForMenu] = useState<Song | null>(
    null
  );
  const {
    songs: searchSongs,
    loading: searchLoading,
    search: performSearch,
  } = useSearchStore();
  const {
    playAlbum,
    setCurrentSong,
    togglePlay,
    isPlaying,
    currentSong,
    queue,
  } = usePlayerStore();
  const isInLibrary = currentPlaylist
    ? libraryPlaylists.some((p: Playlist) => p._id === currentPlaylist._id)
    : false;

  const { isDownloaded, downloadItem } = useOfflineStore((s) => s.actions);

  useEffect(() => {
    const loadPlaylist = async () => {
      setLocalIsLoading(true);
      if (playlistId) {
        await fetchPlaylistDetails(playlistId);
      }
      setLocalIsLoading(false);
    };
    loadPlaylist();
  }, [playlistId, fetchPlaylistDetails]);

  useEffect(() => {
    if (playlistId && socket) {
      socket.emit("join_playlist_room", playlistId);
      const handlePlaylistUpdate = (data: { playlist: Playlist }) => {
        if (data && data.playlist && data.playlist._id === playlistId) {
          updateCurrentPlaylistFromSocket(data.playlist);
          toast.success("This playlist has been updated by the owner.");
          if (isDownloaded(playlistId)) {
            toast.loading("Updating your downloaded playlist...", {
              id: "playlist-sync",
            });
            downloadItem(playlistId, "playlists")
              .then(() =>
                toast.success("Downloaded playlist updated!", {
                  id: "playlist-sync",
                })
              )
              .catch(() =>
                toast.error("Could not update downloaded playlist.", {
                  id: "playlist-sync",
                })
              );
          }
        }
      };
      socket.on("playlist_updated", handlePlaylistUpdate);
      return () => {
        socket.emit("leave_playlist_room", playlistId);
        socket.off("playlist_updated", handlePlaylistUpdate);
      };
    }
  }, [
    playlistId,
    socket,
    updateCurrentPlaylistFromSocket,
    isDownloaded,
    downloadItem,
  ]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds((prev) => [{ key: newKey, color }, ...prev.slice(0, 1)]);
    };

    if (currentPlaylist?.imageUrl) {
      setIsColorLoading(true);
      extractColor(currentPlaylist.imageUrl)
        .then((color) => updateBackgroundColor(color || "#18181b"))
        .finally(() => setIsColorLoading(false));
    } else if (currentPlaylist) {
      updateBackgroundColor("#18181b");
      setIsColorLoading(false);
    }
  }, [currentPlaylist, extractColor]);

  useEffect(() => {
    if (isSearchAndAddDialogOpen && playlistId) {
      fetchRecommendations(playlistId);
    }
  }, [isSearchAndAddDialogOpen, playlistId, fetchRecommendations]);

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, performSearch]);

  const handlePlayPlaylist = () => {
    if (!currentPlaylist || currentPlaylist.songs.length === 0) return;
    const isCurrentPlaylistPlaying =
      isPlaying &&
      currentSong &&
      queue.length > 0 &&
      currentPlaylist.songs.some((song) => song._id === currentSong._id) &&
      queue[0]?._id === currentPlaylist.songs[0]?._id;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      playAlbum(currentPlaylist.songs, 0);
    }
  };

  const handlePlaySong = (song: Song, index: number) => {
    if (!currentPlaylist) return;
    const isThisPlaylistInPlayer =
      queue.length > 0 &&
      currentPlaylist.songs.some((s) => s._id === queue[0]?._id);
    if (isThisPlaylistInPlayer) {
      if (currentSong?._id === song._id) {
        togglePlay();
      } else {
        setCurrentSong(song);
        playAlbum(currentPlaylist.songs, index);
      }
    } else {
      playAlbum(currentPlaylist.songs, index);
    }
  };

  const handleSongTitleClick = (albumId: string | null | undefined) => {
    if (albumId) {
      navigate(`/albums/${albumId}`);
    }
  };

  const handleArtistNameClick = (artistId: string) =>
    navigate(`/artists/${artistId}`);
  const handleOwnerClick = () => {
    if (currentPlaylist?.owner?._id)
      navigate(`/users/${currentPlaylist.owner._id}`);
  };
  const isOwner = authUser && currentPlaylist?.owner?._id === authUser.id;

  const handleDeletePlaylistConfirm = async () => {
    if (!playlistToDelete || !isOwner) {
      toast.error("You don't have permission to delete this playlist.");
      return;
    }
    try {
      await deletePlaylist(playlistToDelete._id);
      toast.success("Playlist successfully deleted!");
      navigate("/library");
    } catch (e) {
      toast.error("Failed to delete playlist.");
    } finally {
      closeAllDialogs();
    }
  };

  const handleDeleteSongConfirm = async () => {
    if (!songToRemoveFromPlaylist) return;
    try {
      await removeSongFromPlaylist(
        songToRemoveFromPlaylist.playlistId,
        songToRemoveFromPlaylist.songId
      );
      toast.success("Song successfully removed from playlist!");
    } catch (e) {
      console.error("Component caught error from removeSongFromPlaylist:", e);
    } finally {
      closeAllDialogs();
    }
  };

  const handleAddSongToPlaylist = async (songId: string) => {
    if (!currentPlaylist) return;
    try {
      await addSongToPlaylist(currentPlaylist._id, songId);
      toast.success("Song added to playlist!");
      await fetchPlaylistDetails(currentPlaylist._id);
    } catch (e) {
      toast.error("Failed to add song.");
    }
  };

  const handleTogglePlaylistInLibrary = async () => {
    if (!currentPlaylist || isTogglingLibrary) return;
    setIsTogglingLibrary(true);
    try {
      await togglePlaylist(currentPlaylist._id);
      toast.success(
        isInLibrary
          ? "Playlist removed from library!"
          : "Playlist added to library!"
      );
    } catch (e) {
      toast.error("Failed to change playlist status in library.");
    } finally {
      setIsTogglingLibrary(false);
    }
  };

  const renderMobileSongList = () => {
    if (!currentPlaylist?.songs) return null;
    return currentPlaylist.songs.map((song) => {
      const isCurrentSong = currentSong?._id === song._id;
      return (
        <div
          key={song._id}
          onClick={() =>
            handlePlaySong(
              song,
              currentPlaylist.songs.findIndex((s) => s._id === song._id)
            )
          }
          className={`flex items-center justify-between gap-4 p-2 rounded-md group cursor-pointer ${
            isCurrentSong ? "bg-white/10" : "hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img
              src={getOptimizedImageUrl(
                song.imageUrl || "/default-song-cover.png",
                100
              )}
              alt={song.title}
              className="size-12 object-cover rounded-md flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isCurrentSong && isPlaying && (
                  <div className="block sm:hidden flex-shrink-0">
                    <EqualizerTitle />
                  </div>
                )}
                <p
                  className={`font-medium truncate w-45 sm:w-120 ${
                    isCurrentSong ? "text-violet-400" : "text-white"
                  }`}
                >
                  {song.title}
                </p>
              </div>
              <p className="text-sm text-zinc-400 truncate w-45 sm:w-120">
                {getArtistNames(song.artist)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSongForMenu(song);
            }}
          >
            <MoreHorizontal className="h-5 w-5 text-zinc-400 group-hover:text-white" />
          </Button>
        </div>
      );
    });
  };

  const renderDesktopSongList = () => {
    if (!currentPlaylist?.songs) return null;
    return currentPlaylist.songs.map((song, index) => {
      const isCurrentlyPlaying = currentSong?._id === song._id;
      const songIsLiked = likedSongs.some(
        (likedSong) => likedSong._id === song._id
      );
      return (
        <div
          key={song._id}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            handlePlaySong(song, index);
          }}
          className={`grid grid-cols-[16px_4fr_2fr_1fr_min-content] gap-4 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 rounded-md group cursor-pointer ${
            isCurrentlyPlaying ? "bg-white/10" : ""
          }`}
        >
          <div className="flex items-center justify-center">
            {isCurrentlyPlaying && isPlaying ? (
              <div className="z-10">
                <Equalizer />
              </div>
            ) : (
              <span className="group-hover:hidden text-xs sm:text-sm">
                {index + 1}
              </span>
            )}
            {!isCurrentlyPlaying && (
              <Play className="h-3 w-3 sm:h-4 sm:w-4 hidden group-hover:block" />
            )}
          </div>
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSongTitleClick(song.albumId);
              }}
              className="flex-shrink-0"
            >
              <img
                src={getOptimizedImageUrl(
                  song.imageUrl || "/default-song-cover.png",
                  80
                )}
                alt={song.title}
                className="size-10 object-cover rounded-md"
              />
            </button>
            <div className="flex flex-col min-w-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSongTitleClick(song.albumId);
                }}
                className={`font-medium w-full text-left hover:underline focus:outline-none focus:underline truncate ${
                  isCurrentlyPlaying ? "text-violet-400" : "text-white"
                }`}
              >
                {song.title}
              </button>
              <div className="text-zinc-400 text-xs sm:text-sm truncate">
                {song.artist.map((artist, artistIndex) => (
                  <span key={artist._id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArtistNameClick(artist._id);
                      }}
                      className="hover:underline focus:outline-none focus:underline"
                    >
                      {artist.name}
                    </button>
                    {artistIndex < song.artist.length - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="items-center hidden md:flex text-xs">
            {song.createdAt
              ? format(new Date(song.createdAt), "MMM dd, yyyy")
              : "N/A"}
          </div>
          <div className="flex items-center text-xs sm:text-sm flex-shrink-0 justify-end md:mr-10">
            {formatDuration(song.duration)}
          </div>
          <div className="flex items-center justify-end gap-1 sm:gap-2 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-full size-6 sm:size-7 ${
                songIsLiked
                  ? "text-violet-500 hover:text-violet-400"
                  : "text-zinc-400 hover:text-white opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSongLike(song._id);
              }}
              title={songIsLiked ? t("player.unlike") : t("player.like")}
            >
              <Heart
                className={`h-4 w-4 sm:h-5 sm:w-5 ${
                  songIsLiked ? "fill-violet-500" : ""
                }`}
              />
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full size-6 sm:size-7 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  openRemoveSongFromPlaylistDialog({
                    songId: song._id,
                    playlistId: currentPlaylist._id,
                  });
                }}
                title="Remove from playlist"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
          </div>
        </div>
      );
    });
  };

  if (localIsLoading || isColorLoading) {
    return (
      <>
        <Helmet>
          <title>Loading Playlist...</title>
        </Helmet>
        <PlaylistDetailsSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 bg-[#0f0f0f] min-h-screen text-white text-center">
        <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
          {t("pages.playlist.errorTitle")}
        </h1>
        <p className="text-red-500">
          {t("pages.playlist.error")}: {error}
        </p>
      </div>
    );
  }

  if (!currentPlaylist) {
    return (
      <>
        <Helmet>
          <title>Playlist Not Found</title>
          <meta
            name="description"
            content="Sorry, the requested playlist could not be found or is private."
          />
        </Helmet>
        <div className="p-4 sm:p-6 bg-[#0f0f0f] min-h-screen text-white text-center">
          <h1 className="text-2xl sm:text-3xl mb-6 font-bold">
            {t("pages.playlist.notFoundTitle")}
          </h1>
          <p className="text-gray-400">{t("pages.playlist.notFoundDesc")}</p>
        </div>
      </>
    );
  }

  const totalDurationSeconds =
    currentPlaylist.songs?.reduce((acc, song) => acc + song.duration, 0) || 0;
  const totalMinutes = Math.floor(totalDurationSeconds / 60);
  const remainingSeconds = totalDurationSeconds % 60;
  const formattedDuration = `${totalMinutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
  const isCurrentPlaylistPlaying =
    isPlaying &&
    currentPlaylist.songs?.length > 0 &&
    queue.length > 0 &&
    currentSong &&
    currentPlaylist.songs.some((song) => song._id === currentSong._id) &&
    queue[0]?._id === currentPlaylist.songs[0]?._id;
  const ownerName = currentPlaylist.owner?.fullName || "a user";
  const metaDescription = `Listen to "${
    currentPlaylist.title
  }", a playlist by ${ownerName} on Moodify. Features ${
    currentPlaylist.songs?.length || 0
  } songs. ${currentPlaylist.description || ""}`;

  return (
    <>
      <Helmet>
        <title>{`${currentPlaylist.title} by ${ownerName}`}</title>
        <meta name="description" content={metaDescription.substring(0, 160)} />
      </Helmet>
      <div className="h-full">
        <ScrollArea className="h-full rounded-md">
          <div className="relative min-h-screen max-w-screen pb-30 lg:pb-0">
            {backgrounds
              .slice(0, 2)
              .reverse()
              .map((bg, index) => (
                <div
                  key={bg.key}
                  className={`absolute inset-0 pointer-events-none ${
                    index === 1 ? "animate-fade-in" : ""
                  }`}
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(to bottom, ${bg.color} 0%, rgba(20, 20, 20, 0.8) 50%, #0f0f0f 100%)`,
                  }}
                />
              ))}
            <div className="relative z-10 w-full">
              <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 sm:pb-8 items-center sm:items-end w-full">
                <img
                  src={getOptimizedImageUrl(
                    currentPlaylist.imageUrl ||
                      "https://moodify.b-cdn.net/default-album-cover.png",
                    500
                  )}
                  alt={currentPlaylist.title}
                  className="w-48 h-48 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded-md object-cover flex-shrink-0 mx-auto sm:mx-0"
                />
                <div className="flex flex-col justify-end text-center sm:text-left min-w-0 w-full">
                  <p className="text-xs sm:text-sm font-medium">
                    {t("pages.playlist.type")}
                  </p>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-2 sm:my-4 break-words">
                    {currentPlaylist.title}
                  </h1>
                  {currentPlaylist.description && (
                    <p className="text-gray-400 text-base mt-2 break-words">
                      {currentPlaylist.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 text-xs sm:text-sm text-gray-100 mt-2">
                    {isOwner &&
                      (currentPlaylist.isPublic ? (
                        <Unlock className="size-3.5" />
                      ) : (
                        <Lock className="size-3.5" />
                      ))}
                    <button
                      onClick={handleOwnerClick}
                      className="font-semibold text-white flex items-center hover:underline focus:outline-none focus:underline"
                    >
                      <img
                        src={currentPlaylist.owner.imageUrl}
                        className="size-4 rounded-full mr-1"
                        alt={currentPlaylist.owner.fullName}
                      />
                      {currentPlaylist.owner?.fullName ||
                        t("common.unknownArtist")}
                    </button>
                    <span className="hidden lg:inline">
                      • {(currentPlaylist.songs || []).length}{" "}
                      {(currentPlaylist.songs || []).length !== 1
                        ? t("pages.playlist.songs")
                        : t("pages.playlist.song")}
                    </span>
                    {(currentPlaylist.songs || []).length > 0 && (
                      <span className="hidden lg:inline">
                        • {formattedDuration}
                      </span>
                    )}
                    {currentPlaylist.likes > 0 && (
                      <span className="hidden lg:inline">
                        • {currentPlaylist.likes} {t("pages.playlist.saved")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-6 pb-4 flex flex-wrap sm:justify-start items-center gap-2">
                {currentPlaylist.songs.length > 0 && (
                  <Button
                    size="icon"
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-white/90 transition-colors shadow-lg flex-shrink-0 hover:scale-105"
                    onClick={handlePlayPlaylist}
                  >
                    {isCurrentPlaylistPlaying ? (
                      <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                    ) : (
                      <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                    )}
                  </Button>
                )}
                {!isOwner && (
                  <Button
                    onClick={handleTogglePlaylistInLibrary}
                    disabled={isTogglingLibrary}
                    variant="ghost"
                    size="icon"
                  >
                    {isInLibrary ? (
                      <CheckCircle2 className="size-6 text-[#8b5cf6]" />
                    ) : (
                      <PlusCircle className="size-6 text-white" />
                    )}
                  </Button>
                )}
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={openSearchAndAddDialog}
                  >
                    <Plus className="size-6" />
                  </Button>
                )}
                <DownloadButton
                  itemId={currentPlaylist._id}
                  itemType="playlists"
                  itemTitle={currentPlaylist.title}
                />
                {isMobile ? (
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-6" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent
                      className="bg-[#0f0f0f] border-[#2a2a2a] text-white p-4"
                      aria-describedby={undefined}
                    >
                      <DrawerHeaderComponent className="p-0 text-center mb-4">
                        <DrawerTitleComponent className="sr-only">
                          Playlist Options
                        </DrawerTitleComponent>
                      </DrawerHeaderComponent>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          className="justify-start p-3 h-auto text-base"
                          onClick={() => {
                            openShareDialog({
                              type: "playlist",
                              id: currentPlaylist._id,
                            });
                          }}
                        >
                          <Share className="mr-4 h-5 w-5" />
                          {t("admin.albums.share")}
                        </Button>
                        {isOwner && (
                          <>
                            <Button
                              variant="ghost"
                              className="justify-start p-3 h-auto text-base"
                              onClick={() =>
                                openEditPlaylistDialog(currentPlaylist)
                              }
                            >
                              <Edit className="mr-4 h-5 w-5" />
                              {t("pages.playlist.actions.edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start p-3 h-auto text-base text-red-400 hover:text-red-400"
                              onClick={() =>
                                openDeletePlaylistDialog(currentPlaylist)
                              }
                            >
                              <Trash2 className="mr-4 h-5 w-5" />
                              {t("pages.playlist.actions.delete")}
                            </Button>
                          </>
                        )}
                      </div>
                    </DrawerContent>
                  </Drawer>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-6" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 bg-zinc-800 text-white border-zinc-700">
                      <DropdownMenuItem
                        className="cursor-pointer hover:bg-zinc-700"
                        onSelect={() =>
                          openShareDialog({
                            type: "playlist",
                            id: currentPlaylist._id,
                          })
                        }
                      >
                        <Share className="mr-2 h-4 w-4" />
                        {t("admin.albums.share")}
                      </DropdownMenuItem>
                      {isOwner && (
                        <>
                          <DropdownMenuSeparator className="bg-zinc-700" />
                          <DropdownMenuItem
                            className="cursor-pointer hover:bg-zinc-700"
                            onSelect={() =>
                              openEditPlaylistDialog(currentPlaylist)
                            }
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            {t("pages.playlist.actions.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-red-400 hover:bg-zinc-700 hover:text-red-300"
                            onSelect={(e) => {
                              e.preventDefault();
                              openDeletePlaylistDialog(currentPlaylist);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("pages.playlist.actions.delete")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="bg-black/20 backdrop-blur-sm">
                <div className="hidden md:grid md:grid-cols-[16px_4fr_2fr_1fr_0.6fr] gap-4 px-4 sm:px-6 md:px-10 py-2 text-sm text-zinc-400 border-b border-white/5">
                  <div>#</div>
                  <div>{t("pages.playlist.headers.title")}</div>
                  <div className="hidden md:block">
                    {t("pages.playlist.headers.dateAdded")}
                  </div>
                  <div className="flex items-center justify-end md:mr-10">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="w-8"></div>
                </div>
                <div className="px-2 sm:px-6">
                  <div className="space-y-1 py-4">
                    {isMobile
                      ? renderMobileSongList()
                      : renderDesktopSongList()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        {currentPlaylist && (
          <EditPlaylistDialog
            isOpen={!!editingPlaylist}
            onClose={closeAllDialogs}
            playlist={editingPlaylist}
            onSuccess={() => fetchPlaylistDetails(currentPlaylist._id)}
          />
        )}
        <AlertDialog
          open={!!playlistToDelete}
          onOpenChange={(isOpen) => !isOpen && closeAllDialogs()}
        >
          <AlertDialogContent className="bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {t("pages.playlist.deleteDialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {t("pages.playlist.deleteDialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={closeAllDialogs}
                className="bg-zinc-700 text-white hover:bg-zinc-600 border-none"
              >
                {t("pages.playlist.deleteDialog.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleDeletePlaylistConfirm}
              >
                {t("pages.playlist.deleteDialog.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={!!songToRemoveFromPlaylist}
          onOpenChange={(isOpen) => !isOpen && closeAllDialogs()}
        >
          <AlertDialogContent className="bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {t("pages.playlist.removeSongDialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {t("pages.playlist.removeSongDialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={closeAllDialogs}
                className="bg-zinc-700 text-white hover:bg-zinc-600 border-none"
              >
                {t("pages.playlist.removeSongDialog.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleDeleteSongConfirm}
              >
                {t("pages.playlist.removeSongDialog.remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog
          open={isSearchAndAddDialogOpen}
          onOpenChange={(isOpen) => !isOpen && closeAllDialogs()}
        >
          <DialogContent className="sm:w-[60%vw] w-[40%vw] bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-white max-w-[80vw]">
                {t("pages.playlist.addSongDialog.title")}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 max-w-[80vw]">
                {t("pages.playlist.addSongDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder={t(
                  "pages.playlist.addSongDialog.searchPlaceholder"
                )}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4 bg-zinc-800 text-white border-zinc-700 focus:ring-violet-500 w-[80vw] sm:w-[55vw] md:w-[38vw] lg:w-[19.5vw] 2xl:w-[18vw]"
              />
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {searchTerm.trim() !== "" ? (
                    <>
                      {searchLoading ? (
                        <p className="text-zinc-400">
                          {t("pages.playlist.addSongDialog.searching")}
                        </p>
                      ) : searchSongs.length === 0 ? (
                        <p className="text-zinc-400">
                          {t("pages.playlist.addSongDialog.noSongsFound")}
                        </p>
                      ) : (
                        searchSongs.map((song) => (
                          <div
                            key={song._id}
                            className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-md cursor-pointer sm:w-[55vw] md:w-[38vw] w-[80vw] lg:w-[20vw] 2xl:w-[18vw]"
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              <button
                                onClick={() =>
                                  handleSongTitleClick(song.albumId)
                                }
                                className="font-semibold text-white truncate text-left hover:underline focus:outline-none focus:underline"
                              >
                                {song.title}
                              </button>
                              <span className="text-sm text-zinc-400 truncate">
                                {song.artist.map((artist, artistIndex) => (
                                  <span key={artist._id}>
                                    <button
                                      onClick={() =>
                                        handleArtistNameClick(artist._id)
                                      }
                                      className="hover:underline focus:outline-none focus:underline"
                                    >
                                      {artist.name}
                                    </button>
                                    {artistIndex < song.artist.length - 1 &&
                                      ", "}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddSongToPlaylist(song._id)}
                              className="bg-violet-500 hover:bg-violet-400 text-white ml-4 flex-shrink-0"
                              disabled={currentPlaylist?.songs.some(
                                (s) => s._id === song._id
                              )}
                            >
                              {currentPlaylist?.songs.some(
                                (s) => s._id === song._id
                              )
                                ? t("pages.playlist.addSongDialog.added")
                                : t("pages.playlist.addSongDialog.add")}
                            </Button>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {isRecommendationsLoading ? (
                        <div className="flex justify-center items-center h-full">
                          <Loader2 className="animate-spin text-violet-500 size-8" />
                        </div>
                      ) : recommendations.length === 0 ? (
                        <p className="text-zinc-400 px-2">Нет рекомендаций.</p>
                      ) : (
                        recommendations.map((song) => (
                          <div
                            key={song._id}
                            className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-md cursor-pointer sm:w-[55vw] md:w-[38vw] w-[80vw] lg:w-[20vw] 2xl:w-[18vw]"
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              <button
                                onClick={() =>
                                  handleSongTitleClick(song.albumId)
                                }
                                className="font-semibold text-white truncate text-left hover:underline focus:outline-none focus:underline "
                              >
                                {song.title}
                              </button>
                              <span className="text-sm text-zinc-400 truncate">
                                {song.artist.map((artist, artistIndex) => (
                                  <span key={artist._id}>
                                    <button
                                      onClick={() =>
                                        handleArtistNameClick(artist._id)
                                      }
                                      className="hover:underline focus:outline-none focus:underline"
                                    >
                                      {artist.name}
                                    </button>
                                    {artistIndex < song.artist.length - 1 &&
                                      ", "}
                                  </span>
                                ))}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddSongToPlaylist(song._id)}
                              className="bg-violet-500 hover:bg-violet-400 text-white ml-4 flex-shrink-0"
                              disabled={currentPlaylist?.songs.some(
                                (s) => s._id === song._id
                              )}
                            >
                              {currentPlaylist?.songs.some(
                                (s) => s._id === song._id
                              )
                                ? t("pages.playlist.addSongDialog.added")
                                : t("pages.playlist.addSongDialog.add")}
                            </Button>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => playlistId && fetchRecommendations(playlistId)}
                  disabled={isRecommendationsLoading}
                  title="Refresh recommendations"
                  className="flex-shrink-0 mt-4 bg-violet-500 w-30 hover:bg-violet-400 transition-colors"
                >
                  <RefreshCw
                    className={`size-5 ${
                      isRecommendationsLoading ? "animate-spin" : ""
                    }`}
                  />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {currentPlaylist && (
          <ShareDialog
            isOpen={
              shareEntity?.type === "playlist" &&
              shareEntity.id === currentPlaylist._id
            }
            onClose={closeAllDialogs}
            entityType="playlist"
            entityId={currentPlaylist._id}
          />
        )}
        {shareEntity?.type === "song" && (
          <ShareDialog
            isOpen={true}
            onClose={closeAllDialogs}
            entityType="song"
            entityId={shareEntity.id}
          />
        )}
      </div>
      <SongOptionsDrawer
        song={selectedSongForMenu}
        playlistId={currentPlaylist?._id || ""}
        isOwner={!!isOwner}
        isOpen={!!selectedSongForMenu}
        onOpenChange={(open) => !open && setSelectedSongForMenu(null)}
      />
    </>
  );
};
export default PlaylistDetailsPage;
