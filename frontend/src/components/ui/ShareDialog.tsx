// frontend/src/components/ui/ShareDialog.tsx
import React, { useEffect } from "react";
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

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

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
            {t("common.selectFriendToShare")} {entityType} {t("common.with")}.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
};
