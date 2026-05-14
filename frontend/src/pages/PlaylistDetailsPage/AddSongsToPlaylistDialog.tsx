import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import StandardLoader from "@/components/ui/StandardLoader";
import type { Playlist, Song } from "@/types";
import type { TFunction } from "i18next";
import { RefreshCw } from "lucide-react";

type AddSongsToPlaylistDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string | undefined;
  currentPlaylist: Playlist | null;
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  searchSongs: Song[];
  searchLoading: boolean;
  recommendations: Song[];
  isRecommendationsLoading: boolean;
  onRefreshRecommendations: () => void;
  onAddSong: (songId: string) => void;
  onSongAlbumNavigate: (albumId: string | null | undefined) => void;
  onSongArtistNavigate: (artistId: string) => void;
  t: TFunction;
};

export function AddSongsToPlaylistDialog({
  open,
  onOpenChange,
  playlistId,
  currentPlaylist,
  searchTerm,
  onSearchTermChange,
  searchSongs,
  searchLoading,
  recommendations,
  isRecommendationsLoading,
  onRefreshRecommendations,
  onAddSong,
  onSongAlbumNavigate,
  onSongArtistNavigate,
  t,
}: AddSongsToPlaylistDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[60%vw] w-[40%vw] bg-zinc-900text-white border-0">
        <DialogHeader>
          <DialogTitle className="text-white max-w-[80vw]">
            {t("pages.playlist.addSongDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 max-w-[80vw]">
            {t("pages.playlist.addSongDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder={t("pages.playlist.addSongDialog.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="mb-4 bg-zinc-800 text-white border-zinc-700 focus:ring-violet-500 w-[80vw] sm:w-[55vw] md:w-[38vw] lg:w-[19.5vw] 2xl:w-[18vw]"
          />
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {searchTerm.trim() !== "" ? (
                <>
                  {searchLoading ? (
                    <p className="text-zinc-400">
                      {t("pages.playlist.addSongDialog.searching")}
                    </p>
                  ) : searchSongs.length === 0 ? (
                    <p className="text-zinc-400">
                      {t("pages.playlist.addSongDialog.noSongsFound")}
                    </p>
                  ) : (
                    searchSongs.map((song) => (
                      <div
                        key={song._id}
                        className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-md cursor-pointer sm:w-[55vw] md:w-[38vw] w-[80vw] lg:w-[20vw] 2xl:w-[18vw]"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onSongAlbumNavigate(song.albumId)}
                            className="font-semibold text-white truncate text-left hover:underline focus:outline-none focus:underline"
                          >
                            {song.title}
                          </button>
                          <span className="text-sm text-zinc-400 truncate">
                            {song.artist.map((artist, artistIndex) => (
                              <span key={artist._id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSongArtistNavigate(artist._id)
                                  }
                                  className="hover:underline focus:outline-none focus:underline"
                                >
                                  {artist.name}
                                </button>
                                {artistIndex < song.artist.length - 1 && ", "}
                              </span>
                            ))}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => onAddSong(song._id)}
                          className="bg-violet-500 hover:bg-violet-400 text-white ml-4 flex-shrink-0"
                          disabled={currentPlaylist?.songs.some(
                            (s) => s._id === song._id,
                          )}
                        >
                          {currentPlaylist?.songs.some(
                            (s) => s._id === song._id,
                          )
                            ? t("pages.playlist.addSongDialog.added")
                            : t("pages.playlist.addSongDialog.add")}
                        </Button>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <>
                  {isRecommendationsLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <StandardLoader size="md" />
                    </div>
                  ) : recommendations.length === 0 ? (
                    <p className="text-zinc-400 px-2">Нет рекомендаций.</p>
                  ) : (
                    recommendations.map((song) => (
                      <div
                        key={song._id}
                        className="flex items-center justify-between p-2 hover:bg-zinc-800 rounded-md cursor-pointer sm:w-[55vw] md:w-[38vw] w-[80vw] lg:w-[20vw] 2xl:w-[18vw]"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onSongAlbumNavigate(song.albumId)}
                            className="font-semibold text-white truncate text-left hover:underline focus:outline-none focus:underline "
                          >
                            {song.title}
                          </button>
                          <span className="text-sm text-zinc-400 truncate">
                            {song.artist.map((artist, artistIndex) => (
                              <span key={artist._id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSongArtistNavigate(artist._id)
                                  }
                                  className="hover:underline focus:outline-none focus:underline"
                                >
                                  {artist.name}
                                </button>
                                {artistIndex < song.artist.length - 1 && ", "}
                              </span>
                            ))}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => onAddSong(song._id)}
                          className="bg-violet-500 hover:bg-violet-400 text-white ml-4 flex-shrink-0"
                          disabled={currentPlaylist?.songs.some(
                            (s) => s._id === song._id,
                          )}
                        >
                          {currentPlaylist?.songs.some(
                            (s) => s._id === song._id,
                          )
                            ? t("pages.playlist.addSongDialog.added")
                            : t("pages.playlist.addSongDialog.add")}
                        </Button>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-center">
            <Button
              variant="secondary"
              size="icon"
              type="button"
              onClick={() => playlistId && onRefreshRecommendations()}
              disabled={isRecommendationsLoading}
              title={t("common.refreshRecommendations")}
              className="flex-shrink-0 mt-4 bg-violet-500 w-30 hover:bg-violet-400 transition-colors"
            >
              <RefreshCw
                className={`size-5 ${
                  isRecommendationsLoading ? "animate-spin" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
