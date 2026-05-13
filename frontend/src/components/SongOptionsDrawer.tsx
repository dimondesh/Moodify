import React, { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Share, Heart, Plus, User, Trash2 } from "lucide-react";
import { Song } from "@/types";
import { useUIStore } from "@/stores/useUIStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getArtistNames } from "@/lib/utils";
import AddSongToPlaylistSheet from "@/components/AddSongToPlaylistSheet";
import { useAuthStore } from "@/stores/useAuthStore";

export type SongOptionsDrawerContext = "album" | "playlist";

export interface SongOptionsDrawerProps {
  song: Song | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  context: SongOptionsDrawerContext;
  /** Playlist page: current playlist id. Empty when not on a playlist (e.g. liked songs). */
  playlistId?: string;
  /** When true and `playlistId` is set, show “remove from this playlist”. */
  isOwner?: boolean;
}

const SongOptionsDrawer: React.FC<SongOptionsDrawerProps> = ({
  song,
  isOpen,
  onOpenChange,
  context,
  playlistId = "",
  isOwner = false,
}) => {
  const sessionUser = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openShareDialog, openRemoveSongFromPlaylistDialog } = useUIStore();
  const { isSongLiked, toggleSongLike } = useLibraryStore();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  if (!song) return null;

  const songIsLiked = isSongLiked(song._id);
  const isPlaylist = context === "playlist";
  const canRemoveFromThisPlaylist =
    isPlaylist && isOwner && Boolean(playlistId);
  const drawerSurfaceClass = isPlaylist
    ? "bg-[#0f0f0f] border-[#2a2a2a] text-white pb-4"
    : "bg-zinc-900 border-zinc-800 text-white pb-4";
  const artistLineClass = isPlaylist ? "text-gray-400" : "text-zinc-400";

  const handleShare = () => {
    openShareDialog({ type: "song", id: song._id });
    onOpenChange(false);
  };

  const handleLikeToggle = async () => {
    if (isPlaylist && !sessionUser) return;
    await toggleSongLike(song._id);
  };

  const handleGoToArtist = () => {
    if (song.artist && song.artist.length > 0) {
      const artistId =
        typeof song.artist[0] === "string"
          ? song.artist[0]
          : song.artist[0]._id;
      navigate(`/artists/${artistId}`);
      onOpenChange(false);
    }
  };

  const handleAddToPlaylist = () => {
    if (isPlaylist && !sessionUser) return;
    setIsAddToPlaylistOpen(true);
  };

  const handleRemoveFromPlaylist = () => {
    if (!playlistId) return;
    openRemoveSongFromPlaylistDialog({ songId: song._id, playlistId });
    onOpenChange(false);
  };

  const notifySheet = isPlaylist;

  return (
    <>
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent
          className={drawerSurfaceClass}
          aria-describedby={undefined}
        >
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader className="flex flex-col items-center text-center p-4 gap-4">
              <img
                src={song.imageUrl}
                alt={song.title}
                className="w-24 h-24 rounded-md"
              />
              <div>
                <DrawerTitle className="text-xl font-bold">
                  {song.title}
                </DrawerTitle>
                <p className={artistLineClass}>{getArtistNames(song.artist)}</p>
              </div>
            </DrawerHeader>
            <div className="p-4 flex flex-col gap-2">
              {!isPlaylist && (
                <>
                  <Button
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={handleShare}
                    title={t("albumPage.options.share", "Поделиться")}
                  >
                    <Share className="w-5 h-5 mr-4" />
                    <span className="text-base">
                      {t("albumPage.options.share", "Поделиться")}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={() => void handleLikeToggle()}
                  >
                    <Heart
                      className={`w-5 h-5 mr-4 ${
                        songIsLiked ? "fill-violet-500 text-violet-500" : ""
                      }`}
                    />
                    <span className="text-base">
                      {songIsLiked
                        ? t(
                            "albumPage.options.removeFromLiked",
                            "Удалить из любимых",
                          )
                        : t(
                            "albumPage.options.addToLiked",
                            "Добавить в любимые",
                          )}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={handleAddToPlaylist}
                  >
                    <Plus className="w-5 h-5 mr-4" />
                    <span className="text-base">
                      {t(
                        "albumPage.options.addToPlaylist",
                        "Добавить в плейлист",
                      )}
                    </span>
                  </Button>
                  {song.artist && song.artist.length > 0 && (
                    <Button
                      variant="ghost"
                      className="justify-start p-3 h-auto"
                      onClick={handleGoToArtist}
                    >
                      <User className="w-5 h-5 mr-4" />
                      <span className="text-base">
                        {t(
                          "albumPage.options.goToArtist",
                          "Перейти к исполнителю",
                        )}
                      </span>
                    </Button>
                  )}
                </>
              )}

              {isPlaylist && (
                <>
                  <Button
                    variant="ghost"
                    className={`justify-start p-3 h-auto ${!sessionUser ? "opacity-50" : ""}`}
                    disabled={!sessionUser}
                    title={
                      !sessionUser ? t("auth.loginRequired") : undefined
                    }
                    onClick={() => void handleLikeToggle()}
                  >
                    <Heart
                      className={`w-5 h-5 mr-4 ${
                        songIsLiked ? "fill-[#8b5cf6] text-[#8b5cf6]" : ""
                      }`}
                    />
                    <span className="text-base">
                      {songIsLiked
                        ? t("player.unlike")
                        : t("player.like")}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    className={`justify-start p-3 h-auto ${!sessionUser ? "opacity-50" : ""}`}
                    disabled={!sessionUser}
                    title={
                      !sessionUser ? t("auth.loginRequired") : undefined
                    }
                    onClick={handleAddToPlaylist}
                  >
                    <Plus className="w-5 h-5 mr-4" />
                    <span className="text-base">{t("player.addToPlaylist")}</span>
                  </Button>
                  {canRemoveFromThisPlaylist && (
                    <Button
                      variant="ghost"
                      className="justify-start p-3 h-auto text-red-400 hover:text-red-400"
                      onClick={handleRemoveFromPlaylist}
                    >
                      <Trash2 className="w-5 h-5 mr-4" />
                      <span className="text-base">
                        {t("pages.playlist.actions.removeSong")}
                      </span>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={handleGoToArtist}
                  >
                    <User className="w-5 h-5 mr-4" />
                    <span className="text-base">
                      {t("admin.albums.goToArtist")}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={handleShare}
                    title={t("admin.albums.share")}
                  >
                    <Share className="w-5 h-5 mr-4" />
                    <span className="text-base">{t("admin.albums.share")}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      {song && (
        <AddSongToPlaylistSheet
          song={song}
          isOpen={isAddToPlaylistOpen}
          notifyPlaylistMembershipChanges={notifySheet}
          notifyLikedSongsChanges={notifySheet}
          onOpenChange={(open) => {
            setIsAddToPlaylistOpen(open);
            if (!open) {
              onOpenChange(false);
            }
          }}
        />
      )}
    </>
  );
};

export default SongOptionsDrawer;
