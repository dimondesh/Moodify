import { axiosInstance } from "@/lib/axios";
import {
  getUserItem,
  getAllUserAlbums,
  getAllUserSongs,
} from "@/lib/offline-db";
import { useOfflineStore } from "@/stores/useOfflineStore";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Song, Album, Artist } from "@/types";
import toast from "react-hot-toast";
import i18n from "@/lib/i18n";

export async function fetchArtists(): Promise<Artist[]> {
  const { isOffline } = useOfflineStore.getState();
  const userId = useAuthStore.getState().user?.id;

  if (isOffline) {
    console.log("[Offline] Constructing artists list from downloaded content.");
    if (!userId) return [];
    const [albums, songs] = await Promise.all([
      getAllUserAlbums(userId),
      getAllUserSongs(userId),
    ]);
    const artistMap = new Map<string, Artist>();
    const processArtist = (artist: Artist) => {
      if (artist && artist._id && !artistMap.has(artist._id)) {
        artistMap.set(artist._id, artist);
      }
    };
    albums.forEach((album: Album) =>
      (album.artist as Artist[]).forEach(processArtist),
    );
    songs.forEach((song: Song) =>
      (song.artist as Artist[]).forEach(processArtist),
    );
    return Array.from(artistMap.values());
  }

  const response = await axiosInstance.get("/artists");
  return response.data;
}

export async function fetchAlbumById(id: string): Promise<Album> {
  const { isOffline } = useOfflineStore.getState();
  const { isDownloaded } = useOfflineStore.getState().actions;
  const userId = useAuthStore.getState().user?.id;

  if (isOffline) {
    if (isDownloaded(id) && userId) {
      console.log(`[Offline] Загрузка альбома ${id} из IndexedDB.`);
      const localAlbum = await getUserItem("albums", id, userId);
      if (!localAlbum) {
        throw new Error("Album not found in offline storage for this user.");
      }
      const offlineAlbum = {
        ...localAlbum,
        songs: (localAlbum as Album & { songsData?: Song[] }).songs?.length
          ? (localAlbum as Album).songs
          : (localAlbum as Album & { songsData?: Song[] }).songsData || [],
      } as Album;
      if (offlineAlbum.songs && offlineAlbum.title) {
        offlineAlbum.songs = offlineAlbum.songs.map((song: Song) => ({
          ...song,
          albumTitle: song.albumTitle || offlineAlbum.title,
        }));
      }
      return offlineAlbum;
    }
    const errorMsg = "This album is not downloaded and unavailable offline.";
    toast.error(errorMsg);
    throw new Error(errorMsg);
  }

  const response = await axiosInstance.get(`/albums/${id}`);
  const albumData = response.data.album as Album;
  if (albumData?.songs) {
    albumData.songs = albumData.songs.map((song: Song) => ({
      ...song,
      albumTitle: albumData.title,
    }));
  }
  return albumData;
}

export interface ArtistWithAppearsOn {
  artist: Artist;
  appearsOn: Album[];
}

export async function fetchArtistById(id: string): Promise<ArtistWithAppearsOn> {
  const [artistRes, appearsOnRes] = await Promise.all([
    axiosInstance.get(`/artists/${id}`),
    axiosInstance.get(`/artists/${id}/appears-on`),
  ]);
  return {
    artist: artistRes.data,
    appearsOn: appearsOnRes.data,
  };
}

export interface ListenHistoryResult {
  songs: Song[];
  entities: unknown[];
}

export async function fetchListenHistory(): Promise<ListenHistoryResult> {
  if (useOfflineStore.getState().isOffline) {
    return { songs: [], entities: [] };
  }
  const response = await axiosInstance.get("/songs/history");
  return {
    songs: response.data.songs || [],
    entities: response.data.entities || [],
  };
}

export interface SecondaryHomeResult {
  genreMixes: import("@/types").Playlist[];
  moodMixes: import("@/types").Playlist[];
  browseRandomAlbums: Album[];
}

export async function fetchSecondaryHome(): Promise<SecondaryHomeResult> {
  const response = await axiosInstance.get("/home/secondary");
  return {
    genreMixes: response.data.genreMixes || [],
    moodMixes: response.data.moodMixes || [],
    browseRandomAlbums: response.data.randomAlbums || [],
  };
}

export async function fetchSecondaryHomeWithToast(): Promise<SecondaryHomeResult> {
  try {
    return await fetchSecondaryHome();
  } catch (err: unknown) {
    console.error("Failed to fetch secondary home playlists:", err);
    toast.error(
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || i18n.t("errors.fetchMixesError"),
    );
    throw err;
  }
}
