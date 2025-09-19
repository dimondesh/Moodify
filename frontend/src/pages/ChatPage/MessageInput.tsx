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
    : "You must be mutual followers to chat";
  return (
    <div className="p-4 mb-10 sm:mb-14 lg:mb-0 mt-auto border-t border-zinc-800">
      <div className="flex gap-2">
        <Input
          placeholder={placeholderText}
          value={value}
          onChange={handleInputChange}
          className="bg-zinc-800 border-none"
          onKeyDown={(e) => e.key === "Enter" && onSend(e)}
          disabled={!isMutual}
        />
        <Button size="icon" onClick={onSend} disabled={isSendDisabled}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
