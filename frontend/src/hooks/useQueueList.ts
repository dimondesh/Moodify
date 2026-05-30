import { useCallback, useMemo, type MouseEvent } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import { usePlayerStore } from "@/stores/usePlayerStore";
import type { Song } from "@/types";
import {
  applyQueueDragReorder,
  getQueueDisplaySongs,
  getQueueSections,
} from "@/lib/queueDisplay";

export function useQueueList() {
  const { t } = useTranslation();
  const queue = usePlayerStore((s) => s.queue);
  const userQueue = usePlayerStore((s) => s.userQueue);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const shuffleHistory = usePlayerStore((s) => s.shuffleHistory);
  const shufflePointer = usePlayerStore((s) => s.shufflePointer);
  const currentPlaybackContext = usePlayerStore((s) => s.currentPlaybackContext);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const moveSongInQueue = usePlayerStore((s) => s.moveSongInQueue);
  const moveSongInUserQueue = usePlayerStore((s) => s.moveSongInUserQueue);
  const promoteUpcomingToUserQueue = usePlayerStore(
    (s) => s.promoteUpcomingToUserQueue,
  );
  const demoteUserQueueToUpcoming = usePlayerStore(
    (s) => s.demoteUserQueueToUpcoming,
  );
  const clearUserQueue = usePlayerStore((s) => s.clearUserQueue);
  const setCurrentSong = usePlayerStore((s) => s.setCurrentSong);
  const getNextSongsInShuffle = usePlayerStore((s) => s.getNextSongsInShuffle);

  const isShuffle = shuffleMode !== "off";

  const sectionParams = useMemo(
    () => ({
      queue,
      userQueue,
      currentSong,
      currentIndex,
      repeatMode,
      isShuffle,
      shuffleHistory,
      shufflePointer,
      getNextSongsInShuffle,
    }),
    [
      queue,
      userQueue,
      currentSong,
      currentIndex,
      repeatMode,
      isShuffle,
      shuffleHistory,
      shufflePointer,
      getNextSongsInShuffle,
    ],
  );

  const queueSections = useMemo(
    () => getQueueSections(sectionParams),
    [sectionParams],
  );

  const displaySongs = useMemo(
    () => getQueueDisplaySongs(sectionParams),
    [sectionParams],
  );

  const upcomingLabel = useMemo(() => {
    const title = currentPlaybackContext?.entityTitle;
    if (title) {
      return t("player.queue.nextFrom", { title });
    }
    return t("player.queue.upNext");
  }, [currentPlaybackContext?.entityTitle, t]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      applyQueueDragReorder({
        activeId: String(event.active.id),
        overId: event.over ? String(event.over.id) : undefined,
        sections: queueSections,
        queue,
        isShuffle,
        moveSongInQueue,
        moveSongInUserQueue,
        promoteUpcomingToUserQueue,
        demoteUserQueueToUpcoming,
      });
    },
    [
      queueSections,
      queue,
      isShuffle,
      moveSongInQueue,
      moveSongInUserQueue,
      promoteUpcomingToUserQueue,
      demoteUserQueueToUpcoming,
    ],
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

  const onClearUserQueue = useCallback(() => {
    clearUserQueue();
  }, [clearUserQueue]);

  return {
    queue,
    queueSections,
    displaySongs,
    upcomingLabel,
    sensors,
    onDragEnd,
    onRemoveSong,
    onPlaySong,
    onClearUserQueue,
  };
}
