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
    <div className="flex flex-col h-full bg-[#0f0f0f] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-[#2a2a2a]">
        <h2 className="text-lg font-semibold text-white">
          {t("pages.chat.title")}
        </h2>
      </div>
      <ScrollArea className="flex-1 pr-2 -mr-2">
        <div className="p-2 space-y-1">
          {filteredUsers.length === 0 ? (
            <p className="text-gray-400 text-sm p-4 text-center">
              {t("pages.chat.noUsers")}
            </p>
          ) : (
            filteredUsers.map((user) => {
              const isOnline = onlineUsers.has(user._id);
              const activity = userActivities.get(user._id);
              const unreadCount =
                useChatStore.getState().unreadMessages.get(user._id) || 0;

              const isPlaying =
                typeof activity === "object" && activity !== null;

              let statusText = isOnline
                ? t("pages.chat.online")
                : t("pages.chat.offline");
              if (isPlaying) {
                const artistNames = activity.artists
                  .map((artist) => artist.artistName)
                  .join(", ");
                statusText = ` ${activity.songTitle} | ${artistNames}`;
              } else if (activity === "Idle") {
                statusText = isOnline
                  ? t("pages.chat.online")
                  : t("pages.chat.offline");
              }

              return (
                <div
                  key={user._id}
                  onClick={() => onUserSelect(user)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUser?._id === user._id
                      ? "bg-[#2a2a2a] hover:bg-[#2a2a2a]"
                      : "hover:bg-[#2a2a2a]"
                  }`}
                >
                  <div className="relative">
                    <Avatar className="size-10">
                      <AvatarImage
                        src={user.imageUrl || "/default-avatar.png"}
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
                  </div>{" "}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate text-white text-sm">
                      {user.fullName}
                    </span>
                    <p className="text-xs text-gray-400 truncate flex">
                      {isPlaying ? (
                        <Music className="size-3.5 text-[#8b5cf6] shrink-0 mr-1" />
                      ) : (
                        ""
                      )}
                      {statusText}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <div className="ml-auto flex-shrink-0 bg-[#8b5cf6] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
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
