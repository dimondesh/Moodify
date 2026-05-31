import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPlaylistDisplayTitle } from "@/lib/entitySection";
import { useOwnedPlaylists } from "@/hooks/queries";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { invalidatePlaylistLists } from "@/lib/invalidateQueries";
import { DuplicateSongInPlaylistDialog } from "./DuplicateSongInPlaylistDialog";
import { SONG_MENU_DIVIDER, SONG_SUBMENU_LIST_ITEM } from "./menuStyles";
import type { Playlist, Song } from "@/types";
import toast from "react-hot-toast";

type PendingDuplicate = {
  playlistId: string;
  playlistTitle: string;
};

export interface SongAddToPlaylistSubmenuProps {
  song: Song;
  playlistIdsContainingSong: string[];
  onRequestClose: () => void;
}

export function SongAddToPlaylistSubmenu({
  song,
  playlistIdsContainingSong,
  onRequestClose,
}: SongAddToPlaylistSubmenuProps) {
  const { t, i18n } = useTranslation();
  const { data: ownedPlaylists = [] } = useOwnedPlaylists();
  const { addSongToPlaylist, createPlaylistFromSong } = usePlaylistStore();
  const { fetchLibrary } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingDuplicate, setPendingDuplicate] =
    useState<PendingDuplicate | null>(null);

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

  const refreshAfterChange = useCallback(async () => {
    await Promise.all([
      fetchLibrary({ silent: true }),
      invalidatePlaylistLists(),
    ]);
  }, [fetchLibrary]);

  const performAdd = useCallback(
    async (playlistId: string, allowDuplicate = false) => {
      try {
        await addSongToPlaylist(playlistId, song._id, { allowDuplicate });
        toast.success(t("player.addedToPlaylist", "Added to playlist"));
        onRequestClose();
      } catch {
        toast.error(t("player.playlistUpdateError"));
      }
    },
    [addSongToPlaylist, onRequestClose, song._id, t],
  );

  const handlePlaylistClick = (playlist: Playlist) => {
    const title = playlistDisplayTitle(playlist);
    const alreadyIn = playlistIdsContainingSong.includes(playlist._id);
    if (alreadyIn) {
      setPendingDuplicate({ playlistId: playlist._id, playlistTitle: title });
      return;
    }
    void performAdd(playlist._id);
  };

  const handleCreatePlaylist = async () => {
    onRequestClose();
    await createPlaylistFromSong(song);
    await refreshAfterChange();
  };

  return (
    <>
      <div
        className="flex min-h-0 flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`border-b ${SONG_MENU_DIVIDER}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder={t("player.findPlaylist")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-none border-0 bg-transparent pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500"
            />
          </div>
        </div>

        <button
          type="button"
          className={cn(
            SONG_SUBMENU_LIST_ITEM,
            `flex items-center gap-2 border-b ${SONG_MENU_DIVIDER}`,
          )}
          onClick={() => void handleCreatePlaylist()}
        >
          <Plus className="size-4 shrink-0 text-zinc-400" />
          <span>{t("player.newPlaylist")}</span>
        </button>

        <div
          className="max-h-52 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar"
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredPlaylists.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500">
              {t("player.noPlaylistsFound", "No playlists found")}
            </p>
          ) : (
            filteredPlaylists.map((playlist) => (
              <button
                key={playlist._id}
                type="button"
                className={SONG_SUBMENU_LIST_ITEM}
                onClick={() => handlePlaylistClick(playlist)}
              >
                <span className="block truncate">
                  {playlistDisplayTitle(playlist)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <DuplicateSongInPlaylistDialog
        open={Boolean(pendingDuplicate)}
        playlistTitle={pendingDuplicate?.playlistTitle ?? ""}
        onOpenChange={(open) => {
          if (!open) setPendingDuplicate(null);
        }}
        onCancel={() => setPendingDuplicate(null)}
        onConfirmAdd={() => {
          if (!pendingDuplicate) return;
          const { playlistId } = pendingDuplicate;
          setPendingDuplicate(null);
          void performAdd(playlistId, true);
        }}
      />
    </>
  );
}
