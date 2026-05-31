import React from "react";
import { Drawer } from "vaul";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
    queueSections,
    displaySongs,
    upcomingLabel,
    sensors,
    onDragEnd,
    onRemoveSong,
    onPlaySong,
    onClearUserQueue,
  } = useQueueList();

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[85dvh] min-h-0 flex-col overflow-hidden rounded-t-lg border-0 bg-zinc-900 text-zinc-100 outline-none"
        >
          <Drawer.Title className="sr-only">
            {t("player.queue.title")}
          </Drawer.Title>

          <div className="flex shrink-0 cursor-grab select-none items-center gap-2 border-b border-zinc-800 px-3 py-2 active:cursor-grabbing">
            <Drawer.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-vaul-no-drag
                className="size-9 shrink-0 text-zinc-400 hover:text-white"
                aria-label={t("player.close")}
              >
                <ChevronDown className="size-5" />
              </Button>
            </Drawer.Close>
            <h2 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-zinc-100">
              {t("player.queue.title")} ({displaySongs.length})
            </h2>
            <div className="size-9 shrink-0" aria-hidden />
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain hide-scrollbar [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag
            onWheel={(e) => e.stopPropagation()}
          >
            {queue.length === 0 ? (
              <div className="px-3 py-8 text-center text-zinc-400">
                {t("player.queue.empty")}
              </div>
            ) : (
              <QueueList
                sections={queueSections}
                upcomingLabel={upcomingLabel}
                variant="drawer"
                sensors={sensors}
                onDragEnd={onDragEnd}
                onRemoveSong={onRemoveSong}
                onPlaySong={onPlaySong}
                onClearUserQueue={onClearUserQueue}
                density="comfortable"
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
