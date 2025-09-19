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
      <div className="h-full bg-zinc-900 rounded-lg flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <HeadphonesIcon className="size-8 animate-pulse text-zinc-500" />
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="h-full bg-zinc-900 rounded-lg flex flex-col">
        <LoginPrompt />
      </div>
    );
  }

  const activeUsers = users.filter(
    (userObj) => userObj._id !== authUser.id && onlineUsers.has(userObj._id)
  );

  return (
    <div className="h-full bg-zinc-900 rounded-lg flex flex-col">
      <div className="p-4 sm:p-3 md:p-4 flex justify-between items-center border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Users className="size-5 shrink-0" />
          <h2 className="font-semibold text-base sm:text-sm md:text-base">
            {t("friendsActivity.title")}
          </h2>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-2 -mr-2">
        <div className="p-4 sm:p-3 md:p-4 space-y-4">
          {activeUsers.length === 0 ? (
            <p className="text-zinc-400 text-center text-sm p-4">
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
                  className="block hover:bg-zinc-800/50 p-3 rounded-md transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <Avatar className="size-10 border border-zinc-800">
                        <AvatarImage
                          src={userObj.imageUrl || "/default-avatar.png"}
                          alt={userObj.fullName}
                          className="object-cover"
                        />
                        <AvatarFallback>
                          {userObj.fullName?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-900 ${
                          isOnline ? "bg-green-500" : "bg-zinc-500"
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
                          <Music className="size-3.5 text-violet-400 shrink-0" />
                        )}
                      </div>

                      {isPlaying ? (
                        <div>
                          <button
                            className="text-sm text-white font-medium truncate w-full text-left hover:underline"
                            onClick={(e) =>
                              handleSongClick(e, activity.albumId)
                            }
                          >
                            {activity.songTitle}
                          </button>
                          <div className="text-xs text-zinc-400 truncate">
                            {activity.artists.map((artist, index) => (
                              <span key={artist.artistId}>
                                <button
                                  onClick={(e) =>
                                    handleArtistClick(e, artist.artistId)
                                  }
                                  className="hover:underline"
                                >
                                  {artist.artistName}
                                </button>
                                {index < activity.artists.length - 1 && ", "}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-zinc-400 truncate">
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
    <div className="h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-4">
      <div className="relative">
        <div
          className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-full blur-lg
         opacity-75 animate-pulse"
          aria-hidden="true"
        />
        <div className="relative bg-zinc-900 rounded-full p-4 sm:p-3">
          <HeadphonesIcon className="size-8 sm:size-7 text-emerald-400" />
        </div>
      </div>
      <div className="space-y-2 max-w-[250px] sm:max-w-[200px]">
        <h3 className="text-lg sm:text-base font-semibold text-white">
          {t("friendsActivity.loginPromptTitle")}
        </h3>
        <p className="text-sm sm:text-xs text-zinc-400">
          {t("friendsActivity.loginPromptDescription")}
        </p>
      </div>
    </div>
  );
};
