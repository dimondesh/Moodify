import { axiosInstance } from "@/lib/axios";
import type { Album, Artist, LibraryPlaylist } from "@/types";

export interface LibrarySummary {
  albums: Album[];
  playlists: LibraryPlaylist[];
  followedArtists: Artist[];
}

export async function fetchLibrarySummary(): Promise<LibrarySummary> {
  const response = await axiosInstance.get("/library/summary");
  const data = response.data;
  return {
    albums: data.albums || [],
    playlists: data.playlists || [],
    followedArtists: data.followedArtists || [],
  };
}

export async function fetchFollowedArtists(): Promise<Artist[]> {
  const res = await axiosInstance.get("/library/artists");
  return res.data.artists;
}

export async function toggleAlbumInLibrary(albumId: string): Promise<void> {
  await axiosInstance.post("/library/albums/toggle", { albumId });
}

export async function togglePlaylistInLibrary(
  playlistId: string,
): Promise<void> {
  await axiosInstance.post("/library/playlists/toggle", { playlistId });
}

export async function toggleArtistFollow(artistId: string): Promise<void> {
  await axiosInstance.post("/library/artists/toggle", { artistId });
}
