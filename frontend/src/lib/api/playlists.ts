import { axiosInstance } from "@/lib/axios";
import { getUserItem, getAllUserPlaylists } from "@/lib/offline-db";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Playlist, Song } from "@/types";
import { isLibraryMyPlaylist } from "@/lib/playlistKinds";
import toast from "react-hot-toast";

export async function fetchMyPlaylists(): Promise<Playlist[]> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return [];

  const { isOffline } = useOfflineStore.getState();
  if (isOffline) {
    console.log("[Offline] Fetching 'My Playlists' from IndexedDB.");
    const allPlaylists = await getAllUserPlaylists(currentUser.id);
    return allPlaylists.filter(
      (pl: Playlist) =>
        pl.owner?._id === currentUser.id && isLibraryMyPlaylist(pl),
    );
  }

  const response = await axiosInstance.get("/playlists/my");
  return response.data;
}

export async function fetchOwnedPlaylists(): Promise<Playlist[]> {
  const currentUser = useAuthStore.getState().user;
  if (!currentUser) return [];

  if (useOfflineStore.getState().isOffline) {
    const allPlaylists = await getAllUserPlaylists(currentUser.id);
    return allPlaylists.filter(
      (p) => p.owner?._id === currentUser.id && p.type === "USER_CREATED",
    );
  }

  const response = await axiosInstance.get("/library/playlists/owned");
  return response.data;
}

export async function fetchPlaylistById(playlistId: string): Promise<Playlist> {
  const { isOffline } = useOfflineStore.getState();
  const { isDownloaded } = useOfflineStore.getState().actions;
  const userId = useAuthStore.getState().user?.id;

  if (isDownloaded(playlistId) && userId) {
    console.log(`[Offline] Загрузка плейлиста ${playlistId} из IndexedDB.`);
    const localPlaylist = await getUserItem("playlists", playlistId, userId);
    if (localPlaylist) return localPlaylist;
  }

  if (isOffline) {
    const errorMsg = "Этот плейлист не скачан и недоступен в офлайн-режиме.";
    toast.error(errorMsg);
    throw new Error(errorMsg);
  }

  const res = await axiosInstance.get(`/playlists/${playlistId}`);
  return res.data;
}

export async function fetchPlaylistRecommendations(
  playlistId: string,
): Promise<Song[] | null> {
  if (useOfflineStore.getState().isOffline) {
    return null;
  }
  const response = await axiosInstance.get(
    `/playlists/${playlistId}/recommendations`,
  );
  const data = response.data;
  return Array.isArray(data) ? data : null;
}

export async function fetchPublicPlaylists(): Promise<Playlist[]> {
  if (useOfflineStore.getState().isOffline) return [];
  const response = await axiosInstance.get("/playlists/public");
  return response.data;
}

export async function fetchRecommendedPlaylists(): Promise<Playlist[]> {
  if (useOfflineStore.getState().isOffline) return [];
  const response = await axiosInstance.get(
    "/users/me/recommendations/playlists",
  );
  return response.data;
}
