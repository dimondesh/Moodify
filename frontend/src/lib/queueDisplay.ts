import type { Song } from "@/types";
import { usePlayerStore } from "@/stores/usePlayerStore";

export function getQueueDisplaySongs(params: {
  queue: Song[];
  currentIndex: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  shuffleHistory: number[];
  shufflePointer: number;
  getNextSongsInShuffle: (count?: number) => Song[];
}): Song[] {
  const {
    queue,
    currentIndex,
    repeatMode,
    isShuffle,
    shuffleHistory,
    shufflePointer,
    getNextSongsInShuffle,
  } = params;

  if (queue.length === 0) return [];

  if (repeatMode === "one") {
    return [queue[currentIndex]].filter(Boolean);
  }

  if (isShuffle) {
    if (shuffleHistory.length === 0) {
      const nextSongs = getNextSongsInShuffle(20);
      return [queue[currentIndex], ...nextSongs].filter(Boolean);
    }

    const displaySongs: Song[] = [];
    const usedIds = new Set<string>();

    displaySongs.push(queue[currentIndex]);
    usedIds.add(queue[currentIndex]._id);

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

  const nextSongs = getNextSongsInShuffle(20);
  const allSongs = [queue[currentIndex], ...nextSongs].filter(Boolean);

  return allSongs.filter(
    (song, index, self) =>
      index === self.findIndex((s) => s._id === song._id),
  );
}

export function applyQueueDragReorder(params: {
  activeId: string;
  overId: string | undefined;
  displaySongs: Song[];
  queue: Song[];
  isShuffle: boolean;
  moveSongInQueue: (fromIndex: number, toIndex: number) => void;
}): void {
  const { activeId, overId, displaySongs, queue, isShuffle, moveSongInQueue } =
    params;

  if (!overId || activeId === overId) return;

  const oldDisplayIndex = displaySongs.findIndex((song) => song._id === activeId);
  const newDisplayIndex = displaySongs.findIndex((song) => song._id === overId);

  if (oldDisplayIndex === -1 || newDisplayIndex === -1) return;

  if (isShuffle) {
    const { shuffleHistory } = usePlayerStore.getState();
    const oldSong = displaySongs[oldDisplayIndex];
    const newSong = displaySongs[newDisplayIndex];

    const oldShuffleIndex = shuffleHistory.findIndex(
      (idx) => queue[idx]._id === oldSong._id,
    );
    const newShuffleIndex = shuffleHistory.findIndex(
      (idx) => queue[idx]._id === newSong._id,
    );

    if (oldShuffleIndex === -1 || newShuffleIndex === -1) return;

    const newShuffleHistory = [...shuffleHistory];
    const [movedIndex] = newShuffleHistory.splice(oldShuffleIndex, 1);
    newShuffleHistory.splice(newShuffleIndex, 0, movedIndex);
    usePlayerStore.setState({ shuffleHistory: newShuffleHistory });
    return;
  }

  const oldSong = displaySongs[oldDisplayIndex];
  const newSong = displaySongs[newDisplayIndex];
  const oldIndex = queue.findIndex((song) => song._id === oldSong._id);
  const newIndex = queue.findIndex((song) => song._id === newSong._id);

  if (oldIndex !== -1 && newIndex !== -1) {
    moveSongInQueue(oldIndex, newIndex);
  }
}
