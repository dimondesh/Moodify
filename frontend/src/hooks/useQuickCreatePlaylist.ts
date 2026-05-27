import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { fetchOwnedPlaylists } from "@/lib/api/playlists";
import { queryKeys } from "@/lib/queryKeys";
import type { Playlist } from "@/types";
import toast from "react-hot-toast";

/** Создаёт плейлист с именем вида «My playlist #N» и ведёт на его страницу. */
export function useQuickCreatePlaylist() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);

  return useCallback(async () => {
    if (useOfflineStore.getState().isOffline) {
      toast.error(t("pages.playlist.quickCreateOffline"));
      return;
    }
    try {
      await queryClient.ensureQueryData({
        queryKey: queryKeys.playlists.owned,
        queryFn: fetchOwnedPlaylists,
      });
      const owned =
        queryClient.getQueryData<Playlist[]>(queryKeys.playlists.owned) ?? [];
      const n = owned.length + 1;
      const title = t("pages.playlist.quickCreateName", { n });
      const pl = await createPlaylist(title, "", false, null);
      if (pl?._id) {
        navigate(`/playlists/${pl._id}`);
      } else {
        toast.error(t("pages.playlist.form.saveError"));
      }
    } catch (e) {
      console.error("quick create playlist", e);
      toast.error(t("pages.playlist.form.saveError"));
    }
  }, [t, navigate, createPlaylist, queryClient]);
}
