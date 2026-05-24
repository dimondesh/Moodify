// frontend/src/layout/FriendsActivity.tsx

import { HeadphonesIcon, Music, Users } from "lucide-react";
import { useChatStore, type UserActivity } from "../stores/useChatStore";
import { useEffect, useMemo } from "react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuthStore } from "../stores/useAuthStore";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { formatShortRelativeTime } from "../lib/formatShortRelativeTime";
import {
  getEffectiveActivity,
  getFriendsActivitySortTime,
  shouldShowInFriendsActivity,
} from "../lib/friendsActivityUtils";
import type { User } from "../types";
import { resolveUserImageUrl } from "@/lib/cdn";

const FriendsActivity = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { users, fetchUsers, onlineUsers, userActivities } = useChatStore();
  const { user: authUser, isLoading: loadingAuthUser } = useAuthStore();

  useEffect(() => {
    if (authUser && authUser.id && !loadingAuthUser) {
      fetchUsers();
    }
  }, [fetchUsers, authUser, loadingAuthUser]);

  const visibleUsers = useMemo(() => {
    if (!authUser?.id) return [];

    return users
      .filter((userObj) =>
        shouldShowInFriendsActivity(userObj, authUser.id, onlineUsers),
      )
      .sort((a, b) => {
        const aOnline = onlineUsers.has(a._id);
        const bOnline = onlineUsers.has(b._id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;

        const timeDiff =
          getFriendsActivitySortTime(b, onlineUsers) -
          getFriendsActivitySortTime(a, onlineUsers);
        if (timeDiff !== 0) return timeDiff;

        return a.fullName.localeCompare(b.fullName);
      });
  }, [users, authUser?.id, onlineUsers]);

  const handleSongClick = (e: React.MouseEvent, albumId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/albums/${albumId}`);
  };

  const handleArtistClick = (e: React.MouseEvent, artistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/artists/${artistId}`);
  };

  if (loadingAuthUser) {
    return <LoadingShell />;
  }

  if (!authUser) {
    return (
      <div className="h-full bg-[#0f0f0f] flex flex-col">
        <LoginPrompt />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0f0f0f] flex flex-col">
      <div className="p-4 flex justify-between items-center border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <Users className="size-4 shrink-0 text-gray-300" />
          <h2 className="font-semibold text-sm text-gray-300">
            {t("friendsActivity.title")}
          </h2>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-2 -mr-2">
        <div className="p-2 space-y-0.5">
          {visibleUsers.length === 0 ? (
            <p className="text-gray-400 text-center text-sm p-4">
              {t("friendsActivity.noFriends")}
            </p>
          ) : (
            visibleUsers.map((userObj) => (
              <FriendActivityCard
                key={userObj._id}
                userObj={userObj}
                isOnline={onlineUsers.has(userObj._id)}
                activity={getEffectiveActivity(
                  userObj._id,
                  userObj,
                  onlineUsers,
                  userActivities,
                )}
                onSongClick={handleSongClick}
                onArtistClick={handleArtistClick}
                idleLabel={t("friendsActivity.idle")}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FriendsActivity;

interface FriendActivityCardProps {
  userObj: User;
  isOnline: boolean;
  activity: UserActivity | "Idle" | null;
  onSongClick: (e: React.MouseEvent, albumId: string) => void;
  onArtistClick: (e: React.MouseEvent, artistId: string) => void;
  idleLabel: string;
}

function FriendActivityCard({
  userObj,
  isOnline,
  activity,
  onSongClick,
  onArtistClick,
  idleLabel,
}: FriendActivityCardProps) {
  const isPlaying = typeof activity === "object" && activity !== null;
  const isLivePlaying = isOnline && isPlaying;
  const offlineBadge =
    !isOnline && userObj.lastActivityAt
      ? formatShortRelativeTime(userObj.lastActivityAt)
      : null;

  return (
    <Link
      to={`/users/${userObj._id}`}
      className="relative block hover:bg-zinc-800/50 px-2 py-1.5 rounded-md transition-colors group"
    >
      {offlineBadge && (
        <span className="absolute top-1.5 right-2 text-[10px] font-medium tabular-nums text-zinc-500">
          {offlineBadge}
        </span>
      )}
      <div className={`flex items-center gap-2${offlineBadge ? " pr-7" : ""}`}>
        <div className="relative flex-shrink-0">
          <Avatar className="size-8 border border-[#2a2a2a]">
            <AvatarImage
              src={resolveUserImageUrl(userObj.imageUrl)}
              alt={userObj.fullName}
              className="object-cover"
            />
            <AvatarFallback className="bg-[#8b5cf6] text-white text-xs font-semibold">
              {userObj.fullName?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0f0f0f] ${
              isOnline ? "bg-green-500" : "bg-gray-500"
            }`}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="flex items-center">
            <span className="font-medium text-xs text-white truncate">
              {userObj.fullName}
            </span>
            {isLivePlaying && (
              <Music className="size-3 text-[#8b5cf6] shrink-0" />
            )}
          </div>

          {isPlaying ? (
            <div>
              <button
                type="button"
                className="text-xs text-white font-medium truncate w-full text-left hover:text-[#8b5cf6]"
                onClick={(e) => onSongClick(e, activity.albumId)}
              >
                {activity.songTitle}
              </button>
              <div className="text-[11px] text-gray-400 truncate leading-snug">
                {activity.artists.map((artist, index) => (
                  <span key={artist.artistId}>
                    <button
                      type="button"
                      onClick={(e) => onArtistClick(e, artist.artistId)}
                      className="hover:text-[#8b5cf6]"
                    >
                      {artist.artistName}
                    </button>
                    {index < activity.artists.length - 1 && ", "}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 truncate">{idleLabel}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function LoadingShell() {
  return (
    <div className="h-full bg-[#0f0f0f] flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <HeadphonesIcon className="size-8 animate-pulse text-gray-400" />
      </div>
    </div>
  );
}

const LoginPrompt = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
      <div className="relative">
        <div className="relative bg-zinc-900 rounded-full p-4">
          <HeadphonesIcon className="size-8 text-[#8b5cf6]" />
        </div>
      </div>
      <div className="space-y-2 max-w-[250px]">
        <h3 className="text-base font-semibold text-white">
          {t("friendsActivity.loginPromptTitle")}
        </h3>
        <p className="text-sm text-gray-400">
          {t("friendsActivity.loginPromptDescription")}
        </p>
      </div>
    </div>
  );
};
