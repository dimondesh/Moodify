// frontend/src/layout/FriendsActivity.tsx

import { HeadphonesIcon, Music, Users } from "lucide-react";
import { useChatStore } from "../stores/useChatStore";
import { useEffect } from "react";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuthStore } from "../stores/useAuthStore";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

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
    return (
      <div className="h-full bg-[#0f0f0f] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <HeadphonesIcon className="size-8 animate-pulse text-gray-400" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="h-full bg-[#0f0f0f] flex flex-col">
        <LoginPrompt />
      </div>
    );
  }

  const activeUsers = users.filter(
    (userObj) => userObj._id !== authUser.id && onlineUsers.has(userObj._id)
  );

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
        <div className="p-4 space-y-3">
          {activeUsers.length === 0 ? (
            <p className="text-gray-400 text-center text-sm p-4">
              {t("friendsActivity.noFriends")}
            </p>
          ) : (
            activeUsers.map((userObj) => {
              const isOnline = onlineUsers.has(userObj._id);
              const activity = userActivities.get(userObj._id);
              const isPlaying =
                typeof activity === "object" && activity !== null;

              return (
                <Link
                  key={userObj._id}
                  to={`/users/${userObj._id}`}
                  className="block hover:bg-[#2a2a2a] p-3 rounded-md transition-colors group hover-scale"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="size-10 border border-[#2a2a2a]">
                        <AvatarImage
                          src={userObj.imageUrl || "/default-avatar.png"}
                          alt={userObj.fullName}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-[#8b5cf6] text-white font-semibold">
                          {userObj.fullName?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0f0f0f] ${
                          isOnline ? "bg-green-500" : "bg-gray-500"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-white truncate">
                          {userObj.fullName}
                        </span>
                        {isPlaying && (
                          <Music className="size-3.5 text-[#8b5cf6] shrink-0" />
                        )}
                      </div>

                      {isPlaying ? (
                        <div>
                          <button
                            className="text-sm text-white font-medium truncate w-full text-left hover:text-[#8b5cf6]"
                            onClick={(e) =>
                              handleSongClick(e, activity.albumId)
                            }
                          >
                            {activity.songTitle}
                          </button>
                          <div className="text-xs text-gray-400 truncate">
                            {activity.artists.map((artist, index) => (
                              <span key={artist.artistId}>
                                <button
                                  onClick={(e) =>
                                    handleArtistClick(e, artist.artistId)
                                  }
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
                        <div className="mt-1 text-xs text-gray-400 truncate">
                          {t("friendsActivity.idle")}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FriendsActivity;

const LoginPrompt = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
      <div className="relative">
        <div
          className="absolute -inset-1 bg-gradient-to-r from-[#8b5cf6] to-[#7c3aed] rounded-full blur-lg
         opacity-75 animate-pulse"
          aria-hidden="true"
        />
        <div className="relative bg-[#0f0f0f] rounded-full p-4">
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
