// src/layout/SaveSongToLibraryControl.tsx

import React, { useEffect, useState, useMemo, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Plus, PlusCircle, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";
import CheckedIcon from "@/components/ui/checkedIcon";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import type { Playlist, Song } from "../types";
import toast from "react-hot-toast";

/** Inner panel (popover wrapper is transparent so theme tokens do not leak). */
const PANEL_CLASS =
  "flex w-[min(16rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-md bg-zinc-900 p-2.5 text-zinc-100 shadow-lg";

type LibraryPickerRowProps = {
  checked: boolean;
  imageUrl?: string;
  title: string;
  subtitle?: string;
  onToggle: () => void;
};

const LibraryPickerRow = memo(function LibraryPickerRow({
  checked,
  imageUrl,
  title,
  subtitle,
  onToggle,
}: LibraryPickerRowProps) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 rounded-md p-1 text-left hover:bg-zinc-800/50"
      onClick={onToggle}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-8 shrink-0 rounded bg-zinc-800 object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-100">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center">
        {checked ? (
          <CheckedIcon className="size-5 text-[#8b5cf6]" />
        ) : (
          <PlusCircle className="size-5 text-zinc-400 group-hover:text-white" />
        )}
      </span>
    </button>
  );
});

type SongLibraryPickerPanelProps = {
  song: Song;
  isLiked: boolean;
  playlistIdsContainingSong: string[];
  ownedPlaylists: Playlist[];
  onRequestClose: () => void;
};

/**
 * Body: new playlist → search → scrollable liked + playlists.
 * Background comes from the parent surface (zinc-900).
 */
const SongLibraryPickerPanel = memo(function SongLibraryPickerPanel({
  song,
  isLiked,
  playlistIdsContainingSong,
  ownedPlaylists,
  onRequestClose,
}: SongLibraryPickerPanelProps) {
  const { t } = useTranslation();
  const { toggleSongLike, fetchLibrary } = useLibraryStore();
  const {
    addSongToPlaylist,
    removeSongFromPlaylist,
    createPlaylistFromSong,
    fetchMyPlaylists,
  } = usePlaylistStore();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlaylists = useMemo(
    () =>
      ownedPlaylists.filter((p) =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [ownedPlaylists, searchTerm],
  );

  const refreshAfterLibraryChange = useCallback(async () => {
    await Promise.all([fetchLibrary(), fetchMyPlaylists()]);
  }, [fetchLibrary, fetchMyPlaylists]);

  const togglePlaylistMembership = useCallback(
    async (playlistId: string, shouldBeInPlaylist: boolean) => {
      try {
        if (shouldBeInPlaylist) {
          await addSongToPlaylist(playlistId, song._id);
        } else {
          await removeSongFromPlaylist(playlistId, song._id);
        }
        await refreshAfterLibraryChange();
      } catch {
        toast.error(t("player.playlistUpdateError"));
      }
    },
    [
      addSongToPlaylist,
      removeSongFromPlaylist,
      refreshAfterLibraryChange,
      song._id,
      t,
    ],
  );

  const createPlaylist = useCallback(async () => {
    onRequestClose();
    await createPlaylistFromSong(song);
    await refreshAfterLibraryChange();
  }, [createPlaylistFromSong, onRequestClose, refreshAfterLibraryChange, song]);

  const toggleLiked = useCallback(async () => {
    await toggleSongLike(song._id);
    await fetchLibrary();
  }, [fetchLibrary, song._id, toggleSongLike]);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-8 w-full mx-auto max-w-40 shrink-0 rounded-md bg-violet-600 text-xs font-medium text-white hover:bg-violet-500"
        onClick={createPlaylist}
      >
        <Plus className="mr-1.5 size-3.5 shrink-0" />
        {t("player.newPlaylist")}
      </Button>

      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          placeholder={t("player.findPlaylist")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-8 border-zinc-700 bg-zinc-950 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <ScrollArea className="max-h-[min(20rem,48vh)] pr-1">
        <div className="flex flex-col gap-0.5 pb-1">
          <LibraryPickerRow
            checked={isLiked}
            imageUrl="/liked.png"
            title={t("sidebar.likedSongs")}
            onToggle={toggleLiked}
          />
          {filteredPlaylists.map((playlist) => (
            <LibraryPickerRow
              key={playlist._id}
              checked={playlistIdsContainingSong.includes(playlist._id)}
              imageUrl={playlist.imageUrl}
              title={playlist.title}
              subtitle={`${playlist.songs.length} ${t("sidebar.subtitle.songs")}`}
              onToggle={() =>
                void togglePlaylistMembership(
                  playlist._id,
                  !playlistIdsContainingSong.includes(playlist._id),
                )
              }
            />
          ))}
        </div>
      </ScrollArea>
    </>
  );
});

interface SaveSongToLibraryControlProps {
  song: Song | null;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
}

function propsAreEqual(
  prev: SaveSongToLibraryControlProps,
  next: SaveSongToLibraryControlProps,
) {
  return (
    prev.song?._id === next.song?._id &&
    prev.disabled === next.disabled &&
    prev.className === next.className &&
    prev.iconClassName === next.iconClassName
  );
}

function SaveSongToLibraryControlInner({
  song,
  className,
  iconClassName = "size-5",
  disabled = false,
}: SaveSongToLibraryControlProps) {
  const { t } = useTranslation();
  const { isSongLiked, toggleSongLike, fetchLibrary } = useLibraryStore();
  const { ownedPlaylists, fetchOwnedPlaylists } = usePlaylistStore();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (song) void fetchOwnedPlaylists();
  }, [song, fetchOwnedPlaylists]);

  const playlistIdsContainingSong = useMemo(() => {
    if (!song) return [];
    return ownedPlaylists
      .filter((p) => p.songs.some((s) => s._id === song._id))
      .map((p) => p._id);
  }, [ownedPlaylists, song]);

  if (!song) return null;

  const liked = isSongLiked(song._id);
  const inLibrary = liked || playlistIdsContainingSong.length > 0;

  const addToLikedFirst = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inLibrary) return;
    await toggleSongLike(song._id);
    await fetchLibrary();
    toast.success(t("player.addedToLiked"));
  };

  const onMenuOpenChange = (open: boolean) => {
    if (inLibrary) setMenuOpen(open);
  };

  const trigger = (
    <Button
      type="button"
      variant="ghost2"
      size="icon"
      className={cn(
        "rounded-full p-0 transition-colors group",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={disabled ? undefined : addToLikedFirst}
      disabled={disabled}
      title={
        disabled
          ? t("auth.loginRequired")
          : inLibrary
            ? t("player.addToPlaylist")
            : t("player.saveToLibrary")
      }
    >
      {inLibrary ? (
        <CheckedIcon className={cn(iconClassName, "text-[#8b5cf6]")} />
      ) : (
        <PlusCircle
          className={cn(iconClassName, "text-zinc-400 group-hover:text-white")}
        />
      )}
    </Button>
  );

  const picker = (
    <SongLibraryPickerPanel
      song={song}
      isLiked={liked}
      playlistIdsContainingSong={playlistIdsContainingSong}
      ownedPlaylists={ownedPlaylists}
      onRequestClose={() => setMenuOpen(false)}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={inLibrary && menuOpen} onOpenChange={onMenuOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          aria-describedby={undefined}
          side="bottom"
          className="z-[100] flex max-h-[min(85dvh,520px)] flex-col rounded-t-2xl border-x border-t border-zinc-800 bg-zinc-900 p-0 text-zinc-100 shadow-2xl"
        >
          <SheetHeader className="shrink-0 border-b border-zinc-800 px-2.5 pb-1.5 pt-10 text-center">
            <SheetTitle className="text-sm font-semibold text-zinc-100">
              {t("player.addToPlaylist")}
            </SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-2.5 py-2">
            {picker}
          </div>
          <div className="shrink-0 border-t border-zinc-800 px-2.5 pb-3 pt-1.5">
            <Button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="h-9 w-full rounded-md bg-zinc-800 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
            >
              {t("player.done")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={inLibrary && menuOpen} onOpenChange={onMenuOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-auto border-0 bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className={PANEL_CLASS}>{picker}</div>
      </PopoverContent>
    </Popover>
  );
}

export const SaveSongToLibraryControl = memo(
  SaveSongToLibraryControlInner,
  propsAreEqual,
);
