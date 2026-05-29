// frontend/src/pages/ChatPage/ChatPage.tsx

import React, { useEffect, useState, useRef } from "react";
import { useChatStore } from "../../stores/useChatStore";
import { useAuthStore } from "../../stores/useAuthStore";
import type { User } from "../../types";
import UsersList from "./UsersList";
import ChatHeader from "./ChatHeader";
import { Avatar, AvatarImage } from "../../components/ui/avatar";
import { getUserAvatarUrl } from "@/lib/cdn";
import MessageInput from "./MessageInput";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { SharedContentMessage } from "./SharedContentMessage";
import { Check, CheckCheck } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import StandardLoader from "../../components/ui/StandardLoader";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/useUIStore";

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const ChatPage = () => {
  const { user: mongoUser } = useAuthStore();
  const {
    users,
    messages,
    selectedUser,
    fetchUsers,
    initSocket,
    sendMessage,
    fetchMessages,
    setSelectedUser,
    isConnected,
    onlineUsers,
    userActivities,
    typingUsers,
    setIsChatPageActive,
    markMessagesAsRead,
    unreadMessages,
    isLoading,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageContent, setMessageContent] = useState("");
  const isPartnerTyping = selectedUser && typingUsers.get(selectedUser._id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messageContent.trim() && selectedUser && mongoUser) {
      await sendMessage(selectedUser._id, mongoUser.id, messageContent);
      setMessageContent("");
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    if (mongoUser && mongoUser.id && !isConnected) initSocket(mongoUser.id);
    if (mongoUser && mongoUser.id && !users.length) fetchUsers();
  }, [mongoUser, initSocket, fetchUsers, isConnected, users.length]);

  useEffect(() => {
    if (selectedUser && mongoUser && mongoUser.id)
      fetchMessages(selectedUser._id);
  }, [selectedUser, fetchMessages, mongoUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const setChatConversationOpen = useUIStore((s) => s.setChatConversationOpen);

  useEffect(() => {
    setIsChatPageActive(true);
    return () => {
      setIsChatPageActive(false);
    };
  }, [setIsChatPageActive]);

  useEffect(() => {
    setChatConversationOpen(!!selectedUser);
    return () => setChatConversationOpen(false);
  }, [selectedUser, setChatConversationOpen]);

  useEffect(() => {
    if (selectedUser && unreadMessages.has(selectedUser._id)) {
      markMessagesAsRead(selectedUser._id);
    }
  }, [selectedUser, messages, unreadMessages, markMessagesAsRead]);

  const handleUserSelect = (user: User) => setSelectedUser(user);

  const handleBackToList = () => setSelectedUser(null);

  const renderMessages = () =>
    messages.map((message) => {
      const isOwn = message.senderId === mongoUser?.id;

      return (
        <div
          key={message._id}
          className={`w-full min-w-0 max-w-full  box-border flex ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`flex items-end gap-2 min-w-0 max-w-[calc(100vw-2.5rem)] sm:max-w-[min(100%,28rem)] ${
              isOwn ? "flex-row-reverse" : ""
            }`}
          >
            <Avatar className="size-8 shrink-0 object-cover mb-px">
              <AvatarImage
                className="object-cover"
                src={
                  isOwn
                    ? getUserAvatarUrl(mongoUser)
                    : getUserAvatarUrl(
                        users.find((u) => u._id === message.senderId),
                      )
                }
              />
            </Avatar>
            <div
              className={`min-w-0 max-w-full overflow-hidden rounded-2xl ${
                message.type === "share"
                  ? "bg-transparent p-0"
                  : isOwn
                    ? "bg-violet-600 text-white px-3.5 py-1.5 shadow-md shadow-violet-950/30"
                    : "bg-zinc-800/90 text-white px-3.5 py-1.5 border border-zinc-700/50"
              }`}
            >
              {message.type === "share" && message.shareDetails ? (
                <SharedContentMessage
                  entityType={
                    (message.shareDetails.entityType as string) === "mix"
                      ? "playlist"
                      : message.shareDetails.entityType
                  }
                  entityId={message.shareDetails.entityId}
                />
              ) : (
                <div className="min-w-0 max-w-full overflow-hidden">
                  <p className="text-[15px] leading-snug max-w-full [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] leading-none">
                    <span
                      className={isOwn ? "text-violet-200/90" : "text-zinc-500"}
                    >
                      {formatTime(message.createdAt)}
                    </span>
                    {isOwn &&
                      (message.isRead ? (
                        <CheckCheck className="size-3.5 text-violet-200 opacity-100" />
                      ) : (
                        <Check className="size-3.5 text-violet-200 opacity-70" />
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });

  return (
    <>
      <Helmet>
        <title>Chat</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="h-full min-h-0 flex flex-col overflow-hidden ">
        <div
          className={cn(
            "flex flex-1 flex-col min-h-0 h-full",
            selectedUser
              ? "min-h-[100dvh] md:min-h-[calc(100dvh-8.5rem)]"
              : "min-h-[calc(100dvh-10.5rem)] md:min-h-[calc(100dvh-8.5rem)]",
          )}
        >
          {!selectedUser ? (
            <UsersList
              onUserSelect={handleUserSelect}
              selectedUser={selectedUser}
              onlineUsers={onlineUsers}
              userActivities={userActivities}
            />
          ) : (
            <ChatConversation
              selectedUser={selectedUser}
              isLoading={isLoading}
              messages={messages}
              messageContent={messageContent}
              isPartnerTyping={!!isPartnerTyping}
              messagesEndRef={messagesEndRef}
              onBack={handleBackToList}
              onMessageChange={(e) => setMessageContent(e.target.value)}
              onSend={handleSendMessage}
              renderMessages={renderMessages}
              currentUserId={mongoUser?.id || ""}
            />
          )}
        </div>
      </main>
    </>
  );
};

export default ChatPage;

interface ChatConversationProps {
  selectedUser: User;
  isLoading: boolean;
  messages: ReturnType<typeof useChatStore.getState>["messages"];
  messageContent: string;
  isPartnerTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onMessageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: (e: React.FormEvent) => void;
  renderMessages: () => React.ReactNode;
  currentUserId: string;
}

const ChatConversation = ({
  selectedUser,
  isLoading,
  messages,
  messageContent,
  isPartnerTyping,
  messagesEndRef,
  onBack,
  onMessageChange,
  onSend,
  renderMessages,
  currentUserId,
}: ChatConversationProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full min-h-0 max-w-3xl w-full mx-auto min-w-0 overflow-hidden no-scrollbar">
      <ChatHeader showBackButton onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar">
        <div className="px-3 sm:px-5 py-4 space-y-2 w-full max-w-full min-w-0 box-border">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <StandardLoader size="md" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-zinc-400 mt-16 px-4">
              <p className="text-base">
                {t("pages.chat.startChatting")} {selectedUser.fullName}!
              </p>
              <p className="text-sm text-zinc-500 mt-2">
                {t("pages.chat.noMessages")}
              </p>
            </div>
          ) : (
            renderMessages()
          )}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>
      <div className="px-4 sm:px-6 h-7 shrink-0 flex items-center">
        {isPartnerTyping && <TypingIndicator />}
      </div>
      <MessageInput
        value={messageContent}
        onChange={onMessageChange}
        onSend={onSend}
        selectedUser={selectedUser}
        currentUserId={currentUserId}
      />
    </div>
  );
};
