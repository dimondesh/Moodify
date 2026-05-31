import { axiosInstance } from "@/lib/axios";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { DisplayItem, Song } from "@/types";

export type HomeSectionId =
  | "quickPicks"
  | "madeForYou"
  | "recentlyListened"
  | "yourTopMixes"
  | "albumsYouMightLike"
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
  const isLoggedIn = Boolean(useAuthStore.getState().accessToken);

  const [bootstrapResponse] = await Promise.all([
    axiosInstance.get("/home/bootstrap"),
    isLoggedIn ? useLibraryStore.getState().fetchLibrary() : Promise.resolve(),
  ]);

  const { data } = bootstrapResponse;

  if (!isLoggedIn) {
    useLibraryStore.setState({
      albums: [],
      playlists: [],
      followedArtists: [],
    });
  }

  return {
    mode: data.mode === "personalized" ? "personalized" : "guest",
    sections: (data.sections ?? []).map(normalizeSection),
  };
}
