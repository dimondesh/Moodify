// frontend/src/pages/ProfilePage/ProfilePage.tsx

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { axiosInstance } from "../../lib/axios";
import { useAuthStore } from "../../stores/useAuthStore";
import type { User, Playlist } from "../../types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import StandardLoader from "../../components/ui/StandardLoader";
import { ScrollArea } from "../../components/ui/scroll-area";
import { EditProfileDialog } from "./EditProfileDialog";
import ProfileSection from "./ProfileSection";
import { useDominantColor } from "../../hooks/useDominantColor";
import PlaylistRow from "./PlaylistRow";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useUIStore } from "../../stores/useUIStore";
import UniversalPlayButton from "../../components/ui/UniversalPlayButton";
import RecentlyListenedArtists from "../../components/RecentlyListenedArtists";
import TopTracksThisMonth from "../../components/TopTracksThisMonth";

interface ListItem {
  _id: string;
  name: string;
  imageUrl: string;
  type: "user" | "artist" | "playlist";
}

const ProfilePage = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { isEditProfileDialogOpen, openEditProfileDialog, closeAllDialogs } =
    useUIStore();

  const { extractColor } = useDominantColor();
  const [profileData, setProfileData] = useState<User | null>(null);
  const [followers, setFollowers] = useState<ListItem[]>([]);
  const [following, setFollowing] = useState<ListItem[]>([]);

  const [isColorLoading, setIsColorLoading] = useState(true);

  const backgroundKeyRef = useRef(0);
  const [backgrounds, setBackgrounds] = useState([
    { key: 0, color: "#18181b" },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [isFollowingUser, setIsFollowingUser] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!userId) return;

    backgroundKeyRef.current += 1;
    setBackgrounds([{ key: backgroundKeyRef.current, color: "#18181b" }]);

    setIsLoading(true);
    try {
      const [profileRes, followersRes, followingRes] = await Promise.all([
        axiosInstance.get(`/users/${userId}`),
        axiosInstance.get(`/users/${userId}/followers`),
        axiosInstance.get(`/users/${userId}/following`),
      ]);
      const profile = profileRes.data;
      setProfileData(profile);
      setFollowers(followersRes.data.items);
      setFollowing(followingRes.data.items);
      setIsFollowingUser(profile.followers.includes(currentUser?.id));
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentUser?.id]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    const updateBackgroundColor = (color: string) => {
      backgroundKeyRef.current += 1;
      const newKey = backgroundKeyRef.current;
      setBackgrounds((prev) => [{ key: newKey, color }, ...prev.slice(0, 1)]);
    };

    if (profileData?.imageUrl) {
      setIsColorLoading(true);
      extractColor(profileData.imageUrl)
        .then((color) => updateBackgroundColor(color || "#18181b"))
        .finally(() => setIsColorLoading(false));
    } else if (profileData) {
      updateBackgroundColor("#18181b");
      setIsColorLoading(false);
    }
  }, [profileData, extractColor]);

  const handleFollow = async () => {
    if (!userId) return;
    try {
      await axiosInstance.post(`/users/${userId}/follow`);
      setIsFollowingUser(!isFollowingUser);
      setProfileData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          followersCount: prev.followersCount! + (isFollowingUser ? -1 : 1),
        };
      });
    } catch (error) {
      console.error("Failed to follow/unfollow:", error);
    }
  };

  const handleShowAllPlaylists = () => {
    navigate("/list", {
      state: {
        title: t("pages.profile.playlistsSection"),
        apiEndpoint: `/users/${userId}/playlists`,
      },
    });
  };

  const { user: liveCurrentUser } = useAuthStore();
  const isMyProfile = liveCurrentUser?.id === userId;

  if (isLoading || isColorLoading) {
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
            content="The user profile you are looking for does not exist on Moodify."
          />
        </Helmet>
        <div className="text-center p-10">{t("pages.profile.notFound")}</div>
      </>
    );
  }
  const metaDescription = `${profileData.fullName} on Moodify. Check out their public playlists, followers, and who they follow.`;

  return (
    <>
      <Helmet>
        <title>{`${profileData.fullName}'s Profile`}</title>
        <meta name="description" content={metaDescription} />
      </Helmet>
      <ScrollArea className="h-full">
        <div className="relative min-h-screen pb-10 bg-[#0f0f0f]">
          <div className="absolute inset-0 pointer-events-none h-[40vh]">
            {backgrounds
              .slice(0, 2)
              .reverse()
              .map((bg, index) => (
                <div
                  key={bg.key}
                  className={`absolute inset-0 ${
                    index === 1 ? "animate-fade-in" : ""
                  }`}
                  style={{
                    background: `linear-gradient(to bottom, ${bg.color}, transparent)`,
                  }}
                />
              ))}
          </div>
          <div className="relative z-10 p-4 pt-8 sm:pt-16 sm:p-8">
            <div className="flex flex-col items-center sm:flex-row sm:items-end gap-4">
              <Avatar className="w-24 h-24 sm:w-48 sm:h-48 shadow-2xl ring-4 ring-black/20 flex-shrink-0">
                <AvatarImage
                  src={profileData.imageUrl}
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
                  {profileData.playlists
                    .slice(0, 5)
                    .map((playlist: Playlist) => (
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

            {/* Показываем секцию только если это профиль владельца или секция не скрыта */}
            {userId && (
              <RecentlyListenedArtists
                userId={userId}
                isMyProfile={isMyProfile}
                showRecentlyListenedArtists={
                  profileData?.showRecentlyListenedArtists
                }
              />
            )}

            {/* Топ треки этого месяца - только для владельца профиля */}
            {userId && (
              <TopTracksThisMonth userId={userId} isMyProfile={isMyProfile} />
            )}

            <div className="hidden sm:block mt-12 space-y-12">
              <ProfileSection
                title={t("pages.profile.followersSection")}
                items={followers}
                apiEndpoint={`/users/${userId}/followers`}
              />
              <ProfileSection
                title={t("pages.profile.followingSection")}
                items={following}
                apiEndpoint={`/users/${userId}/following`}
              />

              {profileData.playlists && profileData.playlists.length > 0 && (
                <div className="mt-12">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">
                      {t("pages.profile.playlistsSection")}
                    </h2>
                    <button
                      onClick={handleShowAllPlaylists}
                      className="text-sm font-bold text-zinc-400 hover:underline"
                    >
                      {t("pages.profile.showAll")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {profileData.playlists.map((playlist: Playlist) => (
                      <Link
                        to={`/playlists/${playlist._id}`}
                        key={playlist._id}
                        className="bg-transparent p-0 rounded-md transition-all group cursor-pointer"
                      >
                        <div className="relative mb-2">
                          <div className="relative aspect-square shadow-lg overflow-hidden rounded-md">
                            <img
                              src={playlist.imageUrl || "/liked.png"}
                              alt={playlist.title}
                              className="absolute inset-0 h-full w-full object-cover rounded-md transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <UniversalPlayButton
                            entity={playlist}
                            entityType="playlist"
                            className="absolute bottom-3 right-2"
                            size="sm"
                          />
                        </div>
                        <div className="px-1">
                          <h3 className="font-semibold text-sm truncate">
                            {playlist.title}
                          </h3>
                          {playlist.owner && (
                            <p className="text-xs text-zinc-400 leading-tight truncate">
                              {t("pages.profile.by")} {playlist.owner.fullName}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {profileData && isMyProfile && (
          <EditProfileDialog
            user={profileData}
            isOpen={isEditProfileDialogOpen}
            onClose={closeAllDialogs}
            onSuccess={fetchProfileData}
          />
        )}
      </ScrollArea>
    </>
  );
};

export default ProfilePage;
