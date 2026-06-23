import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Disc3,
  ListEnd,
  ListPlus,
  PlusCircle,
  Scale,
  Share,
  Trash2,
  User,
} from "lucide-react";
import CheckedIcon from "@/components/ui/checkedIcon";
import { Song } from "@/types";
import { SongAddToPlaylistSubmenu } from "./SongAddToPlaylistSubmenu";
import { SongShareSubmenu } from "./SongShareSubmenu";
import { SONG_MENU_ITEM, SONG_MENU_SUB_TRIGGER, SONG_MENU_SURFACE } from "./menuStyles";
import type { useSongOptionsActions } from "./useSongOptionsActions";

type SongOptionsActions = ReturnType<typeof useSongOptionsActions>;

export interface SongOptionsDropdownContentProps {
  song: Song;
  actions: SongOptionsActions;
  onClose: () => void;
  onRemoveFromQueue?: () => void;
}

export function SongOptionsDropdownContent({
  song,
  actions,
  onClose,
  onRemoveFromQueue,
}: SongOptionsDropdownContentProps) {
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
    playlistIdsContainingSong,
    goToArtist,
    goToAlbum,
    toggleLiked,
    openCredits,
    handleRemoveFromPlaylist,
    handleAddToQueue,
  } = actions;

  return (
    <DropdownMenuContent
      className={SONG_MENU_SURFACE}
      align="end"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenuItem
        className={SONG_MENU_ITEM}
        onSelect={(e) => {
          e.preventDefault();
          handleAddToQueue();
        }}
      >
        <ListEnd />
        <span>{t("player.addToQueue")}</span>
      </DropdownMenuItem>

      {sessionUser && (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={SONG_MENU_SUB_TRIGGER}>
              <ListPlus />
              <span>{t("player.addToPlaylist")}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className={SONG_MENU_SURFACE}
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
            >
              <SongAddToPlaylistSubmenu
                song={song}
                playlistIdsContainingSong={playlistIdsContainingSong}
                onRequestClose={onClose}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className={SONG_MENU_ITEM}
            onSelect={(e) => {
              e.preventDefault();
              void toggleLiked();
            }}
          >
            {isLiked ? (
              <CheckedIcon className="size-4 shrink-0 text-[#8b5cf6]" />
            ) : (
              <PlusCircle className="size-4 shrink-0 text-zinc-400" />
            )}
            <span>
              {isLiked
                ? t("player.removeFromLikedSongs")
                : t("player.addToLikedSongs")}
            </span>
          </DropdownMenuItem>
        </>
      )}

      {hasAlbum && (
        <DropdownMenuItem className={SONG_MENU_ITEM} onSelect={goToAlbum}>
          <Disc3 />
          <span>{t("albumPage.options.goToAlbum", "Go to album")}</span>
        </DropdownMenuItem>
      )}

      {artists.length === 1 && (
        <DropdownMenuItem
          className={SONG_MENU_ITEM}
          onSelect={() => goToArtist(artists[0]._id)}
        >
          <User />
          <span>
            {t(
              isPlaylist ? "admin.albums.goToArtist" : "albumPage.options.goToArtist",
              "Go to artist",
            )}
          </span>
        </DropdownMenuItem>
      )}

      {hasMultipleArtists && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={SONG_MENU_SUB_TRIGGER}>
            <User />
            <span>
              {t(
                isPlaylist ? "admin.albums.goToArtist" : "albumPage.options.goToArtist",
                "Go to artist",
              )}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={SONG_MENU_SURFACE} sideOffset={4}>
            {artists.map((artist) => (
              <DropdownMenuItem
                key={artist._id}
                className={SONG_MENU_ITEM}
                onSelect={() => goToArtist(artist._id)}
              >
                <span className="truncate">{artist.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={SONG_MENU_SUB_TRIGGER}>
          <Share />
          <span>
            {t(
              isPlaylist ? "admin.albums.share" : "albumPage.options.share",
              "Share",
            )}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent
          className={SONG_MENU_SURFACE}
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
        >
          <SongShareSubmenu songId={song._id} onRequestClose={onClose} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {hasCredits && (
        <DropdownMenuItem
          className={SONG_MENU_ITEM}
          onSelect={(e) => {
            e.preventDefault();
            openCredits();
          }}
        >
          <Scale />
          <span>{t("songOptions.credits", "Credits")}</span>
        </DropdownMenuItem>
      )}

      {canRemoveFromThisPlaylist && (
        <DropdownMenuItem
          className={SONG_MENU_ITEM}
          onSelect={handleRemoveFromPlaylist}
        >
          <Trash2 />
          <span>{t("pages.playlist.actions.removeSong")}</span>
        </DropdownMenuItem>
      )}

      {onRemoveFromQueue && (
        <DropdownMenuItem
          className={SONG_MENU_ITEM}
          onSelect={(e) => {
            e.preventDefault();
            onRemoveFromQueue();
            onClose();
          }}
        >
          <Trash2 />
          <span>{t("player.queue.removeFromQueue")}</span>
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );
}
