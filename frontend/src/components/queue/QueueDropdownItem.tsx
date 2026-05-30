import type { MouseEvent } from "react";
import { cn, getArtistNames } from "@/lib/utils";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import type { Song } from "@/types";
import SongOptionsMenu from "@/components/SongOptionsMenu";

interface QueueDropdownItemProps {
  song: Song;
  isCurrent?: boolean;
  onPlay: (song: Song, e: MouseEvent) => void;
  onRemove: (songId: string) => void;
}

export function QueueDropdownItem({
  song,
  isCurrent = false,
  onPlay,
  onRemove,
}: QueueDropdownItemProps) {
  const handlePlay = (e: MouseEvent) => {
    e.stopPropagation();
    onPlay(song, e);
  };

  return (
    <div
      className={cn(
        "group flex cursor-default items-center gap-2 px-3 py-2 hover:bg-zinc-800/50",
        isCurrent && "bg-[#8b5cf6]/20",
      )}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        handlePlay(e);
      }}
    >
      <button
        type="button"
        className="relative flex-shrink-0 cursor-pointer rounded-md"
        onClick={handlePlay}
        aria-label={song.title}
      >
        <CoverImage
          entity={song}
          size="thumb"
          defaultUrl={CDN_DEFAULT_ALBUM_COVER}
          alt={song.title}
          className="size-8 object-cover rounded-md"
        />
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm font-medium",
            isCurrent ? "text-[#8b5cf6]" : "text-white",
          )}
        >
          {song.title}
        </div>
        <div className="truncate text-xs text-gray-400">
          {getArtistNames(Array.isArray(song.artist) ? song.artist : [], [])}
        </div>
      </div>

      <SongOptionsMenu
        song={song}
        context="album"
        variant="dropdown"
        nested
        className="opacity-0 group-hover:opacity-100"
        onRemoveFromQueue={
          isCurrent ? undefined : () => onRemove(song._id)
        }
      />
    </div>
  );
}
