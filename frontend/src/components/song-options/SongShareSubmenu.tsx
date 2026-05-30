import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { SONG_MENU_DIVIDER, SONG_SUBMENU_LIST_ITEM } from "./menuStyles";
import toast from "react-hot-toast";

export interface SongShareSubmenuProps {
  songId: string;
  onRequestClose: () => void;
}

export function SongShareSubmenu({ songId, onRequestClose }: SongShareSubmenuProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { users, sendMessage } = useChatStore();

  const friends = users.filter((friend) => friend._id !== user?.id);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/track/${songId}`;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        toast.success(t("common.linkCopied"));
        onRequestClose();
      })
      .catch(() => toast.error(t("common.copyFailed")));
  };

  const handleSendToFriend = (receiverId: string) => {
    if (!user) return;
    sendMessage(receiverId, user.id, `${t("common.checkOutThis")} song!`, "share", {
      entityType: "song",
      entityId: songId,
    });
    toast.success(t("common.sharedToChat"));
    onRequestClose();
  };

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${SONG_SUBMENU_LIST_ITEM} flex items-center gap-2 border-b ${SONG_MENU_DIVIDER}`}
        onClick={handleCopyLink}
      >
        <Link2 className="size-4 shrink-0 text-zinc-400" />
        <span>{t("common.copyLink")}</span>
      </button>

      {friends.length > 0 ? (
        <div
          className="max-h-52 min-h-0 overflow-y-auto overscroll-contain hide-scrollbar"
          onWheel={(e) => e.stopPropagation()}
        >
          {friends.map((friend) => (
            <button
              key={friend._id}
              type="button"
              className={SONG_SUBMENU_LIST_ITEM}
              onClick={() => handleSendToFriend(friend._id)}
            >
              <span className="block truncate">{friend.fullName}</span>
            </button>
          ))}
        </div>
      ) : user ? (
        <p
          className={`${SONG_SUBMENU_LIST_ITEM} cursor-default text-zinc-500 hover:bg-transparent`}
        >
          {t("common.noFriendsFound", "No friends to send to")}
        </p>
      ) : null}
    </div>
  );
}
