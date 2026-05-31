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

export async function createPlaylistFromSong(
  songId: string,
  title: string,
): Promise<Playlist> {
  const response = await axiosInstance.post("/playlists/from-song", {
    title,
    initialSongId: songId,
  });
  return response.data;
}

export async function createPlaylist(
  title: string,
  description: string,
  isPublic: boolean,
  imageFile?: File | null,
): Promise<Playlist> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  formData.append("isPublic", String(isPublic));
  if (imageFile) {
    formData.append("image", imageFile);
  }
  const response = await axiosInstance.post("/playlists", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function updatePlaylistApi(
  id: string,
  title: string,
  description: string,
  isPublic: boolean,
  imageFile?: File | null,
  removeImage?: boolean,
): Promise<Playlist> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("description", description);
  formData.append("isPublic", String(isPublic));
  if (imageFile) {
    formData.append("image", imageFile);
  } else if (removeImage) {
    formData.append("removeImage", "true");
  }
  const response = await axiosInstance.put(`/playlists/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function deletePlaylistApi(id: string): Promise<void> {
  await axiosInstance.delete(`/playlists/${id}`);
}

export async function addSongToPlaylistApi(
  playlistId: string,
  songId: string,
  allowDuplicate = false,
): Promise<{ playlist?: Playlist }> {
  const response = await axiosInstance.post(`/playlists/${playlistId}/songs`, {
    songId,
    allowDuplicate,
  });
  return response.data;
}

export async function removeSongFromPlaylistApi(
  playlistId: string,
  songId: string,
): Promise<void> {
  await axiosInstance.delete(`/playlists/${playlistId}/songs/${songId}`);
}

export async function togglePlaylistInUserLibraryApi(
  playlistId: string,
): Promise<{ isAdded: boolean; message?: string }> {
  const response = await axiosInstance.post("/api/library/playlists/toggle", {
    playlistId,
  });
  return response.data;
}

export async function addPlaylistLikeApi(playlistId: string): Promise<void> {
  await axiosInstance.post(`/playlists/${playlistId}/like`);
}

export async function removePlaylistLikeApi(playlistId: string): Promise<void> {
  await axiosInstance.delete(`/playlists/${playlistId}/unlike`);
}

export async function toggleSongLikeApi(
  songId: string,
): Promise<{ playlistId?: string }> {
  const res = await axiosInstance.post("/library/songs/toggle-like", {
    songId,
  });
  return res.data;
}
