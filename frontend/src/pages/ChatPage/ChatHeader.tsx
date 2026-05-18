// frontend/src/pages/ChatPage/ChatHeader.tsx

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { useChatStore } from "../../stores/useChatStore";
import { Button } from "../../components/ui/button";
import { ArrowLeft, Music } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getEffectiveActivity } from "../../lib/friendsActivityUtils";

interface ChatHeaderProps {
  showBackButton?: boolean;
  onBack?: () => void;
}

const ChatHeader = ({ showBackButton = false, onBack }: ChatHeaderProps) => {
  const { t } = useTranslation();
  const { selectedUser, onlineUsers, userActivities } = useChatStore();

  if (!selectedUser) return null;

  const isOnline = onlineUsers.has(selectedUser._id);
  const activity = getEffectiveActivity(
    selectedUser._id,
    selectedUser,
    onlineUsers,
    userActivities,
  );
  const isPlaying = typeof activity === "object" && activity !== null;

  return (
    <div className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm flex items-center gap-3">
      {showBackButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 -ml-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="size-5" />
        </Button>
      )}
      <Link
        to={`/users/${selectedUser._id}`}
        className="flex items-center gap-3.5 group min-w-0 flex-1"
      >
        <Avatar className="size-11 object-cover shrink-0">
          <AvatarImage
            className="object-cover"
            src={selectedUser.imageUrl || "/default-avatar.png"}
          />
          <AvatarFallback>{selectedUser.fullName?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="font-medium text-white text-base group-hover:underline flex items-center gap-1.5 min-w-0">
            <span className="truncate">{selectedUser.fullName}</span>
            {isPlaying && (
              <Music className="size-3.5 shrink-0 text-violet-500 md:hidden" />
            )}
          </h2>
          {isPlaying ? (
            <p className="text-sm text-zinc-500 truncate">
              {activity.songTitle}
              {activity.artists.length > 0 &&
                ` · ${activity.artists.map((a) => a.artistName).join(", ")}`}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">
              {isOnline ? t("pages.chat.online") : t("pages.chat.offline")}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
};

export default ChatHeader;
