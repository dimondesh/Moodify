/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import type { Song, Album, Stats, Artist } from "../types/index"; // Импортируем Artist
import toast from "react-hot-toast";

interface MusicStore {
  albums: Album[];
  songs: Song[];
  artists: Artist[]; // НОВОЕ: Состояние для артистов
  isLoading: boolean;
  error: string | null;
  currentAlbum: Album | null;
  featuredSongs: Song[];
  madeForYouSongs: Song[];
  trendingSongs: Song[];
  stats: Stats;
  fetchAlbums: () => Promise<void>;
  fetchAlbumbyId: (id: string) => Promise<void>;
  fetchFeaturedSongs: () => Promise<void>;
  fetchMadeForYouSongs: () => Promise<void>;
  fetchTrendingSongs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchSongs: () => Promise<void>;
  fetchArtists: () => Promise<void>; // НОВОЕ: Функция для получения артистов
  deleteSong: (id: string) => Promise<void>;
  deleteAlbum: (id: string) => Promise<void>;
  deleteArtist: (id: string) => Promise<void>; // НОВОЕ: Функция для удаления артиста
}

export const useMusicStore = create<MusicStore>((set) => ({
  albums: [],
  songs: [],
  artists: [], // Инициализируем массив артистов
  isLoading: false,
  error: null,
  currentAlbum: null,
  featuredSongs: [],
  madeForYouSongs: [],
  trendingSongs: [],
  stats: {
    totalSongs: 0,
    totalAlbums: 0,
    totalUsers: 0,
    totalArtists: 0,
  },

  deleteSong: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.delete(`/admin/songs/${id}`);

      set((state) => ({
        songs: state.songs.filter((song) => song._id !== id),
      }));
      toast.success("Song deleted successfully");
    } catch (error: any) {
      console.log("Error in deleteSong", error);
      toast.error("Error deleting song");
    } finally {
      set({ isLoading: false });
    }
  },

  deleteAlbum: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.delete(`/admin/albums/${id}`);
      set((state) => ({
        albums: state.albums.filter((album) => album._id !== id),
        // Также нужно обновить песни, у которых был этот альбом
        songs: state.songs.map((song) =>
          song.albumId === id ? { ...song, albumId: null } : song
        ),
      }));
      toast.success("Album deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete album: " + error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteArtist: async (id) => {
    // НОВАЯ ФУНКЦИЯ
    set({ isLoading: true, error: null });
    try {
      await axiosInstance.delete(`/admin/artists/${id}`);
      set((state) => ({
        artists: state.artists.filter((artist) => artist._id !== id),
        // Также нужно обновить песни и альбомы, которые были связаны с этим артистом
        songs: state.songs.map((song) => ({
          ...song,
          artist: song.artist.filter((artist) => artist._id !== id), // Удаляем артиста из массива
        })).filter(song => song.artist.length > 0), // Удаляем песни, если у них не осталось артистов
        albums: state.albums.map((album) => ({
          ...album,
          artist: album.artist.filter((artist) => artist._id !== id), // Удаляем артиста из массива
        })).filter(album => album.artist.length > 0), // Удаляем альбомы, если у них не осталось артистов
      }));
      toast.success("Artist and associated content relationships updated/deleted successfully");
    } catch (error: any) {
      console.log("Error in deleteArtist", error);
      toast.error("Failed to delete artist: " + error.message);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAlbums: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/albums");
      set({ albums: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },
  fetchAlbumbyId: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get(`/albums/${id}`);
      set({ currentAlbum: response.data.album });
    } catch (error: any) {
      set({ error: error.response.data.message || "Failed to fetch album" });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchFeaturedSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/songs/featured");
      set({ featuredSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMadeForYouSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/songs/made-for-you");
      set({ madeForYouSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTrendingSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/songs/trending");
      set({ trendingSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/songs");
      // Backend теперь возвращает Artist[] вместо string
      set({ songs: response.data.songs });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchArtists: async () => {
    // НОВАЯ ФУНКЦИЯ
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/artists"); // Предполагаемый роут для получения всех артистов
      set({ artists: response.data });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get("/stats");
      set({ stats: response.data });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },
}));