import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Artist, Song, User } from "@/types";

export interface ProfileListItem {
  _id: string;
  name: string;
  images?: { size: number; url: string }[];
  type: "user" | "artist" | "playlist";
}

export interface ProfileTopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

export type RecentlyListenedStatus = "ok" | "private" | "error";

type RecentListenedPack =
  | { ok: true; artists: Artist[] }
  | { ok: false; code: RecentlyListenedStatus; artists: Artist[] };

export interface ProfilePageData {
  profile: User;
  followers: ProfileListItem[];
  following: ProfileListItem[];
  recentlyListenedArtists: Artist[];
  recentlyListenedStatus: RecentlyListenedStatus;
  topTracksThisMonth: ProfileTopTrack[];
  topTracksError: string | null;
  isFollowingUser: boolean;
}

export async function fetchUserProfile(userId: string): Promise<User> {
  const response = await axiosInstance.get(`/users/${userId}`);
  return response.data;
}

export async function fetchUserFollowers(
  userId: string,
): Promise<{ items: ProfileListItem[] }> {
  const response = await axiosInstance.get(`/users/${userId}/followers`);
  return response.data;
}

export async function fetchUserFollowing(
  userId: string,
): Promise<{ items: ProfileListItem[] }> {
  const response = await axiosInstance.get(`/users/${userId}/following`);
  return response.data;
}

export async function fetchRecentlyListenedArtists(
  userId: string,
): Promise<RecentListenedPack> {
  try {
    const response = await axiosInstance.get(
      `/users/${userId}/recently-listened-artists`,
    );
    return {
      ok: true,
      artists: response.data.artists || [],
    };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 403) {
      return { ok: false, code: "private", artists: [] };
    }
    return { ok: false, code: "error", artists: [] };
  }
}

export async function fetchTopTracksThisMonth(userId: string): Promise<{
  tracks: ProfileTopTrack[];
  error: string | null;
}> {
  try {
    const response = await axiosInstance.get(
      `/users/${userId}/top-tracks-this-month`,
    );
    return {
      tracks: (response.data.tracks || []) as ProfileTopTrack[],
      error: null,
    };
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })
      .response?.data?.message;
    return {
      tracks: [],
      error: message || "Failed to load top tracks",
    };
  }
}

export async function toggleFollow(userId: string): Promise<void> {
  await axiosInstance.post(`/users/${userId}/follow`);
}

export async function fetchProfilePageData(
  userId: string,
): Promise<ProfilePageData> {
  const currentId = useAuthStore.getState().user?.id;
  const isOwner = currentId === userId;

  const [profile, followersRes, followingRes, recentPack, topPack] =
    await Promise.all([
      fetchUserProfile(userId),
      fetchUserFollowers(userId),
      fetchUserFollowing(userId),
      fetchRecentlyListenedArtists(userId),
      isOwner
        ? fetchTopTracksThisMonth(userId)
        : Promise.resolve({ tracks: [], error: null }),
    ]);

  return {
    profile,
    followers: followersRes.items,
    following: followingRes.items,
    recentlyListenedArtists: recentPack.artists,
    recentlyListenedStatus: recentPack.ok ? "ok" : recentPack.code,
    topTracksThisMonth: topPack.tracks,
    topTracksError: topPack.error,
    isFollowingUser:
      Array.isArray(profile.followers) &&
      currentId != null &&
      profile.followers.includes(currentId),
  };
}
