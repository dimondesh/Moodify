import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUIStore } from "@/stores/useUIStore";
import { useChatStore } from "@/stores/useChatStore";
import { useOwnedPlaylists } from "@/hooks/queries";
import { useIsSongLiked } from "@/hooks/useLikedSongs";
import { usePlaylistStore } from "@/stores/usePlaylistStore";
import type { Song } from "@/types";
import type { SongOptionsContext } from "@/components/SongOptionsMenu";
import toast from "react-hot-toast";

export function useSongOptionsActions(
  song: Song,
  context: SongOptionsContext,
  playlistId: string,
  isOwner: boolean,
  onClose: () => void,
) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessionUser = useAuthStore((s) => s.user);
  const { openShareDialog, openRemoveSongFromPlaylistDialog } = useUIStore();
  const fetchUsers = useChatStore((s) => s.fetchUsers);
  const { data: ownedPlaylists = [] } = useOwnedPlaylists();
  const { toggleSongLike } = usePlaylistStore();
  const isLiked = useIsSongLiked(song._id);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  const isPlaylist = context === "playlist";
  const canRemoveFromThisPlaylist =
    isPlaylist && isOwner && Boolean(playlistId);
  const artists = song.artist ?? [];
  const hasMultipleArtists = artists.length > 1;
  const hasAlbum = Boolean(song.albumId);

  const playlistIdsContainingSong = useMemo(
    () =>
      ownedPlaylists
        .filter((p) => p.songs.some((s) => s._id === song._id))
        .map((p) => p._id),
    [ownedPlaylists, song._id],
  );

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const goToArtist = useCallback(
    (artistId: string) => {
      navigate(`/artists/${artistId}`);
      onClose();
    },
    [navigate, onClose],
  );

  const goToAlbum = useCallback(() => {
    if (song.albumId) {
      navigate(`/albums/${song.albumId}`);
      onClose();
    }
  }, [navigate, onClose, song.albumId]);

  const toggleLiked = useCallback(async () => {
    if (!sessionUser) return;
    try {
      await toggleSongLike(song._id);
      toast.success(
        isLiked ? t("player.removedFromLiked") : t("player.addedToLiked"),
      );
      onClose();
    } catch {
      toast.error(t("player.playlistUpdateError"));
    }
  }, [sessionUser, toggleSongLike, song._id, isLiked, t, onClose]);

  const openAddToPlaylistSheet = useCallback(() => {
    if (!sessionUser) return;
    onClose();
    setIsAddToPlaylistOpen(true);
  }, [sessionUser, onClose]);

  const openShare = useCallback(() => {
    openShareDialog({ type: "song", id: song._id });
    onClose();
  }, [openShareDialog, song._id, onClose]);

  const handleRemoveFromPlaylist = useCallback(() => {
    if (!playlistId) return;
    openRemoveSongFromPlaylistDialog({ songId: song._id, playlistId });
    onClose();
  }, [openRemoveSongFromPlaylistDialog, playlistId, song._id, onClose]);

  return {
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
    openAddToPlaylistSheet,
    openShare,
    handleRemoveFromPlaylist,
    isAddToPlaylistOpen,
    setIsAddToPlaylistOpen,
  };
}
