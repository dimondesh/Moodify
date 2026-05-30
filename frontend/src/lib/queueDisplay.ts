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

  if (queue.length === 0 || currentIndex < 0) return [];

  const current = queue[currentIndex];
  if (!current) return [];

  if (repeatMode === "one") {
    return [current];
  }

  if (isShuffle) {
    if (shuffleHistory.length === 0) {
      const upcoming = getNextSongsInShuffle(queue.length);
      return [current, ...upcoming.filter((song) => song._id !== current._id)];
    }

    const displaySongs: Song[] = [current];
    const usedIds = new Set<string>([current._id]);

    let pointer = shufflePointer;
    for (let i = 0; i < shuffleHistory.length - 1; i++) {
      pointer = (pointer + 1) % shuffleHistory.length;
      const songIndex = shuffleHistory[pointer];
      if (songIndex >= 0 && songIndex < queue.length) {
        const song = queue[songIndex];
        if (!usedIds.has(song._id)) {
          displaySongs.push(song);
          usedIds.add(song._id);
        }
      }
    }

    return displaySongs;
  }

  if (repeatMode === "all") {
    return [...queue.slice(currentIndex), ...queue.slice(0, currentIndex)];
  }

  return queue.slice(currentIndex);
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
