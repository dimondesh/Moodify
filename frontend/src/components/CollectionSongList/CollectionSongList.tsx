import { Fragment } from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SongListRow, MobileSongListVariant } from "./SongListRow";
import {
  desktopSongListGridClass,
  desktopSongListPaddingClass,
  desktopSongListActionsClass,
} from "./layout";
import type { SongOptionsContext } from "@/components/SongOptionsMenu";
import type { Song } from "@/types";

export interface CollectionSongListProps {
  songs: Song[];
  context: SongOptionsContext;
  isMobile: boolean;
  currentSongId?: string;
  isPlaying: boolean;
  onPlay: (index: number) => void;
  onArtistClick: (artistId: string) => void;
  onAlbumClick: (albumId: string | null | undefined) => void;
  dateHeaderKey: string;
  getDateLabel: (song: Song) => string;
  getMobileSubtitle?: (song: Song) => string;
  playlistId?: string;
  isOwner?: boolean;
  mobileVariant: MobileSongListVariant;
  mobileArtistNames?: string;
  isLoggedIn?: boolean;
  /** When false, skips the desktop column header row (e.g. artist popular tracks). */
  showDesktopHeader?: boolean;
  /** When false, removes the list surface tint (bg-black/20). */
  dimBackground?: boolean;
}

const resolveDiscNumber = (song: Song) => song.discNumber ?? 1;

export function CollectionSongList({
  songs,
  context,
  isMobile,
  currentSongId,
  isPlaying,
  onPlay,
  onArtistClick,
  onAlbumClick,
  dateHeaderKey,
  getDateLabel,
  getMobileSubtitle,
  playlistId,
  isOwner,
  mobileVariant,
  mobileArtistNames,
  isLoggedIn,
  showDesktopHeader = true,
  dimBackground = true,
}: CollectionSongListProps) {
  const { t } = useTranslation();

  const isMultiDisc =
    context === "album" &&
    new Set(songs.map(resolveDiscNumber)).size > 1;

  const discTrackCounters = new Map<number, number>();

  return (
    <div className={dimBackground ? "bg-black/20" : undefined}>
      {!isMobile && showDesktopHeader && (
        <div
          className={`${desktopSongListGridClass} ${desktopSongListPaddingClass} py-2 text-sm text-gray-400 border-b border-[#2a2a2a]`}
        >
          <div>#</div>
          <div>
            {context === "album"
              ? t("pages.album.headers.title")
              : t("pages.playlist.headers.title")}
          </div>
          <div className="hidden md:block min-w-0">{t(dateHeaderKey)}</div>
          <div className={desktopSongListActionsClass}>
            <span aria-hidden="true" />
            <Clock className="h-4 w-4 justify-self-center" />
            <span aria-hidden="true" />
          </div>
        </div>
      )}
      <div className={isMobile ? "px-2 sm:px-6" : undefined}>
        <div className="space-y-1 sm:space-y-2 py-4">
          {songs.map((song, index) => {
            const disc = resolveDiscNumber(song);
            const showDiscHeader =
              isMultiDisc &&
              (index === 0 || resolveDiscNumber(songs[index - 1]) !== disc);

            const withinDisc = (discTrackCounters.get(disc) ?? 0) + 1;
            discTrackCounters.set(disc, withinDisc);

            const displayNumber = isMultiDisc
              ? (song.trackNumber ?? withinDisc)
              : index + 1;

            return (
              <Fragment key={song._id}>
                {showDiscHeader && (
                  <div
                    className={`${
                      isMobile
                        ? "px-2 pt-3 pb-1"
                        : `${desktopSongListPaddingClass} pt-4 pb-1`
                    } text-sm font-semibold text-zinc-300`}
                  >
                    {t("pages.album.disc", { n: disc })}
                  </div>
                )}
                <SongListRow
                  song={song}
                  index={index}
                  displayNumber={displayNumber}
                  isMobile={isMobile}
                  isCurrentSong={currentSongId === song._id}
                  isPlaying={isPlaying}
                  onPlay={onPlay}
                  onArtistClick={onArtistClick}
                  onAlbumClick={onAlbumClick}
                  getDateLabel={getDateLabel}
                  getMobileSubtitle={getMobileSubtitle}
                  context={context}
                  playlistId={playlistId}
                  isOwner={isOwner}
                  mobileVariant={mobileVariant}
                  mobileArtistNames={mobileArtistNames}
                  isLoggedIn={isLoggedIn}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
