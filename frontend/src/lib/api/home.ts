import { axiosInstance } from "@/lib/axios";
import type { DisplayItem, Song } from "@/types";

export type HomeSectionId =
  | "quickPicks"
  | "madeForYou"
  | "recentlyListened"
  | "yourTopMixes"
  | "albumsYouMightLike"
  | "artistsYouMightLike"
  | "yourPlaylists"
  | "trendingSongs"
  | "trendingArtists"
  | "trendingAlbums";

export interface HomeSection {
  id: HomeSectionId;
  items: DisplayItem[];
}

export interface HomeBootstrapResponse {
  mode: "personalized" | "guest";
  sections: HomeSection[];
}

const SONG_SECTION_IDS: HomeSectionId[] = ["quickPicks", "trendingSongs"];

function normalizeSection(section: {
  id: string;
  items?: unknown[];
}): HomeSection {
  const id = section.id as HomeSectionId;
  const rawItems = section.items ?? [];

  if (SONG_SECTION_IDS.includes(id)) {
    return {
      id,
      items: rawItems.map((item) => ({
        ...(item as Song),
        itemType: "song" as const,
      })),
    };
  }

  return { id, items: rawItems as DisplayItem[] };
}

export async function fetchHomeBootstrap(): Promise<HomeBootstrapResponse> {
  const { data } = await axiosInstance.get("/home/bootstrap");

  return {
    mode: data.mode === "personalized" ? "personalized" : "guest",
    sections: (data.sections ?? []).map(normalizeSection),
  };
}

export type HomeFeedStatus = "ready" | "pending" | "failed";

export async function fetchHomeFeedStatus(): Promise<{ status: HomeFeedStatus }> {
  const { data } = await axiosInstance.get("/home/feed/status");
  return { status: data.status as HomeFeedStatus };
}

export async function fetchApiEndpoint<T = unknown>(
  endpoint: string,
): Promise<T> {
  const response = await axiosInstance.get(endpoint);
  return response.data;
}
