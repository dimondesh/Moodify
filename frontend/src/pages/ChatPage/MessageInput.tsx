// frontend/src/pages/ChatPage/MessageInput.tsx

import React, { useRef } from "react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Send } from "lucide-react";
import type { User } from "../../types";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/useChatStore";

interface MessageInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: (e: React.FormEvent) => void;
  selectedUser: User | null;
  currentUserId: string;
}

const MessageInput = ({
  value,
  onChange,
  onSend,
  selectedUser,
}: MessageInputProps) => {
  const { t } = useTranslation();
  const { startTyping, stopTyping, users: mutuals } = useChatStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isMutual = selectedUser
    ? mutuals.some((u) => u._id === selectedUser._id)
    : false;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);

    if (!selectedUser || !isMutual) return;

    if (!typingTimeoutRef.current) {
      startTyping(selectedUser._id);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(selectedUser._id);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const isSendDisabled = !value.trim() || !selectedUser || !isMutual;
  const placeholderText = isMutual
    ? t("pages.chat.typeMessage")
    : t("common.mutualFollowersRequired");
  return (
    <div className="shrink-0 px-4 sm:px-6 py-4 pb-5 sm:pb-6 border-t border-zinc-800/80 bg-zinc-900/30">
      <div className="flex gap-2.5 max-w-3xl mx-auto">
        <Input
          placeholder={placeholderText}
          value={value}
          onChange={handleInputChange}
          className="h-11 flex-1 rounded-xl bg-zinc-800/80 border-zinc-700/50 focus-visible:ring-violet-500/40"
          onKeyDown={(e) => e.key === "Enter" && onSend(e)}
          disabled={!isMutual}
        />
        <Button
          size="icon"
          onClick={onSend}
          disabled={isSendDisabled}
          className="h-11 w-11 shrink-0 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
