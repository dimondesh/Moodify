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

export type DiscoverSearchCategory = "songs" | "albums" | "artists";

export type DiscoverTopResult =
  | ({ kind: "song" } & Song)
  | ({ kind: "album" } & Album)
  | ({ kind: "artist" } & Artist);

export type SearchPreviewResponse = {
  topResults: DiscoverTopResult[];
  counts: {
    songs: number;
    albums: number;
    artists: number;
  };
};

const CATEGORY_LIMIT = 10;

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

export async function fetchDiscoverSearchPreview(
  query: string,
): Promise<SearchPreviewResponse> {
  const res = await axiosInstance.get<SearchPreviewResponse>("/search", {
    params: { q: query, preview: 1 },
  });
  return res.data;
}

export async function fetchDiscoverSearchCategory(
  query: string,
  category: DiscoverSearchCategory,
): Promise<{ songs: Song[]; albums: Album[]; artists: Artist[] }> {
  const res = await axiosInstance.get("/search", {
    params: { q: query, type: category, limit: CATEGORY_LIMIT },
  });
  return {
    songs: res.data.songs ?? [],
    albums: res.data.albums ?? [],
    artists: res.data.artists ?? [],
  };
}
