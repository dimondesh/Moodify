// frontend/src/pages/ProfilePage/ProfilePage.tsx

import { useEffect, useMemo, useCallback, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/useAuthStore";
import type { Playlist, Artist, User, Song } from "../../types";
import type { DisplayItem } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import StandardLoader from "../../components/ui/StandardLoader";
import { EditProfileDialog } from "./EditProfileDialog";
import { CoverDominantBackdrop } from "@/components/CoverDominantBackdrop";
import { useDominantCoverGradient } from "@/hooks/useDominantCoverGradient";
import PlaylistRow from "./PlaylistRow";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "../../stores/useUIStore";
import RecentlyListenedArtists from "../../components/RecentlyListenedArtists";
import TopTracksThisMonth from "../../components/TopTracksThisMonth";
import FixedRowEntitySection from "../HomePage/FixedRowEntitySection";
import { resolveUserImageUrl } from "@/lib/cdn";
import { axiosInstance } from "@/lib/axios";

export interface ProfileListItem {
  _id: string;
  name: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist";
}

interface ProfileTopTrack extends Song {
  listenCount: number;
  lastListened: string;
}

type RecentListenedPack =
  | { ok: true; artists: Artist[] }
  | { ok: false; code: "private" | "error"; artists: Artist[] };

function relationToDisplayItem(item: ProfileListItem): DisplayItem {
  switch (item.type) {
    case "user":
      return {
        _id: item._id,
        name: item.name,
        imageUrl: item.imageUrl,
        itemType: "user",
      };
    case "artist":
      return {
        _id: item._id,
        name: item.name,
        imageUrl: item.imageUrl,
        itemType: "artist",
      } as Artist & { itemType: "artist" };
    case "playlist":
      return {
        _id: item._id,
        title: item.name,
        imageUrl: item.imageUrl,
        itemType: "playlist",
      } as Playlist & { itemType: "playlist" };
  }
}

const ProfilePage = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isEditProfileDialogOpen, openEditProfileDialog, closeAllDialogs } =
    useUIStore();

  const [profileData, setProfileData] = useState<User | null>(null);
  const [followers, setFollowers] = useState<ProfileListItem[]>([]);
  const [following, setFollowing] = useState<ProfileListItem[]>([]);
  const [recentlyListenedArtists, setRecentlyListenedArtists] = useState<
    Artist[]
  >([]);
  const [recentlyListenedStatus, setRecentlyListenedStatus] = useState<
    "ok" | "private" | "error"
  >("ok");
  const [topTracksThisMonth, setTopTracksThisMonth] = useState<
    ProfileTopTrack[]
  >([]);
  const [topTracksError, setTopTracksError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);

  const { backgrounds, isColorLoading } = useDominantCoverGradient(
    isLoading ? undefined : profileData?.imageUrl,
    userId,
    profileData?.coverAccentHex,
  );
  const heroAccent = backgrounds[0]?.color ?? "#18181b";

  const { user: liveCurrentUser } = useAuthStore();
  const isMyProfile = liveCurrentUser?.id === userId;

  const loadProfile = useCallback(async (targetUserId: string) => {
    setIsLoading(true);
    const currentId = useAuthStore.getState().user?.id;
    const isOwner = currentId === targetUserId;

    const recentPromise: Promise<RecentListenedPack> = axiosInstance
      .get(`/users/${targetUserId}/recently-listened-artists`)
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
          .get(`/users/${targetUserId}/top-tracks-this-month`)
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
          axiosInstance.get(`/users/${targetUserId}`),
          axiosInstance.get(`/users/${targetUserId}/followers`),
          axiosInstance.get(`/users/${targetUserId}/following`),
          recentPromise,
          topPromise,
        ]);

      const profile = profileRes.data;
      setProfileData(profile);
      setFollowers(followersRes.data.items);
      setFollowing(followingRes.data.items);
      setRecentlyListenedArtists(recentPack.artists);
      setRecentlyListenedStatus(recentPack.ok ? "ok" : recentPack.code);
      setTopTracksThisMonth(topPack.tracks);
      setTopTracksError(topPack.error);
      setIsFollowingUser(
        Array.isArray(profile.followers) &&
          currentId != null &&
          profile.followers.includes(currentId),
      );
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
      setProfileData(null);
      setFollowers([]);
      setFollowing([]);
      setRecentlyListenedArtists([]);
      setRecentlyListenedStatus("ok");
      setTopTracksThisMonth([]);
      setTopTracksError(null);
      setIsFollowingUser(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleFollow = useCallback(
    async (targetUserId: string, currentlyFollowing: boolean) => {
      try {
        await axiosInstance.post(`/users/${targetUserId}/follow`);
        setIsFollowingUser(!currentlyFollowing);
        setProfileData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            followersCount:
              prev.followersCount! + (currentlyFollowing ? -1 : 1),
          };
        });
      } catch (error) {
        console.error("Failed to follow/unfollow:", error);
      }
    },
    [],
  );

  useEffect(() => {
    if (!userId) return;
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const handleFollow = useCallback(() => {
    if (!userId) return;
    void toggleFollow(userId, isFollowingUser);
  }, [userId, isFollowingUser, toggleFollow]);

  const handleShowAllPlaylists = () => {
    navigate("/list", {
      state: {
        title: t("pages.profile.playlistsSection"),
        apiEndpoint: `/users/${userId}/playlists`,
      },
    });
  };

  const followerDisplayItems = useMemo(
    () => followers.map(relationToDisplayItem),
    [followers],
  );
  const followingDisplayItems = useMemo(
    () => following.map(relationToDisplayItem),
    [following],
  );

  const publicPlaylistDisplayItems = useMemo(
    () =>
      (profileData?.playlists ?? []).map(
        (p): Playlist & { itemType: "playlist" } => ({
          ...p,
          itemType: "playlist",
        }),
      ),
    [profileData?.playlists],
  );

  if (isLoading || (profileData && isColorLoading)) {
    return (
      <>
        <Helmet>
          <title>Loading Profile...</title>
        </Helmet>
        <div className="flex justify-center items-center h-full bg-[#0f0f0f]">
          <StandardLoader
            size="lg"
            text={t("pages.profile.loading")}
            showText={true}
          />
        </div>
      </>
    );
  }

  if (!profileData) {
    return (
      <>
        <Helmet>
          <title>User Not Found</title>
          <meta
            name="description"
            content="The user profile you are looking for does not exist on Moodify Music."
          />
        </Helmet>
        <div className="text-center p-10">{t("pages.profile.notFound")}</div>
      </>
    );
  }
  const metaDescription = `${profileData.fullName} on Moodify Music. Check out their public playlists, followers, and who they follow.`;

  return (
    <>
      <Helmet>
        <title>{`${profileData.fullName}'s Profile`}</title>
        <meta name="description" content={metaDescription} />
      </Helmet>
      <div className="relative min-h-screen pb-40 lg:pb-0 bg-[#0f0f0f]">
        <div className="absolute inset-x-0 top-0 pointer-events-none h-[40vh] z-0">
          <CoverDominantBackdrop accentColor={heroAccent} variant="hero" />
        </div>
        <div className="relative z-10 p-4 pt-8 sm:pt-16 sm:p-8">
          <div className="flex flex-col items-center sm:flex-row sm:items-end gap-4">
            <Avatar className="w-24 h-24 sm:w-48 sm:h-48 shadow-2xl ring-0 ring-black/20 flex-shrink-0">
              <AvatarImage
                src={resolveUserImageUrl(profileData.imageUrl)}
                className="object-cover"
              />
              <AvatarFallback>{profileData.fullName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 text-center sm:text-left">
              <p className="hidden sm:block text-sm font-bold">
                {t("pages.profile.type")}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black break-words">
                {profileData.fullName}
              </h1>
              <div className="flex flex-row gap-2 justify-center sm:justify-start items-center gap-y-1 sm:gap-x-4 text-sm mt-1 text-zinc-300">
                <span className="hidden">
                  {profileData.publicPlaylistsCount ?? 0}{" "}
                  {t("pages.profile.playlists")}
                </span>
                <Link
                  to="/list"
                  state={{
                    title: t("pages.profile.playlistsSection"),
                    apiEndpoint: `/users/${userId}/playlists`,
                  }}
                  className="hidden sm:block hover:underline"
                >
                  {profileData.publicPlaylistsCount ?? 0}{" "}
                  {t("pages.profile.playlists")}
                </Link>
                <Link
                  to="/list"
                  state={{
                    title: t("pages.profile.followersSection"),
                    apiEndpoint: `/users/${userId}/followers`,
                  }}
                  className="hover:underline"
                >
                  <span>
                    {profileData.followersCount ?? 0}{" "}
                    {t("pages.profile.followers")}
                  </span>
                </Link>
                <Link
                  to="/list"
                  state={{
                    title: t("pages.profile.followingSection"),
                    apiEndpoint: `/users/${userId}/following`,
                  }}
                  className="hover:underline"
                >
                  <span>
                    {(profileData.followingUsersCount ?? 0) +
                      (profileData.followingArtistsCount ?? 0)}{" "}
                    {t("pages.profile.following")}
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center sm:justify-start gap-4">
            {isMyProfile ? (
              <Button
                onClick={openEditProfileDialog}
                variant="outline"
                className="rounded-full px-5"
              >
                {t("pages.profile.edit")}
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                variant="outline"
                className="rounded-full px-5"
              >
                {isFollowingUser
                  ? t("pages.profile.followingButton")
                  : t("pages.profile.followButton")}
              </Button>
            )}
          </div>

          {profileData.playlists && profileData.playlists.length > 0 && (
            <div className="mt-8 sm:hidden">
              <h2 className="text-xl font-bold mb-2">
                {t("pages.profile.playlists")}
              </h2>
              <div className="flex flex-col gap-2">
                {profileData.playlists.slice(0, 5).map((playlist: Playlist) => (
                  <PlaylistRow key={playlist._id} playlist={playlist} />
                ))}
              </div>
              {profileData.playlists.length > 5 && (
                <div className="text-center mt-4">
                  <Button
                    onClick={handleShowAllPlaylists}
                    variant="outline"
                    className="rounded-full"
                  >
                    {t("pages.profile.showAllPlaylists")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {userId && (
            <RecentlyListenedArtists
              isMyProfile={isMyProfile}
              showRecentlyListenedArtists={
                profileData?.showRecentlyListenedArtists
              }
              artists={recentlyListenedArtists}
              fetchStatus={recentlyListenedStatus}
            />
          )}

          {userId && (
            <TopTracksThisMonth
              userId={userId}
              isMyProfile={isMyProfile}
              tracks={topTracksThisMonth}
              errorMessage={topTracksError}
            />
          )}

          <div className="hidden sm:block mt-12 space-y-12">
            <FixedRowEntitySection
              title={t("pages.profile.followersSection")}
              items={followerDisplayItems}
              apiEndpoint={`/users/${userId}/followers`}
            />
            <FixedRowEntitySection
              title={t("pages.profile.followingSection")}
              items={followingDisplayItems}
              apiEndpoint={`/users/${userId}/following`}
            />

            {publicPlaylistDisplayItems.length > 0 && (
              <FixedRowEntitySection
                title={t("pages.profile.playlistsSection")}
                items={publicPlaylistDisplayItems}
                apiEndpoint={`/users/${userId}/playlists`}
              />
            )}
          </div>
        </div>
      </div>

      {profileData && isMyProfile && (
        <EditProfileDialog
          user={profileData}
          isOpen={isEditProfileDialogOpen}
          onClose={closeAllDialogs}
          onSuccess={() => {
            if (userId) void loadProfile(userId);
          }}
        />
      )}
    </>
  );
};

export default ProfilePage;
