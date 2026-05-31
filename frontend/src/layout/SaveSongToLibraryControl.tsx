// src/layout/SaveSongToLibraryControl.tsx

import React, { useState, useMemo, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, PlusCircle, Search } from "lucide-react";
import { Drawer } from "vaul";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import CheckedIcon from "@/components/ui/checkedIcon";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { getPlaylistDisplayTitle } from "@/lib/entitySection";
import { CDN_DEFAULT_ALBUM_COVER, CDN_LIKED_PLAYLIST_COVER } from "@/lib/cdn";
import { buildStaticCdnImages, getImageUrlByKey } from "@/lib/imageUrl";
import { useLibraryStore } from "../stores/useLibraryStore";
import { usePlaylistStore } from "../stores/usePlaylistStore";
import { useOwnedPlaylists } from "@/hooks/queries";
import { invalidatePlaylistLists } from "@/lib/invalidateQueries";
import { useIsSongLiked } from "@/hooks/useLikedSongs";
import type { Playlist, Song } from "../types";
import { DROPDOWN_SURFACE } from "@/components/song-options/menuStyles";
import toast from "react-hot-toast";

/** Inner panel (popover wrapper is transparent so theme tokens do not leak). */
const PANEL_CLASS = `flex w-[min(16rem,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden ${DROPDOWN_SURFACE}`;

const ROW_ICON = "size-5 text-[#8b5cf6]";
const ROW_ICON_OUTLINE = "size-5 text-zinc-400 group-hover:text-white";

type LibraryPickerDensity = "compact" | "comfortable";

type LibraryPickerRowProps = {
  checked: boolean;
  coverSrc?: string;
  title: string;
  subtitle?: string;
  actionLabel: string;
  onToggle: () => void | Promise<void>;
  density?: LibraryPickerDensity;
};

/** Row body is display-only; only the trailing control toggles (matches desktop UX). */
const LibraryPickerRow = memo(function LibraryPickerRow({
  checked,
  coverSrc,
  title,
  subtitle,
  actionLabel,
  onToggle,
  density = "compact",
}: LibraryPickerRowProps) {
  const comfortable = density === "comfortable";
  return (
    <div
      className={cn(
        "flex w-full items-center rounded-none hover:bg-zinc-800/50",
        comfortable ? "gap-3 px-3 py-2.5" : "gap-1.5 px-3 py-2",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center",
          comfortable ? "gap-3" : "gap-1.5",
        )}
      >
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className={cn(
              "shrink-0 rounded bg-zinc-800 object-cover",
              comfortable ? "size-11" : "size-8",
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              "truncate font-medium text-zinc-100",
              comfortable ? "text-sm" : "text-xs",
            )}
          >
            {title}
          </p>
          {subtitle ? (
            <p
              className={cn(
                "truncate text-zinc-500",
                comfortable ? "text-sm" : "text-xs",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost2"
        size="icon"
        className={cn(
          "group shrink-0 rounded-full p-0",
          comfortable ? "size-11" : "size-9",
        )}
        aria-label={actionLabel}
        aria-pressed={checked}
        title={actionLabel}
        data-vaul-no-drag
        onClick={(e) => {
          e.stopPropagation();
          void Promise.resolve(onToggle());
        }}
      >
        {checked ? (
          <CheckedIcon
            className={comfortable ? "size-6 text-[#8b5cf6]" : ROW_ICON}
          />
        ) : (
          <PlusCircle
            className={
              comfortable
                ? "size-6 text-zinc-400 group-hover:text-white"
                : ROW_ICON_OUTLINE
            }
          />
        )}
      </Button>
    </div>
  );
});

type SongLibraryPickerPanelProps = {
  song: Song;
  isLiked: boolean;
  playlistIdsContainingSong: string[];
  ownedPlaylists: Playlist[];
  onRequestClose: () => void;
  density?: LibraryPickerDensity;
  /** When false, hide the Liked Songs row (e.g. add-to-playlist submenu). */
  includeLikedSongs?: boolean;
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
  density = "compact",
  includeLikedSongs = true,
}: SongLibraryPickerPanelProps) {
  const { t, i18n } = useTranslation();
  const { fetchLibrary } = useLibraryStore();
  const {
    toggleSongLike,
    addSongToPlaylist,
    removeSongFromPlaylist,
    createPlaylistFromSong,
  } = usePlaylistStore();

  const [searchTerm, setSearchTerm] = useState("");

  const playlistDisplayTitle = useCallback(
    (playlist: Playlist) =>
      getPlaylistDisplayTitle(playlist, i18n.language, t),
    [i18n.language, t],
  );

  const filteredPlaylists = useMemo(
    () =>
      ownedPlaylists.filter(
        (p) =>
          p.type !== "LIKED_SONGS" &&
          playlistDisplayTitle(p)
            .toLowerCase()
            .includes(searchTerm.toLowerCase()),
      ),
    [ownedPlaylists, searchTerm, playlistDisplayTitle],
  );

  const refreshAfterLibraryChange = useCallback(async () => {
    await Promise.all([
      fetchLibrary({ silent: true }),
      invalidatePlaylistLists(),
    ]);
  }, [fetchLibrary]);

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
  }, [song._id, toggleSongLike]);

  const likedActionLabel = isLiked ? t("player.unlike") : t("player.like");
  const comfortable = density === "comfortable";

  const body = (
    <>
      <Button
        type="button"
        variant="secondary"
        className={cn(
          "w-full shrink-0 rounded-none border-b border-zinc-800 bg-transparent font-medium text-zinc-100 hover:bg-zinc-800/50",
          comfortable ? "h-11 justify-start gap-2 px-3 text-sm" : "h-9 justify-start gap-2 px-3 text-xs",
        )}
        data-vaul-no-drag
        onClick={createPlaylist}
      >
        <Plus
          className={cn("mr-1.5 shrink-0", comfortable ? "size-4" : "size-3.5")}
        />
        {t("player.newPlaylist")}
      </Button>

      <div className={cn("relative shrink-0 border-b border-zinc-800", comfortable ? "h-11" : "h-9")}>
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500",
            comfortable ? "size-4" : "size-3.5",
          )}
        />
        <Input
          placeholder={t("player.findPlaylist")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn(
            "h-full rounded-none border-0 bg-transparent text-zinc-100 placeholder:text-zinc-500",
            comfortable ? "pl-9 pr-3 text-sm" : "pl-9 pr-3 text-xs",
          )}
          data-vaul-no-drag
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div
        className={cn(
          "overscroll-contain hide-scrollbar",
          comfortable
            ? "min-h-0 flex-1 overflow-y-auto"
            : "max-h-[min(20rem,48vh)] overflow-y-auto",
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          {includeLikedSongs && (
            <LibraryPickerRow
              checked={isLiked}
              density={density}
              coverSrc={getImageUrlByKey(
                { images: buildStaticCdnImages(CDN_LIKED_PLAYLIST_COVER) },
                "thumb",
                CDN_LIKED_PLAYLIST_COVER,
              )}
              title={t("sidebar.likedSongs")}
              actionLabel={likedActionLabel}
              onToggle={toggleLiked}
            />
          )}
          {filteredPlaylists.map((playlist) => {
            const inPl = playlistIdsContainingSong.includes(playlist._id);
            return (
              <LibraryPickerRow
                key={playlist._id}
                checked={inPl}
                density={density}
                coverSrc={getImageUrlByKey(
                  playlist,
                  "thumb",
                  CDN_DEFAULT_ALBUM_COVER,
                )}
                title={playlistDisplayTitle(playlist)}
                subtitle={`${playlist.songs.length} ${t("sidebar.subtitle.songs")}`}
                actionLabel={
                  inPl
                    ? t("common.removeFromPlaylist")
                    : t("player.addToPlaylist")
                }
                onToggle={() =>
                  void togglePlaylistMembership(playlist._id, !inPl)
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );

  if (comfortable) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
    );
  }

  return <div className="flex min-h-0 flex-col overflow-hidden">{body}</div>;
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
  const { data: ownedPlaylists = [] } = useOwnedPlaylists();
  const { toggleSongLike } = usePlaylistStore();
  const liked = useIsSongLiked(song?._id);
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const [menuOpen, setMenuOpen] = useState(false);

  const playlistIdsContainingSong = useMemo(() => {
    if (!song) return [];
    return ownedPlaylists
      .filter((p) => p.songs.some((s) => s._id === song._id))
      .map((p) => p._id);
  }, [ownedPlaylists, song]);

  if (!song) return null;

  const inLibrary = liked || playlistIdsContainingSong.length > 0;

  const addToLikedFirst = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inLibrary) return;
    await toggleSongLike(song._id);
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
      density={isMobile ? "comfortable" : "compact"}
    />
  );

  if (isMobile) {
    return (
      <Drawer.Root
        open={Boolean(inLibrary && menuOpen)}
        onOpenChange={onMenuOpenChange}
        shouldScaleBackground={false}
      >
        <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
          <Drawer.Content
            aria-describedby={undefined}
            className={cn(
              "fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col rounded-none border-0 bg-zinc-900 text-zinc-100 outline-none",
            )}
          >
            <div className="flex shrink-0 cursor-grab select-none items-center gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] active:cursor-grabbing">
              <Drawer.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-vaul-no-drag
                  className="size-11 shrink-0 text-zinc-400 hover:text-white"
                  aria-label={t("player.close")}
                >
                  <ChevronDown className="size-7" />
                </Button>
              </Drawer.Close>
              <Drawer.Title className="min-w-0 flex-1 pr-2 text-center text-base font-semibold text-zinc-100">
                {t("player.addToPlaylist")}
              </Drawer.Title>
              <div className="size-11 shrink-0" aria-hidden />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overscroll-contain px-3 py-3">
              {picker}
            </div>

            <div className="shrink-0 flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <Drawer.Close asChild>
                <Button
                  type="button"
                  data-vaul-no-drag
                  className="h-11 w-full rounded-3xl max-w-30 bg-violet-500 text-sm font-medium text-[#1f1f1f]"
                >
                  {t("player.done")}
                </Button>
              </Drawer.Close>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Popover open={inLibrary && menuOpen} onOpenChange={onMenuOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={6}
        className="w-auto overscroll-contain border-0 bg-transparent p-0 shadow-none"
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

export { SongLibraryPickerPanel };
