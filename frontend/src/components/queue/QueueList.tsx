import React from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { Song } from "@/types";
import type { QueueSections } from "@/lib/queueDisplay";
import { Button } from "@/components/ui/button";
import {
  SortableQueueItem,
  QueueCurrentItem,
  type QueueItemDensity,
} from "@/components/queue/SortableQueueItem";
import { QueueDropdownItem } from "@/components/queue/QueueDropdownItem";

export type QueueListVariant = "dropdown" | "drawer";

interface QueueListProps {
  sections: QueueSections;
  upcomingLabel: string;
  variant: QueueListVariant;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  onRemoveSong: (songId: string, e: React.MouseEvent) => void;
  onPlaySong: (song: Song, e: React.MouseEvent) => void;
  onClearUserQueue?: () => void;
  density: QueueItemDensity;
}

function QueueSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-900/95 px-3 py-1.5 backdrop-blur-sm">
      <h4 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h4>
      {action}
    </div>
  );
}

function ClearUserQueueButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto shrink-0 px-1 py-0 text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:bg-transparent hover:text-white"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {t("player.queue.clear")}
    </Button>
  );
}

function QueueDropdownList({
  sections,
  upcomingLabel,
  onRemoveSong,
  onPlaySong,
  onClearUserQueue,
}: Pick<
  QueueListProps,
  | "sections"
  | "upcomingLabel"
  | "onRemoveSong"
  | "onPlaySong"
  | "onClearUserQueue"
>) {
  const { t } = useTranslation();
  const { current, userAdded, upcoming } = sections;

  const handleRemove = (songId: string) => {
    onRemoveSong(songId, { stopPropagation: () => {} } as React.MouseEvent);
  };

  return (
    <>
      {current && (
        <>
          <QueueSectionHeader title={t("player.queue.nowPlaying")} />
          <QueueDropdownItem
            song={current}
            isCurrent
            onPlay={onPlaySong}
            onRemove={handleRemove}
          />
        </>
      )}

      {(userAdded.length > 0 || upcoming.length > 0) && (
        <>
          {userAdded.length > 0 && (
            <>
              <QueueSectionHeader
                title={t("player.queue.nextInQueue")}
                action={
                  onClearUserQueue ? (
                    <ClearUserQueueButton onClick={onClearUserQueue} />
                  ) : undefined
                }
              />
              {userAdded.map((song) => (
                <QueueDropdownItem
                  key={song._id}
                  song={song}
                  onPlay={onPlaySong}
                  onRemove={handleRemove}
                />
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <QueueSectionHeader title={upcomingLabel} />
              {upcoming.map((song) => (
                <QueueDropdownItem
                  key={song._id}
                  song={song}
                  onPlay={onPlaySong}
                  onRemove={handleRemove}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function QueueDrawerList({
  sections,
  upcomingLabel,
  sensors,
  onDragEnd,
  onRemoveSong,
  onPlaySong,
  onClearUserQueue,
  density,
}: QueueListProps) {
  const { t } = useTranslation();
  const { current, userAdded, upcoming } = sections;
  const draggableSongs = [...userAdded, ...upcoming];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      {current && (
        <>
          <QueueSectionHeader title={t("player.queue.nowPlaying")} />
          <QueueCurrentItem
            song={current}
            density={density}
            onRemove={onRemoveSong}
            onPlay={onPlaySong}
          />
        </>
      )}

      {(userAdded.length > 0 || upcoming.length > 0) && (
        <SortableContext
          items={draggableSongs.map((song) => song._id)}
          strategy={verticalListSortingStrategy}
        >
          {userAdded.length > 0 && (
            <>
              <QueueSectionHeader
                title={t("player.queue.nextInQueue")}
                action={
                  onClearUserQueue ? (
                    <ClearUserQueueButton onClick={onClearUserQueue} />
                  ) : undefined
                }
              />
              {userAdded.map((song) => (
                <SortableQueueItem
                  key={song._id}
                  song={song}
                  density={density}
                  onRemove={onRemoveSong}
                  onPlay={onPlaySong}
                />
              ))}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <QueueSectionHeader title={upcomingLabel} />
              {upcoming.map((song) => (
                <SortableQueueItem
                  key={song._id}
                  song={song}
                  density={density}
                  onRemove={onRemoveSong}
                  onPlay={onPlaySong}
                />
              ))}
            </>
          )}
        </SortableContext>
      )}
    </DndContext>
  );
}

export const QueueList: React.FC<QueueListProps> = (props) => {
  if (props.variant === "dropdown") {
    return <QueueDropdownList {...props} />;
  }
  return <QueueDrawerList {...props} />;
};
