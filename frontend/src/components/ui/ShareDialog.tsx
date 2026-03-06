// src/components/ui/ShareDialog.tsx
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import { useChatStore } from "@/stores/useChatStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { ScrollArea } from "./scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import { Separator } from "./separator";
import { Link2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: "song" | "album" | "playlist" | "mix";
  entityId: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
}) => {
  const { t } = useTranslation();
  const { users, fetchUsers, sendMessage } = useChatStore();
  const { user } = useAuthStore();

  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const handleCopyLink = () => {
    const baseUrl = window.location.origin;
    const pathMap: Record<string, string> = {
      song: "track",
      album: "albums",
      playlist: "playlists",
      mix: "mixes",
    };

    const path = pathMap[entityType] || entityType;
    const shareUrl = `${baseUrl}/${path}/${entityId}`;

    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        toast.success(t("common.linkCopied"));
        setIsCopied(true);

        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch(() => {
        toast.error(t("common.copyFailed"));
      });
  };

  const handleSend = (receiverId: string) => {
    if (user) {
      const content = `${t("common.checkOutThis")} ${entityType}!`;
      sendMessage(receiverId, user.id, content, "share", {
        entityType,
        entityId,
      });
      toast.success(t("common.sharedToChat"));
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700 z-[150]">
        <DialogHeader>
          <DialogTitle>{t("common.shareWithFriend")}</DialogTitle>
          <DialogDescription>
            {t("common.selectFriendToShare", {
              entity: t(`common.entities.instrumental.${entityType}`),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Button
            variant="secondary"
            className="w-full flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 transition-all"
            onClick={handleCopyLink}
          >
            {/* Условный рендеринг иконки */}
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {t("common.copyLink")}
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1 bg-zinc-700" />
            <span className="text-xs text-zinc-500 uppercase">
              {t("common.orSendToFriend")}
            </span>
            <Separator className="flex-1 bg-zinc-700" />
          </div>

          <ScrollArea className="h-64">
            <div className="space-y-2">
              {users.map((friend) => (
                <div
                  key={friend._id}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={friend.imageUrl} />
                      <AvatarFallback>{friend.fullName[0]}</AvatarFallback>
                    </Avatar>
                    <span>{friend.fullName}</span>
                  </div>
                  <Button size="sm" onClick={() => handleSend(friend._id)}>
                    {t("common.send")}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
