import { axiosInstance } from "@/lib/axios";
import type { Album, Artist, Song } from "@/types";

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
