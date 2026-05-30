import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Disc3,
  Heart,
  ListPlus,
  Share,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Song } from "@/types";
import { SongAddToPlaylistSubmenu } from "./SongAddToPlaylistSubmenu";
import { SongShareSubmenu } from "./SongShareSubmenu";
import { SONG_MENU_ITEM, SONG_MENU_SUB_TRIGGER, SONG_MENU_SURFACE } from "./menuStyles";
import type { SongOptionsContext } from "@/components/SongOptionsMenu";
import { useSongOptionsActions } from "./useSongOptionsActions";

export interface SongOptionsDropdownContentProps {
  song: Song;
  context: SongOptionsContext;
  playlistId?: string;
  isOwner?: boolean;
  onClose: () => void;
}

export function SongOptionsDropdownContent({
  song,
  context,
  playlistId = "",
  isOwner = false,
  onClose,
}: SongOptionsDropdownContentProps) {
  const {
    t,
    sessionUser,
    isPlaylist,
    isLiked,
    artists,
    hasMultipleArtists,
    hasAlbum,
    canRemoveFromThisPlaylist,
    playlistIdsContainingSong,
    goToArtist,
    goToAlbum,
    toggleLiked,
    handleRemoveFromPlaylist,
  } = useSongOptionsActions(song, context, playlistId, isOwner, onClose);

  return (
    <DropdownMenuContent
      className={SONG_MENU_SURFACE}
      align="end"
      onClick={(e) => e.stopPropagation()}
    >
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
            <Heart className={cn(isLiked && "fill-current !text-[#8b5cf6]")} />
            <span>
              {isLiked ? t("player.unlike") : t("player.saveToLibrary")}
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

      {canRemoveFromThisPlaylist && (
        <DropdownMenuItem
          className={SONG_MENU_ITEM}
          onSelect={handleRemoveFromPlaylist}
        >
          <Trash2 />
          <span>{t("pages.playlist.actions.removeSong")}</span>
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );
}
