/* eslint-disable @typescript-eslint/no-unused-vars */
import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import { usePlaylist } from "@/hooks/queries";
import PlaylistDetailsSkeleton from "@/components/ui/skeletons/PlaylistDetailsSkeleton";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CollectionSongList } from "@/components/CollectionSongList/CollectionSongList";
import { formatPlaylistTotalDuration } from "@/lib/utils";
import {
  getPlaylistDisplayDescription,
  getPlaylistDisplayTitle,
} from "@/lib/entitySection";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import { getUserAvatarUrl } from "@/lib/imageUrl";
import { CoverImage } from "@/components/CoverImage";
import {
  playlistOwnerLabel,
  SITE_BRAND_AVATAR,
  SITE_NAME,
} from "@/lib/site-meta";
import {
  canShowPlaylistLibraryToggle,
  isPlaylistMadeForUser,
} from "@/lib/playlistKinds";
import { CollectionGradientLayout } from "@/components/CollectionGradientLayout";
import { useDominantCoverGradient } from "@/hooks/useDominantCoverGradient";
import { DeletePlaylistDialog } from "./DeletePlaylistDialog";
import { PlaylistDiscoverSection } from "./PlaylistDiscoverSection";
import { RemoveSongFromPlaylistDialog } from "./RemoveSongFromPlaylistDialog";

import {
  Play,
  Pause,
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Lock,
  Unlock,
  Share,
} from "lucide-react";
import CheckedIcon from "@/components/ui/checkedIcon";
import { usePlayerStore } from "@/stores/usePlayerStore";
import { Song, Playlist, PlaylistKind } from "@/types";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerHeader as DrawerHeaderComponent,
  DrawerTitle as DrawerTitleComponent,
} from "@/components/ui/drawer";
import toast from "react-hot-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { DownloadButton } from "@/layout/DownloadButton";
import { ShareDialog } from "@/layout/ShareDialog";
import { useUIStore } from "@/stores/useUIStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MOBILE_MEDIA_QUERY } from "@/constants/breakpoints";

function playlistKindLabel(
  t: (k: string) => string,
  kind?: PlaylistKind,
  isMadeForViewer?: boolean,
) {
  if (isMadeForViewer) {
    return t("homepage.madeForYou");
  }
  switch (kind) {
    case "GENRE_MIX":
    case "MOOD_MIX":
      return t("sidebar.subtitle.dailyMix");
    case "LIKED_SONGS":
      return t("sidebar.likedSongs");
    case "PERSONAL_MIX":
      return t("personalMix.title");
    case "ON_REPEAT":
    case "DISCOVER_WEEKLY":
    case "ON_REPEAT_REWIND":
    case "NEW_RELEASES":
      return t("sidebar.subtitle.playlist");
    default:
      return t("pages.playlist.type");
  }
}

const PlaylistDetailsPage = () => {
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const user = useAuthStore((s) => s.user);
  const { t, i18n } = useTranslation();
  const { playlistId } = useParams<{ playlistId: string }>();
  const {
    data: currentPlaylist,
    isPending: isPlaylistLoading,
    error: playlistQueryError,
    refetch: refetchPlaylist,
  } = usePlaylist(playlistId);
  const {
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
  } = usePlaylistStore();
  const error = playlistQueryError?.message ?? null;
  const {
    openEditPlaylistDialog,
    playlistToDelete,
    openDeletePlaylistDialog,
    songToRemoveFromPlaylist,
    shareEntity,
    openShareDialog,
    closeAllDialogs,
  } = useUIStore();
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const {
    playlists: libraryPlaylists,
    togglePlaylist,
  } = useLibraryStore();
  const [isTogglingLibrary, setIsTogglingLibrary] = useState(false);
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

  const isOwner = Boolean(
    authUser?.id && currentPlaylist?.owner?._id === authUser.id,
  );
  const isUserEditable = Boolean(
    isOwner && currentPlaylist && !currentPlaylist.isSystem,
  );
  const showAddToPlaylistButton = Boolean(
    isUserEditable && currentPlaylist?.type !== "LIKED_SONGS",
  );
  const isMadeForViewer = Boolean(
    currentPlaylist &&
      isPlaylistMadeForUser(currentPlaylist, authUser?.id),
  );
  const showLibraryToggle = Boolean(
    currentPlaylist &&
      canShowPlaylistLibraryToggle(currentPlaylist, authUser?.id),
  );

  const { backgrounds, isColorLoading } = useDominantCoverGradient(
    playlistId,
    currentPlaylist?.coverAccentHex,
  );

  const playlistSongIds = useMemo(
    () => new Set(currentPlaylist?.songs?.map((s) => s._id) ?? []),
    [currentPlaylist?.songs],
  );

  const displayTitle = useMemo(
    () =>
      currentPlaylist
        ? getPlaylistDisplayTitle(currentPlaylist, i18n.language, t)
        : "",
    [currentPlaylist, i18n.language, t],
  );

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
      playAlbum(currentPlaylist.songs, 0, {
        type: "playlist",
        entityId: currentPlaylist._id,
        entityTitle: displayTitle,
      });
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
        playAlbum(currentPlaylist.songs, index, {
          type: "playlist",
          entityId: currentPlaylist._id,
          entityTitle: displayTitle,
        });
      }
    } else {
      playAlbum(currentPlaylist.songs, index, {
        type: "playlist",
        entityId: currentPlaylist._id,
        entityTitle: displayTitle,
      });
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

  const handleDeletePlaylistConfirm = async () => {
    if (!playlistToDelete || !isUserEditable) {
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
        songToRemoveFromPlaylist.songId,
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
    } catch (e) {
      toast.error("Failed to add song.");
    }
  };

  const handleTogglePlaylistInLibrary = async () => {
    if (!user || !currentPlaylist || isTogglingLibrary) return;
    setIsTogglingLibrary(true);
    try {
      await togglePlaylist(currentPlaylist._id);
      toast.success(
        isInLibrary
          ? "Playlist removed from library!"
          : "Playlist added to library!",
      );
    } catch (e) {
      toast.error("Failed to change playlist status in library.");
    } finally {
      setIsTogglingLibrary(false);
    }
  };

  if (isPlaylistLoading || isColorLoading) {
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
  const formattedDuration = formatPlaylistTotalDuration(
    totalDurationSeconds,
    t,
  );
  const isLikedSongsPlaylist = currentPlaylist.type === "LIKED_SONGS";
  const isCurrentPlaylistPlaying =
    isPlaying &&
    currentPlaylist.songs?.length > 0 &&
    queue.length > 0 &&
    currentSong &&
    currentPlaylist.songs.some((song) => song._id === currentSong._id) &&
    queue[0]?._id === currentPlaylist.songs[0]?._id;
  const ownerName = playlistOwnerLabel(
    currentPlaylist.owner,
    t("common.unknownArtist"),
  );
  const playlistDescriptionText = getPlaylistDisplayDescription(
    currentPlaylist,
    t,
  );
  const metaDescription = `Listen to "${displayTitle}", a playlist by ${ownerName} on Moodify Music. Features ${
    currentPlaylist.songs?.length || 0
  } songs.${playlistDescriptionText ? ` ${playlistDescriptionText}` : ""}`;
  const showPlaylistHeaderMenu = Boolean(
    user && (currentPlaylist.isPublic || isUserEditable),
  );
  const playlistDateHeaderKey = isLikedSongsPlaylist
    ? "pages.likedSongs.headers.dateAdded"
    : "pages.playlist.headers.dateAdded";
  const getPlaylistSongDateLabel = (song: Song) => {
    if (isLikedSongsPlaylist) {
      return song.likedAt
        ? format(new Date(song.likedAt), "MMM dd, yyyy")
        : "N/A";
    }
    return song.createdAt
      ? format(new Date(song.createdAt), "MMM dd, yyyy")
      : "N/A";
  };
  const handlePlaylistSongPlay = (index: number) => {
    const song = currentPlaylist.songs[index];
    if (song) handlePlaySong(song, index);
  };

  return (
    <>
      <Helmet>
        <title>{`${displayTitle} by ${ownerName}`}</title>
        <meta name="description" content={metaDescription.substring(0, 160)} />
      </Helmet>
      <CollectionGradientLayout
        backgrounds={backgrounds}
        footerTint="#0f0f0f"
        midTint="rgba(20, 20, 20, 0.8)"
        innerClassName="relative min-h-screen max-w-screen pb-30 lg:pb-0"
      >
        <div className="relative z-10 w-full">
            <div className="flex flex-col sm:flex-row p-4 sm:p-6 gap-4 sm:gap-6 pb-8 sm:pb-8 items-center sm:items-end w-full">
              {isUserEditable ? (
                <button
                  type="button"
                  onClick={() =>
                    openEditPlaylistDialog(currentPlaylist, () =>
                      void refetchPlaylist(),
                    )
                  }
                  className="group w-64 h-64 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded-md object-cover flex-shrink-0 mx-auto sm:mx-0 overflow-hidden border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]"
                  title={t("pages.playlist.actions.edit")}
                >
                  <CoverImage
                    entity={currentPlaylist}
                    size="large"
                    defaultUrl={CDN_DEFAULT_ALBUM_COVER}
                    alt={displayTitle}
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                  />
                </button>
              ) : (
                <CoverImage
                  entity={currentPlaylist}
                  size="large"
                  defaultUrl={CDN_DEFAULT_ALBUM_COVER}
                  alt={displayTitle}
                  className="w-64 h-64 sm:w-[200px] sm:h-[200px] lg:w-[240px] lg:h-[240px] shadow-xl rounded-md object-cover flex-shrink-0 mx-auto sm:mx-0"
                />
              )}
              <div className="flex flex-col justify-end text-center sm:text-left min-w-0 w-full">
                <p className="text-xs sm:text-sm font-medium">
                  {playlistKindLabel(t, currentPlaylist.type, isMadeForViewer)}
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mt-2 mb-2 sm:my-4 break-words">
                  {displayTitle}
                </h1>
                {playlistDescriptionText && (
                  <p className="text-gray-400 text-base mt-2 break-words">
                    {playlistDescriptionText}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 text-xs sm:text-sm text-gray-100 mt-2">
                  {isOwner &&
                    (currentPlaylist.isPublic ? (
                      <Unlock className="size-3.5" />
                    ) : (
                      <Lock className="size-3.5" />
                    ))}
                  {currentPlaylist.owner == null ? (
                    <span className="font-semibold text-white flex items-center">
                      <img
                        src={SITE_BRAND_AVATAR}
                        className="size-4 rounded-full mr-1 object-cover bg-zinc-800"
                        alt={SITE_NAME}
                      />
                      {SITE_NAME}
                    </span>
                  ) : currentPlaylist.owner ? (
                    <button
                      type="button"
                      onClick={handleOwnerClick}
                      className="font-semibold text-white flex items-center hover:underline focus:outline-none focus:underline"
                    >
                      <img
                        src={getUserAvatarUrl(currentPlaylist.owner)}
                        className="size-4 rounded-full mr-1"
                        alt={currentPlaylist.owner.fullName}
                      />
                      {currentPlaylist.owner.fullName ||
                        t("common.unknownArtist")}
                    </button>
                  ) : null}
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
                  {(currentPlaylist.likes ?? 0) > 0 && (
                    <span className="hidden lg:inline">
                      • {currentPlaylist.likes} {t("pages.playlist.saved")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-4 flex flex-wrap sm:justify-start items-center gap-1">
              {currentPlaylist.songs.length > 0 && (
                <Button
                  size="icon"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white hover:bg-white/90 transition-all duration-100 shadow-lg flex-shrink-0 hover:scale-105"
                  onClick={handlePlayPlaylist}
                >
                  {isCurrentPlaylistPlaying ? (
                    <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-8 sm:h-8 text-black fill-current" />
                  )}
                </Button>
              )}
              {showLibraryToggle && (
                <Button
                  onClick={handleTogglePlaylistInLibrary}
                  disabled={isTogglingLibrary || !user}
                  variant="ghost2"
                  size="icon"
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-2 transition-colors group ${
                    !user ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  title={
                    !user
                      ? t("auth.loginRequired")
                      : isInLibrary
                        ? t("pages.playlist.actions.removeFromLibrary")
                        : t("pages.playlist.actions.addToLibrary")
                  }
                >
                  {isInLibrary ? (
                    <CheckedIcon className="size-8 text-[#8b5cf6]" />
                  ) : (
                    <PlusCircle className="size-8 text-white/80 group-hover:text-white transition-colors" />
                  )}
                </Button>
              )}
              <DownloadButton
                itemId={currentPlaylist._id}
                itemType="playlists"
                itemTitle={displayTitle}
                disabled={
                  !user || (currentPlaylist.songs?.length ?? 0) === 0
                }
                disabledHint={
                  user && (currentPlaylist.songs?.length ?? 0) === 0
                    ? t("pages.playlist.downloadEmptyHint")
                    : undefined
                }
              />
              {showPlaylistHeaderMenu &&
                (isMobile ? (
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button
                      variant="ghost2"
                      size="icon"
                      disabled={!user}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-2 transition-colors group ${
                        !user ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      title={!user ? t("auth.loginRequired") : ""}
                    >
                      <MoreHorizontal className="size-8 text-white/80 group-hover:text-white transition-colors" />
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
                      {currentPlaylist.isPublic && (
                        <Button
                          variant="ghost"
                          className={`justify-start p-3 h-auto text-base `}
                          onClick={() => {
                            openShareDialog({
                              type: "playlist",
                              id: currentPlaylist._id,
                            });
                          }}
                          title={t("admin.albums.share")}
                        >
                          <Share className="mr-4 h-5 w-5" />
                          {t("admin.albums.share")}
                        </Button>
                      )}
                      {isUserEditable && (
                        <>
                          <Button
                            variant="ghost"
                            className="justify-start p-3 h-auto text-base"
                            onClick={() =>
                              openEditPlaylistDialog(currentPlaylist, () =>
                                void refetchPlaylist(),
                              )
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
                    <Button
                      variant="ghost2"
                      size="icon"
                      disabled={!user}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full p-2 transition-colors group ${
                        !user ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      title={!user ? t("auth.loginRequired") : ""}
                    >
                      <MoreHorizontal className="size-8 text-white/80 group-hover:text-white transition-colors" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    {currentPlaylist.isPublic && (
                      <DropdownMenuItem
                        className={`cursor-pointer hover:bg-zinc-800/50 `}
                        onSelect={() =>
                          openShareDialog({
                            type: "playlist",
                            id: currentPlaylist._id,
                          })
                        }
                        title={t("admin.albums.share")}
                      >
                        <Share className="mr-2 h-4 w-4" />
                        {t("admin.albums.share")}
                      </DropdownMenuItem>
                    )}
                    {isUserEditable && (
                      <>
                        <DropdownMenuSeparator className="bg-zinc-800/50" />
                        <DropdownMenuItem
                          className="cursor-pointer hover:bg-zinc-800/50"
                          onSelect={() =>
                            openEditPlaylistDialog(currentPlaylist, () =>
                              void refetchPlaylist(),
                            )
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {t("pages.playlist.actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-red-400 hover:bg-zinc-800/50 hover:text-red-300"
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
              ))}
            </div>

            <CollectionSongList
              songs={currentPlaylist.songs ?? []}
              context="playlist"
              isMobile={isMobile}
              currentSongId={currentSong?._id}
              isPlaying={isPlaying}
              onPlay={handlePlaylistSongPlay}
              onArtistClick={handleArtistNameClick}
              onAlbumClick={handleSongTitleClick}
              dateHeaderKey={playlistDateHeaderKey}
              getDateLabel={getPlaylistSongDateLabel}
              playlistId={currentPlaylist._id}
              isOwner={isUserEditable}
              mobileVariant="playlist"
              isLoggedIn={Boolean(user)}
            />
            {showAddToPlaylistButton && playlistId && (
              <PlaylistDiscoverSection
                playlistId={playlistId}
                playlistSongCount={currentPlaylist.songs?.length ?? 0}
                playlistSongIds={playlistSongIds}
                onAddSong={handleAddSongToPlaylist}
              />
            )}
          </div>
      </CollectionGradientLayout>
        <DeletePlaylistDialog
          open={!!playlistToDelete}
          onOpenChange={(isOpen) => !isOpen && closeAllDialogs()}
          onConfirm={handleDeletePlaylistConfirm}
          onCancel={closeAllDialogs}
          t={t}
        />

        <RemoveSongFromPlaylistDialog
          open={!!songToRemoveFromPlaylist}
          onOpenChange={(isOpen) => !isOpen && closeAllDialogs()}
          onConfirm={handleDeleteSongConfirm}
          onCancel={closeAllDialogs}
          t={t}
        />

        {currentPlaylist && currentPlaylist.isPublic && (
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
    </>
  );
};
export default PlaylistDetailsPage;
