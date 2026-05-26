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
import type { Song } from "@/types";
import {
  SortableQueueItem,
  type QueueItemDensity,
} from "@/components/queue/SortableQueueItem";

interface QueueListProps {
  displaySongs: Song[];
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  onRemoveSong: (songId: string, e: React.MouseEvent) => void;
  onPlaySong: (song: Song, e: React.MouseEvent) => void;
  density: QueueItemDensity;
}

export const QueueList: React.FC<QueueListProps> = ({
  displaySongs,
  sensors,
  onDragEnd,
  onRemoveSong,
  onPlaySong,
  density,
}) => (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={onDragEnd}
  >
    <SortableContext
      items={displaySongs.map((song) => song._id)}
      strategy={verticalListSortingStrategy}
    >
      {displaySongs.map((song, index) => (
        <SortableQueueItem
          key={song._id}
          song={song}
          isCurrent={index === 0}
          density={density}
          onRemove={onRemoveSong}
          onPlay={onPlaySong}
        />
      ))}
    </SortableContext>
  </DndContext>
);
