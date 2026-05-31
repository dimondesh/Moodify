import { axiosInstance } from "@/lib/axios";
import type { Message, User } from "@/types";
import type { Album, Playlist, Song } from "@/types";

export async function fetchUnreadCounts(token: string): Promise<
  Map<string, number>
> {
  const response = await axiosInstance.get("/users/unread-counts", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return new Map<string, number>(Object.entries(response.data));
}

export async function fetchMutualUsers(token: string): Promise<User[]> {
  const response = await axiosInstance.get("/users/mutuals", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(response.data)
    ? response.data
    : response.data.users || [];
}

export async function fetchMessages(
  userId: string,
  token: string,
): Promise<Message[]> {
  const response = await axiosInstance.get(`/users/messages/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

export async function fetchSharedContent(
  entityType: "song" | "album" | "playlist",
  entityId: string,
): Promise<Song | Album | Playlist> {
  const response = await axiosInstance.get(`/share/${entityType}/${entityId}`);
  return response.data;
}
