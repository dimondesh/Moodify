import { Play } from "lucide-react";
import Equalizer from "@/components/ui/equalizer";
import EqualizerTitle from "@/components/ui/equalizer-title";
import { CoverImage } from "@/components/CoverImage";
import { CDN_DEFAULT_ALBUM_COVER } from "@/lib/cdn";
import { formatDuration, getArtistNames } from "@/lib/utils";
import { SaveSongToLibraryControl } from "@/layout/SaveSongToLibraryControl";
import SongOptionsMenu, {
  SongOptionsContext,
} from "@/components/SongOptionsMenu";
import {
  desktopSongListGridClass,
  desktopSongListPaddingClass,
  desktopSongListActionsClass,
} from "./layout";
import type { Song } from "@/types";

export type MobileSongListVariant = "album" | "playlist" | "artist";

export interface SongListRowProps {
  song: Song;
  index: number;
  isMobile: boolean;
  isCurrentSong: boolean;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  onArtistClick: (artistId: string) => void;
  onAlbumClick: (albumId: string | null | undefined) => void;
  getDateLabel: (song: Song) => string;
  getMobileSubtitle?: (song: Song) => string;
  context: SongOptionsContext;
  playlistId?: string;
  isOwner?: boolean;
  mobileVariant: MobileSongListVariant;
  mobileArtistNames?: string;
  isLoggedIn?: boolean;
}

export function SongListRow({
  song,
  index,
  isMobile,
  isCurrentSong,
  isPlaying,
  onPlay,
  onArtistClick,
  onAlbumClick,
  getDateLabel,
  getMobileSubtitle,
  context,
  playlistId,
  isOwner,
  mobileVariant,
  mobileArtistNames,
  isLoggedIn,
}: SongListRowProps) {
  if (isMobile) {
    const showMobileCover =
      mobileVariant === "playlist" || mobileVariant === "artist";
    const subtitle = getMobileSubtitle
      ? getMobileSubtitle(song)
      : mobileVariant === "album"
        ? (mobileArtistNames ?? "")
        : getArtistNames(song.artist);

    return (
      <div
        onClick={() => onPlay(index)}
        className="flex items-center justify-between gap-4 p-2 rounded-md group cursor-pointer hover:bg-white/5"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showMobileCover && (
            <CoverImage
              entity={song}
              size="thumb"
              defaultUrl={CDN_DEFAULT_ALBUM_COVER}
              alt={song.title}
              className="size-12 object-cover rounded-md flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isCurrentSong && isPlaying && (
                <div className="block sm:hidden flex-shrink-0">
                  <EqualizerTitle />
                </div>
              )}
              <p
                className={`font-medium truncate w-50 sm:w-120 ${
                  isCurrentSong ? "text-violet-400" : "text-white"
                }`}
              >
                {song.title}
              </p>
            </div>
            <p
              className={`text-sm text-zinc-400 truncate ${
                showMobileCover ? "w-45 sm:w-120" : ""
              }`}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <SongOptionsMenu
          song={song}
          context={context}
          variant="drawer"
          playlistId={playlistId}
          isOwner={isOwner}
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onPlay(index);
      }}
      className={`${desktopSongListGridClass} ${desktopSongListPaddingClass} py-2 text-sm text-gray-400 hover:bg-zinc-800/50 group cursor-pointer`}
    >
      <div className="flex items-center justify-center">
        {isCurrentSong && isPlaying ? (
          <div className="z-10">
            <Equalizer />
          </div>
        ) : (
          <span className="group-hover:hidden">{index + 1}</span>
        )}
        <Play className="h-4 w-4 hidden group-hover:block fill-current text-zinc-400" />
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <CoverImage
          entity={song}
          size="thumb"
          defaultUrl={CDN_DEFAULT_ALBUM_COVER}
          alt={song.title}
          className="size-10 object-cover rounded-md flex-shrink-0"
        />
        <div className="min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlbumClick(song.albumId);
            }}
            className={`inline-block max-w-full truncate font-medium text-left hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6] ${
              isCurrentSong ? "text-[#8b5cf6]" : "text-white"
            }`}
          >
            {song.title}
          </button>
          <div className="text-gray-400 truncate">
            {song.artist.map((artist, artistIndex) => (
              <span key={artist._id}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onArtistClick(artist._id);
                  }}
                  className="hover:text-[#8b5cf6] focus:outline-none focus:text-[#8b5cf6]"
                >
                  {artist.name}
                </button>
                {artistIndex < song.artist.length - 1 && ", "}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="hidden md:flex items-center min-w-0 text-xs">
        {getDateLabel(song)}
      </div>
      <div className={desktopSongListActionsClass}>
        <div className="flex justify-center">
          <SaveSongToLibraryControl
            song={song}
            disabled={!isLoggedIn}
            className="rounded-full size-7 opacity-0 group-hover:opacity-100"
            iconClassName="h-5 w-5"
          />
        </div>
        <span className="text-center text-xs tabular-nums">
          {formatDuration(song.duration)}
        </span>
        <div className="flex justify-center">
          <SongOptionsMenu
            song={song}
            context={context}
            variant="dropdown"
            playlistId={playlistId}
            isOwner={isOwner}
            className="opacity-0 group-hover:opacity-100"
          />
        </div>
      </div>
    </div>
  );
}
