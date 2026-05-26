import { useCallback, useMemo, type MouseEvent } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { Song } from "@/types";
import { applyQueueDragReorder, getQueueDisplaySongs } from "@/lib/queueDisplay";

export function useQueueList() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffleHistory = usePlayerStore((s) => s.shuffleHistory);
  const shufflePointer = usePlayerStore((s) => s.shufflePointer);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveSongInQueue = usePlayerStore((s) => s.moveSongInQueue);
  const setCurrentSong = usePlayerStore((s) => s.setCurrentSong);
  const getNextSongsInShuffle = usePlayerStore((s) => s.getNextSongsInShuffle);

  const displaySongs = useMemo(
    () =>
      getQueueDisplaySongs({
        queue,
        currentIndex,
        repeatMode,
        isShuffle,
        shuffleHistory,
        shufflePointer,
        getNextSongsInShuffle,
      }),
    [
      queue,
      currentIndex,
      repeatMode,
      isShuffle,
      shuffleHistory,
      shufflePointer,
      getNextSongsInShuffle,
    ],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      applyQueueDragReorder({
        activeId: String(event.active.id),
        overId: event.over ? String(event.over.id) : undefined,
        displaySongs,
        queue,
        isShuffle,
        moveSongInQueue,
      });
    },
    [displaySongs, queue, isShuffle, moveSongInQueue],
  );

  const onRemoveSong = useCallback(
    (songId: string, e: MouseEvent) => {
      e.stopPropagation();
      removeFromQueue(songId);
    },
    [removeFromQueue],
  );

  const onPlaySong = useCallback(
    (song: Song, e: MouseEvent) => {
      e.stopPropagation();
      setCurrentSong(song);
    },
    [setCurrentSong],
  );

  return {
    queue,
    displaySongs,
    sensors,
    onDragEnd,
    onRemoveSong,
    onPlaySong,
  };
}
