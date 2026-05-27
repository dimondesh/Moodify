import { axiosInstance } from "@/lib/axios";
import type {
  Song,
  Album,
  Playlist,
  Artist,
  User,
  RecentSearchItem,
} from "@/types";

export interface SearchResults {
  songs: Song[];
  albums: Album[];
  playlists: Playlist[];
  artists: Artist[];
  users: User[];
}

export async function fetchSearch(q: string): Promise<SearchResults> {
  const res = await axiosInstance.get("/search", { params: { q } });
  return {
    songs: res.data.songs || [],
    albums: res.data.albums || [],
    playlists: res.data.playlists || [],
    artists: res.data.artists || [],
    users: res.data.users || [],
  };
}

export async function fetchRecentSearches(): Promise<RecentSearchItem[]> {
  const res = await axiosInstance.get("/users/me/recent-searches");
  return res.data;
}

export async function addRecentSearch(
  itemId: string,
  itemType: string,
): Promise<void> {
  await axiosInstance.post("/users/me/recent-searches", { itemId, itemType });
}

export async function removeRecentSearch(searchId: string): Promise<void> {
  await axiosInstance.delete(`/users/me/recent-searches/${searchId}`);
}

export async function clearRecentSearches(): Promise<void> {
  await axiosInstance.delete("/users/me/recent-searches/all");
}
