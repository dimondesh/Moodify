// src/components/QueueDrawer.tsx

import React from "react";
import { usePlayerStore } from "../stores/usePlayerStore";
import { Button } from "./ui/button";
import { Drawer } from "vaul";
import { ScrollArea } from "./ui/scroll-area";
import { useTranslation } from "react-i18next";
import { getArtistNames } from "@/lib/utils";
import { X, GripVertical, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Song } from "../types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface QueueDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SortableQueueItemProps {
  song: Song;
  index: number;
  isCurrent: boolean;
  onRemove: (songId: string, e: React.MouseEvent) => void;
  onPlay: (song: Song, e: React.MouseEvent) => void;
}

const SortableQueueItem: React.FC<SortableQueueItemProps> = ({
  song,
  index,
  isCurrent,
  onRemove,
  onPlay,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-md hover:bg-zinc-800 group cursor-pointer",
        isCurrent && "bg-[#8b5cf6]/20"
      )}
      onClick={(e) => onPlay(song, e)}
    >
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-gray-400 group-hover:text-white" />
      </div>

      <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden">
        <img
          src={song.imageUrl || "/default-song-cover.png"}
          alt={song.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-base font-medium truncate",
            isCurrent ? "text-[#8b5cf6]" : "text-white"
          )}
        >
          {song.title}
        </div>
        <div className="text-sm text-gray-400 truncate">
          {getArtistNames(Array.isArray(song.artist) ? song.artist : [], [])}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-sm text-gray-400">
          {formatDuration(song.duration)}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => onRemove(song._id, e)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const {
    queue,
    currentIndex,
    currentSong,
    isShuffle,
    repeatMode,
    removeFromQueue,
    moveSongInQueue,
    setCurrentSong,
    getNextSongsInShuffle,
  } = usePlayerStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleRemoveSong = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromQueue(songId);
  };

  const handlePlaySong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSong(song);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    console.log("Drag end:", { activeId: active.id, overId: over?.id });
    console.log(
      "Display songs:",
      displaySongs.map((s) => s._id)
    );
    console.log(
      "Queue:",
      queue.map((s) => s._id)
    );

    if (over && active.id !== over.id) {
      // Находим индексы в отображаемом списке
      const oldDisplayIndex = displaySongs.findIndex(
        (song) => song._id === active.id
      );
      const newDisplayIndex = displaySongs.findIndex(
        (song) => song._id === over.id
      );

      console.log("Display indices:", { oldDisplayIndex, newDisplayIndex });

      if (oldDisplayIndex !== -1 && newDisplayIndex !== -1) {
        // В режиме shuffle нужно обновлять shuffle history, а не queue
        if (isShuffle) {
          const { shuffleHistory, shufflePointer } = usePlayerStore.getState();

          // Находим позиции в shuffle history
          const oldSong = displaySongs[oldDisplayIndex];
          const newSong = displaySongs[newDisplayIndex];

          const oldShuffleIndex = shuffleHistory.findIndex(
            (idx) => queue[idx]._id === oldSong._id
          );
          const newShuffleIndex = shuffleHistory.findIndex(
            (idx) => queue[idx]._id === newSong._id
          );

          console.log("Shuffle indices:", { oldShuffleIndex, newShuffleIndex });

          if (oldShuffleIndex !== -1 && newShuffleIndex !== -1) {
            // Перемещаем в shuffle history
            const newShuffleHistory = [...shuffleHistory];
            const [movedIndex] = newShuffleHistory.splice(oldShuffleIndex, 1);
            newShuffleHistory.splice(newShuffleIndex, 0, movedIndex);

            // Обновляем shuffle history в store
            usePlayerStore.setState({ shuffleHistory: newShuffleHistory });

            console.log("Updated shuffle history:", newShuffleHistory);
          }
        } else {
          // В обычном режиме перемещаем в queue
          const oldSong = displaySongs[oldDisplayIndex];
          const newSong = displaySongs[newDisplayIndex];

          const oldIndex = queue.findIndex((song) => song._id === oldSong._id);
          const newIndex = queue.findIndex((song) => song._id === newSong._id);

          console.log("Queue indices:", { oldIndex, newIndex });

          if (oldIndex !== -1 && newIndex !== -1) {
            console.log("Moving song from", oldIndex, "to", newIndex);
            moveSongInQueue(oldIndex, newIndex);
          } else {
            console.warn("Could not find songs in queue:", {
              oldIndex,
              newIndex,
            });
          }
        }
      } else {
        console.warn("Could not find songs in display list:", {
          oldDisplayIndex,
          newDisplayIndex,
        });
      }
    }
  };

  // Получаем правильную последовательность треков для отображения
  const getDisplaySongs = () => {
    if (queue.length === 0) return [];

    // Если режим повтора "one", показываем только текущий трек
    if (repeatMode === "one") {
      return [queue[currentIndex]].filter(Boolean);
    }

    // В режиме shuffle показываем треки в порядке shuffle history
    if (isShuffle) {
      const { shuffleHistory, shufflePointer } = usePlayerStore.getState();

      if (shuffleHistory.length === 0) {
        // Если shuffle history пуст, показываем обычный порядок
        const nextSongs = getNextSongsInShuffle(20);
        return [queue[currentIndex], ...nextSongs].filter(Boolean);
      }

      // Создаем массив треков в порядке shuffle history, начиная с текущего
      const displaySongs = [];
      const usedIds = new Set<string>();

      // Добавляем текущий трек
      displaySongs.push(queue[currentIndex]);
      usedIds.add(queue[currentIndex]._id);

      // Добавляем следующие треки в порядке shuffle history
      let currentPointer = shufflePointer;
      for (let i = 0; i < shuffleHistory.length - 1; i++) {
        currentPointer = (currentPointer + 1) % shuffleHistory.length;
        const songIndex = shuffleHistory[currentPointer];

        if (songIndex < queue.length) {
          const song = queue[songIndex];
          if (!usedIds.has(song._id)) {
            displaySongs.push(song);
            usedIds.add(song._id);
          }
        }
      }

      return displaySongs;
    }

    // В обычном режиме показываем текущий трек + следующие
    const nextSongs = getNextSongsInShuffle(20);
    const allSongs = [queue[currentIndex], ...nextSongs].filter(Boolean);

    // Удаляем дубликаты по ID
    const uniqueSongs = allSongs.filter(
      (song, index, self) => index === self.findIndex((s) => s._id === song._id)
    );

    return uniqueSongs;
  };

  const displaySongs = getDisplaySongs();

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
              <div className="flex items-center gap-2">
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
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {t("player.queue.empty")}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={displaySongs.map((song) => song._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {displaySongs.map((song, index) => {
                      // Первый трек в списке всегда текущий
                      const isCurrent = index === 0;
                      return (
                        <SortableQueueItem
                          key={song._id}
                          song={song}
                          index={index}
                          isCurrent={isCurrent}
                          onRemove={handleRemoveSong}
                          onPlay={handlePlaySong}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};
