import React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { QueueList } from "@/components/queue/QueueList";
import { useQueueList } from "@/hooks/useQueueList";

interface QueueDropdownProps {
  children: React.ReactNode;
}

export const QueueDropdown: React.FC<QueueDropdownProps> = ({ children }) => {
  const { t } = useTranslation();
  const {
    queue,
    displaySongs,
    sensors,
    onDragEnd,
    onRemoveSong,
    onPlaySong,
  } = useQueueList();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="end"
        className="w-80 bg-[#1a1a1a] border-[#2a2a2a] p-0 rounded-md shadow-lg"
      >
        {queue.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            {t("player.queue.empty")}
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-[#2a2a2a]">
              <h3 className="text-white font-semibold text-sm">
                {t("player.queue.title")} ({queue.length})
              </h3>
            </div>
            <ScrollArea className="h-64">
              <div className="p-2">
                <QueueList
                  displaySongs={displaySongs}
                  sensors={sensors}
                  onDragEnd={onDragEnd}
                  onRemoveSong={onRemoveSong}
                  onPlaySong={onPlaySong}
                  density="compact"
                />
              </div>
            </ScrollArea>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
