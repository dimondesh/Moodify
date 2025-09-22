// frontend/src/pages/ChatPage/ChatPage.tsx

import React, { useEffect, useState, useRef } from "react";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Button } from "../../components/ui/button";
import { Users as UsersIcon } from "lucide-react";
import { useChatStore } from "../../stores/useChatStore";
import { useAuthStore } from "../../stores/useAuthStore";
import type { User } from "../../types";
import UsersList from "./UsersList";
import ChatHeader from "./ChatHeader";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "../../components/ui/sheet";
import { Avatar, AvatarImage } from "../../components/ui/avatar";
import MessageInput from "./MessageInput";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { SharedContentMessage } from "./SharedContentMessage";
import { Check, CheckCheck } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import { useAudioSettingsStore } from "@/lib/webAudio";

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const ChatPage = () => {
  const { t } = useTranslation();
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
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageContent, setMessageContent] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isPartnerTyping = selectedUser && typingUsers.get(selectedUser._id);

  useEffect(() => {}, []);

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

  useEffect(() => {
    setIsChatPageActive(true);
    return () => {
      setIsChatPageActive(false);
    };
  }, [setIsChatPageActive]);

  useEffect(() => {
    if (selectedUser && unreadMessages.has(selectedUser._id)) {
      markMessagesAsRead(selectedUser._id);
    }
  }, [selectedUser, messages, unreadMessages, markMessagesAsRead]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setIsSidebarOpen(false);
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setIsSidebarOpen(true);
  };

  const renderMessages = () =>
    messages.map((message) => (
      <div
        key={message._id}
        className={`flex items-start gap-3 w-full ${
          message.senderId === mongoUser?.id ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`flex items-start gap-3 max-w-[80%] sm:max-w-[70%] ${
            message.senderId === mongoUser?.id ? "flex-row-reverse" : ""
          }`}
        >
          <Avatar className="size-8 flex-shrink-0 object-cover">
            <AvatarImage
              className="object-cover"
              src={
                message.senderId === mongoUser?.id
                  ? mongoUser?.imageUrl || "/default-avatar.png"
                  : users.find((u) => u._id === message.senderId)?.imageUrl ||
                    "/default-avatar.png"
              }
            />
          </Avatar>
          <div
            className={`rounded-lg max-w-full ${
              message.type === "share"
                ? "bg-transparent p-0"
                : message.senderId === mongoUser?.id
                ? "bg-[#8b5cf6] text-white p-3"
                : "bg-[#1a1a1a] text-white p-3"
            }`}
          >
            {message.type === "share" && message.shareDetails ? (
              <SharedContentMessage
                entityType={message.shareDetails.entityType}
                entityId={message.shareDetails.entityId}
              />
            ) : (
              <div className="flex flex-col">
                <p className="text-sm break-words">{message.content}</p>
                <div className="flex items-center justify-end gap-1 text-xs text-gray-400 mt-1 self-end">
                  <span>{formatTime(message.createdAt)}</span>
                  {message.senderId === mongoUser?.id &&
                    (message.isRead ? (
                      <CheckCheck className="size-4 text-[#8b5cf6]" />
                    ) : (
                      <Check className="size-4" />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ));

  return (
    <>
      {" "}
      <Helmet>
        <title>Chat</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="h-full rounded-lg bg-gradient-to-b from-[#0f0f0f] to-[#0f0f0f] overflow-hidden">
        {/*ПК*/}
        <div className="hidden lg:grid lg:grid-cols-[300px_1fr] h-[calc(100vh-180px)]">
          <UsersList
            onUserSelect={handleUserSelect}
            selectedUser={selectedUser}
            onlineUsers={onlineUsers}
            userActivities={userActivities}
          />
          <div className="flex flex-col h-full border-l border-[#2a2a2a]">
            {selectedUser ? (
              <>
                <ChatHeader />
                <ScrollArea className="overflow-y-auto h-[calc(100vh-340px)]">
                  <div className="p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 mt-8">
                        <p>
                          {t("pages.chat.startChatting")}{" "}
                          {selectedUser.fullName}!
                        </p>
                        <p className="text-sm">{t("pages.chat.noMessages")}</p>
                      </div>
                    ) : (
                      renderMessages()
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                <div className="px-4 pb-2 h-6">
                  {" "}
                  {isPartnerTyping && <TypingIndicator />}
                </div>
                <MessageInput
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onSend={handleSendMessage}
                  selectedUser={selectedUser}
                  currentUserId={mongoUser?.id || ""}
                />
              </>
            ) : (
              <NoConversationPlaceholder />
            )}
          </div>
        </div>
        {/*Мобилка*/}

        <div className="lg:hidden h-[calc(100vh-180px)] flex flex-col">
          {selectedUser ? (
            <div className="flex flex-col h-full">
              <ChatHeader showBackButton={true} onBack={handleBackToList} />
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                      <p>
                        {t("pages.chat.startChatting")} {selectedUser.fullName}!
                      </p>
                      <p className="text-sm">{t("pages.chat.noMessages")}</p>
                    </div>
                  ) : (
                    renderMessages()
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="px-4 pb-2 h-6">
                {" "}
                {isPartnerTyping && <TypingIndicator />}
              </div>
              <MessageInput
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                onSend={handleSendMessage}
                selectedUser={selectedUser}
                currentUserId={mongoUser?.id || ""}
              />
            </div>
          ) : (
            <div className="flex flex-col h-full items-center justify-center p-4">
              <NoConversationPlaceholder />
              <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                <SheetTrigger asChild>
                  <Button className="mt-8 bg-[#8b5cf6] hover:bg-[#7c3aed] mb-10">
                    <UsersIcon className="mr-2 h-4 w-4" />{" "}
                    {t("pages.chat.viewUsers")}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[300px] sm:w-[350px] p-0 bg-[#0f0f0f] border-r border-[#2a2a2a] text-white"
                >
                  <SheetTitle className="sr-only">Users List</SheetTitle>
                  <SheetDescription className="sr-only">
                    List of users for chat.
                  </SheetDescription>
                  <UsersList
                    onUserSelect={handleUserSelect}
                    selectedUser={selectedUser}
                    onlineUsers={onlineUsers}
                    userActivities={userActivities}
                  />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default ChatPage;

const NoConversationPlaceholder = () => {
  const { t } = useTranslation();
  const { isReduceMotionEnabled } = useAudioSettingsStore();

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
      <img
        src="/Moodify.svg"
        alt="Moodify"
        className={`size-16 ${isReduceMotionEnabled ? "" : "animate-bounce"}`}
      />
      <div className="text-center">
        <h3 className="text-zinc-300 text-lg font-medium mb-1">
          {t("pages.chat.noConversation")}
        </h3>
        <p className="text-zinc-500 text-sm">{t("pages.chat.chooseFriend")}</p>
      </div>
    </div>
  );
};
