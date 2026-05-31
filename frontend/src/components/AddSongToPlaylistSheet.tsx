/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import { useOwnedPlaylists } from "@/hooks/queries";
import { useIsSongLiked } from "@/hooks/useLikedSongs";
import { Song } from "@/types";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getPlaylistDisplayTitle } from "@/lib/entitySection";
import { CDN_DEFAULT_ALBUM_COVER, CDN_LIKED_PLAYLIST_COVER } from "@/lib/cdn";
import { buildStaticCdnImages, getImageUrlByKey } from "@/lib/imageUrl";

interface AddSongToPlaylistSheetProps {
  song: Song;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Success toasts when adding/removing the track from a user playlist row. */
  notifyPlaylistMembershipChanges?: boolean;
  /** Success toasts when toggling liked songs from this sheet. */
  notifyLibraryChanges?: boolean;
}

const AddSongToPlaylistSheet: React.FC<AddSongToPlaylistSheetProps> = ({
  song,
  isOpen,
  onOpenChange,
  notifyPlaylistMembershipChanges = false,
  notifyLibraryChanges = false,
}) => {
  const { t, i18n } = useTranslation();
  const { data: ownedPlaylists = [] } = useOwnedPlaylists();
  const {
    addSongToPlaylist,
    removeSongFromPlaylist,
    createPlaylistFromSong,
    toggleSongLike,
  } = usePlaylistStore();
  const isLiked = useIsSongLiked(song._id);

  const [localPlaylistsWithSong, setLocalPlaylistsWithSong] = useState<
    Set<string>
  >(new Set());
  const [localIsLiked, setLocalIsLiked] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalIsLiked(isLiked);
      const playlistsContainingSong = new Set(
        ownedPlaylists
          .filter((p) => p.songs.some((s) => s._id === song._id))
          .map((p) => p._id),
      );
      setLocalPlaylistsWithSong(playlistsContainingSong);
    }
  }, [isOpen, song, ownedPlaylists, isLiked]);

  const handlePlaylistToggle = async (playlistId: string) => {
    const wasInPlaylist = localPlaylistsWithSong.has(playlistId);
    setLocalPlaylistsWithSong((prev) => {
      const newSet = new Set(prev);
      if (wasInPlaylist) newSet.delete(playlistId);
      else newSet.add(playlistId);
      return newSet;
    });

    try {
      if (wasInPlaylist) {
        await removeSongFromPlaylist(playlistId, song._id);
        if (notifyPlaylistMembershipChanges) {
          toast.success(t("player.removedFromPlaylist"));
        }
      } else {
        await addSongToPlaylist(playlistId, song._id);
        if (notifyPlaylistMembershipChanges) {
          toast.success(t("player.addedToPlaylist"));
        }
      }
    } catch (e) {
      toast.error(t("player.playlistUpdateError"));
      setLocalPlaylistsWithSong((prev) => {
        const newSet = new Set(prev);
        if (wasInPlaylist) newSet.add(playlistId);
        else newSet.delete(playlistId);
        return newSet;
      });
    }
  };

  const handleLikeToggle = async () => {
    const originallyLiked = localIsLiked;
    setLocalIsLiked(!originallyLiked);
    try {
      await toggleSongLike(song._id);
      if (notifyLibraryChanges) {
        toast.success(
          !originallyLiked
            ? t("player.addedToLiked")
            : t("player.removedFromLiked"),
        );
      }
    } catch (e) {
      toast.error("Failed to update liked songs.");
      setLocalIsLiked(originallyLiked);
    }
  };

  const handleCreateAndAdd = async () => {
    await createPlaylistFromSong(song);
    onOpenChange(false);
  };

  const CheckboxItem = ({
    checked,
    onClick,
    coverSrc,
    title,
    subtitle,
  }: {
    checked: boolean;
    onClick: () => void;
    coverSrc?: string;
    title: string;
    subtitle?: string;
  }) => (
    <div
      className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-700 cursor-pointer"
      onClick={onClick}
    >
      {coverSrc && (
        <img
          src={coverSrc}
          alt={title}
          className="w-12 h-12 object-cover rounded-md flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold max-w-50 truncate md:max-w-70">{title}</p>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>
      <div
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          checked
            ? "bg-violet-500 border-violet-500"
            : "border-zinc-500 group-hover:border-white",
        )}
      >
        {checked && <Check className="w-4 h-4 text-white" />}
      </div>
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-zinc-900 border-zinc-800 text-white rounded-t-2xl h-[90vh] z-[120] flex flex-col p-0"
        aria-describedby={undefined}
      >
        <SheetHeader className="text-center p-4 border-b border-zinc-800 flex-shrink-0">
          <SheetTitle>{t("player.addToPlaylist")}</SheetTitle>
          <SheetDescription>{song.title}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-shrink-0">
          <Button
            variant="secondary"
            className="w-full justify-center rounded-md bg-zinc-800 hover:bg-zinc-700"
            onClick={handleCreateAndAdd}
          >
            <Plus className="mr-2 h-5 w-5" /> {t("player.newPlaylist")}
          </Button>
        </div>
        <ScrollArea className="flex-grow px-4">
          <div className="space-y-1 pb-4">
            <CheckboxItem
              checked={localIsLiked}
              onClick={handleLikeToggle}
              coverSrc={getImageUrlByKey(
                { images: buildStaticCdnImages(CDN_LIKED_PLAYLIST_COVER) },
                "thumb",
                CDN_LIKED_PLAYLIST_COVER,
              )}
              title={t("sidebar.likedSongs")}
            />
            {ownedPlaylists
              .filter((p) => p.type !== "LIKED_SONGS")
              .map((playlist) => (
              <CheckboxItem
                key={playlist._id}
                checked={localPlaylistsWithSong.has(playlist._id)}
                onClick={() => handlePlaylistToggle(playlist._id)}
                coverSrc={getImageUrlByKey(
                  playlist,
                  "thumb",
                  CDN_DEFAULT_ALBUM_COVER,
                )}
                title={getPlaylistDisplayTitle(playlist, i18n.language, t)}
                subtitle={`${playlist.songs.length} ${t(
                  "sidebar.subtitle.songs",
                )}`}
              />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default AddSongToPlaylistSheet;
