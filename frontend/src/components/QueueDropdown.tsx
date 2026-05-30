import React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
      <DropdownMenuContent side="top" align="end" className="w-80 overflow-hidden p-0">
        {queue.length === 0 ? (
          <div className="px-3 py-4 text-center text-zinc-400">
            {t("player.queue.empty")}
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-800 px-3 py-2">
              <h3 className="text-sm font-semibold text-zinc-100">
                {t("player.queue.title")} ({displaySongs.length})
              </h3>
            </div>
            <div
              className="max-h-64 overflow-y-auto overscroll-contain hide-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              <QueueList
                displaySongs={displaySongs}
                sensors={sensors}
                onDragEnd={onDragEnd}
                onRemoveSong={onRemoveSong}
                onPlaySong={onPlaySong}
                density="compact"
              />
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
