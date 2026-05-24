// frontend/src/pages/ChatPage/UsersList.tsx

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { ScrollArea } from "../../components/ui/scroll-area";
import UsersListSkeleton from "../../components/ui/skeletons/UsersListSkeleton";
import { useChatStore, UserActivity } from "../../stores/useChatStore";
import { useAuthStore } from "../../stores/useAuthStore";
import type { User } from "../../types";
import { useTranslation } from "react-i18next";
import { Music } from "lucide-react";
import { formatShortRelativeTime } from "../../lib/formatShortRelativeTime";
import { resolveUserImageUrl } from "@/lib/cdn";
import { getEffectiveActivity } from "../../lib/friendsActivityUtils";

interface UsersListProps {
  onUserSelect: (user: User) => void;
  selectedUser: User | null;
  onlineUsers: Set<string>;
  userActivities: Map<string, UserActivity | "Idle">;
}

const UsersList = ({
  onUserSelect,
  selectedUser,
  onlineUsers,
  userActivities,
}: UsersListProps) => {
  const { t } = useTranslation();
  const { users, isLoading, error } = useChatStore();
  const { user: mongoUser } = useAuthStore();

  if (isLoading) return <UsersListSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full text-red-500">
        <p>Error loading users: {error}</p>
      </div>
    );
  }

  const filteredUsers = users
    .filter((u) => u._id !== mongoUser?.id)
    .sort((a, b) => {
      const aOnline = onlineUsers.has(a._id);
      const bOnline = onlineUsers.has(b._id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return a.fullName.localeCompare(b.fullName);
    });

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden max-w-3xl w-full mx-auto">
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 pt-3 pb-4 sm:px-5 sm:pt-4 space-y-1.5">
          {filteredUsers.length === 0 ? (
            <p className="text-gray-400 text-sm p-4 text-center">
              {t("pages.chat.noUsers")}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const isOnline = onlineUsers.has(user._id);
              const activity = getEffectiveActivity(
                user._id,
                user,
                onlineUsers,
                userActivities,
              );
              const unreadCount =
                useChatStore.getState().unreadMessages.get(user._id) || 0;

              const isPlaying =
                typeof activity === "object" && activity !== null;

              const offlineBadge =
                !isOnline && user.lastActivityAt
                  ? formatShortRelativeTime(user.lastActivityAt)
                  : null;

              return (
                <div
                  key={user._id}
                  onClick={() => onUserSelect(user)}
                  className={`relative flex items-center gap-4 px-3 py-3.5 rounded-xl cursor-pointer transition-colors ${
                    selectedUser?._id === user._id
                      ? "bg-zinc-800/60"
                      : "hover:bg-zinc-800/40 active:bg-zinc-800/50"
                  }`}
                >
                  {offlineBadge && (
                    <span className="absolute top-3.5 right-3 text-[10px] font-medium tabular-nums text-zinc-500">
                      {offlineBadge}
                    </span>
                  )}
                  <div className="relative shrink-0">
                    <Avatar className="size-12">
                      <AvatarImage
                        src={resolveUserImageUrl(user.imageUrl)}
                        className="object-cover"
                      />
                      <AvatarFallback>
                        {user.fullName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-[#0f0f0f] ${
                        isOnline ? "bg-green-500" : "bg-gray-500"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 min-w-0 leading-tight">
                    <span className="font-medium text-white text-[15px] flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{user.fullName}</span>
                      {isPlaying && (
                        <Music className="size-3.5 text-violet-500 shrink-0 md:hidden" />
                      )}
                    </span>
                    {isPlaying ? (
                      <div className="mt-0.5 min-w-0">
                        <p className="text-[13px] text-zinc-500 truncate">
                          {activity.songTitle}
                        </p>
                        {activity.artists.length > 0 && (
                          <p className="text-[12px] text-zinc-500/80 truncate">
                            {activity.artists
                              .map((artist) => artist.artistName)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                        {isOnline
                          ? t("pages.chat.online")
                          : t("pages.chat.offline")}
                      </p>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <div className="ml-auto shrink-0 bg-violet-600 text-white text-xs rounded-full h-6 min-w-6 px-1.5 flex items-center justify-center font-semibold">
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default UsersList;
