/* eslint-disable @typescript-eslint/no-unused-vars */
// frontend/src/pages/PlaylistPage/AddToPlaylistSheet.tsx

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
import { useLibraryStore } from "@/stores/useLibraryStore";
import { Song } from "@/types";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface AddToPlaylistSheetProps {
  song: Song;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddToPlaylistSheet: React.FC<AddToPlaylistSheetProps> = ({
  song,
  isOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const {
    ownedPlaylists,
    fetchOwnedPlaylists,
    addSongToPlaylist,
    removeSongFromPlaylist,
    createPlaylistFromSong,
  } = usePlaylistStore();
  const { isSongLiked, toggleSongLike } = useLibraryStore();

  const [localPlaylistsWithSong, setLocalPlaylistsWithSong] = useState<
    Set<string>
  >(new Set());
  const [localIsLiked, setLocalIsLiked] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchOwnedPlaylists();
    }
  }, [isOpen, fetchOwnedPlaylists]);

  useEffect(() => {
    if (isOpen) {
      setLocalIsLiked(isSongLiked(song._id));
      const playlistsContainingSong = new Set(
        ownedPlaylists
          .filter((p) => p.songs.some((s) => s._id === song._id))
          .map((p) => p._id)
      );
      setLocalPlaylistsWithSong(playlistsContainingSong);
    }
  }, [isOpen, song, ownedPlaylists, isSongLiked]);

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
        toast.success(t("player.removedFromPlaylist"));
      } else {
        await addSongToPlaylist(playlistId, song._id);
        toast.success(t("player.addedToPlaylist"));
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
      toast.success(
        !originallyLiked
          ? t("player.addedToLiked")
          : t("player.removedFromLiked")
      );
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
    imageUrl,
    title,
    subtitle,
  }: {
    checked: boolean;
    onClick: () => void;
    imageUrl?: string;
    title: string;
    subtitle?: string;
  }) => (
    <div
      className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-700 cursor-pointer"
      onClick={onClick}
    >
      {imageUrl && (
        <img
          src={imageUrl}
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
            : "border-zinc-500 group-hover:border-white"
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
              imageUrl="/liked.png"
              title={t("sidebar.likedSongs")}
            />
            {ownedPlaylists.map((playlist) => (
              <CheckboxItem
                key={playlist._id}
                checked={localPlaylistsWithSong.has(playlist._id)}
                onClick={() => handlePlaylistToggle(playlist._id)}
                imageUrl={playlist.imageUrl}
                title={playlist.title}
                subtitle={`${playlist.songs.length} ${t(
                  "sidebar.subtitle.songs"
                )}`}
              />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default AddToPlaylistSheet;
