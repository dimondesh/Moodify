import { axiosInstance } from "@/lib/axios";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Song, Album, Artist, Playlist } from "@/types";

export interface HomeBootstrapData {
  featuredSongs: Song[];
  trendingSongs: Song[];
  trendingAlbums: Album[];
  madeForYouSongs: Song[];
  recentlyListenedSongs: Song[];
  favoriteArtists: Artist[];
  newReleases: Album[];
  homePersonalPlaylists: Playlist[];
  homeSmartPlaylists: Playlist[];
  genreMixes: Playlist[];
  moodMixes: Playlist[];
  publicPlaylists: Playlist[];
  recommendedPlaylists: Playlist[];
}

export async function fetchHomeBootstrap(): Promise<HomeBootstrapData> {
  const isLoggedIn = Boolean(useAuthStore.getState().accessToken);

  const [bootstrapResponse] = await Promise.all([
    axiosInstance.get("/home/bootstrap"),
    isLoggedIn
      ? useLibraryStore.getState().fetchLibrary()
      : Promise.resolve(),
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
    featuredSongs: data.featuredSongs || [],
    trendingSongs: data.trendingSongs || [],
    trendingAlbums: data.trendingAlbums || [],
    madeForYouSongs: data.madeForYouSongs || [],
    recentlyListenedSongs: data.recentlyListenedSongs || [],
    favoriteArtists: data.favoriteArtists || [],
    newReleases: data.newReleases || [],
    homePersonalPlaylists: data.personalMixes || [],
    homeSmartPlaylists: data.allGeneratedPlaylists || [],
    genreMixes: data.genreMixes || [],
    moodMixes: data.moodMixes || [],
    publicPlaylists: data.publicPlaylists || [],
    recommendedPlaylists: data.recommendedPlaylists || [],
  };
}
