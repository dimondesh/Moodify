import { create } from "zustand";
import { axiosInstance } from "@/lib/axios";
import type { User, Artist, Song } from "@/types";
import { useAuthStore } from "./useAuthStore";

export interface ProfileListItem {
  _id: string;
  name: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist";
}

export interface ProfileTopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

type RecentListenedPack =
  | { ok: true; artists: Artist[] }
  | { ok: false; code: "private" | "error"; artists: Artist[] };

interface ProfileStore {
  profileData: User | null;
  followers: ProfileListItem[];
  following: ProfileListItem[];
  recentlyListenedArtists: Artist[];
  recentlyListenedStatus: "ok" | "private" | "error";
  topTracksThisMonth: ProfileTopTrack[];
  topTracksError: string | null;
  isLoading: boolean;
  isFollowingUser: boolean;

  loadProfile: (userId: string) => Promise<void>;
  toggleFollow: (userId: string, currentlyFollowing: boolean) => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profileData: null,
  followers: [],
  following: [],
  recentlyListenedArtists: [],
  recentlyListenedStatus: "ok",
  topTracksThisMonth: [],
  topTracksError: null,
  isLoading: false,
  isFollowingUser: false,

  loadProfile: async (userId) => {
    set({ isLoading: true });
    const currentId = useAuthStore.getState().user?.id;
    const isOwner = currentId === userId;

    const recentPromise: Promise<RecentListenedPack> = axiosInstance
      .get(`/users/${userId}/recently-listened-artists`)
      .then((r) => ({
        ok: true as const,
        artists: r.data.artists || [],
      }))
      .catch((err: { response?: { status?: number } }) => {
        if (err.response?.status === 403) {
          return { ok: false as const, code: "private" as const, artists: [] };
        }
        return { ok: false as const, code: "error" as const, artists: [] };
      });

    const topPromise = isOwner
      ? axiosInstance
          .get(`/users/${userId}/top-tracks-this-month`)
          .then((r) => ({
            tracks: (r.data.tracks || []) as ProfileTopTrack[],
            error: null as string | null,
          }))
          .catch((err: { response?: { data?: { message?: string } } }) => ({
            tracks: [] as ProfileTopTrack[],
            error:
              err.response?.data?.message || "Failed to load top tracks",
          }))
      : Promise.resolve({
          tracks: [] as ProfileTopTrack[],
          error: null as string | null,
        });

    try {
      const [profileRes, followersRes, followingRes, recentPack, topPack] =
        await Promise.all([
          axiosInstance.get(`/users/${userId}`),
          axiosInstance.get(`/users/${userId}/followers`),
          axiosInstance.get(`/users/${userId}/following`),
          recentPromise,
          topPromise,
        ]);

      const profile = profileRes.data;
      set({
        profileData: profile,
        followers: followersRes.data.items,
        following: followingRes.data.items,
        recentlyListenedArtists: recentPack.artists,
        recentlyListenedStatus: recentPack.ok ? "ok" : recentPack.code,
        topTracksThisMonth: topPack.tracks,
        topTracksError: topPack.error,
        isFollowingUser:
          Array.isArray(profile.followers) &&
          currentId != null &&
          profile.followers.includes(currentId),
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
      set({
        profileData: null,
        followers: [],
        following: [],
        recentlyListenedArtists: [],
        recentlyListenedStatus: "ok",
        topTracksThisMonth: [],
        topTracksError: null,
        isFollowingUser: false,
        isLoading: false,
      });
    }
  },

  toggleFollow: async (userId, currentlyFollowing) => {
    try {
      await axiosInstance.post(`/users/${userId}/follow`);
      const { profileData } = get();
      if (!profileData) return;
      set({
        isFollowingUser: !currentlyFollowing,
        profileData: {
          ...profileData,
          followersCount:
            profileData.followersCount! + (currentlyFollowing ? -1 : 1),
        },
      });
    } catch (error) {
      console.error("Failed to follow/unfollow:", error);
    }
  },
}));
