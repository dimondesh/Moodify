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
  const { users, fetchUsers, sendMessage } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  const handleSend = (receiverId: string) => {
    if (user) {
      const content = `Check out this ${entityType}!`;
      sendMessage(receiverId, user.id, content, "share", {
        entityType,
        entityId,
      });
      toast.success(`Shared to chat!`);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900/70 backdrop-blur-md text-white border-zinc-700 z-[150]">
        <DialogHeader>
          <DialogTitle>Share with a friend</DialogTitle>
          <DialogDescription>
            Select a friend to share this {entityType} with.
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
                  Send
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
