import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Disc3,
  Heart,
  ListEnd,
  ListPlus,
  Scale,
  Share,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { useSongOptionsActions } from "./useSongOptionsActions";

const DRAWER_ITEM =
  "justify-start gap-3 rounded-none p-3 h-auto w-full text-base text-zinc-100 hover:bg-zinc-800/50 hover:text-zinc-100";

type SongOptionsActions = ReturnType<typeof useSongOptionsActions>;

export interface SongOptionsDrawerContentProps {
  actions: SongOptionsActions;
}

export function SongOptionsDrawerContent({ actions }: SongOptionsDrawerContentProps) {
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const {
    t,
    sessionUser,
    isPlaylist,
    isLiked,
    artists,
    hasMultipleArtists,
    hasAlbum,
    hasCredits,
    canRemoveFromThisPlaylist,
    goToArtist,
    goToAlbum,
    toggleLiked,
    openAddToPlaylistSheet,
    openCredits,
    openShare,
    handleRemoveFromPlaylist,
    handleAddToQueue,
  } = actions;

  if (artistPickerOpen) {
    return (
      <div className="flex flex-col gap-1 px-2 pb-4">
        <Button
          variant="ghost"
          className={DRAWER_ITEM}
          onClick={() => setArtistPickerOpen(false)}
        >
          <ChevronLeft className="size-5 shrink-0 text-zinc-400" />
          <span>
            {t(
              isPlaylist ? "admin.albums.goToArtist" : "albumPage.options.goToArtist",
              "Go to artist",
            )}
          </span>
        </Button>
        {artists.map((artist) => (
          <Button
            key={artist._id}
            variant="ghost"
            className={cn(DRAWER_ITEM, "pl-6")}
            onClick={() => goToArtist(artist._id)}
          >
            <span className="truncate">{artist.name}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2 pb-4">
      <Button
        variant="ghost"
        className={DRAWER_ITEM}
        onClick={handleAddToQueue}
      >
        <ListEnd className="size-5 shrink-0 text-zinc-400" />
        <span>{t("player.addToQueue")}</span>
      </Button>

      {sessionUser && (
        <>
          <Button
            variant="ghost"
            className={DRAWER_ITEM}
            onClick={openAddToPlaylistSheet}
          >
            <ListPlus className="size-5 shrink-0 text-zinc-400" />
            <span>{t("player.addToPlaylist")}</span>
          </Button>
          <Button
            variant="ghost"
            className={DRAWER_ITEM}
            onClick={() => void toggleLiked()}
          >
            <Heart
              className={cn(
                "size-5 shrink-0",
                isLiked ? "fill-current text-[#8b5cf6]" : "text-zinc-400",
              )}
            />
            <span>{isLiked ? t("player.unlike") : t("player.saveToLibrary")}</span>
          </Button>
        </>
      )}

      {hasAlbum && (
        <Button variant="ghost" className={DRAWER_ITEM} onClick={goToAlbum}>
          <Disc3 className="size-5 shrink-0 text-zinc-400" />
          <span>{t("albumPage.options.goToAlbum", "Go to album")}</span>
        </Button>
      )}

      {artists.length === 1 && (
        <Button
          variant="ghost"
          className={DRAWER_ITEM}
          onClick={() => goToArtist(artists[0]._id)}
        >
          <User className="size-5 shrink-0 text-zinc-400" />
          <span>
            {t(
              isPlaylist ? "admin.albums.goToArtist" : "albumPage.options.goToArtist",
              "Go to artist",
            )}
          </span>
        </Button>
      )}

      {hasMultipleArtists && (
        <Button
          variant="ghost"
          className={DRAWER_ITEM}
          onClick={() => setArtistPickerOpen(true)}
        >
          <User className="size-5 shrink-0 text-zinc-400" />
          <span>
            {t(
              isPlaylist ? "admin.albums.goToArtist" : "albumPage.options.goToArtist",
              "Go to artist",
            )}
          </span>
        </Button>
      )}

      <Button variant="ghost" className={DRAWER_ITEM} onClick={openShare}>
        <Share className="size-5 shrink-0 text-zinc-400" />
        <span>
          {t(
            isPlaylist ? "admin.albums.share" : "albumPage.options.share",
            "Share",
          )}
        </span>
      </Button>

      {hasCredits && (
        <Button variant="ghost" className={DRAWER_ITEM} onClick={openCredits}>
          <Scale className="size-5 shrink-0 text-zinc-400" />
          <span>{t("songOptions.credits", "Credits")}</span>
        </Button>
      )}

      {canRemoveFromThisPlaylist && (
        <Button
          variant="ghost"
          className={DRAWER_ITEM}
          onClick={handleRemoveFromPlaylist}
        >
          <Trash2 className="size-5 shrink-0 text-zinc-400" />
          <span>{t("pages.playlist.actions.removeSong")}</span>
        </Button>
      )}
    </div>
  );
}
