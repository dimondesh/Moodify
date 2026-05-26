import React from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { QueueList } from "@/components/queue/QueueList";
import { useQueueList } from "@/hooks/useQueueList";

interface QueueDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onOpenChange,
}) => {
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
    <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed bg-black/40 z-[70] max-w-none" />
        <Drawer.Content
          aria-describedby={undefined}
          className="bg-zinc-950 flex flex-col rounded-t-[10px] w-auto max-w-none h-[70vh] mt-24 min-w-screen overflow-hidden fixed bottom-0 left-0 right-0 z-[70]"
        >
          <Drawer.Title className="sr-only">
            {t("player.queue.title")}
          </Drawer.Title>
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">
                {t("player.queue.title")} ({queue.length})
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {t("player.queue.empty")}
                </div>
              ) : (
                <QueueList
                  displaySongs={displaySongs}
                  sensors={sensors}
                  onDragEnd={onDragEnd}
                  onRemoveSong={onRemoveSong}
                  onPlaySong={onPlaySong}
                  density="comfortable"
                />
              )}
            </div>
          </ScrollArea>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
